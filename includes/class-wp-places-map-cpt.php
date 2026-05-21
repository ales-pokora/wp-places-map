<?php
/**
 * Custom post type "Facility" + taxonomy "Facility Type".
 *
 * @package WPPlacesMap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class WPPM_CPT {

	private static $instance = null;

	public static function instance() {
		if ( self::$instance === null ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function init() {
		add_action( 'init', [ $this, 'register' ] );
		add_filter( 'manage_' . WPPM_CPT . '_posts_columns', [ $this, 'columns' ] );
		add_action( 'manage_' . WPPM_CPT . '_posts_custom_column', [ $this, 'column_content' ], 10, 2 );
	}

	public function register() {
		register_post_type( WPPM_CPT, [
			'labels'              => [
				'name'               => __( 'Zařízení', 'wp-places-map' ),
				'singular_name'      => __( 'Zařízení', 'wp-places-map' ),
				'menu_name'          => __( 'Mapa zařízení', 'wp-places-map' ),
				'add_new'            => __( 'Přidat zařízení', 'wp-places-map' ),
				'add_new_item'       => __( 'Přidat nové zařízení', 'wp-places-map' ),
				'edit_item'          => __( 'Upravit zařízení', 'wp-places-map' ),
				'new_item'           => __( 'Nové zařízení', 'wp-places-map' ),
				'view_item'          => __( 'Zobrazit zařízení', 'wp-places-map' ),
				'search_items'       => __( 'Hledat zařízení', 'wp-places-map' ),
				'not_found'          => __( 'Žádná zařízení.', 'wp-places-map' ),
				'not_found_in_trash' => __( 'V koši nejsou žádná zařízení.', 'wp-places-map' ),
			],
			'public'              => false,
			'show_ui'             => true,
			'show_in_menu'        => true,
			'show_in_rest'        => false,
			'menu_position'       => 25,
			'menu_icon'           => 'dashicons-location-alt',
			'supports'            => [ 'title', 'editor', 'thumbnail', 'revisions' ],
			'has_archive'         => false,
			'rewrite'             => false,
			'capability_type'     => 'post',
			'hierarchical'        => false,
			'exclude_from_search' => true,
		] );

		register_taxonomy( WPPM_TAX, WPPM_CPT, [
			'labels'            => [
				'name'              => __( 'Typy zařízení', 'wp-places-map' ),
				'singular_name'     => __( 'Typ zařízení', 'wp-places-map' ),
				'menu_name'         => __( 'Typy zařízení', 'wp-places-map' ),
				'all_items'         => __( 'Všechny typy', 'wp-places-map' ),
				'edit_item'         => __( 'Upravit typ', 'wp-places-map' ),
				'add_new_item'      => __( 'Přidat typ', 'wp-places-map' ),
			],
			'public'            => false,
			'show_ui'           => true,
			'show_admin_column' => true,
			'show_in_rest'      => false,
			'hierarchical'      => true,
			'rewrite'           => false,
		] );
	}

	public static function seed_default_terms() {
		$defaults = [
			'prakticky-lekar' => __( 'Praktický lékař', 'wp-places-map' ),
			'nemocnice'       => __( 'Nemocnice', 'wp-places-map' ),
			'ambulance'       => __( 'Ambulance / specialista', 'wp-places-map' ),
			'lekarna'         => __( 'Lékárna', 'wp-places-map' ),
		];
		foreach ( $defaults as $slug => $label ) {
			if ( ! term_exists( $slug, WPPM_TAX ) ) {
				wp_insert_term( $label, WPPM_TAX, [ 'slug' => $slug ] );
			}
		}
	}

	public function columns( $cols ) {
		// Reorder + inject custom columns.
		$new = [];
		foreach ( $cols as $key => $val ) {
			$new[ $key ] = $val;
			if ( $key === 'title' ) {
				$new['wppm_address'] = __( 'Adresa', 'wp-places-map' );
				$new['wppm_coords']  = __( 'GPS', 'wp-places-map' );
			}
		}
		return $new;
	}

	public function column_content( $col, $post_id ) {
		if ( $col === 'wppm_address' ) {
			$city = get_post_meta( $post_id, '_wppm_city', true );
			$addr = get_post_meta( $post_id, '_wppm_address', true );
			echo esc_html( trim( $addr . ( $city ? ', ' . $city : '' ), ', ' ) );
		}
		if ( $col === 'wppm_coords' ) {
			$lat = get_post_meta( $post_id, '_wppm_lat', true );
			$lng = get_post_meta( $post_id, '_wppm_lng', true );
			if ( $lat && $lng ) {
				printf( '%s, %s', esc_html( $lat ), esc_html( $lng ) );
			} else {
				echo '<span style="color:#b32d2e">' . esc_html__( 'chybí', 'wp-places-map' ) . '</span>';
			}
		}
	}
}
