<?php
/**
 * Facility meta-box: address, GPS, contact, hours, website.
 *
 * @package WPPlacesMap
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class WPPM_Meta {

	private static $instance = null;

	const NONCE_FIELD  = 'wppm_meta_nonce';
	const NONCE_ACTION = 'wppm_save_meta';

	/** Whitelisted meta keys + sanitisation. */
	const FIELDS = [
		'_wppm_address' => 'text',
		'_wppm_city'    => 'text',
		'_wppm_zip'     => 'text',
		'_wppm_lat'     => 'coord',
		'_wppm_lng'     => 'coord',
		'_wppm_phone'   => 'text',
		'_wppm_email'   => 'email',
		'_wppm_website' => 'url',
		'_wppm_hours'   => 'textarea',
	];

	public static function instance() {
		if ( self::$instance === null ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function init() {
		add_action( 'add_meta_boxes', [ $this, 'register_box' ] );
		add_action( 'save_post_' . WPPM_CPT, [ $this, 'save' ], 10, 2 );
		add_action( 'save_post_' . WPPM_CPT, [ $this, 'bust_cache' ], 99 );
		add_action( 'deleted_post', [ $this, 'bust_cache_on_delete' ] );
	}

	public function register_box() {
		add_meta_box(
			'wppm-details',
			__( 'Detaily zařízení', 'wp-places-map' ),
			[ $this, 'render' ],
			WPPM_CPT,
			'normal',
			'high'
		);
	}

	public function render( $post ) {
		wp_nonce_field( self::NONCE_ACTION, self::NONCE_FIELD );

		$values = [];
		foreach ( array_keys( self::FIELDS ) as $key ) {
			$values[ $key ] = get_post_meta( $post->ID, $key, true );
		}
		?>
		<div class="wppm-meta-grid">

			<div class="wppm-field wppm-field--full wppm-autocomplete">
				<label for="wppm_autocomplete"><?php esc_html_e( 'Vyhledat adresu (Google Places)', 'wp-places-map' ); ?></label>
				<input type="text" id="wppm_autocomplete" placeholder="<?php esc_attr_e( 'začněte psát adresu — např. Jiráskova 12 Pardubice', 'wp-places-map' ); ?>" autocomplete="off" />
				<p class="wppm-autocomplete-hint">
					<span class="dashicons dashicons-lightbulb"></span>
					<?php esc_html_e( 'Vyberte adresu z rozbalovacího seznamu — pole níže (ulice, město, PSČ, GPS) se vyplní automaticky a marker se posadí na přesné místo.', 'wp-places-map' ); ?>
				</p>
				<p id="wppm-autocomplete-status" class="wppm-validated" aria-live="polite" hidden></p>
			</div>

			<div class="wppm-section-sep" aria-hidden="true">
				<span><?php esc_html_e( '— nebo zadejte ručně —', 'wp-places-map' ); ?></span>
			</div>

			<div class="wppm-field wppm-field--full">
				<label for="wppm_address"><?php esc_html_e( 'Ulice a č.p.', 'wp-places-map' ); ?></label>
				<input type="text" id="wppm_address" name="_wppm_address" value="<?php echo esc_attr( $values['_wppm_address'] ); ?>" placeholder="<?php esc_attr_e( 'např. Jiráskova 1320', 'wp-places-map' ); ?>" />
			</div>

			<div class="wppm-field">
				<label for="wppm_city"><?php esc_html_e( 'Město', 'wp-places-map' ); ?></label>
				<input type="text" id="wppm_city" name="_wppm_city" value="<?php echo esc_attr( $values['_wppm_city'] ); ?>" placeholder="<?php esc_attr_e( 'např. Pardubice', 'wp-places-map' ); ?>" />
			</div>

			<div class="wppm-field">
				<label for="wppm_zip"><?php esc_html_e( 'PSČ', 'wp-places-map' ); ?></label>
				<input type="text" id="wppm_zip" name="_wppm_zip" value="<?php echo esc_attr( $values['_wppm_zip'] ); ?>" placeholder="530 02" />
			</div>

			<div class="wppm-field wppm-field--full">
				<button type="button" class="button button-secondary" id="wppm-geocode-btn">
					<span class="dashicons dashicons-location"></span>
					<?php esc_html_e( 'Dohledat GPS souřadnice z adresy', 'wp-places-map' ); ?>
				</button>
				<span id="wppm-geocode-status" class="wppm-status" aria-live="polite"></span>
			</div>

			<div class="wppm-field">
				<label for="wppm_lat"><?php esc_html_e( 'Zeměpisná šířka (lat)', 'wp-places-map' ); ?></label>
				<input type="text" id="wppm_lat" name="_wppm_lat" value="<?php echo esc_attr( $values['_wppm_lat'] ); ?>" placeholder="50.0381" inputmode="decimal" />
			</div>

			<div class="wppm-field">
				<label for="wppm_lng"><?php esc_html_e( 'Zeměpisná délka (lng)', 'wp-places-map' ); ?></label>
				<input type="text" id="wppm_lng" name="_wppm_lng" value="<?php echo esc_attr( $values['_wppm_lng'] ); ?>" placeholder="15.7793" inputmode="decimal" />
			</div>

			<div class="wppm-field wppm-field--full">
				<div id="wppm-preview-map" class="wppm-preview-map" aria-hidden="true"></div>
			</div>

			<div class="wppm-field">
				<label for="wppm_phone"><?php esc_html_e( 'Telefon', 'wp-places-map' ); ?></label>
				<input type="text" id="wppm_phone" name="_wppm_phone" value="<?php echo esc_attr( $values['_wppm_phone'] ); ?>" placeholder="+420 ..." />
			</div>

			<div class="wppm-field">
				<label for="wppm_email"><?php esc_html_e( 'E-mail', 'wp-places-map' ); ?></label>
				<input type="email" id="wppm_email" name="_wppm_email" value="<?php echo esc_attr( $values['_wppm_email'] ); ?>" />
			</div>

			<div class="wppm-field wppm-field--full">
				<label for="wppm_website"><?php esc_html_e( 'Web', 'wp-places-map' ); ?></label>
				<input type="url" id="wppm_website" name="_wppm_website" value="<?php echo esc_attr( $values['_wppm_website'] ); ?>" placeholder="https://" />
			</div>

			<div class="wppm-field wppm-field--full">
				<label for="wppm_hours"><?php esc_html_e( 'Otevírací doba', 'wp-places-map' ); ?></label>
				<textarea id="wppm_hours" name="_wppm_hours" rows="3" placeholder="<?php esc_attr_e( "Po–Pá: 7:00–15:30\nSo–Ne: zavřeno", 'wp-places-map' ); ?>"><?php echo esc_textarea( $values['_wppm_hours'] ); ?></textarea>
			</div>

		</div>
		<?php
	}

	public function save( $post_id, $post ) {
		if ( ! isset( $_POST[ self::NONCE_FIELD ] ) ) {
			return;
		}
		if ( ! wp_verify_nonce( $_POST[ self::NONCE_FIELD ], self::NONCE_ACTION ) ) {
			return;
		}
		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		foreach ( self::FIELDS as $key => $type ) {
			$raw = isset( $_POST[ $key ] ) ? wp_unslash( $_POST[ $key ] ) : '';
			$clean = self::sanitize( $raw, $type );
			if ( $clean === '' || $clean === null ) {
				delete_post_meta( $post_id, $key );
			} else {
				update_post_meta( $post_id, $key, $clean );
			}
		}
	}

	public static function sanitize( $value, $type ) {
		switch ( $type ) {
			case 'email':
				return sanitize_email( $value );
			case 'url':
				return esc_url_raw( $value );
			case 'textarea':
				return sanitize_textarea_field( $value );
			case 'coord':
				$v = trim( str_replace( ',', '.', (string) $value ) );
				if ( $v === '' ) {
					return '';
				}
				if ( ! is_numeric( $v ) ) {
					return '';
				}
				$n = (float) $v;
				if ( $n < -180 || $n > 180 ) {
					return '';
				}
				return (string) $n;
			case 'text':
			default:
				return sanitize_text_field( $value );
		}
	}

	public function bust_cache() {
		delete_transient( WPPM_CACHE_KEY );
	}

	public function bust_cache_on_delete( $post_id ) {
		if ( get_post_type( $post_id ) === WPPM_CPT ) {
			$this->bust_cache();
		}
	}
}
