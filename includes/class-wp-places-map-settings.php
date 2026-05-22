<?php
/**
 * Settings page under Settings → Places Map.
 *
 * @package WPPlacesMap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class WPPM_Settings {

	private static $instance = null;

	public static function instance() {
		if ( self::$instance === null ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function init() {
		add_action( 'admin_menu', [ $this, 'menu' ] );
		add_action( 'admin_init', [ $this, 'register' ] );
	}

	public static function get( $key = null, $default = null ) {
		$opts = (array) get_option( WPPM_OPT, [] );
		if ( $key === null ) {
			return $opts;
		}
		return isset( $opts[ $key ] ) ? $opts[ $key ] : $default;
	}

	public function menu() {
		add_submenu_page(
			'edit.php?post_type=' . WPPM_CPT,
			__( 'Nastavení mapy', 'wp-places-map' ),
			__( 'Nastavení', 'wp-places-map' ),
			'manage_options',
			'wp-places-map',
			[ $this, 'render' ]
		);

		add_options_page(
			__( 'Places Map', 'wp-places-map' ),
			__( 'Places Map', 'wp-places-map' ),
			'manage_options',
			'wp-places-map',
			[ $this, 'render' ]
		);
	}

	public function register() {
		register_setting( 'wppm_settings_group', WPPM_OPT, [
			'type'              => 'array',
			'sanitize_callback' => [ $this, 'sanitize' ],
			'default'           => [],
		] );
	}

	public function sanitize( $input ) {
		$out = [];

		$out['api_key']       = isset( $input['api_key'] ) ? sanitize_text_field( $input['api_key'] ) : '';
		$out['default_lat']   = isset( $input['default_lat'] ) ? WPPM_Meta::sanitize( $input['default_lat'], 'coord' ) : '49.7437';
		$out['default_lng']   = isset( $input['default_lng'] ) ? WPPM_Meta::sanitize( $input['default_lng'], 'coord' ) : '15.3386';
		$out['default_zoom']  = isset( $input['default_zoom'] ) ? max( 2, min( 20, (int) $input['default_zoom'] ) ) : 7;
		$out['brand_color']   = $this->color( $input['brand_color'] ?? '', '#41C8F4' );
		$out['cluster_color'] = $this->color( $input['cluster_color'] ?? '', '#41C8F4' );
		$out['map_style']     = isset( $input['map_style'] ) && in_array( $input['map_style'], [ 'light', 'default', 'silver' ], true ) ? $input['map_style'] : 'light';
		$out['show_filters']  = ! empty( $input['show_filters'] ) ? 1 : 0;
		$out['cluster']       = ! empty( $input['cluster'] ) ? 1 : 0;
		$out['height']        = isset( $input['height'] ) ? max( 200, min( 1200, (int) $input['height'] ) ) : 600;
		$out['preserve_data'] = ! empty( $input['preserve_data'] ) ? 1 : 0;
		$out['github_token']  = isset( $input['github_token'] ) ? sanitize_text_field( $input['github_token'] ) : '';
		$out['show_regions']  = ! empty( $input['show_regions'] ) ? 1 : 0;
		$out['region_color']  = $this->color( $input['region_color'] ?? '', '#41C8F4' );

		delete_transient( WPPM_CACHE_KEY );
		return $out;
	}

	private function color( $val, $fallback ) {
		$v = sanitize_hex_color( $val );
		return $v ? $v : $fallback;
	}

	public function render() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$opts = wp_parse_args( self::get(), [
			'api_key'       => '',
			'default_lat'   => '49.7437',
			'default_lng'   => '15.3386',
			'default_zoom'  => 7,
			'brand_color'   => '#41C8F4',
			'cluster_color' => '#41C8F4',
			'map_style'     => 'light',
			'show_filters'  => 1,
			'cluster'       => 1,
			'height'        => 600,
			'preserve_data' => 1,
			'github_token'  => '',
			'show_regions'  => 1,
			'region_color'  => '#41C8F4',
		] );
		?>
		<div class="wrap wppm-settings">
			<h1><?php esc_html_e( 'Places Map – Nastavení', 'wp-places-map' ); ?></h1>

			<div class="wppm-settings-layout">

				<form method="post" action="options.php" class="wppm-settings-form">
					<?php settings_fields( 'wppm_settings_group' ); ?>

					<h2 class="title"><?php esc_html_e( 'Google Maps API', 'wp-places-map' ); ?></h2>
					<table class="form-table" role="presentation">
						<tr>
							<th scope="row">
								<label for="wppm_api_key"><?php esc_html_e( 'API klíč', 'wp-places-map' ); ?></label>
							</th>
							<td>
								<input type="text" id="wppm_api_key" name="<?php echo esc_attr( WPPM_OPT ); ?>[api_key]" value="<?php echo esc_attr( $opts['api_key'] ); ?>" class="regular-text code" autocomplete="off" />
								<p class="description">
									<?php
									printf(
										/* translators: %s: link to Google Cloud Console */
										esc_html__( 'Vygenerujte v %s. Povolte: Maps JavaScript API + Geocoding API. Omezte na HTTP referrer s doménou vašeho webu.', 'wp-places-map' ),
										'<a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noopener">Google Cloud Console</a>'
									);
									?>
								</p>
							</td>
						</tr>
					</table>

					<h2 class="title"><?php esc_html_e( 'Výchozí pohled mapy', 'wp-places-map' ); ?></h2>
					<table class="form-table" role="presentation">
						<tr>
							<th scope="row"><label for="wppm_lat"><?php esc_html_e( 'Lat', 'wp-places-map' ); ?></label></th>
							<td><input type="text" id="wppm_lat" name="<?php echo esc_attr( WPPM_OPT ); ?>[default_lat]" value="<?php echo esc_attr( $opts['default_lat'] ); ?>" class="small-text" /></td>
						</tr>
						<tr>
							<th scope="row"><label for="wppm_lng"><?php esc_html_e( 'Lng', 'wp-places-map' ); ?></label></th>
							<td><input type="text" id="wppm_lng" name="<?php echo esc_attr( WPPM_OPT ); ?>[default_lng]" value="<?php echo esc_attr( $opts['default_lng'] ); ?>" class="small-text" /></td>
						</tr>
						<tr>
							<th scope="row"><label for="wppm_zoom"><?php esc_html_e( 'Zoom (2–20)', 'wp-places-map' ); ?></label></th>
							<td><input type="number" id="wppm_zoom" name="<?php echo esc_attr( WPPM_OPT ); ?>[default_zoom]" value="<?php echo esc_attr( $opts['default_zoom'] ); ?>" min="2" max="20" class="small-text" /></td>
						</tr>
						<tr>
							<th scope="row"><label for="wppm_height"><?php esc_html_e( 'Výška mapy (px)', 'wp-places-map' ); ?></label></th>
							<td><input type="number" id="wppm_height" name="<?php echo esc_attr( WPPM_OPT ); ?>[height]" value="<?php echo esc_attr( $opts['height'] ); ?>" min="200" max="1200" class="small-text" /></td>
						</tr>
					</table>

					<h2 class="title"><?php esc_html_e( 'Vzhled', 'wp-places-map' ); ?></h2>
					<table class="form-table" role="presentation">
						<tr>
							<th scope="row"><label for="wppm_brand_color"><?php esc_html_e( 'Barva markeru', 'wp-places-map' ); ?></label></th>
							<td><input type="text" id="wppm_brand_color" name="<?php echo esc_attr( WPPM_OPT ); ?>[brand_color]" value="<?php echo esc_attr( $opts['brand_color'] ); ?>" class="wppm-color-picker" data-default="#41C8F4" /></td>
						</tr>
						<tr>
							<th scope="row"><label for="wppm_cluster_color"><?php esc_html_e( 'Barva clusterů', 'wp-places-map' ); ?></label></th>
							<td><input type="text" id="wppm_cluster_color" name="<?php echo esc_attr( WPPM_OPT ); ?>[cluster_color]" value="<?php echo esc_attr( $opts['cluster_color'] ); ?>" class="wppm-color-picker" data-default="#41C8F4" /></td>
						</tr>
						<tr>
							<th scope="row"><label for="wppm_style"><?php esc_html_e( 'Styl podkladu', 'wp-places-map' ); ?></label></th>
							<td>
								<select id="wppm_style" name="<?php echo esc_attr( WPPM_OPT ); ?>[map_style]">
									<option value="light" <?php selected( $opts['map_style'], 'light' ); ?>><?php esc_html_e( 'Světlý minimalistický', 'wp-places-map' ); ?></option>
									<option value="silver" <?php selected( $opts['map_style'], 'silver' ); ?>><?php esc_html_e( 'Silver (Google preset)', 'wp-places-map' ); ?></option>
									<option value="default" <?php selected( $opts['map_style'], 'default' ); ?>><?php esc_html_e( 'Výchozí Google styl', 'wp-places-map' ); ?></option>
								</select>
							</td>
						</tr>
						<tr>
							<th scope="row"><?php esc_html_e( 'Kraje ČR', 'wp-places-map' ); ?></th>
							<td>
								<label>
									<input type="checkbox" name="<?php echo esc_attr( WPPM_OPT ); ?>[show_regions]" value="1" <?php checked( ! empty( $opts['show_regions'] ) ); ?> />
									<?php esc_html_e( 'Zobrazit interaktivní hranice 14 krajů ČR (najetím se kraj zvýrazní, klik filtruje místa)', 'wp-places-map' ); ?>
								</label>
							</td>
						</tr>
						<tr>
							<th scope="row"><label for="wppm_region_color"><?php esc_html_e( 'Barva krajů', 'wp-places-map' ); ?></label></th>
							<td><input type="text" id="wppm_region_color" name="<?php echo esc_attr( WPPM_OPT ); ?>[region_color]" value="<?php echo esc_attr( $opts['region_color'] ); ?>" class="wppm-color-picker" data-default="#41C8F4" /></td>
						</tr>
					</table>

					<h2 class="title"><?php esc_html_e( 'Chování', 'wp-places-map' ); ?></h2>
					<table class="form-table" role="presentation">
						<tr>
							<th scope="row"><?php esc_html_e( 'Filtry typů zařízení', 'wp-places-map' ); ?></th>
							<td>
								<label>
									<input type="checkbox" name="<?php echo esc_attr( WPPM_OPT ); ?>[show_filters]" value="1" <?php checked( ! empty( $opts['show_filters'] ) ); ?> />
									<?php esc_html_e( 'Zobrazit tlačítka pro filtraci nad mapou', 'wp-places-map' ); ?>
								</label>
							</td>
						</tr>
						<tr>
							<th scope="row"><?php esc_html_e( 'Marker clustering', 'wp-places-map' ); ?></th>
							<td>
								<label>
									<input type="checkbox" name="<?php echo esc_attr( WPPM_OPT ); ?>[cluster]" value="1" <?php checked( ! empty( $opts['cluster'] ) ); ?> />
									<?php esc_html_e( 'Při oddálení seskupit blízké markery', 'wp-places-map' ); ?>
								</label>
							</td>
						</tr>
						<tr>
							<th scope="row"><?php esc_html_e( 'Při odinstalaci', 'wp-places-map' ); ?></th>
							<td>
								<label>
									<input type="checkbox" name="<?php echo esc_attr( WPPM_OPT ); ?>[preserve_data]" value="1" <?php checked( ! empty( $opts['preserve_data'] ) ); ?> />
									<?php esc_html_e( 'Ponechat zařízení v databázi (doporučeno)', 'wp-places-map' ); ?>
								</label>
							</td>
						</tr>
					</table>

					<h2 class="title"><?php esc_html_e( 'Automatické aktualizace (GitHub)', 'wp-places-map' ); ?></h2>
					<table class="form-table" role="presentation">
						<tr>
							<th scope="row">
								<label for="wppm_github_token"><?php esc_html_e( 'GitHub token', 'wp-places-map' ); ?></label>
							</th>
							<td>
								<?php
								$token_locked = defined( 'WPPM_GITHUB_TOKEN' ) && WPPM_GITHUB_TOKEN;
								if ( $token_locked ) {
									echo '<input type="text" class="regular-text code" value="' . esc_attr( '••••• ' . __( 'definováno v wp-config.php', 'wp-places-map' ) ) . '" disabled />';
								} else {
									?>
									<input type="password" id="wppm_github_token" name="<?php echo esc_attr( WPPM_OPT ); ?>[github_token]" value="<?php echo esc_attr( $opts['github_token'] ); ?>" class="regular-text code" autocomplete="off" />
									<?php
								}
								?>
								<p class="description">
									<?php
									echo wp_kses(
										sprintf(
											/* translators: 1: repo URL, 2: GitHub tokens settings URL */
											__( 'Plugin se aktualizuje z %1$s. Pole vyplňte <strong>pouze</strong> pokud je repo privátní, nebo pokud narážíte na GitHub API rate limit. <a href="%2$s" target="_blank" rel="noopener">Vytvořit token</a> (oprávnění: jen <code>public_repo</code> nebo <code>repo</code> pro privátní).', 'wp-places-map' ),
											'<a href="' . esc_url( WPPM_GITHUB_REPO ) . '" target="_blank" rel="noopener">' . esc_html( str_replace( 'https://github.com/', '', WPPM_GITHUB_REPO ) ) . '</a>',
											'https://github.com/settings/tokens/new?scopes=public_repo&description=WP+Places+Map+updates'
										),
										[ 'a' => [ 'href' => [], 'target' => [], 'rel' => [] ], 'strong' => [], 'code' => [] ]
									);
									?>
								</p>
							</td>
						</tr>
					</table>

					<?php submit_button( __( 'Uložit nastavení', 'wp-places-map' ) ); ?>
				</form>

				<aside class="wppm-settings-aside">
					<div class="wppm-card">
						<h3><?php esc_html_e( 'Použití v Divi / WordPress', 'wp-places-map' ); ?></h3>
						<p><?php esc_html_e( 'Vložte shortcode kamkoliv do stránky:', 'wp-places-map' ); ?></p>
						<code class="wppm-snippet">[wp_places_map]</code>
						<p style="margin-top:14px;"><?php esc_html_e( 'Volitelné parametry:', 'wp-places-map' ); ?></p>
						<code class="wppm-snippet">[wp_places_map height="600" zoom="7" filters="yes" cluster="yes"]</code>
						<p style="margin-top:14px;"><?php esc_html_e( 'Filtrovat pouze jeden typ:', 'wp-places-map' ); ?></p>
						<code class="wppm-snippet">[wp_places_map type="nemocnice"]</code>
					</div>

					<div class="wppm-card">
						<h3><?php esc_html_e( 'Hromadný import', 'wp-places-map' ); ?></h3>
						<p><?php esc_html_e( 'Načtěte více zařízení z CSV souboru najednou.', 'wp-places-map' ); ?></p>
						<a class="button button-primary" href="<?php echo esc_url( admin_url( 'edit.php?post_type=' . WPPM_CPT . '&page=wp-places-map-import' ) ); ?>">
							<?php esc_html_e( 'Otevřít CSV import', 'wp-places-map' ); ?>
						</a>
					</div>

					<div class="wppm-card">
						<h3><?php esc_html_e( 'REST API', 'wp-places-map' ); ?></h3>
						<p><?php esc_html_e( 'Veřejný read-only endpoint:', 'wp-places-map' ); ?></p>
						<code class="wppm-snippet"><?php echo esc_html( rest_url( WPPM_REST_NS . '/facilities' ) ); ?></code>
					</div>
				</aside>

			</div>
		</div>
		<?php
	}
}
