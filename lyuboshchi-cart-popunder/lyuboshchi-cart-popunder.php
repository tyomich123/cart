<?php
/**
 * Plugin Name: Lyuboshchi Woo Cart Popunder
 * Description: Shows a responsive cart popunder after adding products to WooCommerce cart.
 * Version: 1.0.0
 * Author: Codex Assistant
 * Text Domain: lyuboshchi-cart-popunder
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Lyuboshchi_Woo_Cart_Popunder {
	const VERSION = '1.0.0';

	public function __construct() {
		add_action( 'plugins_loaded', array( $this, 'init' ) );
	}

	public function init() {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}

		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );
		add_action( 'template_redirect', array( $this, 'capture_non_ajax_add_to_cart' ) );
		add_action( 'wp_ajax_lcp_get_cart_snapshot', array( $this, 'ajax_get_cart_snapshot' ) );
		add_action( 'wp_ajax_nopriv_lcp_get_cart_snapshot', array( $this, 'ajax_get_cart_snapshot' ) );
		add_action( 'wp_ajax_lcp_update_cart_item', array( $this, 'ajax_update_cart_item' ) );
		add_action( 'wp_ajax_nopriv_lcp_update_cart_item', array( $this, 'ajax_update_cart_item' ) );
		add_action( 'wp_ajax_lcp_remove_cart_item', array( $this, 'ajax_remove_cart_item' ) );
		add_action( 'wp_ajax_nopriv_lcp_remove_cart_item', array( $this, 'ajax_remove_cart_item' ) );
		add_action( 'wp_footer', array( $this, 'render_modal_markup' ) );
	}

	public function enqueue_assets() {
		if ( is_admin() ) {
			return;
		}

		wp_enqueue_style(
			'lcp-style',
			plugin_dir_url( __FILE__ ) . 'assets/css/lcp-style.css',
			array(),
			self::VERSION
		);

		wp_enqueue_script(
			'lcp-script',
			plugin_dir_url( __FILE__ ) . 'assets/js/lcp-script.js',
			array( 'jquery' ),
			self::VERSION,
			true
		);

		$should_show_on_load = false;

		if ( function_exists( 'WC' ) && WC()->session ) {
			$should_show_on_load = (bool) WC()->session->get( 'lcp_show_popup', false );
			WC()->session->set( 'lcp_show_popup', false );
		}

		wp_localize_script(
			'lcp-script',
			'lcpData',
			array(
				'ajaxUrl'          => admin_url( 'admin-ajax.php' ),
				'nonce'            => wp_create_nonce( 'lcp_nonce' ),
				'checkoutUrl'      => wc_get_checkout_url(),
				'cartUrl'          => wc_get_cart_url(),
				'shouldShowOnLoad' => $should_show_on_load,
				'i18n'             => array(
					'title'        => __( 'Це ваш кошик', 'lyuboshchi-cart-popunder' ),
					'subtitle'     => __( 'Товари додані успішно', 'lyuboshchi-cart-popunder' ),
					'totalLabel'   => __( 'Разом', 'lyuboshchi-cart-popunder' ),
					'continueText' => __( 'Продовжити покупки', 'lyuboshchi-cart-popunder' ),
					'checkoutText' => __( 'Оформити замовлення', 'lyuboshchi-cart-popunder' ),
					'viewCartText' => __( 'Переглянути кошик', 'lyuboshchi-cart-popunder' ),
					'emptyText'    => __( 'Ваш кошик зараз порожній.', 'lyuboshchi-cart-popunder' ),
						'removeText'   => __( 'Видалити', 'lyuboshchi-cart-popunder' ),
						'loadingText'  => __( 'Оновлюємо кошик...', 'lyuboshchi-cart-popunder' ),
						'fallbackText' => __( 'Не вдалося швидко оновити кошик. Товар уже міг додатися — перевірте кошик.', 'lyuboshchi-cart-popunder' ),
						'retryText'    => __( 'Спробувати ще раз', 'lyuboshchi-cart-popunder' ),
					),
				)
			);
	}

	public function capture_non_ajax_add_to_cart() {
		if ( is_admin() || wp_doing_ajax() || ! function_exists( 'WC' ) || ! WC()->session ) {
			return;
		}

		if ( isset( $_REQUEST['add-to-cart'] ) ) {
			WC()->session->set( 'lcp_show_popup', true );
		}
	}

	public function ajax_get_cart_snapshot() {
		nocache_headers();
		check_ajax_referer( 'lcp_nonce', 'nonce' );

		if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
			wp_send_json_error( array( 'message' => 'WooCommerce cart unavailable.' ) );
		}

		wp_send_json_success( $this->build_cart_snapshot() );
	}

	public function ajax_update_cart_item() {
		nocache_headers();
		check_ajax_referer( 'lcp_nonce', 'nonce' );

		if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
			wp_send_json_error( array( 'message' => 'WooCommerce cart unavailable.' ) );
		}

		$cart_item_key = isset( $_POST['cartItemKey'] ) ? wc_clean( wp_unslash( $_POST['cartItemKey'] ) ) : '';
		$quantity      = isset( $_POST['quantity'] ) ? absint( wp_unslash( $_POST['quantity'] ) ) : 0;

		if ( ! $cart_item_key ) {
			wp_send_json_error( array( 'message' => 'Invalid cart item key.' ) );
		}

		if ( $quantity <= 0 ) {
			WC()->cart->remove_cart_item( $cart_item_key );
		} else {
			WC()->cart->set_quantity( $cart_item_key, $quantity, true );
		}

		WC()->cart->calculate_totals();

		wp_send_json_success( $this->build_cart_snapshot() );
	}

	public function ajax_remove_cart_item() {
		nocache_headers();
		check_ajax_referer( 'lcp_nonce', 'nonce' );

		if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
			wp_send_json_error( array( 'message' => 'WooCommerce cart unavailable.' ) );
		}

		$cart_item_key = isset( $_POST['cartItemKey'] ) ? wc_clean( wp_unslash( $_POST['cartItemKey'] ) ) : '';

		if ( ! $cart_item_key ) {
			wp_send_json_error( array( 'message' => 'Invalid cart item key.' ) );
		}

		WC()->cart->remove_cart_item( $cart_item_key );
		WC()->cart->calculate_totals();

		wp_send_json_success( $this->build_cart_snapshot() );
	}

	private function build_cart_snapshot() {
		$items = array();

		foreach ( WC()->cart->get_cart() as $cart_item_key => $cart_item ) {
			$product = $cart_item['data'];

			if ( ! $product || ! $product->exists() ) {
				continue;
			}

			$items[] = array(
				'cartItemKey' => $cart_item_key,
				'name'      => wp_strip_all_tags( $product->get_name() ),
				'quantity'  => (int) $cart_item['quantity'],
				'lineTotal' => wp_kses_post( wc_price( (float) $cart_item['line_total'] + (float) $cart_item['line_tax'] ) ),
				'unitPrice' => wp_kses_post( wc_price( (float) wc_get_price_including_tax( $product ) ) ),
				'image'     => wp_get_attachment_image_url( $product->get_image_id(), 'woocommerce_thumbnail' ),
			);
		}

		return array(
			'items'     => $items,
			'total'     => wp_kses_post( WC()->cart->get_cart_total() ),
			'cartCount' => WC()->cart->get_cart_contents_count(),
		);
	}

	public function render_modal_markup() {
		if ( is_admin() ) {
			return;
		}
		?>
		<div id="lcp-modal" class="lcp-modal" aria-hidden="true" role="dialog" aria-label="Cart preview">
			<div class="lcp-backdrop" data-lcp-close></div>
			<div class="lcp-dialog" role="document">
				<button type="button" class="lcp-close" data-lcp-close aria-label="Close">&times;</button>
				<div class="lcp-head">
					<h2 class="lcp-title"></h2>
					<p class="lcp-subtitle"></p>
				</div>
				<div class="lcp-body">
					<ul class="lcp-items" aria-live="polite"></ul>
					<div class="lcp-summary">
						<span class="lcp-total-label"></span>
						<strong class="lcp-total-value"></strong>
					</div>
				</div>
				<div class="lcp-actions">
					<button type="button" class="lcp-btn lcp-btn-secondary" data-lcp-close></button>
					<a href="#" class="lcp-btn lcp-btn-primary lcp-checkout-link"></a>
				</div>
				<a href="#" class="lcp-view-cart-link"></a>
			</div>
		</div>
		<?php
	}
}

new Lyuboshchi_Woo_Cart_Popunder();
