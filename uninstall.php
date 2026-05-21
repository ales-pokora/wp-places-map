<?php
/**
 * Uninstall handler — runs only when the plugin is deleted from WP-admin → Plugins.
 *
 * If the "preserve data" setting is enabled (default), places and taxonomy terms
 * stay in the database, only options + transients are cleared. Otherwise everything
 * the plugin created is removed.
 *
 * @package WPPlacesMap
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

$opts = get_option( 'wppm_settings' );
$preserve = is_array( $opts ) ? ! empty( $opts['preserve_data'] ) : true;

delete_transient( 'wppm_places_cache' );

if ( ! $preserve ) {
	$cpt = 'wppm_place';
	$tax = 'wppm_place_type';

	// Delete posts (and their meta automatically).
	$ids = get_posts( [
		'post_type'      => $cpt,
		'post_status'    => 'any',
		'posts_per_page' => -1,
		'fields'         => 'ids',
	] );
	foreach ( (array) $ids as $id ) {
		wp_delete_post( (int) $id, true );
	}

	// Delete taxonomy terms.
	$terms = get_terms( [ 'taxonomy' => $tax, 'hide_empty' => false, 'fields' => 'ids' ] );
	if ( ! is_wp_error( $terms ) ) {
		foreach ( (array) $terms as $term_id ) {
			wp_delete_term( (int) $term_id, $tax );
		}
	}
}

delete_option( 'wppm_settings' );

// Wipe geocode transients we cached during imports.
global $wpdb;
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '\_transient\_wppm\_geo\_%' OR option_name LIKE '\_transient\_timeout\_wppm\_geo\_%'" );
