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


  const INVENTORY_API_URL =
    "https://still-flower-9194rumbo-corcel-inventario.rumbocorcel.workers.dev/productos";


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

async function loadInventory() {
  if (
    !INVENTORY_API_URL ||
    INVENTORY_API_URL.includes(
      "PEGA_AQUI"
    )
  ) {
    throw new Error(
      "Falta configurar INVENTORY_API_URL."
    );
  }

  const controller =
    new AbortController();

  const timeout =
    window.setTimeout(
      () => {
        controller.abort();
      },
      10000
    );

  try {
    console.log(
      "Consultando inventario mediante Worker:",
      INVENTORY_API_URL
    );

    const response =
      await fetch(
        INVENTORY_API_URL,
        {
          method: "GET",
          mode: "cors",
          cache: "no-store",
          credentials: "omit",
          signal: controller.signal,

          headers: {
            Accept: "application/json"
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        `El Worker respondió HTTP ${response.status}.`
      );
    }

    const data =
      await response.json();

    if (
      !data ||
      data.ok !== true ||
      !Array.isArray(data.productos)
    ) {
      throw new Error(
        data?.detalle ||
        data?.error ||
        "El Worker entregó una respuesta inválida."
      );
    }

    return data;
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "La consulta del inventario excedió el plazo."
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
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

/* =========================================================
   CARRUSEL PRINCIPAL Y GALERÍAS DE NOVEDADES
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  const homeCarousel = document.querySelector("[data-home-carousel]");

  if (homeCarousel) {
    const track = homeCarousel.querySelector("[data-home-carousel-track]");
    const slides = [...homeCarousel.querySelectorAll("[data-home-slide]")];
    const dots = [...homeCarousel.querySelectorAll("[data-home-dot]")];
    const previousButton = homeCarousel.querySelector(".home-carousel-prev");
    const nextButton = homeCarousel.querySelector(".home-carousel-next");
    const currentLabel = homeCarousel.querySelector("[data-home-current]");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let currentIndex = 0;
    let autoPlayTimer = null;
    let touchStartX = 0;
    let touchStartY = 0;

    const requestedSlide = Number.parseInt(
      new URLSearchParams(window.location.search).get("slide"),
      10
    );

    if (Number.isInteger(requestedSlide) && requestedSlide >= 0 && requestedSlide < slides.length) {
      currentIndex = requestedSlide;

      const cleanUrl = `${window.location.pathname}${window.location.hash || "#inicio"}`;
      window.history.replaceState({}, "", cleanUrl);
    }

    const updateCarousel = (index, { userInitiated = false } = {}) => {
      currentIndex = (index + slides.length) % slides.length;
      track.style.transform = `translateX(-${currentIndex * 100}%)`;

      slides.forEach((slide, slideIndex) => {
        const isActive = slideIndex === currentIndex;
        slide.setAttribute("aria-hidden", String(!isActive));
        slide.toggleAttribute("inert", !isActive);
      });

      dots.forEach((dot, dotIndex) => {
        dot.setAttribute("aria-selected", String(dotIndex === currentIndex));
      });

      if (currentLabel) {
        currentLabel.textContent = String(currentIndex + 1).padStart(2, "0");
      }

      sessionStorage.setItem("rumboHomeCarouselIndex", String(currentIndex));

      if (userInitiated) {
        restartAutoPlay();
      }
    };

    const stopAutoPlay = () => {
      if (autoPlayTimer !== null) {
        window.clearInterval(autoPlayTimer);
        autoPlayTimer = null;
      }
    };

    const startAutoPlay = () => {
      stopAutoPlay();

      if (reducedMotion.matches || document.hidden) {
        return;
      }

      autoPlayTimer = window.setInterval(() => {
        updateCarousel(currentIndex + 1);
      }, 9000);
    };

    const restartAutoPlay = () => {
      stopAutoPlay();
      startAutoPlay();
    };

    previousButton?.addEventListener("click", () => {
      updateCarousel(currentIndex - 1, { userInitiated: true });
    });

    nextButton?.addEventListener("click", () => {
      updateCarousel(currentIndex + 1, { userInitiated: true });
    });

    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        updateCarousel(Number(dot.dataset.homeDot), { userInitiated: true });
      });
    });

    homeCarousel.addEventListener("mouseenter", stopAutoPlay);
    homeCarousel.addEventListener("mouseleave", startAutoPlay);
    homeCarousel.addEventListener("focusin", stopAutoPlay);
    homeCarousel.addEventListener("focusout", startAutoPlay);

    homeCarousel.addEventListener("touchstart", (event) => {
      const touch = event.changedTouches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      stopAutoPlay();
    }, { passive: true });

    homeCarousel.addEventListener("touchend", (event) => {
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY)) {
        updateCarousel(
          deltaX < 0 ? currentIndex + 1 : currentIndex - 1,
          { userInitiated: true }
        );
      } else {
        startAutoPlay();
      }
    }, { passive: true });

    homeCarousel.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        updateCarousel(currentIndex - 1, { userInitiated: true });
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        updateCarousel(currentIndex + 1, { userInitiated: true });
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopAutoPlay();
      } else {
        startAutoPlay();
      }
    });

    if (typeof reducedMotion.addEventListener === "function") {
      reducedMotion.addEventListener("change", startAutoPlay);
    }

    document.querySelectorAll("[data-novedad-open]").forEach((link) => {
      link.addEventListener("click", () => {
        const index = Number(link.dataset.homeSlideIndex);
        if (Number.isInteger(index)) {
          sessionStorage.setItem("rumboHomeCarouselIndex", String(index));
        }

        if (typeof window.gtag === "function") {
          window.gtag("event", "abrir_novedad", {
            novedad: link.getAttribute("href") || "",
            slide: index
          });
        }
      });
    });

    updateCarousel(currentIndex);
    startAutoPlay();
  }


  document.querySelectorAll("[data-story-gallery]").forEach((gallery) => {
    const track = gallery.querySelector("[data-story-track]");
    const slides = [...gallery.querySelectorAll("[data-story-slide]")];
    const previousButton = gallery.querySelector(".story-gallery-prev");
    const nextButton = gallery.querySelector(".story-gallery-next");
    const dots = [...gallery.querySelectorAll("[data-story-dot]")];
    const currentLabel = gallery.querySelector("[data-story-current]");

    if (!track || slides.length === 0) {
      return;
    }

    let currentIndex = 0;
    let touchStartX = 0;
    let touchStartY = 0;

    const updateGallery = (index) => {
      currentIndex = (index + slides.length) % slides.length;
      track.style.transform = `translateX(-${currentIndex * 100}%)`;

      slides.forEach((slide, slideIndex) => {
        slide.setAttribute("aria-hidden", String(slideIndex !== currentIndex));
      });

      dots.forEach((dot, dotIndex) => {
        dot.setAttribute("aria-selected", String(dotIndex === currentIndex));
      });

      if (currentLabel) {
        currentLabel.textContent = String(currentIndex + 1).padStart(2, "0");
      }
    };

    previousButton?.addEventListener("click", () => updateGallery(currentIndex - 1));
    nextButton?.addEventListener("click", () => updateGallery(currentIndex + 1));

    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        updateGallery(Number(dot.dataset.storyDot));
      });
    });

    gallery.addEventListener("touchstart", (event) => {
      const touch = event.changedTouches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    }, { passive: true });

    gallery.addEventListener("touchend", (event) => {
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY)) {
        updateGallery(deltaX < 0 ? currentIndex + 1 : currentIndex - 1);
      }
    }, { passive: true });

    gallery.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        updateGallery(currentIndex - 1);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        updateGallery(currentIndex + 1);
      }
    });

    updateGallery(0);
  });
});

