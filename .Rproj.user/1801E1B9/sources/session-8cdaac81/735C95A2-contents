"use strict";

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const CART_CONFIG = Object.freeze({
      storageKey: "rumboCorcelCartV1",
      whatsapp: "56962590678",
      currency: "CLP",
      locale: "es-CL"
    });

    let cart = loadCart();
    let inventory = new Map();

    createCartInterface();
    renderCart();

    if (
      Array.isArray(
        window.RUMBO_INVENTORY
      )
    ) {
      synchronizeInventory(
        window.RUMBO_INVENTORY
      );
    }

    window.addEventListener(
      "rumbo:inventory-ready",
      (event) => {
        synchronizeInventory(
          event.detail
        );
      }
    );


    /* =====================================================
       AGREGAR PRODUCTOS
       ===================================================== */

    document.addEventListener(
      "click",
      (event) => {

        const button =
          event.target.closest(
            ".add-to-cart"
          );

        if (!button) {
          return;
        }

        event.preventDefault();

        const card =
          button.closest(
            "[data-product-sku]"
          );

        if (!card) {
          return;
        }

        addProductFromCard(card);
      }
    );


    document.addEventListener(
      "keydown",
      (event) => {

        const button =
          event.target.closest(
            ".add-to-cart"
          );

        if (!button) {
          return;
        }

        if (
          event.key !== "Enter" &&
          event.key !== " "
        ) {
          return;
        }

        event.preventDefault();
        button.click();
      }
    );


    /* =====================================================
       CREAR INTERFAZ
       ===================================================== */

    function createCartInterface() {
      createCartButton();

      document.body.insertAdjacentHTML(
        "beforeend",
        `
        <div
          class="cart-overlay"
          data-cart-overlay
          aria-hidden="true">
        </div>

        <aside
          class="cart-drawer"
          data-cart-drawer
          aria-hidden="true"
          aria-label="Carrito de compras">

          <header class="cart-header">

            <div>
              <span class="cart-eyebrow">
                RUMBO CORCEL
              </span>

              <h2>Tu carrito</h2>
            </div>

            <button
              class="cart-close"
              type="button"
              data-cart-close
              aria-label="Cerrar carrito">
              ×
            </button>

          </header>

          <div
            class="cart-content"
            data-cart-content>
          </div>

          <footer class="cart-footer">

            <div class="cart-summary">

              <span>Subtotal</span>

              <strong data-cart-subtotal>
                $0
              </strong>

            </div>

            <p class="cart-shipping-note">
              El despacho se cotiza y confirma
              antes del pago.
            </p>

            <button
              class="cart-checkout"
              type="button"
              data-cart-checkout>
              Confirmar por WhatsApp
            </button>

            <button
              class="cart-clear"
              type="button"
              data-cart-clear>
              Vaciar carrito
            </button>

          </footer>

        </aside>

        <div
          class="cart-toast"
          data-cart-toast
          role="status"
          aria-live="polite">
        </div>
        `
      );

      document
        .querySelector(
          "[data-cart-overlay]"
        )
        ?.addEventListener(
          "click",
          closeCart
        );

      document
        .querySelector(
          "[data-cart-close]"
        )
        ?.addEventListener(
          "click",
          closeCart
        );

      document
        .querySelector(
          "[data-cart-clear]"
        )
        ?.addEventListener(
          "click",
          clearCart
        );

      document
        .querySelector(
          "[data-cart-checkout]"
        )
        ?.addEventListener(
          "click",
          checkoutByWhatsApp
        );

      document
        .querySelector(
          "[data-cart-content]"
        )
        ?.addEventListener(
          "click",
          handleCartAction
        );

      document.addEventListener(
        "keydown",
        (event) => {
          if (event.key === "Escape") {
            closeCart();
          }
        }
      );
    }


    function createCartButton() {
      const rightNavbar =
        document.querySelector(
          ".navbar .navbar-nav.ms-auto"
        );

      const wrapper =
        document.createElement("li");

      wrapper.className =
        "nav-item cart-nav-item";

      wrapper.innerHTML = `
        <button
          class="cart-nav-button"
          type="button"
          data-cart-open
          aria-label="Abrir carrito">

          <svg
            viewBox="0 0 24 24"
            aria-hidden="true">
            <path
              d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 7H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round">
            </path>
          </svg>

          <span
            class="cart-count"
            data-cart-count>
            0
          </span>

        </button>
      `;

      if (rightNavbar) {
        rightNavbar.prepend(wrapper);
      } else {
        wrapper.classList.add(
          "cart-nav-fallback"
        );

        document.body.appendChild(
          wrapper
        );
      }

      wrapper
        .querySelector(
          "[data-cart-open]"
        )
        ?.addEventListener(
          "click",
          openCart
        );
    }


    /* =====================================================
       LEER PRODUCTO DESDE LA TARJETA
       ===================================================== */

    function addProductFromCard(card) {
      const sku = String(
        card.dataset.productSku || ""
      )
        .trim()
        .toUpperCase();

      const name =
        card.dataset.productName ||
        card.querySelector("h2, h3")
          ?.textContent
          ?.trim() ||
        "Producto Rumbo Corcel";

      const price = Number(
        card.dataset.livePrice
      ) || readPriceFromCard(card);

      const stock = Math.max(
        0,
        Number(
          card.dataset.liveStock
        ) || 0
      );

      const image =
        card.querySelector("img")
          ?.getAttribute("src") || "";

      if (!sku) {
        showToast(
          "No se pudo identificar el producto."
        );

        return;
      }

      if (stock <= 0) {
        showToast(
          "Este producto está sin stock."
        );

        return;
      }

      const existingProduct =
        cart.find(
          (item) => item.sku === sku
        );

      if (existingProduct) {
        if (
          existingProduct.quantity >=
          stock
        ) {
          showToast(
            "Ya agregaste todas las unidades disponibles."
          );

          openCart();
          return;
        }

        existingProduct.quantity += 1;
        existingProduct.stock = stock;
        existingProduct.price = price;
      } else {
        cart.push({
          sku,
          name,
          price,
          image,
          stock,
          quantity: 1
        });
      }

      saveCart();
      renderCart();
      showToast(
        `${name} agregado al carrito.`
      );
      openCart();
    }


    function readPriceFromCard(card) {
      const priceText =
        card.querySelector(
          ".featured-price, .catalog-price"
        )?.textContent || "";

      const numeric = priceText
        .replace(/[^\d]/g, "");

      return Number(numeric) || 0;
    }


    /* =====================================================
       SINCRONIZAR INVENTARIO
       ===================================================== */

    function synchronizeInventory(
      products
    ) {
      if (!Array.isArray(products)) {
        return;
      }

      inventory = new Map(
        products.map(
          (product) => [
            String(product.sku)
              .trim()
              .toUpperCase(),
            product
          ]
        )
      );

      let cartWasModified = false;

      cart = cart.filter(
        (item) => {

          const product =
            inventory.get(item.sku);

          if (!product) {
            return true;
          }

          const available =
            Math.max(
              0,
              Number(
                product.disponible
              ) || 0
            );

          if (available <= 0) {
            cartWasModified = true;
            return false;
          }

          item.name =
            product.product ||
            item.name;

          item.price =
            Number(product.precio) ||
            item.price;

          item.stock =
            available;

          if (
            item.quantity >
            available
          ) {
            item.quantity =
              available;

            cartWasModified = true;
          }

          return true;
        }
      );

      saveCart();
      renderCart();

      if (cartWasModified) {
        showToast(
          "El carrito fue actualizado según el stock disponible."
        );
      }
    }


    /* =====================================================
       ACCIONES DEL CARRITO
       ===================================================== */

    function handleCartAction(event) {
      const control =
        event.target.closest(
          "[data-cart-action]"
        );

      if (!control) {
        return;
      }

      const sku =
        control.dataset.sku;

      const action =
        control.dataset.cartAction;

      if (!sku) {
        return;
      }

      if (action === "increase") {
        increaseQuantity(sku);
      }

      if (action === "decrease") {
        decreaseQuantity(sku);
      }

      if (action === "remove") {
        removeProduct(sku);
      }
    }


    function increaseQuantity(sku) {
      const product =
        cart.find(
          (item) => item.sku === sku
        );

      if (!product) {
        return;
      }

      if (
        product.quantity >=
        product.stock
      ) {
        showToast(
          "No hay más unidades disponibles."
        );

        return;
      }

      product.quantity += 1;

      saveCart();
      renderCart();
    }


    function decreaseQuantity(sku) {
      const product =
        cart.find(
          (item) => item.sku === sku
        );

      if (!product) {
        return;
      }

      product.quantity -= 1;

      if (product.quantity <= 0) {
        removeProduct(sku);
        return;
      }

      saveCart();
      renderCart();
    }


    function removeProduct(sku) {
      cart = cart.filter(
        (item) => item.sku !== sku
      );

      saveCart();
      renderCart();
    }


    function clearCart() {
      if (cart.length === 0) {
        return;
      }

      cart = [];

      saveCart();
      renderCart();

      showToast(
        "El carrito quedó vacío."
      );
    }


    /* =====================================================
       MOSTRAR CARRITO
       ===================================================== */

    function renderCart() {
      const content =
        document.querySelector(
          "[data-cart-content]"
        );

      const subtotalElement =
        document.querySelector(
          "[data-cart-subtotal]"
        );

      const countElement =
        document.querySelector(
          "[data-cart-count]"
        );

      const checkoutButton =
        document.querySelector(
          "[data-cart-checkout]"
        );

      const clearButton =
        document.querySelector(
          "[data-cart-clear]"
        );

      if (
        !content ||
        !subtotalElement ||
        !countElement
      ) {
        return;
      }

      const totalUnits =
        cart.reduce(
          (total, item) =>
            total + item.quantity,
          0
        );

      const subtotal =
        cart.reduce(
          (total, item) =>
            total +
            item.price *
            item.quantity,
          0
        );

      countElement.textContent =
        String(totalUnits);

      countElement.classList.toggle(
        "is-empty",
        totalUnits === 0
      );

      subtotalElement.textContent =
        formatMoney(subtotal);

      if (checkoutButton) {
        checkoutButton.disabled =
          cart.length === 0;
      }

      if (clearButton) {
        clearButton.disabled =
          cart.length === 0;
      }

      if (cart.length === 0) {
        content.innerHTML = `
          <div class="cart-empty">

            <span class="cart-empty-icon">
              ◇
            </span>

            <h3>Tu carrito está vacío</h3>

            <p>
              Agrega productos y aparecerán
              guardados aquí.
            </p>

          </div>
        `;

        return;
      }

      content.innerHTML =
        cart.map(
          (item) => `
          <article class="cart-item">

            <div class="cart-item-image">

              ${
                item.image
                  ? `
                    <img
                      src="${escapeHtml(item.image)}"
                      alt="${escapeHtml(item.name)}">
                  `
                  : `
                    <span>RC</span>
                  `
              }

            </div>

            <div class="cart-item-info">

              <div class="cart-item-heading">

                <div>
                  <small>
                    ${escapeHtml(item.sku)}
                  </small>

                  <h3>
                    ${escapeHtml(item.name)}
                  </h3>
                </div>

                <button
                  class="cart-remove"
                  type="button"
                  data-cart-action="remove"
                  data-sku="${escapeHtml(item.sku)}"
                  aria-label="Eliminar ${escapeHtml(item.name)}">
                  ×
                </button>

              </div>

              <div class="cart-item-bottom">

                <div class="cart-quantity">

                  <button
                    type="button"
                    data-cart-action="decrease"
                    data-sku="${escapeHtml(item.sku)}"
                    aria-label="Disminuir cantidad">
                    −
                  </button>

                  <span>
                    ${item.quantity}
                  </span>

                  <button
                    type="button"
                    data-cart-action="increase"
                    data-sku="${escapeHtml(item.sku)}"
                    aria-label="Aumentar cantidad"
                    ${
                      item.quantity >=
                      item.stock
                        ? "disabled"
                        : ""
                    }>
                    +
                  </button>

                </div>

                <strong>
                  ${formatMoney(
                    item.price *
                    item.quantity
                  )}
                </strong>

              </div>

              <small class="cart-item-stock">
                Máximo disponible:
                ${item.stock}
              </small>

            </div>

          </article>
          `
        )
        .join("");
    }


    /* =====================================================
       WHATSAPP
       ===================================================== */

    function checkoutByWhatsApp() {
      if (cart.length === 0) {
        return;
      }

      const subtotal =
        cart.reduce(
          (total, item) =>
            total +
            item.price *
            item.quantity,
          0
        );

      const productLines =
        cart.map(
          (item) =>
            `${item.quantity} × ` +
            `${item.name} — ` +
            `${formatMoney(
              item.price *
              item.quantity
            )}`
        );

      const message = [
        "Hola Rumbo Corcel 👋",
        "",
        "Quiero confirmar el siguiente pedido:",
        "",
        ...productLines,
        "",
        `Subtotal: ${formatMoney(subtotal)}`,
        "Envío: por cotizar",
        "",
        "Nombre:",
        "Región:",
        "Comuna:",
        "Dirección o sucursal:",
        "",
        "¿Me pueden confirmar el stock y el total final?"
      ].join("\n");

      const url =
        `https://wa.me/` +
        `${CART_CONFIG.whatsapp}` +
        `?text=${encodeURIComponent(message)}`;

      window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );
    }


    /* =====================================================
       GUARDAR Y LEER
       ===================================================== */

    function saveCart() {
      try {
        localStorage.setItem(
          CART_CONFIG.storageKey,
          JSON.stringify(cart)
        );
      } catch (error) {
        console.warn(
          "No fue posible guardar el carrito:",
          error
        );
      }
    }


    function loadCart() {
      try {
        const stored =
          localStorage.getItem(
            CART_CONFIG.storageKey
          );

        if (!stored) {
          return [];
        }

        const parsed =
          JSON.parse(stored);

        if (!Array.isArray(parsed)) {
          return [];
        }

        return parsed
          .filter(
            (item) =>
              item &&
              item.sku &&
              Number(item.quantity) > 0
          )
          .map(
            (item) => ({
              sku: String(item.sku)
                .trim()
                .toUpperCase(),

              name:
                String(item.name || ""),

              price:
                Number(item.price) || 0,

              image:
                String(item.image || ""),

              stock:
                Math.max(
                  1,
                  Number(item.stock) || 1
                ),

              quantity:
                Math.max(
                  1,
                  Number(item.quantity) || 1
                )
            })
          );

      } catch (error) {
        console.warn(
          "No fue posible leer el carrito:",
          error
        );

        return [];
      }
    }


    /* =====================================================
       UTILIDADES
       ===================================================== */

    function openCart() {
      document.body.classList.add(
        "cart-is-open"
      );

      document
        .querySelector(
          "[data-cart-drawer]"
        )
        ?.setAttribute(
          "aria-hidden",
          "false"
        );

      document
        .querySelector(
          "[data-cart-overlay]"
        )
        ?.setAttribute(
          "aria-hidden",
          "false"
        );
    }


    function closeCart() {
      document.body.classList.remove(
        "cart-is-open"
      );

      document
        .querySelector(
          "[data-cart-drawer]"
        )
        ?.setAttribute(
          "aria-hidden",
          "true"
        );

      document
        .querySelector(
          "[data-cart-overlay]"
        )
        ?.setAttribute(
          "aria-hidden",
          "true"
        );
    }


    function formatMoney(value) {
      return new Intl.NumberFormat(
        CART_CONFIG.locale,
        {
          style: "currency",
          currency:
            CART_CONFIG.currency,
          maximumFractionDigits: 0
        }
      ).format(value);
    }


    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }


    let toastTimer = null;

    function showToast(message) {
      const toast =
        document.querySelector(
          "[data-cart-toast]"
        );

      if (!toast) {
        return;
      }

      window.clearTimeout(
        toastTimer
      );

      toast.textContent = message;

      toast.classList.add(
        "is-visible"
      );

      toastTimer =
        window.setTimeout(
          () => {
            toast.classList.remove(
              "is-visible"
            );
          },
          2800
        );
    }

  }
);