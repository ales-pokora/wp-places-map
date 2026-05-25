/* global google, markerClusterer */
/**
 * Places Map – frontend.
 *
 * Reads window.WPPMInstances (array of config objects produced by the shortcode)
 * and renders one Google Map per entry once the Maps SDK has loaded.
 */
(function () {
	'use strict';

	const STYLES = {
		light: [
			{ elementType: 'geometry', stylers: [{ color: '#f5f8fa' }] },
			{ elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
			{ elementType: 'labels.text.fill', stylers: [{ color: '#647387' }] },
			{ elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
			{ featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#cbd5dd' }] },
			{ featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
			{ featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#1b2b3a' }] },
			{ featureType: 'poi', stylers: [{ visibility: 'off' }] },
			{ featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
			{ featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
			{ featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#647387' }] },
			{ featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e8ebef' }] },
			{ featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#1b2b3a' }] },
			{ featureType: 'transit', stylers: [{ visibility: 'off' }] },
			{ featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d6f1fb' }] },
			{ featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#0a6fa0' }] },
		],
		silver: [
			{ elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
			{ elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
			{ elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
			{ elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
			{ featureType: 'poi', stylers: [{ visibility: 'off' }] },
			{ featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
			{ featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e7f4' }] },
		],
		default: null,
	};

	const TYPE_ICONS = {
		'prakticky-lekar': '⚕', // ⚕
		nemocnice: '🏥', // 🏥
		ambulance: '⚕',
		lekarna: '⚚', // ⚚
	};

	let mapsReady = false;
	const pendingInstances = [];

	function markerSvgDataUri(color) {
		const c = color || '#41C8F4';
		const svg =
			'<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">' +
			'<defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%">' +
			'<feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#000" flood-opacity="0.25"/></filter></defs>' +
			'<path filter="url(#s)" fill="' + c + '" d="M17 0C7.6 0 0 7.6 0 17c0 12 17 27 17 27s17-15 17-27C34 7.6 26.4 0 17 0z"/>' +
			'<circle cx="17" cy="17" r="7" fill="#ffffff"/>' +
			'</svg>';
		return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
	}

	function clusterSizeFor(count) {
		return count < 10 ? 56 : count < 50 ? 68 : count < 200 ? 82 : 96;
	}

	function clusterRendererFactory(brandColor) {
		return {
			render: function (cluster) {
				const count = cluster.count;
				const position = cluster.position;
				const size = clusterSizeFor(count);
				const r = (size / 2) - 6;
				const fontSize = Math.max(15, Math.round(size * 0.36));
				const svg = window.btoa(
					'<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
						'<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="' + brandColor + '"/>' +
						'<text x="50%" y="50%" dy=".34em" text-anchor="middle" fill="white" ' +
							'font-family="Inter, system-ui, -apple-system, Segoe UI, sans-serif" ' +
							'font-size="' + fontSize + '" font-weight="700" letter-spacing="-0.5">' + count + '</text>' +
					'</svg>'
				);
				return new google.maps.Marker({
					position: position,
					icon: {
						url: 'data:image/svg+xml;base64,' + svg,
						scaledSize: new google.maps.Size(size, size),
						anchor: new google.maps.Point(size / 2, size / 2),
					},
					zIndex: 1000 + count,
					title: count + ' zařízení',
				});
			},
		};
	}

	function escapeHtml(s) {
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	function hostnameOf(url) {
		try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; }
	}

	function createDetailModal() {
		const modal = document.createElement('div');
		modal.className = 'wppm-modal';
		modal.setAttribute('role', 'dialog');
		modal.setAttribute('aria-modal', 'true');
		modal.setAttribute('aria-labelledby', 'wppm-modal-title-' + Math.random().toString(36).slice(2, 8));
		modal.hidden = true;
		modal.innerHTML =
			'<div class="wppm-modal-backdrop" data-wppm-close></div>' +
			'<div class="wppm-modal-card" role="document">' +
				'<div class="wppm-modal-hero">' +
					'<div class="wppm-modal-hero-blob" aria-hidden="true"></div>' +
					'<div class="wppm-modal-hero-image" aria-hidden="true"></div>' +
					'<button type="button" class="wppm-modal-close" data-wppm-close aria-label="Zavřít detail">' +
						'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">' +
							'<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>' +
					'</button>' +
				'</div>' +
				'<div class="wppm-modal-body">' +
					'<span class="wppm-modal-badge" hidden></span>' +
					'<h2 class="wppm-modal-title" id="' + modal.getAttribute('aria-labelledby') + '"></h2>' +
					'<p class="wppm-modal-addr" hidden></p>' +
					'<p class="wppm-modal-region" hidden></p>' +
					'<p class="wppm-modal-desc" hidden></p>' +
					'<div class="wppm-modal-meta"></div>' +
					'<div class="wppm-modal-actions"></div>' +
				'</div>' +
			'</div>';
		return modal;
	}

	function renderDetailModal(modal, facility, i18n, regions) {
		const card = modal.querySelector('.wppm-modal-card');
		const badge = modal.querySelector('.wppm-modal-badge');
		const title = modal.querySelector('.wppm-modal-title');
		const addr = modal.querySelector('.wppm-modal-addr');
		const region = modal.querySelector('.wppm-modal-region');
		const desc = modal.querySelector('.wppm-modal-desc');
		const meta = modal.querySelector('.wppm-modal-meta');
		const actions = modal.querySelector('.wppm-modal-actions');
		const heroImg = modal.querySelector('.wppm-modal-hero-image');

		// Hero: thumbnail if available, otherwise leave the blob gradient.
		if (facility.image) {
			heroImg.style.backgroundImage = 'url(' + JSON.stringify(facility.image).slice(1, -1) + ')';
			heroImg.classList.add('has-image');
			card.classList.add('has-image');
		} else {
			heroImg.style.backgroundImage = '';
			heroImg.classList.remove('has-image');
			card.classList.remove('has-image');
		}

		if (facility.type_label) {
			badge.textContent = facility.type_label;
			badge.hidden = false;
		} else {
			badge.hidden = true;
		}

		title.textContent = facility.title || '';

		const addrLine = [facility.address, [facility.zip, facility.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
		if (addrLine) {
			addr.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
				'<span></span>';
			addr.querySelector('span').textContent = addrLine;
			addr.hidden = false;
		} else {
			addr.hidden = true;
		}

		if (facility.region && regions && regions[facility.region]) {
			region.textContent = regions[facility.region].name;
			region.hidden = false;
		} else {
			region.hidden = true;
		}

		if (facility.description) {
			desc.textContent = facility.description;
			desc.hidden = false;
		} else {
			desc.hidden = true;
		}

		// Meta rows (phone, email, web, hours).
		meta.innerHTML = '';
		const rows = [];
		if (facility.phone) {
			rows.push({
				icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z"/></svg>',
				label: i18n.phone,
				value: facility.phone,
				href: 'tel:' + facility.phone.replace(/\s+/g, ''),
			});
		}
		if (facility.email) {
			rows.push({
				icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6L12 13 2 6"/></svg>',
				label: i18n.email,
				value: facility.email,
				href: 'mailto:' + facility.email,
			});
		}
		if (facility.website) {
			rows.push({
				icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
				label: i18n.web,
				value: hostnameOf(facility.website),
				href: facility.website,
				external: true,
			});
		}
		if (facility.hours) {
			rows.push({
				icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
				label: i18n.hours,
				value: facility.hours,
				pre: true,
			});
		}
		rows.forEach((row) => {
			const item = document.createElement('div');
			item.className = 'wppm-modal-meta-row' + (row.pre ? ' is-pre' : '');
			const labelHtml = '<span class="wppm-modal-meta-label">' + escapeHtml(row.label) + '</span>';
			const valueHtml = row.pre
				? '<pre class="wppm-modal-meta-pre"></pre>'
				: (row.href
					? '<a class="wppm-modal-meta-value" href="' + escapeHtml(row.href) + '"' + (row.external ? ' target="_blank" rel="noopener"' : '') + '></a>'
					: '<span class="wppm-modal-meta-value"></span>');
			item.innerHTML =
				'<span class="wppm-modal-meta-icon">' + row.icon + '</span>' +
				'<span class="wppm-modal-meta-text">' + labelHtml + valueHtml + '</span>';
			item.querySelector('.wppm-modal-meta-value, .wppm-modal-meta-pre').textContent = row.value;
			meta.appendChild(item);
		});

		// Actions: primary "Navigate" + secondaries (Call, Email, Web).
		actions.innerHTML = '';
		const destParts = [facility.title, addrLine].filter(Boolean).join(', ');
		const dest = encodeURIComponent(destParts || (facility.lat + ',' + facility.lng));

		const cta = document.createElement('a');
		cta.className = 'wppm-modal-cta';
		cta.href = 'https://www.google.com/maps/dir/?api=1&destination=' + dest;
		cta.target = '_blank';
		cta.rel = 'noopener';
		cta.innerHTML =
			'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>' +
			'<span></span>';
		cta.querySelector('span').textContent = i18n.navigate;
		actions.appendChild(cta);

		// Optional secondary actions.
		const secondaries = [];
		if (facility.phone) secondaries.push({ label: i18n.phone, href: 'tel:' + facility.phone.replace(/\s+/g, '') });
		if (facility.email) secondaries.push({ label: i18n.email, href: 'mailto:' + facility.email });
		if (facility.website) secondaries.push({ label: i18n.web, href: facility.website, external: true });

		if (secondaries.length) {
			const row = document.createElement('div');
			row.className = 'wppm-modal-actions-secondary';
			secondaries.forEach((s) => {
				const a = document.createElement('a');
				a.className = 'wppm-modal-action';
				a.href = s.href;
				if (s.external) { a.target = '_blank'; a.rel = 'noopener'; }
				a.textContent = s.label;
				row.appendChild(a);
			});
			actions.appendChild(row);
		}
	}

	function bootInstance(config) {
		const wrap = document.getElementById(config.id);
		if (!wrap) return;

		const canvas = wrap.querySelector('.wppm-map');
		const loading = wrap.querySelector('.wppm-loading');
		if (!canvas) return;

		function hideLoading() {
			if (loading) loading.style.display = 'none';
		}

		function showError(err) {
			if (loading) {
				loading.innerHTML = '<span class="wppm-error-inline">' + config.i18n.error + '</span>';
				loading.style.pointerEvents = 'auto';
			}
			if (window.console) window.console.error('[WPPM]', err);
		}

		if (typeof google === 'undefined' || !google.maps) {
			showError(new Error('Google Maps SDK not available'));
			return;
		}

		let map;
		try {
			map = new google.maps.Map(canvas, {
				center: config.center,
				zoom: config.zoom,
				styles: STYLES[config.mapStylePreset] || STYLES.light,
				mapTypeControl: false,
				streetViewControl: false,
				fullscreenControl: true,
				gestureHandling: 'cooperative',
			});
		} catch (err) {
			showError(err);
			return;
		}

		const markerIcon = {
			url: markerSvgDataUri(config.brandColor),
			scaledSize: new google.maps.Size(34, 44),
			anchor: new google.maps.Point(17, 44),
		};

		// Build detail modal once, append to <body> so transformed ancestors
		// (e.g. Divi sections) don't break position: fixed.
		const detailModal = createDetailModal();
		document.body.appendChild(detailModal);

		let lastFocused = null;

		function openDetail(facility) {
			renderDetailModal(detailModal, facility, config.i18n, allRegions || {});
			lastFocused = document.activeElement;
			detailModal.hidden = false;
			// Force reflow so the transition runs from initial state.
			void detailModal.offsetWidth;
			detailModal.classList.add('is-open');
			document.body.classList.add('wppm-modal-locked');
			// Defer focus so transition starts smoothly.
			setTimeout(function () {
				const closeBtn = detailModal.querySelector('.wppm-modal-close');
				if (closeBtn) closeBtn.focus();
			}, 50);
		}

		function closeDetail() {
			if (detailModal.hidden) return;
			detailModal.classList.remove('is-open');
			document.body.classList.remove('wppm-modal-locked');
			// Wait for transition before hiding entirely.
			setTimeout(function () {
				detailModal.hidden = true;
				if (lastFocused && typeof lastFocused.focus === 'function') {
					lastFocused.focus();
				}
			}, 220);
		}

		detailModal.addEventListener('click', function (e) {
			if (e.target.closest('[data-wppm-close]')) {
				closeDetail();
			}
		});
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && !detailModal.hidden) closeDetail();
		});

		let allFacilities = [];
		let allRegions = null; // { slug: { name, polys: [google.maps.Polygon] } }
		let regionCounts = {};
		let markers = [];
		let cluster = null;
		let activeFilter = config.typeFilter || '';
		let activeRegionFilter = '';
		let activeQuery = '';
		let selectedFeature = null; // map.data feature currently active
		let haloOverlays = [];      // WPPMHalo[] anchored to current cluster positions
		let glowSchedulerStarted = false;

		// --- Halo OverlayView for pulsing glow on cluster bubbles ----------

		class WPPMHalo extends google.maps.OverlayView {
			constructor(position, size) {
				super();
				this.position = position;
				this.size = size;
				this.div = null;
			}
			onAdd() {
				this.div = document.createElement('div');
				this.div.className = 'wppm-cluster-halo';
				const haloSize = Math.round(this.size * 2.4);
				this.div.style.width = haloSize + 'px';
				this.div.style.height = haloSize + 'px';
				const panes = this.getPanes();
				// overlayLayer is below markerLayer so the actual cluster marker stays clickable.
				(panes && (panes.overlayLayer || panes.markerLayer || panes.floatPane) || document.body)
					.appendChild(this.div);
			}
			draw() {
				if (!this.div) return;
				const proj = this.getProjection();
				if (!proj) return;
				const px = proj.fromLatLngToDivPixel(this.position);
				if (!px) return;
				const w = this.div.offsetWidth || 0;
				const h = this.div.offsetHeight || 0;
				this.div.style.left = (px.x - w / 2) + 'px';
				this.div.style.top = (px.y - h / 2) + 'px';
			}
			onRemove() {
				if (this.div && this.div.parentNode) {
					this.div.parentNode.removeChild(this.div);
				}
				this.div = null;
			}
			pulse() {
				if (!this.div) return;
				this.div.classList.remove('is-pulsing');
				void this.div.offsetWidth; // force reflow so animation restarts
				this.div.classList.add('is-pulsing');
			}
		}

		function syncHalos() {
			haloOverlays.forEach((h) => h.setMap(null));
			haloOverlays = [];
			if (!cluster || !cluster.clusters) return;
			cluster.clusters.forEach((c) => {
				if (!c || !c.position) return;
				const count = c.count || (c.markers ? c.markers.length : 0);
				if (count <= 1) return;
				const halo = new WPPMHalo(c.position, clusterSizeFor(count));
				halo.setMap(map);
				haloOverlays.push(halo);
			});
		}

		function startGlowSchedulers() {
			if (glowSchedulerStarted) return;
			glowSchedulerStarted = true;
			// Two independent slots: at any moment at most 2 halos are pulsing.
			// Each slot picks a random halo, pulses it, waits (animation + jitter), picks again.
			function slot(initialDelay) {
				setTimeout(function tick() {
					if (haloOverlays.length === 0) {
						setTimeout(tick, 1500);
						return;
					}
					const pick = haloOverlays[Math.floor(Math.random() * haloOverlays.length)];
					pick.pulse();
					setTimeout(tick, 2400 + Math.floor(Math.random() * 700));
				}, initialDelay);
			}
			slot(0);
			slot(1100); // offset second slot so the two pulses don't sync up
		}

		// Diacritic-insensitive lowercase for fuzzy text matching.
		// "Pardubické" and "Pardubicke" both normalise to "pardubicke".
		function normalize(s) {
			return String(s == null ? '' : s)
				.toLowerCase()
				.normalize('NFD')
				.replace(/[̀-ͯ]/g, '');
		}

		// Tooltip element for region hover.
		const tooltip = document.createElement('div');
		tooltip.className = 'wppm-tooltip';
		tooltip.hidden = true;
		canvas.appendChild(tooltip);

		// Active-region chip above the map ("Kraj: Pardubický × Clear").
		const regionBar = document.createElement('div');
		regionBar.className = 'wppm-region-bar';
		regionBar.hidden = true;
		wrap.insertBefore(regionBar, wrap.querySelector('.wppm-canvas'));

		// Track DOM mouse position over the map for tooltip placement.
		let mouseX = 0, mouseY = 0;
		canvas.addEventListener('mousemove', function (e) {
			const r = canvas.getBoundingClientRect();
			mouseX = e.clientX - r.left;
			mouseY = e.clientY - r.top;
			if (!tooltip.hidden) positionTooltip();
		}, { passive: true });

		function positionTooltip() {
			const r = canvas.getBoundingClientRect();
			const tw = tooltip.offsetWidth;
			const th = tooltip.offsetHeight;
			let x = mouseX + 14;
			let y = mouseY + 14;
			if (x + tw > r.width - 8) x = mouseX - tw - 14;
			if (y + th > r.height - 8) y = mouseY - th - 14;
			tooltip.style.transform = 'translate(' + x + 'px,' + y + 'px)';
		}

		function showTooltip(html) {
			tooltip.innerHTML = html;
			tooltip.hidden = false;
			positionTooltip();
		}

		function hideTooltip() {
			tooltip.hidden = true;
		}

		function renderRegionBar(slug, name) {
			if (!slug) {
				regionBar.hidden = true;
				regionBar.innerHTML = '';
				return;
			}
			regionBar.hidden = false;
			regionBar.innerHTML =
				'<span class="wppm-region-bar-label">' + escapeHtmlSafe(config.i18n.regionLabel) + '</span>' +
				'<strong class="wppm-region-bar-name"></strong>' +
				'<button type="button" class="wppm-region-bar-clear" aria-label="' + escapeHtmlSafe(config.i18n.clearRegion) + '">×</button>';
			regionBar.querySelector('.wppm-region-bar-name').textContent = name;
			regionBar.querySelector('.wppm-region-bar-clear').addEventListener('click', function () {
				applyFilter(activeFilter, '');
				renderRegionBar('', '');
				clearSelectedRegion();
				// Always restore the CZ-wide configured view when the user clears a region.
				map.setCenter(config.center);
				map.setZoom(config.zoom);
			});
		}

		function clearSelectedRegion() {
			if (selectedFeature) {
				try { map.data.revertStyle(selectedFeature); } catch (e) { /* noop */ }
				selectedFeature = null;
			}
		}

		function escapeHtmlSafe(s) {
			return String(s == null ? '' : s)
				.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
		}

		function clearMarkers() {
			if (cluster) {
				cluster.clearMarkers();
				cluster = null;
			}
			haloOverlays.forEach((h) => h.setMap(null));
			haloOverlays = [];
			markers.forEach((m) => m.setMap(null));
			markers = [];
		}

		function renderMarkers(list) {
			clearMarkers();

			list.forEach((f) => {
				const marker = new google.maps.Marker({
					position: { lat: f.lat, lng: f.lng },
					title: f.title,
					icon: markerIcon,
					optimized: true,
				});
				marker.addListener('click', () => openDetail(f));
				markers.push(marker);
			});

			// Clustering is disabled when a region is the active filter. Inside a kraj the
			// user is drilling down — collapsing two nearby places into a "2" bubble hides
			// exactly the detail they came for. (Pardubický's two places fall in separate
			// towns so they never clustered to start with; Jihočeský's two are close enough
			// to cluster at the zoom fitBounds picks, which is what made the behaviour look
			// inconsistent.)
			const allowCluster = config.cluster && !activeRegionFilter;
			if (allowCluster && window.markerClusterer && markers.length > 1) {
				cluster = new window.markerClusterer.MarkerClusterer({
					map,
					markers,
					renderer: clusterRendererFactory(config.clusterColor),
					// When a cluster bubble visually covers a small kraj (Praha is the obvious
					// case — at zoom 7 the 56px bubble is wider than the polygon), clicking
					// the bubble should drill into that kraj rather than zoom-to-fit two pins
					// half a km apart. We do the lookup against region polygons; if the cluster
					// centre lies inside one, activateRegion handles the rest.
					onClusterClick: (_evt, c, m) => {
						const pos = c && c.position;
						if (pos && allRegions && google.maps.geometry && google.maps.geometry.poly) {
							for (const slug in allRegions) {
								if (!Object.prototype.hasOwnProperty.call(allRegions, slug)) continue;
								const polys = allRegions[slug].polys;
								for (let i = 0; i < polys.length; i++) {
									if (google.maps.geometry.poly.containsLocation(pos, polys[i])) {
										activateRegion(slug);
										return;
									}
								}
							}
						}
						// Cluster outside any known polygon (shouldn't happen on CZ data but
						// keep MarkerClusterer's default fallback for safety).
						if (c && c.bounds) m.fitBounds(c.bounds);
					},
				});
				// Re-sync halo positions every time MarkerClusterer recomputes (zoom/pan).
				try {
					cluster.addListener('clusteringend', syncHalos);
				} catch (e) { /* older MC versions: best-effort */ }
				// Initial sync — clusteringend doesn't always fire synchronously on construction.
				setTimeout(syncHalos, 80);
				startGlowSchedulers();
			} else if (markers.length) {
				markers.forEach((m) => m.setMap(map));
				// No clustering → drop any halos still on the map.
				haloOverlays.forEach((h) => h.setMap(null));
				haloOverlays = [];
			}

			// Keep the configured CZ-wide view by default. fitBounds is only triggered
			// explicitly by region clicks (see initRegionLayer) or when the user clears
			// a region filter — never on the initial render or generic filter change.
		}

		function filterFacilities(typeSlug, regionSlug, query) {
			let out = allFacilities;
			if (typeSlug) out = out.filter((f) => f.type === typeSlug);
			if (regionSlug) out = out.filter((f) => f.region === regionSlug);
			if (query) {
				const q = normalize(query);
				out = out.filter((f) => (f._haystack || '').indexOf(q) !== -1);
			}
			return out;
		}

		function applyFilter(typeSlug, regionSlug, query) {
			activeFilter = typeSlug || '';
			activeRegionFilter = regionSlug != null ? regionSlug : activeRegionFilter;
			if (query != null) activeQuery = query;
			renderMarkers(filterFacilities(activeFilter, activeRegionFilter, activeQuery));
			refreshFilterPillCounts();
			buildRegionBadges();
		}

		// Compute how many places remain *for each type* given the current region+query filters,
		// then write those counts into the pill badges. So "Lékárna 3" becomes "Lékárna 0" when
		// the user picks a region with no pharmacies — the empty state is immediately legible.
		function refreshFilterPillCounts() {
			const baseFiltered = allFacilities.filter((f) => {
				if (activeRegionFilter && f.region !== activeRegionFilter) return false;
				if (activeQuery) {
					const q = normalize(activeQuery);
					if ((f._haystack || '').indexOf(q) === -1) return false;
				}
				return true;
			});
			const countsByType = {};
			baseFiltered.forEach((f) => {
				if (!f.type) return;
				countsByType[f.type] = (countsByType[f.type] || 0) + 1;
			});
			wrap.querySelectorAll('.wppm-filter').forEach((btn) => {
				const slug = btn.getAttribute('data-filter') || '';
				const badge = btn.querySelector('.wppm-filter-count');
				if (!badge) return;
				const c = slug ? (countsByType[slug] || 0) : baseFiltered.length;
				badge.textContent = c;
				btn.classList.toggle('is-empty', c === 0);
			});
		}


		// Filter button wiring.
		const filterButtons = wrap.querySelectorAll('.wppm-filter');
		filterButtons.forEach((btn) => {
			btn.addEventListener('click', () => {
				const slug = btn.getAttribute('data-filter') || '';
				filterButtons.forEach((b) => {
					b.classList.toggle('is-active', b === btn);
					b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
				});
				applyFilter(slug, activeRegionFilter, activeQuery);
			});
		});

		// Search input wiring (debounced).
		const searchInput = wrap.querySelector('.wppm-search-input');
		const searchClear = wrap.querySelector('.wppm-search-clear');
		if (searchInput) {
			let timer = null;
			searchInput.addEventListener('input', () => {
				if (timer) clearTimeout(timer);
				timer = setTimeout(() => {
					const q = searchInput.value.trim();
					if (searchClear) searchClear.hidden = q.length === 0;
					applyFilter(activeFilter, activeRegionFilter, q);
				}, 120);
			});
			if (searchClear) {
				searchClear.addEventListener('click', () => {
					searchInput.value = '';
					searchClear.hidden = true;
					applyFilter(activeFilter, activeRegionFilter, '');
					searchInput.focus();
				});
			}
		}

		// --- Czech regions overlay -----------------------------------------

		function parseRegionPolygons(geojson) {
			const out = {};
			(geojson.features || []).forEach((f) => {
				const slug = (f.properties && f.properties.slug) || '';
				const name = (f.properties && f.properties.name) || slug;
				if (!slug) return;
				const polys = [];
				const g = f.geometry || {};
				const toLatLngs = (ring) => ring.map((c) => ({ lat: c[1], lng: c[0] }));
				// Pass every ring (outer + any holes) so google.maps.geometry.poly.containsLocation
				// respects donut polygons — e.g. Středočeský has a Praha-shaped hole, and a Praha
				// point must NOT classify as Středočeský.
				if (g.type === 'Polygon') {
					polys.push(new google.maps.Polygon({ paths: g.coordinates.map(toLatLngs) }));
				} else if (g.type === 'MultiPolygon') {
					g.coordinates.forEach((p) => {
						polys.push(new google.maps.Polygon({ paths: p.map(toLatLngs) }));
					});
				}
				out[slug] = { name: name, polys: polys };
			});
			return out;
		}

		function assignFacilitiesToRegions() {
			regionCounts = {};
			if (!allRegions) return;
			allFacilities.forEach((f) => {
				const latLng = new google.maps.LatLng(f.lat, f.lng);
				f.region = '';
				for (const slug in allRegions) {
					if (!Object.prototype.hasOwnProperty.call(allRegions, slug)) continue;
					const polys = allRegions[slug].polys;
					for (let i = 0; i < polys.length; i++) {
						if (google.maps.geometry && google.maps.geometry.poly &&
							google.maps.geometry.poly.containsLocation(latLng, polys[i])) {
							f.region = slug;
							regionCounts[slug] = (regionCounts[slug] || 0) + 1;
							return;
						}
					}
				}
			});
		}

		function initRegionLayer(geojson) {
			allRegions = parseRegionPolygons(geojson);

			map.data.addGeoJson(geojson, { idPropertyName: 'slug' });

			const baseStyle = {
				fillColor: config.regionColor,
				fillOpacity: 0.06,
				strokeColor: config.regionColor,
				strokeWeight: 1.2,
				strokeOpacity: 0.55,
				clickable: true,
				zIndex: 1,
			};
			map.data.setStyle(baseStyle);

			const SELECTED_STYLE = {
				fillColor: config.regionColor,
				fillOpacity: 0.32,
				strokeColor: config.regionColor,
				strokeWeight: 3,
				strokeOpacity: 1,
				zIndex: 60,
			};

			function applySelected(feature) {
				map.data.overrideStyle(feature, SELECTED_STYLE);
			}

			map.data.addListener('mouseover', (e) => {
				if (e.feature === selectedFeature) return; // don't dim the currently-active region
				map.data.overrideStyle(e.feature, {
					fillOpacity: 0.22,
					strokeWeight: 2,
					strokeOpacity: 1,
					zIndex: 50,
				});
				canvas.style.cursor = 'pointer';
				const slug = e.feature.getProperty('slug');
				const name = e.feature.getProperty('name');
				const count = regionCounts[slug] || 0;
				showTooltip(
					'<strong>' + escapeHtmlSafe(name) + '</strong>' +
					'<span>' + count + ' ' + escapeHtmlSafe(count === 1 ? config.i18n.placeCount : config.i18n.placesCount) + '</span>'
				);
			});

			map.data.addListener('mouseout', (e) => {
				canvas.style.cursor = '';
				hideTooltip();
				if (e.feature === selectedFeature) {
					// Keep the active region highlighted; just restore the override (might have been lost on transient hover).
					applySelected(e.feature);
				} else {
					map.data.revertStyle(e.feature);
				}
			});

			map.data.addListener('click', (e) => {
				activateRegion(e.feature.getProperty('slug'));
			});
		}

		// --- Per-region count badges at centroids ------------------------
		//
		// Small outlined cyan circles at each kraj centroid showing how many
		// places of the current type+search filter live in that region.
		// Persist regardless of zoom/region selection so users can spot
		// "Pardubický has 3, Jihomoravský has 7" at a glance even while
		// zoomed into a different kraj.

		let regionBadges = [];

		function regionBadgeSvg(count, color) {
			const size = 38;
			const r = (size / 2) - 3;
			return window.btoa(
				'<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
					'<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="#ffffff" stroke="' + color + '" stroke-width="2"/>' +
					'<text x="50%" y="50%" dy=".34em" text-anchor="middle" fill="' + color + '" ' +
						'font-family="Inter, system-ui, -apple-system, Segoe UI, sans-serif" ' +
						'font-size="14" font-weight="700">' + count + '</text>' +
				'</svg>'
			);
		}

		// Area-weighted centroid via the shoelace formula, summed across all rings of all
		// polygons in the region. Holes contribute negative signed area, so a donut's
		// centroid is pulled toward the thicker portion — Středočeský's centroid lands
		// in middle Bohemia (not on top of Praha as bounds.getCenter() would).
		function regionCentroid(slug) {
			const polys = (allRegions[slug] || {}).polys || [];
			if (polys.length === 0) return null;

			let totalA = 0, Cx = 0, Cy = 0;
			polys.forEach((poly) => {
				const paths = poly.getPaths();
				for (let r = 0; r < paths.getLength(); r++) {
					const ring = paths.getAt(r).getArray();
					const n = ring.length;
					if (n < 3) continue;
					let A = 0, cx = 0, cy = 0;
					for (let i = 0; i < n; i++) {
						const p0 = ring[i];
						const p1 = ring[(i + 1) % n];
						const cross = p0.lng() * p1.lat() - p1.lng() * p0.lat();
						A += cross;
						cx += (p0.lng() + p1.lng()) * cross;
						cy += (p0.lat() + p1.lat()) * cross;
					}
					if (A === 0) continue;
					// Signed area: outer rings positive (CCW), holes negative (CW) per RFC 7946.
					// Summing signed contributions naturally subtracts holes from the total.
					totalA += A;
					Cx += cx;
					Cy += cy;
				}
			});

			if (totalA === 0) {
				// Degenerate fallback: bbox center.
				const bounds = new google.maps.LatLngBounds();
				polys.forEach((p) => p.getPath().forEach((latLng) => bounds.extend(latLng)));
				return bounds.getCenter();
			}
			// Shoelace formula: centroid = sum((p0 + p1) * cross) / (6 * A)
			return new google.maps.LatLng(Cy / (3 * totalA), Cx / (3 * totalA));
		}

		function buildRegionBadges() {
			regionBadges.forEach((b) => b.setMap(null));
			regionBadges = [];
			if (!allRegions) return;

			// Badges are an overview *aid* while filtering. In the default
			// "all places, all regions" view the cluster bubbles already
			// convey distribution — extra white badges duplicate info and
			// crowd the map. Show only when something is being filtered.
			if (!activeFilter && !activeRegionFilter && !activeQuery) return;

			// Compute counts reflecting the active type + search filter,
			// but NOT the region filter (otherwise the selected region would
			// always show the total and the others would all show 0).
			const counts = {};
			allFacilities.forEach((f) => {
				if (activeFilter && f.type !== activeFilter) return;
				if (activeQuery) {
					const q = normalize(activeQuery);
					if ((f._haystack || '').indexOf(q) === -1) return;
				}
				if (!f.region) return;
				counts[f.region] = (counts[f.region] || 0) + 1;
			});

			Object.keys(allRegions).forEach((slug) => {
				// Skip the currently-active region — the chip above the map plus
				// the cluster bubble inside the region already make it obvious,
				// and stacking the badge on top of the cluster looks like a bug.
				if (slug === activeRegionFilter) return;

				const count = counts[slug] || 0;
				if (count === 0) return;
				const center = regionCentroid(slug);
				if (!center) return;

				const size = 38;
				const marker = new google.maps.Marker({
					position: center,
					icon: {
						url: 'data:image/svg+xml;base64,' + regionBadgeSvg(count, config.regionColor),
						scaledSize: new google.maps.Size(size, size),
						anchor: new google.maps.Point(size / 2, size / 2),
					},
					zIndex: 40,
					title: allRegions[slug].name + ' — ' + count + ' ' + (count === 1 ? config.i18n.placeCount : config.i18n.placesCount),
					cursor: 'pointer',
				});
				marker.addListener('click', () => activateRegion(slug));
				marker.setMap(map);
				regionBadges.push(marker);
			});
		}

		// Shared logic between clicking the kraj polygon and clicking a count badge.
		function activateRegion(slug) {
			const region = allRegions[slug];
			if (!region) return;

			// Locate the matching Data Layer feature so we can apply/clear the selected style.
			let targetFeature = null;
			map.data.forEach((f) => {
				if (f.getProperty('slug') === slug) targetFeature = f;
			});

			if (activeRegionFilter === slug) {
				// Toggle off
				applyFilter(activeFilter, '');
				renderRegionBar('', '');
				clearSelectedRegion();
				return;
			}

			clearSelectedRegion();
			applyFilter(activeFilter, slug);
			renderRegionBar(slug, region.name);
			if (targetFeature) {
				selectedFeature = targetFeature;
				try { map.data.overrideStyle(selectedFeature, {
					fillColor: config.regionColor,
					fillOpacity: 0.32,
					strokeColor: config.regionColor,
					strokeWeight: 3,
					strokeOpacity: 1,
					zIndex: 60,
				}); } catch (e) { /* noop */ }
			}
			const bounds = new google.maps.LatLngBounds();
			region.polys.forEach((p) => p.getPath().forEach((latLng) => bounds.extend(latLng)));
			map.fitBounds(bounds, 48);
		}

		// --- Boot: load facilities + regions in parallel --------------------

		const facilitiesPromise = fetch(config.restUrl, { credentials: 'same-origin' })
			.then((r) => {
				if (!r.ok) throw new Error('Facilities HTTP ' + r.status);
				return r.json();
			})
			.then((data) => {
				allFacilities = Array.isArray(data) ? data : [];
				// Pre-compute normalised haystack for fast diacritic-insensitive search.
				allFacilities.forEach((f) => {
					f._haystack = normalize([
						f.title,
						f.city,
						f.address,
						f.zip,
						f.type_label,
						f.description,
					].filter(Boolean).join(' • '));
				});
			});

		const regionsPromise = config.regions
			? fetch(config.regionsUrl)
				.then((r) => {
					if (!r.ok) throw new Error('Regions HTTP ' + r.status);
					return r.json();
				})
				.catch((err) => {
					// Region overlay is non-critical — log but don't fail the map.
					if (window.console) window.console.warn('[WPPM] regions overlay disabled:', err);
					return null;
				})
			: Promise.resolve(null);

		Promise.all([facilitiesPromise, regionsPromise])
			.then(([_, geojson]) => {
				hideLoading();
				if (geojson) {
					try {
						initRegionLayer(geojson);
						assignFacilitiesToRegions();
					} catch (err) {
						if (window.console) window.console.warn('[WPPM] region layer init failed:', err);
					}
				}
				if (allFacilities.length === 0) {
					canvas.insertAdjacentHTML(
						'afterbegin',
						'<div class="wppm-empty">' + config.i18n.empty + '</div>'
					);
					return;
				}
				try {
					renderMarkers(filterFacilities(activeFilter, activeRegionFilter, activeQuery));
					refreshFilterPillCounts();
					buildRegionBadges();
				} catch (err) {
					showError(err);
				}
			})
			.catch(showError);
	}

	function flushPending() {
		while (pendingInstances.length) {
			bootInstance(pendingInstances.shift());
		}
	}

	function intakeAndStart() {
		const list = window.WPPMInstances || [];
		list.forEach((cfg) => {
			if (mapsReady) {
				bootInstance(cfg);
			} else {
				pendingInstances.push(cfg);
			}
		});
		// Replace with a proxy so any later push() also goes through us.
		const realPush = Array.prototype.push;
		window.WPPMInstances = {
			push: function (cfg) {
				if (mapsReady) bootInstance(cfg);
				else pendingInstances.push(cfg);
				return 1;
			},
		};
		if (mapsReady) flushPending();
	}

	// If the defensive stub (added inline before the Maps SDK tag) already fired
	// because we were 429'd / cached out of order, replay it now.
	const stubAlreadyFired = window.__wppm_maps_ready === true;

	window.WPPM_onMapsReady = function () {
		mapsReady = true;
		flushPending();
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', intakeAndStart);
	} else {
		intakeAndStart();
	}

	if (stubAlreadyFired) {
		// google.maps is guaranteed to be loaded since the Maps SDK is what called the stub.
		window.WPPM_onMapsReady();
	}
})();
