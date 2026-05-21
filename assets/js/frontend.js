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
		let markers = [];
		let cluster = null;
		let activeFilter = config.typeFilter || '';

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

			// Fit bounds to markers when we have them; otherwise honour configured center/zoom.
			if (markers.length === 1) {
				map.setCenter(markers[0].getPosition());
				if (map.getZoom() < 12) map.setZoom(12);
			} else if (markers.length > 1) {
				const bounds = new google.maps.LatLngBounds();
				markers.forEach((m) => bounds.extend(m.getPosition()));
				map.fitBounds(bounds, 64);
			}
		}

		function applyFilter(slug) {
			activeFilter = slug || '';
			const filtered = activeFilter ? allFacilities.filter((f) => f.type === activeFilter) : allFacilities.slice();
			renderMarkers(filtered);
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
				applyFilter(slug);
			});
		});

		fetch(config.restUrl, { credentials: 'same-origin' })
			.then((r) => {
				if (!r.ok) throw new Error('HTTP ' + r.status);
				return r.json();
			})
			.then((data) => {
				allFacilities = Array.isArray(data) ? data : [];
				hideLoading();
				if (allFacilities.length === 0) {
					canvas.insertAdjacentHTML(
						'afterbegin',
						'<div class="wppm-empty">' + config.i18n.empty + '</div>'
					);
					return;
				}
				try {
					applyFilter(activeFilter);
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
