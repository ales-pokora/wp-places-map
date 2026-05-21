<?php
/**
 * GitHub auto-update integration via YahnisElsts/plugin-update-checker.
 *
 * The plugin checks GitHub for a newer tagged release and offers a one-click
 * update in WP Admin → Plugins, exactly like a wordpress.org-hosted plugin.
 *
 * Release flow (project owner):
 *   1. Bump the "Version" header in wp-places-map.php.
 *   2. Commit and push to main.
 *   3. Tag and push:  git tag v1.0.1 && git push --tags
 *   4. (Optional) gh release create v1.0.1 --generate-notes
 *      Attach a pre-built ZIP for cleaner downloads:
 *        gh release create v1.0.1 wp-places-map.zip --generate-notes
 *
 * Private repositories: paste a GitHub Personal Access Token in
 *   Settings → WP Places Map → "GitHub token for updates".
 *
 * @package WPPlacesMap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class WPPM_Updater {

	private static $instance = null;

	/** @var \YahnisElsts\PluginUpdateChecker\v5\Plugin\UpdateChecker|null */
	private $checker = null;

	public static function instance() {
		if ( self::$instance === null ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function init() {
		$loader = WPPM_PATH . 'lib/plugin-update-checker/plugin-update-checker.php';
		if ( ! file_exists( $loader ) ) {
			return;
		}
		require_once $loader;

		if ( ! class_exists( '\\YahnisElsts\\PluginUpdateChecker\\v5\\PucFactory' ) ) {
			return;
		}

		$repo_url = defined( 'WPPM_GITHUB_REPO' ) ? WPPM_GITHUB_REPO : '';
		if ( empty( $repo_url ) ) {
			return;
		}

		$this->checker = \YahnisElsts\PluginUpdateChecker\v5\PucFactory::buildUpdateChecker(
			$repo_url,
			WPPM_FILE,
			'wp-places-map'
		);

		// Track the main branch for stable releases — tags take precedence when present.
		if ( method_exists( $this->checker, 'setBranch' ) ) {
			$this->checker->setBranch( defined( 'WPPM_GITHUB_BRANCH' ) ? WPPM_GITHUB_BRANCH : 'main' );
		}

		// Prefer release-attached ZIPs (cleaner — only ships built artefacts, not the whole repo tree).
		// If a release has no attached ZIP, PUC falls back to the source-tarball of the tag.
		$vcs = $this->checker->getVcsApi();
		if ( $vcs && method_exists( $vcs, 'enableReleaseAssets' ) ) {
			$vcs->enableReleaseAssets( '/wp-places-map.*\.zip/i' );
		}

		// Optional authentication for private repos / higher rate limits.
		$token = $this->github_token();
		if ( $token ) {
			$this->checker->setAuthentication( $token );
		}

		// Bust update transients when the admin saves the settings page —
		// useful right after adding a token, so the user sees results immediately.
		add_action( 'update_option_' . WPPM_OPT, [ $this, 'force_check_on_settings_save' ], 10, 2 );
	}

	/**
	 * Pull token from settings, with a defined-constant override for envs
	 * that prefer to keep secrets out of the database.
	 */
	private function github_token() {
		if ( defined( 'WPPM_GITHUB_TOKEN' ) && WPPM_GITHUB_TOKEN ) {
			return WPPM_GITHUB_TOKEN;
		}
		$opts = (array) get_option( WPPM_OPT, [] );
		return isset( $opts['github_token'] ) ? trim( (string) $opts['github_token'] ) : '';
	}

	public function force_check_on_settings_save( $old, $new ) {
		$old_token = isset( $old['github_token'] ) ? $old['github_token'] : '';
		$new_token = isset( $new['github_token'] ) ? $new['github_token'] : '';
		if ( $old_token !== $new_token && $this->checker ) {
			$this->checker->resetUpdateState();
			$this->checker->checkForUpdates();
		}
	}
}
