<?php
/**
 * [wp_places_map] shortcode.
 *
 * @package WPPlacesMap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class WPPM_Shortcode {

	private static $instance = null;

	const HANDLE_GMAPS   = 'wppm-gmaps';
	const HANDLE_CLUSTER = 'wppm-cluster';
	const HANDLE_APP     = 'wppm-frontend';
	const HANDLE_CSS     = 'wppm-frontend';

	private $instance_count = 0;

	public static function instance() {
		if ( self::$instance === null ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function init() {
		add_shortcode( 'wp_places_map', [ $this, 'render' ] );
	}

	public function render( $atts ) {
		$settings = WPPM_Settings::get();

		$atts = shortcode_atts( [
			'height'  => $settings['height'] ?? 600,
			'zoom'    => $settings['default_zoom'] ?? 7,
			'lat'     => $settings['default_lat'] ?? '49.7437',
			'lng'     => $settings['default_lng'] ?? '15.3386',
			'type'    => '',
			'filters' => ( ! empty( $settings['show_filters'] ) ) ? 'yes' : 'no',
			'cluster' => ( ! empty( $settings['cluster'] ) ) ? 'yes' : 'no',
			'regions' => ( ! empty( $settings['show_regions'] ) ) ? 'yes' : 'no',
			'search'  => ( ! empty( $settings['show_search'] ) ) ? 'yes' : 'no',
			'class'   => '',
		], $atts, 'wp_places_map' );

		$api_key = $settings['api_key'] ?? '';
		if ( empty( $api_key ) ) {
			if ( current_user_can( 'manage_options' ) ) {
				return sprintf(
					'<div class="wppm-error" role="alert"><strong>Places Map:</strong> %s <a href="%s">%s</a>.</div>',
					esc_html__( 'Doplňte Google Maps API klíč v', 'wp-places-map' ),
					esc_url( admin_url( 'options-general.php?page=wp-places-map' ) ),
					esc_html__( 'nastavení pluginu', 'wp-places-map' )
				);
			}
			return '';
		}

		$this->enqueue_assets( $api_key, $settings );

		$this->instance_count++;
		$id = 'wppm-' . $this->instance_count . '-' . substr( md5( uniqid( '', true ) ), 0, 8 );

		// Filter terms (used by JS to build buttons).
		$terms = [];
		if ( $this->bool( $atts['filters'] ) ) {
			$all = get_terms( [
				'taxonomy'   => WPPM_TAX,
				'hide_empty' => true,
			] );
			if ( ! is_wp_error( $all ) ) {
				foreach ( $all as $t ) {
					$terms[] = [ 'slug' => $t->slug, 'label' => $t->name, 'count' => (int) $t->count ];
				}
			}
		}

		$config = [
			'id'             => $id,
			'restUrl'        => esc_url_raw( rest_url( WPPM_REST_NS . '/facilities' ) ),
			'center'         => [
				'lat' => (float) $atts['lat'],
				'lng' => (float) $atts['lng'],
			],
			'zoom'           => (int) $atts['zoom'],
			'typeFilter'     => sanitize_title( $atts['type'] ),
			'cluster'        => $this->bool( $atts['cluster'] ),
			'filters'        => $this->bool( $atts['filters'] ),
			'terms'          => $terms,
			'brandColor'     => $settings['brand_color'] ?? '#41C8F4',
			'clusterColor'   => $settings['cluster_color'] ?? '#41C8F4',
			'mapStylePreset' => $settings['map_style'] ?? 'light',
			'regions'        => $this->bool( $atts['regions'] ),
			'regionsUrl'     => esc_url_raw( WPPM_URL . 'assets/geojson/cz-kraje.geojson' ),
			'regionColor'    => $settings['region_color'] ?? '#41C8F4',
			'search'         => $this->bool( $atts['search'] ),
			'i18n'           => [
				'all'           => __( 'Vše', 'wp-places-map' ),
				'loading'       => __( 'Načítám zařízení…', 'wp-places-map' ),
				'empty'         => __( 'Zatím nejsou k dispozici žádná zařízení.', 'wp-places-map' ),
				'error'         => __( 'Mapu se nepodařilo načíst.', 'wp-places-map' ),
				'phone'         => __( 'Telefon', 'wp-places-map' ),
				'email'         => __( 'E-mail', 'wp-places-map' ),
				'web'           => __( 'Web', 'wp-places-map' ),
				'hours'         => __( 'Otevírací doba', 'wp-places-map' ),
				'navigate'      => __( 'Navigovat', 'wp-places-map' ),
				'placesCount'   => __( 'zařízení', 'wp-places-map' ),
				'placeCount'    => __( 'zařízení', 'wp-places-map' ),
				'clearRegion'   => __( 'Zobrazit všechny kraje', 'wp-places-map' ),
				'regionLabel'   => __( 'Kraj:', 'wp-places-map' ),
				'searchPlace'   => __( 'Hledat zařízení (název, město, ulice)…', 'wp-places-map' ),
				'searchClear'   => __( 'Zrušit hledání', 'wp-places-map' ),
				'searchNoMatch' => __( 'Žádné zařízení neodpovídá hledání.', 'wp-places-map' ),
				'resultsShown'  => __( 'Zobrazeno %1$d z %2$d zařízení', 'wp-places-map' ),
			],
		];

		wp_add_inline_script(
			self::HANDLE_APP,
			'window.WPPMInstances = window.WPPMInstances || []; window.WPPMInstances.push(' . wp_json_encode( $config ) . ');',
			'before'
		);

		$classes = trim( 'wppm-wrap ' . sanitize_html_class( $atts['class'] ) );

		ob_start();
		?>
		<div class="<?php echo esc_attr( $classes ); ?>" id="<?php echo esc_attr( $id ); ?>" data-wppm data-instance="<?php echo esc_attr( $id ); ?>">

			<div class="wppm-controls">
				<?php if ( $this->bool( $atts['search'] ) ) : ?>
					<div class="wppm-search" role="search">
						<svg class="wppm-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<circle cx="11" cy="11" r="7"/>
							<line x1="21" y1="21" x2="16.65" y2="16.65"/>
						</svg>
						<input type="search" class="wppm-search-input" placeholder="<?php esc_attr_e( 'Hledat zařízení (název, město, ulice)…', 'wp-places-map' ); ?>" aria-label="<?php esc_attr_e( 'Hledat zařízení', 'wp-places-map' ); ?>" autocomplete="off" />
						<button type="button" class="wppm-search-clear" aria-label="<?php esc_attr_e( 'Zrušit hledání', 'wp-places-map' ); ?>" hidden>×</button>
					</div>
				<?php endif; ?>

				<?php if ( ! empty( $terms ) ) : ?>
					<div class="wppm-filters" role="tablist" aria-label="<?php esc_attr_e( 'Filtrovat typ zařízení', 'wp-places-map' ); ?>">
						<button type="button" class="wppm-filter is-active" role="tab" aria-selected="true" data-filter="">
							<?php esc_html_e( 'Vše', 'wp-places-map' ); ?>
						</button>
						<?php foreach ( $terms as $term ) : ?>
							<button type="button" class="wppm-filter" role="tab" aria-selected="false" data-filter="<?php echo esc_attr( $term['slug'] ); ?>">
								<?php echo esc_html( $term['label'] ); ?>
								<span class="wppm-filter-count"><?php echo esc_html( $term['count'] ); ?></span>
							</button>
						<?php endforeach; ?>
					</div>
				<?php endif; ?>
			</div>

			<div class="wppm-canvas" style="height: <?php echo (int) $atts['height']; ?>px;">
				<div class="wppm-loading" aria-live="polite">
					<span class="wppm-spinner" aria-hidden="true"></span>
					<span><?php esc_html_e( 'Načítám mapu…', 'wp-places-map' ); ?></span>
				</div>
				<div class="wppm-map" aria-label="<?php esc_attr_e( 'Interaktivní mapa zapojených zdravotnických zařízení', 'wp-places-map' ); ?>"></div>
			</div>
		</div>
		<?php
		return ob_get_clean();
	}

	private function bool( $val ) {
		if ( is_bool( $val ) ) {
			return $val;
		}
		$v = strtolower( trim( (string) $val ) );
		return in_array( $v, [ '1', 'yes', 'true', 'on' ], true );
	}

	private function enqueue_assets( $api_key, $settings ) {
		if ( wp_script_is( self::HANDLE_APP, 'registered' ) ) {
			return;
		}

		wp_register_style(
			self::HANDLE_CSS,
			WPPM_URL . 'assets/css/frontend.css',
			[],
			WPPM_VERSION
		);
		wp_enqueue_style( self::HANDLE_CSS );

		wp_register_script(
			self::HANDLE_CLUSTER,
			'https://unpkg.com/@googlemaps/markerclusterer@2.5.3/dist/index.min.js',
			[],
			'2.5.3',
			true
		);
		wp_enqueue_script( self::HANDLE_CLUSTER );

		wp_register_script(
			self::HANDLE_APP,
			WPPM_URL . 'assets/js/frontend.js',
			[ self::HANDLE_CLUSTER ],
			WPPM_VERSION,
			true
		);
		wp_enqueue_script( self::HANDLE_APP );

		// Google Maps loaded last via the global callback the frontend script defines.
		wp_register_script(
			self::HANDLE_GMAPS,
			'https://maps.googleapis.com/maps/api/js?key=' . rawurlencode( $api_key ) . '&libraries=geometry&loading=async&callback=WPPM_onMapsReady',
			[ self::HANDLE_APP ],
			null,
			true
		);
		wp_enqueue_script( self::HANDLE_GMAPS );
	}
}
