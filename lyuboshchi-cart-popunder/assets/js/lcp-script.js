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

  function renderItems(data) {
    $items.empty();

    if (!data.items || !data.items.length) {
      $items.append('<li class="lcp-empty">' + lcpData.i18n.emptyText + '</li>');
      $totalValue.html(data.total || '');
      return;
    }

    data.items.forEach(function (item) {
      var imageHtml = item.image
        ? '<img src="' + item.image + '" alt="" loading="lazy" />'
        : '<span class="lcp-img-placeholder"></span>';

      $items.append(
        '<li class="lcp-item">' +
          '<div class="lcp-item-image">' + imageHtml + '</div>' +
          '<div class="lcp-item-content">' +
            '<div class="lcp-item-name">' + item.name + '</div>' +
            '<div class="lcp-item-meta">x' + item.quantity + ' · ' + item.lineTotal + '</div>' +
          '</div>' +
        '</li>'
      );
    });

    $totalValue.html(data.total);
  }

  function fetchCartSnapshot() {
    $.ajax({
      method: 'POST',
      url: lcpData.ajaxUrl,
      data: {
        action: 'lcp_get_cart_snapshot',
        nonce: lcpData.nonce
      }
    })
      .done(function (response) {
        if (!response || !response.success || !response.data) {
          return;
        }

        renderItems(response.data);
        setOpenState(true);
      });
  }

  $(document.body).on('added_to_cart', function () {
    fetchCartSnapshot();
  });

  $modal.on('click', '[data-lcp-close]', function () {
    setOpenState(false);
  });

  $(document).on('keyup', function (event) {
    if (event.key === 'Escape' && $modal.hasClass('is-open')) {
      setOpenState(false);
    }
  });

  if (lcpData.shouldShowOnLoad) {
    fetchCartSnapshot();
  }
})(jQuery);
