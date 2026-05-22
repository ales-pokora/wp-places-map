<?php
/**
 * Plugin Name:       WP Places Map
 * Plugin URI:        https://github.com/ales-pokora/wp-places-map
 * Description:       Interactive Google Map of locations (clinics, hospitals, branches, points of sale — anything). Provides a custom post type, admin UI, CSV import and a [wp_places_map] shortcode. Drop the shortcode anywhere — Divi Text/Code module, Gutenberg block, classic editor, theme template.
 * Version:           1.0.2
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Aleš Pokora
 * Author URI:        https://github.com/ales-pokora
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       wp-places-map
 * Domain Path:       /languages
 * Update URI:        https://github.com/ales-pokora/wp-places-map
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'WPPM_VERSION', '1.0.2' );
define( 'WPPM_FILE', __FILE__ );
define( 'WPPM_PATH', plugin_dir_path( __FILE__ ) );
define( 'WPPM_URL', plugin_dir_url( __FILE__ ) );
define( 'WPPM_BASENAME', plugin_basename( __FILE__ ) );

define( 'WPPM_CPT', 'wppm_place' );
define( 'WPPM_TAX', 'wppm_place_type' );
define( 'WPPM_OPT', 'wppm_settings' );
define( 'WPPM_CACHE_KEY', 'wppm_places_cache' );
define( 'WPPM_REST_NS', 'wp-places-map/v1' );

define( 'WPPM_GITHUB_REPO', 'https://github.com/ales-pokora/wp-places-map' );
define( 'WPPM_GITHUB_BRANCH', 'main' );

require_once WPPM_PATH . 'includes/class-wp-places-map.php';
require_once WPPM_PATH . 'includes/class-wp-places-map-cpt.php';
require_once WPPM_PATH . 'includes/class-wp-places-map-meta.php';
require_once WPPM_PATH . 'includes/class-wp-places-map-settings.php';
require_once WPPM_PATH . 'includes/class-wp-places-map-rest.php';
require_once WPPM_PATH . 'includes/class-wp-places-map-shortcode.php';
require_once WPPM_PATH . 'includes/class-wp-places-map-importer.php';
require_once WPPM_PATH . 'includes/class-wp-places-map-geocoder.php';
require_once WPPM_PATH . 'includes/class-wp-places-map-updater.php';

register_activation_hook( __FILE__, [ 'WPPM_Plugin', 'activate' ] );
register_deactivation_hook( __FILE__, [ 'WPPM_Plugin', 'deactivate' ] );

add_action( 'plugins_loaded', static function () {
	WPPM_Plugin::instance()->init();
	WPPM_Updater::instance()->init();
} );
