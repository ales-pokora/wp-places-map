<?php
/**
 * Plugin orchestrator.
 *
 * @package WPPlacesMap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class WPPM_Plugin {

	/** @var WPPM_Plugin|null */
	private static $instance = null;

	public static function instance() {
		if ( self::$instance === null ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {}

	public function init() {
		load_plugin_textdomain( 'wp-places-map', false, dirname( WPPM_BASENAME ) . '/languages' );

		WPPM_CPT::instance()->init();
		WPPM_Meta::instance()->init();
		WPPM_Settings::instance()->init();
		WPPM_Rest::instance()->init();
		WPPM_Shortcode::instance()->init();
		WPPM_Importer::instance()->init();

		add_action( 'admin_enqueue_scripts', [ $this, 'admin_assets' ] );
		add_filter( 'plugin_action_links_' . WPPM_BASENAME, [ $this, 'action_links' ] );
	}

	public static function activate() {
		require_once WPPM_PATH . 'includes/class-wp-places-map-cpt.php';
		WPPM_CPT::instance()->register();
		WPPM_CPT::seed_default_terms();

		// Default settings.
		$defaults = [
			'api_key'         => '',
			'default_lat'     => '49.7437',  // Czech Republic centroid
			'default_lng'     => '15.3386',
			'default_zoom'    => 7,
			'brand_color'     => '#41C8F4',
			'cluster_color'   => '#41C8F4',
			'map_style'       => 'light',
			'show_filters'    => 1,
			'cluster'         => 1,
			'height'          => 600,
			'preserve_data'   => 1, // keep CPT entries when plugin is uninstalled
		];
		if ( ! get_option( WPPM_OPT ) ) {
			add_option( WPPM_OPT, $defaults );
		} else {
			$existing = (array) get_option( WPPM_OPT );
			update_option( WPPM_OPT, array_merge( $defaults, $existing ) );
		}

		flush_rewrite_rules();
	}

	public static function deactivate() {
		delete_transient( WPPM_CACHE_KEY );
		flush_rewrite_rules();
	}

	public function admin_assets( $hook ) {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		$is_facility_screen = $screen && ( $screen->post_type === WPPM_CPT );
		$is_settings_screen = isset( $_GET['page'] ) && in_array( $_GET['page'], [ 'wp-places-map', 'wp-places-map-import' ], true );

		if ( ! $is_facility_screen && ! $is_settings_screen ) {
			return;
		}

		wp_enqueue_style(
			'wppm-admin',
			WPPM_URL . 'assets/css/admin.css',
			[],
			WPPM_VERSION
		);

		wp_enqueue_script(
			'wppm-admin',
			WPPM_URL . 'assets/js/admin.js',
			[ 'jquery' ],
			WPPM_VERSION,
			true
		);

		$settings = WPPM_Settings::get();
		wp_localize_script( 'wppm-admin', 'WPPMAdmin', [
			'restUrl'       => esc_url_raw( rest_url( WPPM_REST_NS . '/' ) ),
			'nonce'         => wp_create_nonce( 'wp_rest' ),
			'apiKey'        => $settings['api_key'],
			'defaultCenter' => [
				'lat' => (float) $settings['default_lat'],
				'lng' => (float) $settings['default_lng'],
			],
			'brandColor'    => $settings['brand_color'],
			'i18n'          => [
				'geocoding'   => __( 'Vyhledávám souřadnice…', 'wp-places-map' ),
				'geocodeOk'   => __( 'Souřadnice nalezeny', 'wp-places-map' ),
				'geocodeErr'  => __( 'Adresu se nepodařilo dohledat. Zadejte souřadnice ručně.', 'wp-places-map' ),
				'noKey'       => __( 'V Nastavení doplňte Google Maps API klíč pro geokódování.', 'wp-places-map' ),
				'dragHint'    => __( 'Pin můžete přetáhnout pro upřesnění polohy.', 'wp-places-map' ),
			],
		] );

		if ( $is_facility_screen && ! empty( $settings['api_key'] ) ) {
			wp_enqueue_script(
				'wppm-gmaps-admin',
				'https://maps.googleapis.com/maps/api/js?key=' . rawurlencode( $settings['api_key'] ) . '&libraries=places&loading=async&callback=WPPMAdmin_initMap',
				[],
				null,
				true
			);
		}
	}

	public function action_links( $links ) {
		$custom = [
			'<a href="' . esc_url( admin_url( 'options-general.php?page=wp-places-map' ) ) . '">' . esc_html__( 'Nastavení', 'wp-places-map' ) . '</a>',
			'<a href="' . esc_url( admin_url( 'edit.php?post_type=' . WPPM_CPT ) ) . '">' . esc_html__( 'Zařízení', 'wp-places-map' ) . '</a>',
		];
		return array_merge( $custom, $links );
	}
}
