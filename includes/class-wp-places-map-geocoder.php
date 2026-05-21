<?php
/**
 * Server-side wrapper around Google Geocoding API.
 * Used by admin AJAX (one address) and CSV importer (batch).
 *
 * @package WPPlacesMap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class WPPM_Geocoder {

	const ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

	/**
	 * @param string $address Free-form address.
	 * @return array|WP_Error  { lat, lng, formatted } on success.
	 */
	public static function geocode( $address ) {
		$address = trim( (string) $address );
		if ( $address === '' ) {
			return new WP_Error( 'wppm_empty', __( 'Adresa je prázdná.', 'wp-places-map' ) );
		}

		$key = WPPM_Settings::get( 'api_key', '' );
		if ( ! $key ) {
			return new WP_Error( 'wppm_no_key', __( 'Není nastaven Google Maps API klíč.', 'wp-places-map' ) );
		}

		$cache_key = 'wppm_geo_' . md5( $address );
		$cached    = get_transient( $cache_key );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$url = add_query_arg(
			[
				'address'    => $address,
				'key'        => $key,
				'language'   => 'cs',
				'region'     => 'cz',
				// Hard component filter — geocoder will only return matches inside Czech Republic.
				// Without this, Google may quietly return a non-CZ "best match" for ambiguous input.
				'components' => 'country:CZ',
			],
			self::ENDPOINT
		);

		$response = wp_remote_get( $url, [ 'timeout' => 15 ] );
		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		if ( $code !== 200 ) {
			return new WP_Error( 'wppm_http', sprintf( __( 'Geocoding API HTTP %d', 'wp-places-map' ), $code ) );
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $body ) ) {
			return new WP_Error( 'wppm_parse', __( 'Geocoding API vrátil neplatnou odpověď.', 'wp-places-map' ) );
		}

		if ( ( $body['status'] ?? '' ) !== 'OK' || empty( $body['results'] ) ) {
			$status = $body['status'] ?? 'UNKNOWN';
			$msg    = ! empty( $body['error_message'] ) ? $body['error_message'] : sprintf( __( 'Adresu se nepodařilo dohledat (%s).', 'wp-places-map' ), $status );
			return new WP_Error( 'wppm_geocode_failed', $msg );
		}

		$first = $body['results'][0];
		$out   = [
			'lat'       => isset( $first['geometry']['location']['lat'] ) ? (float) $first['geometry']['location']['lat'] : null,
			'lng'       => isset( $first['geometry']['location']['lng'] ) ? (float) $first['geometry']['location']['lng'] : null,
			'formatted' => isset( $first['formatted_address'] ) ? (string) $first['formatted_address'] : '',
		];

		if ( $out['lat'] === null || $out['lng'] === null ) {
			return new WP_Error( 'wppm_no_coords', __( 'Odpověď neobsahuje souřadnice.', 'wp-places-map' ) );
		}

		set_transient( $cache_key, $out, DAY_IN_SECONDS );
		return $out;
	}
}
