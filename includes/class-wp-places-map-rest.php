<?php
/**
 * REST API – public read endpoint for the frontend map + private geocode endpoint for the admin UI.
 *
 * @package WPPlacesMap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class WPPM_Rest {

	private static $instance = null;

	const CACHE_TTL = 5 * MINUTE_IN_SECONDS;

	public static function instance() {
		if ( self::$instance === null ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function init() {
		add_action( 'rest_api_init', [ $this, 'routes' ] );
	}

	public function routes() {
		register_rest_route( WPPM_REST_NS, '/facilities', [
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => [ $this, 'list_facilities' ],
			'permission_callback' => '__return_true',
			'args'                => [
				'type' => [
					'type'              => 'string',
					'required'          => false,
					'sanitize_callback' => 'sanitize_title',
				],
			],
		] );

		register_rest_route( WPPM_REST_NS, '/geocode', [
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => [ $this, 'geocode' ],
			'permission_callback' => function () {
				return current_user_can( 'edit_posts' );
			},
			'args'                => [
				'address' => [
					'type'              => 'string',
					'required'          => true,
					'sanitize_callback' => 'sanitize_text_field',
				],
			],
		] );
	}

	public function list_facilities( WP_REST_Request $req ) {
		$type = $req->get_param( 'type' );

		$cached = get_transient( WPPM_CACHE_KEY );
		if ( is_array( $cached ) && empty( $type ) ) {
			return rest_ensure_response( $cached );
		}

		$args = [
			'post_type'      => WPPM_CPT,
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'orderby'        => 'title',
			'order'          => 'ASC',
			'no_found_rows'  => true,
		];

		if ( ! empty( $type ) ) {
			$args['tax_query'] = [
				[
					'taxonomy' => WPPM_TAX,
					'field'    => 'slug',
					'terms'    => $type,
				],
			];
		}

		$query = new WP_Query( $args );
		$out   = [];

		foreach ( $query->posts as $post ) {
			$lat = get_post_meta( $post->ID, '_wppm_lat', true );
			$lng = get_post_meta( $post->ID, '_wppm_lng', true );
			if ( $lat === '' || $lng === '' ) {
				continue; // facilities without GPS aren't rendered
			}

			$terms = wp_get_post_terms( $post->ID, WPPM_TAX, [ 'fields' => 'all' ] );
			$type_slug  = '';
			$type_label = '';
			if ( ! is_wp_error( $terms ) && ! empty( $terms ) ) {
				$type_slug  = $terms[0]->slug;
				$type_label = $terms[0]->name;
			}

			$thumb = get_the_post_thumbnail_url( $post->ID, 'medium' );

			$out[] = [
				'id'         => $post->ID,
				'title'      => get_the_title( $post ),
				'lat'        => (float) $lat,
				'lng'        => (float) $lng,
				'type'       => $type_slug,
				'type_label' => $type_label,
				'address'    => get_post_meta( $post->ID, '_wppm_address', true ),
				'city'       => get_post_meta( $post->ID, '_wppm_city', true ),
				'zip'        => get_post_meta( $post->ID, '_wppm_zip', true ),
				'phone'      => get_post_meta( $post->ID, '_wppm_phone', true ),
				'email'      => get_post_meta( $post->ID, '_wppm_email', true ),
				'website'    => get_post_meta( $post->ID, '_wppm_website', true ),
				'hours'      => get_post_meta( $post->ID, '_wppm_hours', true ),
				'description'=> wp_strip_all_tags( $post->post_content ),
				'image'      => $thumb ? $thumb : '',
			];
		}

		if ( empty( $type ) ) {
			set_transient( WPPM_CACHE_KEY, $out, self::CACHE_TTL );
		}

		return rest_ensure_response( $out );
	}

	public function geocode( WP_REST_Request $req ) {
		$address = $req->get_param( 'address' );
		$result  = WPPM_Geocoder::geocode( $address );

		if ( is_wp_error( $result ) ) {
			return new WP_Error(
				$result->get_error_code(),
				$result->get_error_message(),
				[ 'status' => 400 ]
			);
		}

		return rest_ensure_response( $result );
	}
}
