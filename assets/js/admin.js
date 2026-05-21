/* global WPPMAdmin, google */
/**
 * Places Map – admin: "Dohledat GPS" button + small preview map with draggable pin.
 */
(function () {
	'use strict';

	let map = null;
	let marker = null;

	function $(id) { return document.getElementById(id); }

	function statusMsg(el, msg, type) {
		if (!el) return;
		el.textContent = msg || '';
		el.classList.remove('is-ok', 'is-err', 'is-pending');
		if (type) el.classList.add('is-' + type);
	}

	function buildAddress() {
		const street = ($('wppm_address') || {}).value || '';
		const city   = ($('wppm_city') || {}).value || '';
		const zip    = ($('wppm_zip') || {}).value || '';
		const parts  = [street, [zip, city].filter(Boolean).join(' ')].filter((s) => s && s.trim() !== '');
		return parts.join(', ');
	}

	function currentLatLng() {
		const latInput = $('wppm_lat');
		const lngInput = $('wppm_lng');
		if (!latInput || !lngInput) return null;
		const lat = parseFloat(String(latInput.value).replace(',', '.'));
		const lng = parseFloat(String(lngInput.value).replace(',', '.'));
		if (!isFinite(lat) || !isFinite(lng)) return null;
		return { lat: lat, lng: lng };
	}

	function setLatLng(latlng) {
		const latInput = $('wppm_lat');
		const lngInput = $('wppm_lng');
		if (latInput) latInput.value = latlng.lat.toFixed(6);
		if (lngInput) lngInput.value = latlng.lng.toFixed(6);
	}

	function ensureMap(center) {
		const el = $('wppm-preview-map');
		if (!el || typeof google === 'undefined' || !google.maps) return null;

		if (map) {
			map.setCenter(center);
			if (marker) marker.setPosition(center);
			return map;
		}

		map = new google.maps.Map(el, {
			center: center,
			zoom: 15,
			mapTypeControl: false,
			streetViewControl: false,
			fullscreenControl: false,
		});

		marker = new google.maps.Marker({
			position: center,
			map: map,
			draggable: true,
			title: WPPMAdmin.i18n.dragHint,
		});

		marker.addListener('dragend', function () {
			const p = marker.getPosition();
			setLatLng({ lat: p.lat(), lng: p.lng() });
		});

		return map;
	}

	function geocodeViaRest(address) {
		const url = WPPMAdmin.restUrl + 'geocode?address=' + encodeURIComponent(address);
		return fetch(url, {
			credentials: 'same-origin',
			headers: { 'X-WP-Nonce': WPPMAdmin.nonce },
		}).then(function (r) {
			return r.json().then(function (body) {
				if (!r.ok) {
					const msg = (body && body.message) || ('HTTP ' + r.status);
					throw new Error(msg);
				}
				return body;
			});
		});
	}

	function handleGeocodeClick() {
		const status = $('wppm-geocode-status');

		if (!WPPMAdmin.apiKey) {
			statusMsg(status, WPPMAdmin.i18n.noKey, 'err');
			return;
		}

		const address = buildAddress();
		if (!address) {
			statusMsg(status, 'Zadejte adresu.', 'err');
			return;
		}

		statusMsg(status, WPPMAdmin.i18n.geocoding, 'pending');

		geocodeViaRest(address)
			.then(function (res) {
				const center = { lat: res.lat, lng: res.lng };
				setLatLng(center);
				ensureMap(center);
				statusMsg(status, WPPMAdmin.i18n.geocodeOk + ' — ' + (res.formatted || ''), 'ok');
			})
			.catch(function (err) {
				statusMsg(status, WPPMAdmin.i18n.geocodeErr + ' (' + err.message + ')', 'err');
			});
	}

	function findComponent(components, type) {
		if (!Array.isArray(components)) return null;
		return components.find(function (c) {
			return Array.isArray(c.types) && c.types.indexOf(type) !== -1;
		}) || null;
	}

	function compLong(components, type) {
		const c = findComponent(components, type);
		return c ? c.long_name : '';
	}

	function compShort(components, type) {
		const c = findComponent(components, type);
		return c ? c.short_name : '';
	}

	function showValidated(formatted) {
		const el = $('wppm-autocomplete-status');
		if (!el) return;
		el.hidden = false;
		el.innerHTML = '<span class="dashicons dashicons-yes-alt"></span> ' +
			'Validovaná adresa Google Places: <strong></strong>';
		// Inject as text to avoid HTML injection from address strings.
		el.querySelector('strong').textContent = formatted || '';
	}

	function setVal(id, value) {
		const el = $(id);
		if (el) el.value = value == null ? '' : String(value);
	}

	function initAutocomplete() {
		const input = $('wppm_autocomplete');
		if (!input || typeof google === 'undefined' || !google.maps || !google.maps.places) return;

		// Some browsers ignore autocomplete="off" — combat with a randomised name.
		input.setAttribute('autocomplete', 'wppm-' + Math.random().toString(36).slice(2));

		const ac = new google.maps.places.Autocomplete(input, {
			fields: ['address_components', 'formatted_address', 'geometry', 'name', 'place_id'],
			componentRestrictions: { country: 'cz' },
			types: ['address'],
		});

		// Pull the bounds of any preview map already shown to bias suggestions toward that area.
		ac.addListener('place_changed', function () {
			const place = ac.getPlace();
			if (!place || !place.geometry || !place.geometry.location) {
				return; // user pressed Enter without picking a suggestion
			}

			const lat = place.geometry.location.lat();
			const lng = place.geometry.location.lng();
			const comp = place.address_components || [];

			const route   = compLong(comp, 'route');
			const number  = compShort(comp, 'street_number');
			const city    = compLong(comp, 'locality') || compLong(comp, 'postal_town') || compLong(comp, 'administrative_area_level_2');
			const zip     = (compLong(comp, 'postal_code') || '').replace(/^(\d{3})(\d{2})$/, '$1 $2');
			const street  = [route, number].filter(Boolean).join(' ');

			setVal('wppm_address', street || place.name || '');
			setVal('wppm_city', city);
			setVal('wppm_zip', zip);
			setVal('wppm_lat', lat.toFixed(6));
			setVal('wppm_lng', lng.toFixed(6));

			ensureMap({ lat: lat, lng: lng });
			if (map) map.setZoom(17);

			showValidated(place.formatted_address || street + ', ' + city);

			// Clear any stale "Dohledat GPS" status from previous manual flow.
			const stat = $('wppm-geocode-status');
			if (stat) statusMsg(stat, '', null);
		});

		// Prevent form submission when user hits Enter inside the autocomplete input.
		input.addEventListener('keydown', function (e) {
			if (e.key === 'Enter') e.preventDefault();
		});
	}

	// Exposed as a callback target for the Google Maps loader.
	window.WPPMAdmin_initMap = function () {
		const existing = currentLatLng() || WPPMAdmin.defaultCenter;
		if (existing) ensureMap(existing);
		initAutocomplete();
	};

	document.addEventListener('DOMContentLoaded', function () {
		const btn = $('wppm-geocode-btn');
		if (btn) btn.addEventListener('click', handleGeocodeClick);

		// Live-update marker when user edits lat/lng manually.
		['wppm_lat', 'wppm_lng'].forEach(function (id) {
			const el = $(id);
			if (!el) return;
			el.addEventListener('change', function () {
				const c = currentLatLng();
				if (c) ensureMap(c);
			});
		});

		// If the Maps SDK initialised before DOMContentLoaded (cached), autocomplete may not be wired yet.
		if (typeof google !== 'undefined' && google.maps && google.maps.places) {
			initAutocomplete();
		}
	});
})();
