<?php
/**
 * CSV bulk importer.
 *
 * Expected CSV columns (header row required, case-insensitive, comma- or semicolon-separated):
 *   title, type, address, city, zip, lat, lng, phone, email, website, hours, description
 *
 * @package WPPlacesMap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class WPPM_Importer {

	private static $instance = null;

	const SLUG = 'wp-places-map-import';

	public static function instance() {
		if ( self::$instance === null ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function init() {
		add_action( 'admin_menu', [ $this, 'menu' ] );
	}

	public function menu() {
		add_submenu_page(
			'edit.php?post_type=' . WPPM_CPT,
			__( 'Import zařízení (CSV)', 'wp-places-map' ),
			__( 'Import CSV', 'wp-places-map' ),
			'manage_options',
			self::SLUG,
			[ $this, 'render' ]
		);
	}

	public function render() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$report = null;
		if ( isset( $_POST['wppm_import_nonce'] ) && wp_verify_nonce( $_POST['wppm_import_nonce'], 'wppm_import' ) ) {
			$report = $this->handle_upload();
		}

		?>
		<div class="wrap wppm-import">
			<h1><?php esc_html_e( 'Hromadný import zařízení z CSV', 'wp-places-map' ); ?></h1>

			<?php if ( $report ) : ?>
				<div class="notice notice-<?php echo $report['errors'] ? 'warning' : 'success'; ?> is-dismissible">
					<p>
						<strong><?php esc_html_e( 'Import dokončen.', 'wp-places-map' ); ?></strong>
						<?php
						printf(
							/* translators: 1: created count, 2: updated count, 3: skipped count, 4: geocoded count */
							esc_html__( 'Vytvořeno: %1$d • Aktualizováno: %2$d • Přeskočeno: %3$d • Geokódováno: %4$d', 'wp-places-map' ),
							(int) $report['created'],
							(int) $report['updated'],
							(int) $report['skipped'],
							(int) $report['geocoded']
						);
						?>
					</p>
					<?php if ( ! empty( $report['errors'] ) ) : ?>
						<details>
							<summary><?php esc_html_e( 'Zobrazit chyby', 'wp-places-map' ); ?></summary>
							<ul style="margin-top:8px;">
								<?php foreach ( $report['errors'] as $err ) : ?>
									<li><?php echo esc_html( $err ); ?></li>
								<?php endforeach; ?>
							</ul>
						</details>
					<?php endif; ?>
				</div>
			<?php endif; ?>

			<div class="wppm-import-layout">

				<form method="post" enctype="multipart/form-data" class="wppm-import-form">
					<?php wp_nonce_field( 'wppm_import', 'wppm_import_nonce' ); ?>

					<table class="form-table" role="presentation">
						<tr>
							<th scope="row"><label for="wppm_csv"><?php esc_html_e( 'CSV soubor', 'wp-places-map' ); ?></label></th>
							<td>
								<input type="file" id="wppm_csv" name="wppm_csv" accept=".csv,text/csv" required />
								<p class="description"><?php esc_html_e( 'UTF-8 kódování, oddělovač čárka nebo středník.', 'wp-places-map' ); ?></p>
							</td>
						</tr>
						<tr>
							<th scope="row"><?php esc_html_e( 'Možnosti', 'wp-places-map' ); ?></th>
							<td>
								<label>
									<input type="checkbox" name="auto_geocode" value="1" checked />
									<?php esc_html_e( 'Automaticky dohledat GPS u řádků bez souřadnic (vyžaduje API klíč).', 'wp-places-map' ); ?>
								</label>
								<br />
								<label>
									<input type="checkbox" name="update_existing" value="1" />
									<?php esc_html_e( 'Aktualizovat existující záznam podle shodného názvu', 'wp-places-map' ); ?>
								</label>
							</td>
						</tr>
					</table>

					<?php submit_button( __( 'Naimportovat zařízení', 'wp-places-map' ) ); ?>
				</form>

				<aside class="wppm-import-aside">
					<div class="wppm-card">
						<h3><?php esc_html_e( 'Formát CSV', 'wp-places-map' ); ?></h3>
						<p><?php esc_html_e( 'První řádek musí obsahovat hlavičku se sloupci:', 'wp-places-map' ); ?></p>
						<code class="wppm-snippet">title,type,address,city,zip,lat,lng,phone,email,website,hours,description</code>
						<ul style="margin-top:10px;">
							<li><strong>title</strong> — <?php esc_html_e( 'povinné, název zařízení', 'wp-places-map' ); ?></li>
							<li><strong>type</strong> — <?php esc_html_e( 'slug typu (např. prakticky-lekar, nemocnice, ambulance, lekarna)', 'wp-places-map' ); ?></li>
							<li><strong>lat/lng</strong> — <?php esc_html_e( 'volitelné — pokud chybí, dohledá se z adresy', 'wp-places-map' ); ?></li>
						</ul>
						<p style="margin-top:14px;">
							<a class="button" href="<?php echo esc_url( WPPM_URL . 'sample-data/facilities.sample.csv' ); ?>" download>
								<?php esc_html_e( 'Stáhnout vzorové CSV', 'wp-places-map' ); ?>
							</a>
						</p>
					</div>
				</aside>

			</div>
		</div>
		<?php
	}

	private function handle_upload() {
		$report = [
			'created'  => 0,
			'updated'  => 0,
			'skipped'  => 0,
			'geocoded' => 0,
			'errors'   => [],
		];

		if ( empty( $_FILES['wppm_csv']['tmp_name'] ) || ! is_uploaded_file( $_FILES['wppm_csv']['tmp_name'] ) ) {
			$report['errors'][] = __( 'Nebyl odeslán žádný soubor.', 'wp-places-map' );
			return $report;
		}

		$file = $_FILES['wppm_csv']['tmp_name'];

		$handle = fopen( $file, 'r' );
		if ( ! $handle ) {
			$report['errors'][] = __( 'Nepodařilo se otevřít soubor.', 'wp-places-map' );
			return $report;
		}

		// Detect delimiter from first line.
		$firstLine = fgets( $handle );
		rewind( $handle );
		$delimiter = ( substr_count( $firstLine, ';' ) > substr_count( $firstLine, ',' ) ) ? ';' : ',';

		// Strip UTF-8 BOM if present.
		$bom = fread( $handle, 3 );
		if ( $bom !== "\xEF\xBB\xBF" ) {
			rewind( $handle );
		}

		$header = fgetcsv( $handle, 0, $delimiter );
		if ( ! $header ) {
			$report['errors'][] = __( 'CSV neobsahuje hlavičku.', 'wp-places-map' );
			fclose( $handle );
			return $report;
		}

		$header = array_map( static function ( $h ) {
			return strtolower( trim( (string) $h ) );
		}, $header );

		$auto_geocode    = ! empty( $_POST['auto_geocode'] );
		$update_existing = ! empty( $_POST['update_existing'] );
		$has_api_key     = (bool) WPPM_Settings::get( 'api_key', '' );

		$row_n = 1;
		while ( ( $row = fgetcsv( $handle, 0, $delimiter ) ) !== false ) {
			$row_n++;
			if ( count( array_filter( $row, static function ( $v ) {
				return trim( (string) $v ) !== '';
			} ) ) === 0 ) {
				continue; // empty row
			}

			$data = [];
			foreach ( $header as $i => $col ) {
				$data[ $col ] = isset( $row[ $i ] ) ? trim( (string) $row[ $i ] ) : '';
			}

			$title = $data['title'] ?? '';
			if ( $title === '' ) {
				$report['skipped']++;
				$report['errors'][] = sprintf( __( 'Řádek %d: chybí název (title), přeskočeno.', 'wp-places-map' ), $row_n );
				continue;
			}

			$lat = $data['lat'] ?? '';
			$lng = $data['lng'] ?? '';

			$needs_geocode = ( $lat === '' || $lng === '' );
			if ( $needs_geocode && $auto_geocode && $has_api_key ) {
				$addr_parts = array_filter( [
					$data['address'] ?? '',
					$data['city'] ?? '',
					$data['zip'] ?? '',
					'Česká republika',
				] );
				$geo = WPPM_Geocoder::geocode( implode( ', ', $addr_parts ) );
				if ( ! is_wp_error( $geo ) ) {
					$lat = (string) $geo['lat'];
					$lng = (string) $geo['lng'];
					$report['geocoded']++;
				} else {
					$report['errors'][] = sprintf( '%s: %s', $title, $geo->get_error_message() );
				}
			}

			// Find existing post by title (only if update enabled).
			$existing_id = 0;
			if ( $update_existing ) {
				$found = get_posts( [
					'post_type'      => WPPM_CPT,
					'post_status'    => 'any',
					'title'          => $title,
					'posts_per_page' => 1,
					'fields'         => 'ids',
					'no_found_rows'  => true,
				] );
				if ( ! empty( $found ) ) {
					$existing_id = (int) $found[0];
				}
			}

			$post_data = [
				'post_type'    => WPPM_CPT,
				'post_status'  => 'publish',
				'post_title'   => $title,
				'post_content' => $data['description'] ?? '',
			];

			if ( $existing_id ) {
				$post_data['ID'] = $existing_id;
				$post_id         = wp_update_post( $post_data, true );
				$is_new          = false;
			} else {
				$post_id = wp_insert_post( $post_data, true );
				$is_new  = true;
			}

			if ( is_wp_error( $post_id ) ) {
				$report['errors'][] = sprintf( '%s: %s', $title, $post_id->get_error_message() );
				continue;
			}

			// Meta.
			$meta_map = [
				'_wppm_address' => $data['address'] ?? '',
				'_wppm_city'    => $data['city'] ?? '',
				'_wppm_zip'     => $data['zip'] ?? '',
				'_wppm_lat'     => $lat,
				'_wppm_lng'     => $lng,
				'_wppm_phone'   => $data['phone'] ?? '',
				'_wppm_email'   => $data['email'] ?? '',
				'_wppm_website' => $data['website'] ?? '',
				'_wppm_hours'   => $data['hours'] ?? '',
			];
			foreach ( $meta_map as $key => $val ) {
				if ( $val === '' || $val === null ) {
					delete_post_meta( $post_id, $key );
				} else {
					$type = ( $key === '_wppm_lat' || $key === '_wppm_lng' ) ? 'coord'
						: ( $key === '_wppm_email' ? 'email'
						: ( $key === '_wppm_website' ? 'url'
						: ( $key === '_wppm_hours' ? 'textarea' : 'text' ) ) );
					update_post_meta( $post_id, $key, WPPM_Meta::sanitize( $val, $type ) );
				}
			}

			// Taxonomy.
			$type_slug = isset( $data['type'] ) ? sanitize_title( $data['type'] ) : '';
			if ( $type_slug ) {
				$term = get_term_by( 'slug', $type_slug, WPPM_TAX );
				if ( ! $term ) {
					$ins = wp_insert_term( ucfirst( str_replace( '-', ' ', $type_slug ) ), WPPM_TAX, [ 'slug' => $type_slug ] );
					if ( ! is_wp_error( $ins ) ) {
						$term_id = $ins['term_id'];
					}
				} else {
					$term_id = $term->term_id;
				}
				if ( ! empty( $term_id ) ) {
					wp_set_post_terms( $post_id, [ (int) $term_id ], WPPM_TAX, false );
				}
			}

			if ( $is_new ) {
				$report['created']++;
			} else {
				$report['updated']++;
			}
		}

		fclose( $handle );
		delete_transient( WPPM_CACHE_KEY );

		return $report;
	}
}
