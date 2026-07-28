"use strict";

document.addEventListener("DOMContentLoaded", () => {

  /* =======================================================
     EFECTO DE PROFUNDIDAD DE LA PORTADA
     ======================================================= */

  const hero = document.querySelector(".hero-section");

  if (hero) {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    let animationFrame = null;

    const updateHeroEffect = () => {
      animationFrame = null;

      if (reducedMotion.matches) {
        hero.style.setProperty("--hero-progress", "0");
        return;
      }

      const rect = hero.getBoundingClientRect();
      const travelled = Math.max(0, -rect.top);

      const progress = Math.min(
        1,
        travelled / (rect.height * 0.82)
      );

      hero.style.setProperty(
        "--hero-progress",
        progress.toFixed(3)
      );
    };

    const requestHeroUpdate = () => {
      if (animationFrame !== null) {
        return;
      }

      animationFrame = window.requestAnimationFrame(
        updateHeroEffect
      );
    };

    window.addEventListener(
      "scroll",
      requestHeroUpdate,
      { passive: true }
    );

    window.addEventListener(
      "resize",
      requestHeroUpdate
    );

    if (typeof reducedMotion.addEventListener === "function") {
      reducedMotion.addEventListener(
        "change",
        requestHeroUpdate
      );
    }

    updateHeroEffect();
  }


  /* =======================================================
     CARRUSELES
     ======================================================= */

  document
    .querySelectorAll("[data-carousel]")
    .forEach((carousel) => {

      const track = carousel.querySelector(".product-track");
      const previousButton = carousel.querySelector(
        ".carousel-arrow-left"
      );
      const nextButton = carousel.querySelector(
        ".carousel-arrow-right"
      );

      if (!track || !previousButton || !nextButton) {
        return;
      }

      const getScrollDistance = () => {
        const firstCard = track.querySelector(".featured-card");

        if (!firstCard) {
          return track.clientWidth * 0.85;
        }

        const styles = window.getComputedStyle(track);
        const gap = Number.parseFloat(styles.columnGap) || 24;

        return firstCard.getBoundingClientRect().width + gap;
      };

      previousButton.addEventListener("click", () => {
        track.scrollBy({
          left: -getScrollDistance(),
          behavior: "smooth"
        });
      });

      nextButton.addEventListener("click", () => {
        track.scrollBy({
          left: getScrollDistance(),
          behavior: "smooth"
        });
      });

    });


  /* =======================================================
     IMÁGENES FALTANTES
     ======================================================= */

  document
    .querySelectorAll(".featured-media img, .catalog-media img")
    .forEach((image) => {

      const markAsMissing = () => {
        const container = image.closest(
          ".featured-media, .catalog-media"
        );

        if (container) {
          container.classList.add("missing");
        }
      };

      image.addEventListener(
        "error",
        markAsMissing,
        { once: true }
      );

      if (
        image.complete &&
        image.naturalWidth === 0
      ) {
        markAsMissing();
      }

    });


  /* =======================================================
     FILTROS DEL CATÁLOGO
     ======================================================= */

  const filterButtons = document.querySelectorAll(
    "[data-filter]"
  );

  const catalogCards = document.querySelectorAll(
    ".catalog-card[data-category]"
  );

  filterButtons.forEach((button) => {

    button.addEventListener("click", () => {

      const selectedCategory = button.dataset.filter;

      filterButtons.forEach((currentButton) => {
        currentButton.classList.remove("is-active");
      });

      button.classList.add("is-active");

      catalogCards.forEach((card) => {

        const shouldShow =
          selectedCategory === "all" ||
          card.dataset.category === selectedCategory;

        card.classList.toggle(
          "is-hidden",
          !shouldShow
        );

      });

    });

  });

});


/* =========================================================
   INVENTARIO EN VIVO — GOOGLE SHEETS + APPS SCRIPT
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  /*
   * Pega aquí la URL ORIGINAL de la implementación.
   * Debe comenzar con script.google.com y terminar en /exec.
   *
   * NO pegues la URL redirigida de googleusercontent.com.
   */

  const INVENTORY_API_URL =
    "https://script.google.com/macros/s/AKfycbymJY7QfvVhKrKRznUkk87mz3xA1C-kOuBtydu4N2ZL59sSdMc-MTfPV2ftLvMiUmmA/exec";


  /* -------------------------------------------------------
     FORMATO DE PRECIOS CHILENOS
     ------------------------------------------------------- */

  const formatCLP = new Intl.NumberFormat(
    "es-CL",
    {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0
    }
  );


  /* -------------------------------------------------------
     CONSULTA JSONP
     ------------------------------------------------------- */

  function loadInventory() {
    return new Promise((resolve, reject) => {
      if (
        !INVENTORY_API_URL ||
        INVENTORY_API_URL.includes("PEGA_AQUI")
      ) {
        reject(
          new Error(
            "Falta configurar INVENTORY_API_URL."
          )
        );

        return;
      }

      const iframe =
        document.createElement("iframe");

      iframe.hidden = true;
      iframe.setAttribute(
        "aria-hidden",
        "true"
      );

      iframe.style.position = "fixed";
      iframe.style.width = "1px";
      iframe.style.height = "1px";
      iframe.style.opacity = "0";
      iframe.style.pointerEvents = "none";

      const timeout = window.setTimeout(
        () => {
          cleanup();

          reject(
            new Error(
              "La consulta del inventario no respondió. " +
              "Revisa que la implementación de Apps Script " +
              "sea pública y corresponda a la versión actual."
            )
          );
        },
        15000
      );

      function cleanup() {
        window.clearTimeout(timeout);

        window.removeEventListener(
          "message",
          handleInventoryMessage
        );

        iframe.remove();
      }

      function handleInventoryMessage(event) {
        const response = event.data;

        if (
          !response ||
          typeof response !== "object" ||
          response.tipo !==
            "rumbo-inventario-respuesta"
        ) {
          return;
        }

        cleanup();

        if (response.ok !== true) {
          reject(
            new Error(
              response.detalle ||
              response.error ||
              "La API no pudo leer el inventario."
            )
          );

          return;
        }

        resolve(response);
      }

      window.addEventListener(
        "message",
        handleInventoryMessage
      );

      const separator =
        INVENTORY_API_URL.includes("?")
          ? "&"
          : "?";

      iframe.src =
        `${INVENTORY_API_URL}` +
        `${separator}action=productos` +
        `&formato=iframe` +
        `&origen=${encodeURIComponent(
          window.location.origin
        )}` +
        `&_=${Date.now()}`;

      iframe.addEventListener(
        "error",
        () => {
          cleanup();

          reject(
            new Error(
              "No fue posible abrir la API de inventario."
            )
          );
        },
        { once: true }
      );

      document.body.appendChild(iframe);
    });
  }

  /* -------------------------------------------------------
     CREAR INDICADOR DE STOCK
     ------------------------------------------------------- */

  function getOrCreateStockStatus(card) {
    const existingStatus = card.querySelector(
      "[data-stock-status]"
    );

    if (existingStatus) {
      return existingStatus;
    }

    const status = document.createElement("p");

    status.className =
      "stock-status is-loading";

    status.dataset.stockStatus = "";

    status.setAttribute(
      "aria-live",
      "polite"
    );

    status.textContent =
      "Consultando disponibilidad…";

    const price = card.querySelector(
      ".featured-price, .catalog-price"
    );

    const action = card.querySelector(
      ".product-cta"
    );

    const referenceElement =
      price || action;

    if (referenceElement) {
      referenceElement.insertAdjacentElement(
        "beforebegin",
        status
      );
    } else {
      card.appendChild(status);
    }

    return status;
  }


  /* -------------------------------------------------------
     MODIFICAR BOTÓN SEGÚN EL STOCK
     ------------------------------------------------------- */

  function enableAction(action) {
  if (!action) {
    return;
  }

  if (
    action.getAttribute("href") &&
    !action.dataset.originalHref
  ) {
    action.dataset.originalHref =
      action.getAttribute("href");
  }

  action.removeAttribute("href");

  action.classList.remove(
    "is-disabled"
  );

  action.classList.add(
    "add-to-cart"
  );

  action.removeAttribute(
    "aria-disabled"
  );

  action.setAttribute(
    "role",
    "button"
  );

  action.setAttribute(
    "tabindex",
    "0"
  );

  action.textContent =
    "Agregar al carrito";
}


  function disableAction(action) {
  if (!action) {
    return;
  }

  if (
    action.getAttribute("href") &&
    !action.dataset.originalHref
  ) {
    action.dataset.originalHref =
      action.getAttribute("href");
  }

  action.removeAttribute("href");

  action.classList.remove(
    "add-to-cart"
  );

  action.classList.add(
    "is-disabled"
  );

  action.setAttribute(
    "role",
    "button"
  );

  action.setAttribute(
    "aria-disabled",
    "true"
  );

  action.setAttribute(
    "tabindex",
    "-1"
  );

  action.textContent =
    "Sin stock";
}


  /* -------------------------------------------------------
     TEXTO DE DISPONIBILIDAD
     ------------------------------------------------------- */
function updateStockStatus(
  statusElement,
  available
) {
  statusElement.className =
    "stock-status";

  if (available <= 0) {
    statusElement.classList.add(
      "is-out"
    );

    statusElement.textContent =
      "Sin stock";

    return;
  }

  statusElement.classList.add(
    available <= 2
      ? "is-low"
      : "is-available"
  );

  statusElement.textContent =
    available === 1
      ? "1 unidad disponible"
      : `${available} unidades disponibles`;
}


  /* -------------------------------------------------------
     ACTUALIZAR UNA TARJETA
     ------------------------------------------------------- */

  function updateProductCard(
    card,
    product
  ) {
    const statusElement =
      getOrCreateStockStatus(card);

    const action = card.querySelector(
      ".product-cta"
    );

    const price = card.querySelector(
      ".featured-price, .catalog-price"
    );

    if (!product) {
      statusElement.className =
        "stock-status is-error";

      statusElement.textContent =
        "Disponibilidad no encontrada";

      disableAction(action);

      return;
    }

    const available = Math.max(
      0,
      Number(product.disponible) || 0
    );

    updateStockStatus(
      statusElement,
      available
    );

    /*
     * El precio visible también se sincroniza
     * con Google Sheets.
     */

    if (price && Number(product.precio) > 0) {
      price.textContent =
        formatCLP.format(
          Number(product.precio)
        );
    }

    if (available > 0) {
      enableAction(action);
    } else {
      disableAction(action);
    }

    card.dataset.liveStock =
      String(available);

    card.dataset.livePrice =
      String(product.precio || 0);

    card.dataset.productName =
      product.product || "";
  }


  /* -------------------------------------------------------
     MOSTRAR ERROR GENERAL
     ------------------------------------------------------- */

  function showInventoryError() {
    document
      .querySelectorAll(
        "[data-product-sku]"
      )
      .forEach((card) => {

        const statusElement =
          getOrCreateStockStatus(card);

        statusElement.className =
          "stock-status is-error";

        statusElement.textContent =
          "Stock por confirmar";

      });
  }


  /* -------------------------------------------------------
     INICIAR CONSULTA
     ------------------------------------------------------- */

  async function initializeInventory() {
    const productCards = [
      ...document.querySelectorAll(
        "[data-product-sku]"
      )
    ];

    if (productCards.length === 0) {
      return;
    }

    productCards.forEach((card) => {
      getOrCreateStockStatus(card);
    });

    try {
      const response =
        await loadInventory();

    if (
        !response ||
        response.ok !== true ||
        !Array.isArray(response.productos)
      ) {
        throw new Error(
          "La API respondió con un formato inválido."
        );
      }
      
      window.RUMBO_INVENTORY =
        response.productos;
      
      window.dispatchEvent(
        new CustomEvent(
          "rumbo:inventory-ready",
          {
            detail: response.productos
          }
        )
      );
      
      const productsBySku = new Map(
        response.productos.map(
          (product) => [
            String(product.sku)
              .trim()
              .toUpperCase(),
            product
          ]
        )
      );

      productCards.forEach((card) => {

        const sku = String(
          card.dataset.productSku || ""
        )
          .trim()
          .toUpperCase();

        const product =
          productsBySku.get(sku);

        updateProductCard(
          card,
          product
        );

      });

      console.info(
        `Inventario Rumbo Corcel cargado: ` +
        `${response.productos.length} productos.`
      );

    } catch (error) {
      console.error(
        "Error consultando inventario:",
        error
      );

      showInventoryError();
    }
  }


  initializeInventory();

});