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

	function clusterRendererFactory(brandColor) {
		return {
			render: function (cluster, stats) {
				const count = cluster.count;
				const position = cluster.position;
				const size = count < 10 ? 44 : count < 50 ? 52 : count < 200 ? 60 : 68;
				const svg = window.btoa(
					'<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
						'<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + (size / 2 - 4) + '" fill="' + brandColor + '" fill-opacity="0.25"/>' +
						'<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + (size / 2 - 10) + '" fill="' + brandColor + '"/>' +
						'<text x="50%" y="52%" dy=".35em" text-anchor="middle" fill="white" font-family="Inter, system-ui, sans-serif" font-size="' + Math.round(size * 0.36) + '" font-weight="700">' + count + '</text>' +
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

	function buildInfoWindowContent(facility, i18n) {
		const safe = (v) => (v == null ? '' : String(v));
		const escapeHtml = (s) =>
			safe(s)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#39;');

		const lines = [];
		lines.push('<div class="wppm-iw">');
		if (facility.type_label) {
			lines.push('<span class="wppm-iw-badge">' + escapeHtml(facility.type_label) + '</span>');
		}
		lines.push('<h3 class="wppm-iw-title">' + escapeHtml(facility.title) + '</h3>');

		const addrParts = [facility.address, [facility.zip, facility.city].filter(Boolean).join(' ')].filter(Boolean);
		if (addrParts.length) {
			lines.push('<p class="wppm-iw-addr">' + escapeHtml(addrParts.join(', ')) + '</p>');
		}

		if (facility.description) {
			const desc = facility.description.length > 220 ? facility.description.slice(0, 220) + '…' : facility.description;
			lines.push('<p class="wppm-iw-desc">' + escapeHtml(desc) + '</p>');
		}

		const rows = [];
		if (facility.phone) {
			rows.push('<li><span>' + escapeHtml(i18n.phone) + '</span><a href="tel:' + escapeHtml(facility.phone.replace(/\s+/g, '')) + '">' + escapeHtml(facility.phone) + '</a></li>');
		}
		if (facility.email) {
			rows.push('<li><span>' + escapeHtml(i18n.email) + '</span><a href="mailto:' + escapeHtml(facility.email) + '">' + escapeHtml(facility.email) + '</a></li>');
		}
		if (facility.website) {
			let host = facility.website;
			try { host = new URL(facility.website).hostname.replace(/^www\./, ''); } catch (e) { /* noop */ }
			rows.push('<li><span>' + escapeHtml(i18n.web) + '</span><a href="' + escapeHtml(facility.website) + '" target="_blank" rel="noopener">' + escapeHtml(host) + '</a></li>');
		}
		if (facility.hours) {
			rows.push('<li class="wppm-iw-hours"><span>' + escapeHtml(i18n.hours) + '</span><pre>' + escapeHtml(facility.hours) + '</pre></li>');
		}
		if (rows.length) {
			lines.push('<ul class="wppm-iw-list">' + rows.join('') + '</ul>');
		}

		const dest = encodeURIComponent(addrParts.length ? facility.title + ', ' + addrParts.join(', ') : facility.lat + ',' + facility.lng);
		lines.push('<div class="wppm-iw-actions">');
		lines.push('<a class="wppm-iw-btn" href="https://www.google.com/maps/dir/?api=1&destination=' + dest + '" target="_blank" rel="noopener">' + escapeHtml(i18n.navigate) + '</a>');
		lines.push('</div>');
		lines.push('</div>');
		return lines.join('');
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

		const infoWindow = new google.maps.InfoWindow({ maxWidth: 320 });
		const markerIcon = {
			url: markerSvgDataUri(config.brandColor),
			scaledSize: new google.maps.Size(34, 44),
			anchor: new google.maps.Point(17, 44),
		};

		let allFacilities = [];
		let allRegions = null; // { slug: { name, polys: [google.maps.Polygon] } }
		let regionCounts = {};
		let markers = [];
		let cluster = null;
		let activeFilter = config.typeFilter || '';
		let activeRegionFilter = '';
		let activeQuery = '';

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
				// Always restore the CZ-wide configured view when the user clears a region.
				map.setCenter(config.center);
				map.setZoom(config.zoom);
			});
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
				marker.addListener('click', () => {
					infoWindow.setContent(buildInfoWindowContent(f, config.i18n));
					infoWindow.open({ map, anchor: marker, shouldFocus: false });
				});
				markers.push(marker);
			});

			if (config.cluster && window.markerClusterer && markers.length > 1) {
				cluster = new window.markerClusterer.MarkerClusterer({
					map,
					markers,
					renderer: clusterRendererFactory(config.clusterColor),
				});
			} else if (markers.length) {
				markers.forEach((m) => m.setMap(map));
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
				if (g.type === 'Polygon') {
					polys.push(new google.maps.Polygon({ paths: toLatLngs(g.coordinates[0]) }));
				} else if (g.type === 'MultiPolygon') {
					g.coordinates.forEach((p) => {
						polys.push(new google.maps.Polygon({ paths: toLatLngs(p[0]) }));
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

			map.data.addListener('mouseover', (e) => {
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
				map.data.revertStyle(e.feature);
				canvas.style.cursor = '';
				hideTooltip();
			});

			map.data.addListener('click', (e) => {
				const slug = e.feature.getProperty('slug');
				const name = e.feature.getProperty('name');
				if (activeRegionFilter === slug) {
					applyFilter(activeFilter, '');
					renderRegionBar('', '');
				} else {
					applyFilter(activeFilter, slug);
					renderRegionBar(slug, name);
					const bounds = new google.maps.LatLngBounds();
					allRegions[slug].polys.forEach((p) => {
						p.getPath().forEach((latLng) => bounds.extend(latLng));
					});
					map.fitBounds(bounds, 48);
				}
			});
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
					renderMarkers(filterFacilities(activeFilter, activeRegionFilter));
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

	window.WPPM_onMapsReady = function () {
		mapsReady = true;
		flushPending();
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', intakeAndStart);
	} else {
		intakeAndStart();
	}
})();
