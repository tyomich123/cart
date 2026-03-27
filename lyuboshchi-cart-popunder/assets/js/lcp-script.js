(function ($) {
  'use strict';

  var $modal = $('#lcp-modal');
  if (!$modal.length || typeof lcpData === 'undefined') {
    return;
  }

  var $title = $modal.find('.lcp-title');
  var $subtitle = $modal.find('.lcp-subtitle');
  var $items = $modal.find('.lcp-items');
  var $totalLabel = $modal.find('.lcp-total-label');
  var $totalValue = $modal.find('.lcp-total-value');
  var $continue = $modal.find('.lcp-btn-secondary');
  var $checkout = $modal.find('.lcp-checkout-link');
  var $viewCart = $modal.find('.lcp-view-cart-link');

  var loadingItemTemplate =
    '<li class="lcp-item is-loading">' +
      '<div class="lcp-item-image"><span class="lcp-img-placeholder"></span></div>' +
      '<div class="lcp-item-content">' +
        '<div class="lcp-item-name">' + lcpData.i18n.loadingText + '</div>' +
      '</div>' +
    '</li>';

  var addToCartTimeout = null;
  var MAX_FETCH_RETRIES = 2;

  function escapeHtml(input) {
    return String(input)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  $title.text(lcpData.i18n.title);
  $subtitle.text(lcpData.i18n.subtitle);
  $totalLabel.text(lcpData.i18n.totalLabel);
  $continue.text(lcpData.i18n.continueText);
  $checkout.text(lcpData.i18n.checkoutText).attr('href', lcpData.checkoutUrl);
  $viewCart.text(lcpData.i18n.viewCartText).attr('href', lcpData.cartUrl);

  function setOpenState(open) {
    $modal.attr('aria-hidden', open ? 'false' : 'true');
    $modal.toggleClass('is-open', open);
    $('body').toggleClass('lcp-no-scroll', open);
  }

  function openLoadingState() {
    $items.html(loadingItemTemplate);
    $totalValue.text('...');
    setOpenState(true);
  }

  function clearAddToCartTimeout() {
    if (addToCartTimeout) {
      clearTimeout(addToCartTimeout);
      addToCartTimeout = null;
    }
  }

  function renderFallbackState() {
    var retryHtml =
      '<button type="button" class="lcp-retry-btn">' +
      escapeHtml(lcpData.i18n.retryText) +
      '</button>';

    $items.html(
      '<li class="lcp-empty lcp-warning">' +
      escapeHtml(lcpData.i18n.fallbackText) +
      retryHtml +
      '</li>'
    );
    $totalValue.text('—');
    setOpenState(true);
  }

  function renderItems(data) {
    $items.empty();

    if (!data.items || !data.items.length) {
      $items.append('<li class="lcp-empty">' + escapeHtml(lcpData.i18n.emptyText) + '</li>');
      $totalValue.html(data.total || '');
      return;
    }

    data.items.forEach(function (item) {
      var imageHtml = item.image
        ? '<img src="' + escapeHtml(item.image) + '" alt="" loading="lazy" />'
        : '<span class="lcp-img-placeholder"></span>';

      var safeName = escapeHtml(item.name);
      var cartItemKey = escapeHtml(item.cartItemKey);

      $items.append(
        '<li class="lcp-item" data-cart-item-key="' + cartItemKey + '">' +
          '<div class="lcp-item-image">' + imageHtml + '</div>' +
          '<div class="lcp-item-content">' +
            '<div class="lcp-item-name">' + safeName + '</div>' +
            '<div class="lcp-item-meta">' + item.lineTotal + '</div>' +
            '<div class="lcp-item-actions">' +
              '<div class="lcp-qty-wrap">' +
                '<button type="button" class="lcp-qty-btn" data-lcp-qty-change="-1" aria-label="Minus">−</button>' +
                '<span class="lcp-qty-value">' + escapeHtml(item.quantity) + '</span>' +
                '<button type="button" class="lcp-qty-btn" data-lcp-qty-change="1" aria-label="Plus">+</button>' +
              '</div>' +
              '<button type="button" class="lcp-remove-btn" aria-label="Remove">' + escapeHtml(lcpData.i18n.removeText) + '</button>' +
            '</div>' +
          '</div>' +
        '</li>'
      );
    });

    $totalValue.html(data.total);
  }

  function fetchCartSnapshot(retryCount) {
    retryCount = retryCount || 0;

    return $.ajax({
      method: 'POST',
      url: lcpData.ajaxUrl,
      cache: false,
      data: {
        action: 'lcp_get_cart_snapshot',
        nonce: lcpData.nonce,
        lcpTs: Date.now()
      }
    }).done(function (response) {
      if (!response || !response.success || !response.data) {
        if (retryCount < MAX_FETCH_RETRIES) {
          fetchCartSnapshot(retryCount + 1);
          return;
        }

        renderFallbackState();
        return;
      }

      clearAddToCartTimeout();
      renderItems(response.data);
      setOpenState(true);
    }).fail(function () {
      if (retryCount < MAX_FETCH_RETRIES) {
        setTimeout(function () {
          fetchCartSnapshot(retryCount + 1);
        }, 250);
        return;
      }

      renderFallbackState();
    });
  }

  function updateCartItem(cartItemKey, quantity) {
    return $.ajax({
      method: 'POST',
      url: lcpData.ajaxUrl,
      cache: false,
      data: {
        action: 'lcp_update_cart_item',
        nonce: lcpData.nonce,
        cartItemKey: cartItemKey,
        quantity: quantity,
        lcpTs: Date.now()
      }
    }).done(function (response) {
      if (!response || !response.success || !response.data) {
        renderFallbackState();
        return;
      }

      renderItems(response.data);
    }).fail(function () {
      renderFallbackState();
    });
  }

  function removeCartItem(cartItemKey) {
    return $.ajax({
      method: 'POST',
      url: lcpData.ajaxUrl,
      cache: false,
      data: {
        action: 'lcp_remove_cart_item',
        nonce: lcpData.nonce,
        cartItemKey: cartItemKey,
        lcpTs: Date.now()
      }
    }).done(function (response) {
      if (!response || !response.success || !response.data) {
        renderFallbackState();
        return;
      }

      renderItems(response.data);
    }).fail(function () {
      renderFallbackState();
    });
  }

  $(document.body).on('adding_to_cart', function () {
    openLoadingState();

    clearAddToCartTimeout();
    addToCartTimeout = setTimeout(function () {
      renderFallbackState();
    }, 3500);
  });

  $(document.body).on('added_to_cart', function () {
    openLoadingState();
    fetchCartSnapshot(0);
  });

  $modal.on('click', '[data-lcp-close]', function () {
    clearAddToCartTimeout();
    setOpenState(false);
  });

  $modal.on('click', '.lcp-retry-btn', function () {
    openLoadingState();
    fetchCartSnapshot(0);
  });

  $modal.on('click', '.lcp-qty-btn', function () {
    var $item = $(this).closest('.lcp-item');
    var cartItemKey = $item.data('cart-item-key');
    var currentQty = parseInt($item.find('.lcp-qty-value').text(), 10) || 1;
    var step = parseInt($(this).data('lcp-qty-change'), 10) || 0;
    var nextQty = currentQty + step;

    if (!cartItemKey || nextQty < 1) {
      return;
    }

    $item.addClass('is-loading');
    updateCartItem(cartItemKey, nextQty).always(function () {
      $item.removeClass('is-loading');
    });
  });

  $modal.on('click', '.lcp-remove-btn', function () {
    var $item = $(this).closest('.lcp-item');
    var cartItemKey = $item.data('cart-item-key');

    if (!cartItemKey) {
      return;
    }

    $item.addClass('is-loading');
    removeCartItem(cartItemKey).always(function () {
      $item.removeClass('is-loading');
    });
  });

  $(document).on('keyup', function (event) {
    if (event.key === 'Escape' && $modal.hasClass('is-open')) {
      clearAddToCartTimeout();
      setOpenState(false);
    }
  });

  if (lcpData.shouldShowOnLoad) {
    openLoadingState();
    fetchCartSnapshot(0);
  }
})(jQuery);
