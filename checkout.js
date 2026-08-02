"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const CHECKOUT_CONFIG = Object.freeze({
    apiUrl: "https://script.google.com/macros/s/AKfycbymJY7QfvVhKrKRznUkk87mz3xA1C-kOuBtydu4N2ZL59sSdMc-MTfPV2ftLvMiUmmA/exec",
    turnstileSiteKey: "0x4AAAAAAEEIY8C7n9zxx6Bt"
    cartStorageKey: "rumboCorcelCartV2",
    reservationStorageKey: "rumboCorcelReservaV1",
    requestTimeoutMs: 45000,

    pickupAddress:
      "Aranjuez Pte. 399, 8700585 Quilicura, Región Metropolitana",

    pickupRegion:
      "Región Metropolitana",

    pickupCommune:
      "Quilicura",

    blueExpressTransitDays: Object.freeze({
      "Región Metropolitana": 1,
      "Región de Arica y Parinacota": 4,
      "Región de Tarapacá": 3,
      "Región de Antofagasta": 3,
      "Región de Atacama": 2,
      "Región de Coquimbo": 2,
      "Región de Valparaíso": 2,
      "Región del Libertador General Bernardo O'Higgins": 2,
      "Región del Maule": 2,
      "Región de Ñuble": 2,
      "Región del Biobío": 2,
      "Región de La Araucanía": 2,
      "Región de Los Ríos": 2,
      "Región de Los Lagos": 2,
      "Región de Aysén": 7,
      "Región de Magallanes": 9
    })
  });

    let requestPending = false;
    let pendingAction = "";
    let requestTimeout = null;
    let countdownTimer = null;
    let pendingDeliveryData = null;

    let turnstileWidgetId = null;
    let turnstileToken = "";

  createCheckoutInterface();
  installCheckoutInterception();
  restoreActiveReservation();

  window.addEventListener("message", handleAppsScriptMessage);

  function createCheckoutInterface() {
    if (document.querySelector("[data-checkout-overlay]")) {
      return;
    }

    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <div
        class="checkout-overlay"
        data-checkout-overlay
        aria-hidden="true">

        <section
          class="checkout-panel"
          data-checkout-panel
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-title">

          <header class="checkout-header">
            <div>
              <span class="checkout-eyebrow">RUMBO CORCEL</span>
              <h2 id="checkout-title">Datos de compra</h2>
            </div>

            <button
              class="checkout-close"
              type="button"
              data-checkout-close
              aria-label="Cerrar">
              ×
            </button>
          </header>

          <div
            class="checkout-body"
            data-checkout-body>

            <p class="checkout-intro">
              Completa tus datos para reservar las unidades
              durante 30 minutos.
            </p>

            <form data-checkout-form>
              <label class="checkout-field">
                <span>Nombre completo</span>
                <input
                  type="text"
                  name="nombre"
                  maxlength="120"
                  autocomplete="name"
                  required>
              </label>

              <label class="checkout-field">
                <span>Correo electrónico</span>
                <input
                  type="email"
                  name="correo"
                  maxlength="160"
                  autocomplete="email"
                  required>
              </label>

              <label class="checkout-field">
                <span>WhatsApp</span>
                <input
                  type="tel"
                  name="whatsapp"
                  maxlength="30"
                  autocomplete="tel"
                  placeholder="+56 9 1234 5678"
                  required>
              </label>

              <div class="checkout-grid">
                <label class="checkout-field">
                  <span>Región</span>
                  <input
                    type="text"
                    name="region"
                    maxlength="100"
                    autocomplete="address-level1"
                    required>
                </label>

                <label class="checkout-field">
                  <span>Comuna</span>
                  <input
                    type="text"
                    name="comuna"
                    maxlength="100"
                    autocomplete="address-level2"
                    required>
                </label>
              </div>

              <label class="checkout-field">
                <span>Dirección</span>
                <textarea
                  name="direccion"
                  maxlength="220"
                  rows="3"
                  autocomplete="street-address"
                  required></textarea>
              </label>

              <input
                type="hidden"
                name="tipoEntrega"
                value="Despacho">

              <div
                class="checkout-error"
                data-checkout-error
                role="alert">
              </div>

              <button
                class="checkout-submit"
                type="submit"
                data-checkout-submit>
                Reservar y ver datos de transferencia
              </button>

              <p class="checkout-legal-note">
                Al continuar, el stock se validará nuevamente.
                La compra solo quedará confirmada después de
                comprobar el depósito.
              </p>
            </form>
          </div>
        </section>
      </div>

      <iframe
        class="checkout-response-frame"
        name="rumboReservaResponse"
        title="Respuesta de la reserva"
        aria-hidden="true">
      </iframe>
      `
    );

    document
      .querySelector("[data-checkout-close]")
      ?.addEventListener("click", closeCheckout);

    document
      .querySelector("[data-checkout-overlay]")
      ?.addEventListener("click", (event) => {
        if (event.target.matches("[data-checkout-overlay]")) {
          closeCheckout();
        }
      });

    document
      .querySelector("[data-checkout-form]")
      ?.addEventListener("submit", submitReservation);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeCheckout();
      }
    });
  }

  function installCheckoutInterception() {
    document.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest("[data-cart-checkout]");

        if (!button) {
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        const activeReservation = loadActiveReservation();

        if (activeReservation) {
          if (
            String(activeReservation.estado || "").toLowerCase() ===
            "pago informado"
          ) {
            showPaymentReportedScreen(activeReservation);
          } else {
            showTransferScreen(activeReservation);
          }

          openCheckout();
          return;
        }

        const cart = loadCart();

        if (cart.length === 0) {
          showCartToast("Tu carrito está vacío.");
          return;
        }

        showCheckoutForm();
        openCheckout();
      },
      true
    );
  }

  function submitReservation(event) {
    event.preventDefault();

    if (requestPending) {
      return;
    }

    const form = event.currentTarget;
    const cart = loadCart();

    if (cart.length === 0) {
      showError("Tu carrito está vacío.");
      return;
    }
    
    if (!turnstileToken) {
  showError(
    "Completa la verificación de seguridad antes de reservar."
  );

  return;
}

    const apiUrlValida =
      /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/
        .test(CHECKOUT_CONFIG.apiUrl);

    if (!apiUrlValida) {
      showError(
        "Falta configurar correctamente la URL de Apps Script en checkout.js."
      );
      return;
    }

    const formData = new FormData(form);

    const tipoEntrega = String(
      formData.get("tipoEntrega") || "Retiro"
    ).trim();

    const esRetiro =
      tipoEntrega === "Retiro";

    const region = esRetiro
      ? CHECKOUT_CONFIG.pickupRegion
      : String(formData.get("region") || "").trim();

    const comuna = esRetiro
      ? CHECKOUT_CONFIG.pickupCommune
      : String(formData.get("comuna") || "").trim();

    const direccion = esRetiro
      ? CHECKOUT_CONFIG.pickupAddress
      : String(formData.get("direccion") || "").trim();

    if (
      !esRetiro &&
      (!region || !comuna || !direccion)
    ) {
      showError(
        "Completa la región, comuna y dirección para solicitar envío."
      );
      return;
    }

    const estimacionBlue = esRetiro
      ? null
      : getBlueExpressTransitEstimate(region);

    pendingDeliveryData = {
      tipoEntrega,
      region,
      comuna,
      direccion,
      transportista: esRetiro
        ? ""
        : "Blue Express",
      modalidadEnvio: esRetiro
        ? "Retiro"
        : "Por pagar",
      tallaEnvio: esRetiro
        ? ""
        : "S",
      cotizacionEnvio: esRetiro
        ? "$0"
        : "Por pagar; valor final determinado por Blue Express",
      plazoEnvio: esRetiro
        ? "Retiro coordinado"
        : estimacionBlue.label,
      plazoDiasHabiles: esRetiro
        ? 0
        : estimacionBlue.days
    };

    const payload = {
      action: "crearReserva",
      formato: "iframe",
      origen: window.location.origin,
      
      turnstileToken,
      
      cliente: {
        nombre: String(formData.get("nombre") || "").trim(),
        correo: String(formData.get("correo") || "").trim(),
        whatsapp: String(formData.get("whatsapp") || "").trim(),
        region,
        comuna,
        direccion,
        tipoEntrega
      },

      entrega: pendingDeliveryData,

      items: cart.map((item) => ({
        sku: String(item.sku || "").trim().toUpperCase(),
        cantidad: Math.max(1, Number(item.quantity) || 1)
      }))
    };

    pendingAction = "crearReserva";
    setPendingState(true);
    showError("");

    const postForm = document.createElement("form");

    postForm.method = "POST";
    postForm.action = CHECKOUT_CONFIG.apiUrl;
    postForm.target = "rumboReservaResponse";
    postForm.style.display = "none";

    appendHiddenField(postForm, "action", "crearReserva");
    appendHiddenField(postForm, "formato", "iframe");
    appendHiddenField(postForm, "origen", window.location.origin);
    appendHiddenField(postForm, "payload", JSON.stringify(payload));

    document.body.appendChild(postForm);
    postForm.submit();
    postForm.remove();

    window.clearTimeout(requestTimeout);

    requestTimeout = window.setTimeout(() => {
      if (!requestPending) {
        return;
      }

      if (pendingAction === "informarTransferencia") {
        setTransferPendingState(false);
        showError(
          "No pudimos registrar el aviso todavía. Revisa tu conexión " +
          "y vuelve a presionar el botón antes de que venza la reserva."
        );
      } else {
        setPendingState(false);
        showError(
          "La reserva está tardando demasiado. Revisa tu conexión " +
          "y vuelve a intentarlo antes de transferir."
        );
      }

      pendingAction = "";
    }, CHECKOUT_CONFIG.requestTimeoutMs);
  }

function isTrustedAppsScriptOrigin(origin) {
  try {
    const url = new URL(origin);

    const trustedHostname =
      url.hostname === "script.google.com" ||
      url.hostname.endsWith(
        ".script.googleusercontent.com"
      ) ||
      url.hostname.endsWith(
        ".scriptmac.googleusercontent.com"
      );

    return (
      url.protocol === "https:" &&
      trustedHostname
    );
  } catch (_error) {
    return false;
  }
}



  function handleAppsScriptMessage(event) {
    const responseFrame =
      document.querySelector(
        'iframe[name="rumboReservaResponse"]'
      );

   if (
      !responseFrame ||
      event.source !==
        responseFrame.contentWindow ||
      !isTrustedAppsScriptOrigin(
        event.origin
      )
    ) {
    console.warn(
      "Mensaje externo bloqueado:",
      event.origin
    );

    return;
  }
  
    if (!requestPending) {
      return;
    }

    const response = event.data;

    if (
      !response ||
      typeof response !== "object" ||
      response.tipo !== "rumbo-reserva-respuesta" ||
      typeof response.ok !== "boolean"
    ) {
      return;
    }

    window.clearTimeout(requestTimeout);

    const action = pendingAction;
    pendingAction = "";

    if (action === "informarTransferencia") {
      setTransferPendingState(false);

      if (!response.ok) {
        if (response.reservaVencida) {
          removeActiveReservation();
          renderExpiredReservation();
          return;
        }

        showError(
          response.error ||
          "No fue posible registrar la transferencia."
        );
        return;
      }

      const currentReservation =
        loadStoredReservationWithoutExpiryCheck() || {};

      const updatedReservation = {
        ...currentReservation,
        ...response,
        estado: "Pago informado",
        savedAt: new Date().toISOString()
      };

      saveActiveReservation(updatedReservation);
      showPaymentReportedScreen(updatedReservation);
      return;
    }

    setPendingState(false);

    if (!response.ok) {
      showError(
        response.error ||
        "No fue posible crear la reserva."
      );
      return;
    }

    const reservation = {
      ...response,
      entrega:
        response.entrega ||
        pendingDeliveryData ||
        null,
      savedAt: new Date().toISOString()
    };

    pendingDeliveryData = null;

    saveActiveReservation(reservation);
    clearVisibleCart();
    showTransferScreen(reservation);
  }

  function showCheckoutForm() {
    window.clearInterval(countdownTimer);

    const body = document.querySelector("[data-checkout-body]");
    const title = document.querySelector("#checkout-title");

    if (!body || !title) {
      return;
    }

    title.textContent = "Datos de compra";

    body.innerHTML = `
      <p class="checkout-intro">
        Completa tus datos y elige cómo quieres recibir tu compra.
        Las unidades se reservarán durante 30 minutos.
      </p>

      <form data-checkout-form>
        <label class="checkout-field">
          <span>Nombre completo</span>
          <input
            type="text"
            name="nombre"
            maxlength="120"
            autocomplete="name"
            required>
        </label>

        <label class="checkout-field">
          <span>Correo electrónico</span>
          <input
            type="email"
            name="correo"
            maxlength="160"
            autocomplete="email"
            required>
        </label>

        <label class="checkout-field">
          <span>WhatsApp</span>
          <input
            type="tel"
            name="whatsapp"
            maxlength="30"
            autocomplete="tel"
            placeholder="+56 9 1234 5678"
            required>
        </label>

        <fieldset class="checkout-delivery">
          <legend>¿Cómo quieres recibir tu compra?</legend>

          <div class="delivery-options">
            <label class="delivery-option">
              <input
                type="radio"
                name="tipoEntrega"
                value="Retiro"
                checked>

              <span>
                <strong>Retiro en Quilicura</strong>
                <small>Sin costo de envío</small>
              </span>
            </label>

            <label class="delivery-option">
              <input
                type="radio"
                name="tipoEntrega"
                value="Envío por pagar">

              <span>
                <strong>Envío por pagar</strong>
                <small>Mediante Blue Express</small>
              </span>
            </label>
          </div>
        </fieldset>

        <div
          class="delivery-panel"
          data-pickup-panel>

          <strong>Dirección de retiro</strong>

          <p>
            ${escapeHtml(CHECKOUT_CONFIG.pickupAddress)}
          </p>

          <small>
            Después de confirmar el pago nos pondremos en contacto
            para coordinar el día y horario.
          </small>
        </div>

        <div
          class="delivery-panel"
          data-shipping-panel
          hidden>

          <div class="checkout-grid">
            <label class="checkout-field">
              <span>Región</span>

              <select
                name="region"
                autocomplete="address-level1"
                data-shipping-field
                disabled>
                <option value="">Selecciona una región</option>
                <option>Región de Arica y Parinacota</option>
                <option>Región de Tarapacá</option>
                <option>Región de Antofagasta</option>
                <option>Región de Atacama</option>
                <option>Región de Coquimbo</option>
                <option>Región de Valparaíso</option>
                <option>Región Metropolitana</option>
                <option>Región del Libertador General Bernardo O'Higgins</option>
                <option>Región del Maule</option>
                <option>Región de Ñuble</option>
                <option>Región del Biobío</option>
                <option>Región de La Araucanía</option>
                <option>Región de Los Ríos</option>
                <option>Región de Los Lagos</option>
                <option>Región de Aysén</option>
                <option>Región de Magallanes</option>
              </select>
            </label>

            <label class="checkout-field">
              <span>Comuna</span>

              <input
                type="text"
                name="comuna"
                maxlength="100"
                autocomplete="address-level2"
                placeholder="Ej.: Providencia"
                data-shipping-field
                disabled>
            </label>
          </div>

          <label class="checkout-field">
            <span>Dirección de entrega</span>

            <textarea
              name="direccion"
              maxlength="220"
              rows="3"
              autocomplete="street-address"
              placeholder="Calle, número, departamento o indicaciones"
              data-shipping-field
              disabled></textarea>
          </label>

          <div class="shipping-note">
            <strong>Envío por pagar vía Blue Express</strong>

            <p>
              El total de la transferencia corresponde solo a los
              productos. El envío se paga al transportista al recibir.
            </p>

            <div
              class="shipping-estimate"
              data-shipping-estimate
              hidden>

              <span>Tiempo estimado de tránsito</span>
              <strong data-shipping-estimate-value>—</strong>

              <small>
                Contado desde que Blue Express recibe físicamente el
                paquete. No incluye validación del pago ni preparación
                del pedido por Rumbo Corcel.
              </small>
            </div>

            <p class="shipping-disclaimer">
              Es una referencia. El plazo definitivo aparecerá en el
              seguimiento una vez generado el número de OS.
            </p>
          </div>
        </div>
        <div class="turnstile-section">
  <p>
    Verificación de seguridad
  </p>

  <div
    class="turnstile-container"
    data-turnstile-container>
  </div>

  <small>
    Esta verificación evita reservas automáticas
    o maliciosas del inventario.
  </small>
</div>

        <div
          class="checkout-error"
          data-checkout-error
          role="alert">
        </div>

        <button
          class="checkout-submit"
          type="submit"
          data-checkout-submit>
          Reservar y ver datos de transferencia
        </button>

        <p class="checkout-legal-note">
          Al continuar, el stock se validará nuevamente.
          La compra solo quedará confirmada después de
          comprobar el depósito.
        </p>
      </form>
    `;

    const form =
      body.querySelector("[data-checkout-form]");

    form?.addEventListener(
      "submit",
      submitReservation
    );

    installDeliveryOptionHandlers(form);
    renderTurnstileWidget(form);
  }
  
  function renderTurnstileWidget(form) {
  if (!form) {
    return;
  }

  const container =
    form.querySelector(
      "[data-turnstile-container]"
    );

  const submitButton =
    form.querySelector(
      "[data-checkout-submit]"
    );

  if (!container) {
    return;
  }

  /*
   * Esperar a que el script externo
   * de Cloudflare termine de cargar.
   */
  if (
    !window.turnstile ||
    typeof window.turnstile.render !==
      "function"
  ) {
    window.setTimeout(
      () => {
        renderTurnstileWidget(form);
      },
      150
    );

    return;
  }

  /*
   * Eliminar un widget anterior
   * si se vuelve a abrir el checkout.
   */
  if (turnstileWidgetId !== null) {
    try {
      window.turnstile.remove(
        turnstileWidgetId
      );
    } catch (_error) {
      // El widget anterior ya no existía.
    }
  }

  turnstileToken = "";

  if (submitButton) {
    submitButton.disabled = true;
  }

  turnstileWidgetId =
    window.turnstile.render(
      container,
      {
        sitekey:
          CHECKOUT_CONFIG
            .turnstileSiteKey,

        theme: "light",
        size: "flexible",
        action: "crear_reserva",

        callback(token) {
          turnstileToken =
            String(token || "");

          if (submitButton) {
            submitButton.disabled = false;
          }

          showError("");
        },

        "expired-callback"() {
          turnstileToken = "";

          if (submitButton) {
            submitButton.disabled = true;
          }

          showError(
            "La verificación de seguridad venció. Complétala nuevamente."
          );
        },

        "error-callback"() {
          turnstileToken = "";

          if (submitButton) {
            submitButton.disabled = true;
          }

          showError(
            "No pudimos completar la verificación de seguridad. Recarga la página e inténtalo nuevamente."
          );

          return true;
        }
      }
    );
}


  function installDeliveryOptionHandlers(form) {
    if (!form) {
      return;
    }

    const radios = Array.from(
      form.querySelectorAll(
        'input[name="tipoEntrega"]'
      )
    );

    const pickupPanel =
      form.querySelector("[data-pickup-panel]");

    const shippingPanel =
      form.querySelector("[data-shipping-panel]");

    const shippingFields = Array.from(
      form.querySelectorAll(
        "[data-shipping-field]"
      )
    );

    const regionField =
      form.querySelector('select[name="region"]');

    const estimateBox =
      form.querySelector("[data-shipping-estimate]");

    const estimateValue =
      form.querySelector("[data-shipping-estimate-value]");

    const updateShippingEstimate = () => {
      const region = String(
        regionField?.value || ""
      ).trim();

      if (!region) {
        if (estimateBox) {
          estimateBox.hidden = true;
        }

        if (estimateValue) {
          estimateValue.textContent = "—";
        }

        return;
      }

      const estimate =
        getBlueExpressTransitEstimate(region);

      if (estimateValue) {
        estimateValue.textContent = estimate.label;
      }

      if (estimateBox) {
        estimateBox.hidden = false;
      }
    };

    const updateDeliveryView = () => {
      const selected =
        form.querySelector(
          'input[name="tipoEntrega"]:checked'
        )?.value || "Retiro";

      const esEnvio =
        selected === "Envío por pagar";

      if (pickupPanel) {
        pickupPanel.hidden = esEnvio;
      }

      if (shippingPanel) {
        shippingPanel.hidden = !esEnvio;
      }

      shippingFields.forEach((field) => {
        field.disabled = !esEnvio;
        field.required = esEnvio;
      });

      if (esEnvio) {
        updateShippingEstimate();
      } else if (estimateBox) {
        estimateBox.hidden = true;
      }

      showError("");
    };

    radios.forEach((radio) => {
      radio.addEventListener(
        "change",
        updateDeliveryView
      );
    });

    regionField?.addEventListener(
      "change",
      updateShippingEstimate
    );

    updateDeliveryView();
  }


  function getBlueExpressTransitEstimate(region) {
    const normalizedRegion = String(
      region || ""
    ).trim();

    const days =
      CHECKOUT_CONFIG.blueExpressTransitDays[normalizedRegion] || 2;

    return {
      days,
      label:
        days === 1
          ? "Aproximadamente 1 día hábil"
          : `Aproximadamente ${days} días hábiles`
    };
  }


  function deliverySummaryMarkup(reservation) {
    const entrega =
      reservation.entrega || {};

    const tipoEntrega = String(
      entrega.tipoEntrega || ""
    );

    const esRetiro =
      tipoEntrega === "Retiro";

    if (esRetiro) {
      return `
        <div class="delivery-summary">
          <strong>Retiro en Quilicura</strong>

          <p>
            ${escapeHtml(
              entrega.direccion ||
              CHECKOUT_CONFIG.pickupAddress
            )}
          </p>
        </div>
      `;
    }

    if (tipoEntrega) {
      const destino = [
        entrega.direccion,
        entrega.comuna,
        entrega.region
      ]
        .filter(Boolean)
        .join(", ");

      return `
        <div class="delivery-summary">
          <strong>
            Envío por pagar vía Blue Express
          </strong>

          <p>
            ${escapeHtml(destino)}
          </p>

          <p>
            <strong>Tiempo estimado:</strong>
            ${escapeHtml(
              entrega.plazoEnvio ||
              getBlueExpressTransitEstimate(
                entrega.region
              ).label
            )}
          </p>

          <small>
            Contado desde que Blue Express recibe el paquete.
            El envío se paga al transportista al recibir.
          </small>
        </div>
      `;
    }

    return "";
  }


  function showTransferScreen(reservation) {
    window.clearInterval(countdownTimer);

    const body = document.querySelector("[data-checkout-body]");
    const title = document.querySelector("#checkout-title");

    if (!body || !title) {
      return;
    }

    title.textContent = "Realiza tu transferencia";

    const transfer = reservation.transferencia || {};

    body.innerHTML = `
      <div class="reservation-success">
        <span class="reservation-check">✓</span>

        <h3>Unidades reservadas</h3>

        <p>
          Tienes 30 minutos para realizar la transferencia.
          Tu compra todavía no está confirmada.
        </p>
      </div>

      <div class="reservation-countdown">
        <span>Tiempo restante</span>
        <strong data-reservation-countdown>--:--</strong>
      </div>

      ${deliverySummaryMarkup(reservation)}

      <div class="transfer-total">
        <span>
          ${
            reservation.entrega?.tipoEntrega === "Envío por pagar"
              ? "Total a transferir por productos"
              : "Total a transferir"
          }
        </span>

        <strong>
          ${formatMoney(reservation.totalEstimado)}
        </strong>
      </div>

      <dl class="transfer-details">
        ${detailRow("Titular", transfer.titular)}
        ${detailRow("RUT", transfer.rut)}
        ${detailRow("Banco", transfer.banco)}
        ${detailRow("Tipo de cuenta", transfer.tipoCuenta)}
        ${detailRow("Número de cuenta", transfer.numeroCuenta)}
        ${detailRow("Correo", transfer.correo)}
      </dl>

      <div class="transfer-warning">
        <strong>Importante</strong>
        <p>
          Aún no se ha generado un código de compra.
          Lo recibirás por correo únicamente después de
          que validemos el depósito.
        </p>
      </div>

      <label class="checkout-field">
        <span>
          Nombre del titular de la cuenta desde la que transferiste
        </span>
        <input
          type="text"
          maxlength="120"
          autocomplete="name"
          data-transfer-holder
          placeholder="Ej.: Camila Herrera"
          required>
      </label>

      <div
        class="checkout-error"
        data-checkout-error
        role="alert">
      </div>

      <button
        class="checkout-submit"
        type="button"
        data-transfer-reported>
        Ya realicé la transferencia
      </button>

      <p class="checkout-legal-note">
        Presiona este botón solo después de transferir el total indicado.
        Informar la transferencia no confirma automáticamente la compra.
      </p>
    `;

    body
      .querySelector("[data-transfer-reported]")
      ?.addEventListener(
        "click",
        () => reportTransfer(reservation)
      );

    startCountdown(reservation.reservaHasta);
  }

  function reportTransfer(reservation) {
    if (requestPending) {
      return;
    }

    const holderInput = document.querySelector(
      "[data-transfer-holder]"
    );

    const titularTransferencia = String(
      holderInput?.value || ""
    ).trim();

    if (!titularTransferencia) {
      showError(
        "Escribe el nombre del titular de la cuenta desde la que transferiste."
      );
      holderInput?.focus();
      return;
    }

    const deadline = new Date(
      reservation.reservaHasta
    ).getTime();

    if (
      !Number.isFinite(deadline) ||
      deadline <= Date.now()
    ) {
      renderExpiredReservation();
      return;
    }

    const payload = {
      action: "informarTransferencia",
      formato: "iframe",
      origen: window.location.origin,
      tokenReserva: reservation.tokenReserva,
      titularTransferencia
    };

    pendingAction = "informarTransferencia";
    setTransferPendingState(true);
    showError("");

    const postForm = document.createElement("form");

    postForm.method = "POST";
    postForm.action = CHECKOUT_CONFIG.apiUrl;
    postForm.target = "rumboReservaResponse";
    postForm.style.display = "none";

    appendHiddenField(
      postForm,
      "action",
      "informarTransferencia"
    );

    appendHiddenField(postForm, "formato", "iframe");
    appendHiddenField(postForm, "origen", window.location.origin);
    appendHiddenField(postForm, "payload", JSON.stringify(payload));

    document.body.appendChild(postForm);
    postForm.submit();
    postForm.remove();

    window.clearTimeout(requestTimeout);

    requestTimeout = window.setTimeout(() => {
      if (
        !requestPending ||
        pendingAction !== "informarTransferencia"
      ) {
        return;
      }

      setTransferPendingState(false);
      pendingAction = "";

      showError(
        "No pudimos registrar el aviso todavía. Revisa tu conexión " +
        "y vuelve a presionar el botón antes de que venza la reserva."
      );
    }, CHECKOUT_CONFIG.requestTimeoutMs);
  }

  function showPaymentReportedScreen(reservation) {
    window.clearInterval(countdownTimer);

    const body = document.querySelector("[data-checkout-body]");
    const title = document.querySelector("#checkout-title");

    if (!body || !title) {
      return;
    }

    title.textContent = "Transferencia informada";

    body.innerHTML = `
      <div class="reservation-success">
        <span class="reservation-check">✓</span>

        <h3>Transferencia informada</h3>

        <p>
          Estamos verificando el depósito. Tu compra todavía no está
          confirmada. Recibirás el código de pedido por correo una vez
          que validemos el pago.
        </p>
      </div>

      <div class="transfer-warning">
        <strong>Plazo de confirmación</strong>
        <p>
          Nuestro sistema tiene un plazo máximo de 12 horas para
          confirmar tu pedido. La confirmación llegará a tu correo
          electrónico a la brevedad.
        </p>
      </div>

      <a
        class="checkout-submit checkout-link"
        href="catalogo.html"
        data-payment-reported-close>
        Volver al catálogo
      </a>

      <p class="checkout-legal-note">
        No realices una segunda transferencia. Si necesitas ayuda,
        contáctanos por WhatsApp.
      </p>
    `;

    body
      .querySelector("[data-payment-reported-close]")
      ?.addEventListener(
        "click",
        () => removeActiveReservation()
      );
  }

  function startCountdown(reservationDeadline) {
    const deadline = new Date(reservationDeadline).getTime();
    const element = document.querySelector(
      "[data-reservation-countdown]"
    );

    if (!element || !Number.isFinite(deadline)) {
      return;
    }

    const update = () => {
      const remaining = deadline - Date.now();

      if (remaining <= 0) {
        window.clearInterval(countdownTimer);
        element.textContent = "00:00";
        renderExpiredReservation();
        return;
      }

      const totalSeconds = Math.floor(remaining / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      element.textContent =
        `${String(minutes).padStart(2, "0")}:` +
        `${String(seconds).padStart(2, "0")}`;
    };

    update();
    countdownTimer = window.setInterval(update, 1000);
  }

  function renderExpiredReservation() {
    removeActiveReservation();

    const body = document.querySelector("[data-checkout-body]");
    const title = document.querySelector("#checkout-title");

    if (!body || !title) {
      return;
    }

    title.textContent = "Reserva vencida";

    body.innerHTML = `
      <div class="reservation-expired">
        <span>!</span>
        <h3>Tu reserva ha vencido</h3>
        <p>
          Han pasado más de 30 minutos, por lo que las unidades
          fueron liberadas. Te invitamos a revisar nuevamente
          el stock e iniciar otra compra.
        </p>

        <a class="checkout-submit checkout-link" href="catalogo.html">
          Volver al catálogo
        </a>

        <p class="checkout-legal-note">
          Si alcanzaste a transferir antes del vencimiento,
          contáctanos antes de realizar una segunda transferencia.
        </p>
      </div>
    `;
  }

  function restoreActiveReservation() {
    const reservation = loadActiveReservation();

    if (!reservation) {
      return;
    }

    window.setTimeout(() => {
      if (
        String(reservation.estado || "").toLowerCase() ===
        "pago informado"
      ) {
        showPaymentReportedScreen(reservation);
      } else {
        showTransferScreen(reservation);
      }

      openCheckout();
    }, 500);
  }

  function loadActiveReservation() {
    const reservation = loadStoredReservationWithoutExpiryCheck();

    if (!reservation) {
      return null;
    }

    if (
      String(reservation.estado || "").toLowerCase() ===
      "pago informado"
    ) {
      return reservation;
    }

    const deadline = new Date(
      reservation.reservaHasta
    ).getTime();

    if (!Number.isFinite(deadline) || deadline <= Date.now()) {
      localStorage.removeItem(
        CHECKOUT_CONFIG.reservationStorageKey
      );
      return null;
    }

    return reservation;
  }

  function loadStoredReservationWithoutExpiryCheck() {
    try {
      const stored = localStorage.getItem(
        CHECKOUT_CONFIG.reservationStorageKey
      );

      if (!stored) {
        return null;
      }

      const reservation = JSON.parse(stored);

      return reservation && typeof reservation === "object"
        ? reservation
        : null;
    } catch (error) {
      console.warn("No fue posible leer la reserva:", error);
      return null;
    }
  }

  function saveActiveReservation(reservation) {
    localStorage.setItem(
      CHECKOUT_CONFIG.reservationStorageKey,
      JSON.stringify(reservation)
    );
  }

  function removeActiveReservation() {
    localStorage.removeItem(
      CHECKOUT_CONFIG.reservationStorageKey
    );
  }

  function loadCart() {
    try {
      const stored = localStorage.getItem(
        CHECKOUT_CONFIG.cartStorageKey
      );

      const parsed = stored ? JSON.parse(stored) : [];

      return Array.isArray(parsed)
        ? parsed.filter(
            (item) =>
              item &&
              item.sku &&
              Number(item.quantity) > 0
          )
        : [];
    } catch (error) {
      console.warn("No fue posible leer el carrito:", error);
      return [];
    }
  }

  function clearVisibleCart() {
    const clearButton = document.querySelector("[data-cart-clear]");

    if (clearButton && !clearButton.disabled) {
      clearButton.click();
      return;
    }

    localStorage.setItem(
      CHECKOUT_CONFIG.cartStorageKey,
      "[]"
    );
  }

  function appendHiddenField(form, name, value) {
    const input = document.createElement("input");

    input.type = "hidden";
    input.name = name;
    input.value = value;

    form.appendChild(input);
  }

  function detailRow(label, value) {
    return `
      <div>
        <dt>${escapeHtml(label)}</dt>
        <dd>${escapeHtml(value || "—")}</dd>
      </div>
    `;
  }

  function setPendingState(isPending) {
    requestPending = isPending;

    const button = document.querySelector("[data-checkout-submit]");

    if (!button) {
      return;
    }

    button.disabled = isPending;
    button.textContent = isPending
      ? "Reservando unidades..."
      : "Reservar y ver datos de transferencia";
  }

  function setTransferPendingState(isPending) {
    requestPending = isPending;

    const button = document.querySelector(
      "[data-transfer-reported]"
    );

    if (!button) {
      return;
    }

    button.disabled = isPending;
    button.textContent = isPending
      ? "Informando transferencia..."
      : "Ya realicé la transferencia";
  }

  function showError(message) {
    const element = document.querySelector("[data-checkout-error]");

    if (!element) {
      return;
    }

    element.textContent = message;
    element.classList.toggle("is-visible", Boolean(message));
  }

  function openCheckout() {
    document.body.classList.add("checkout-is-open");

    document
      .querySelector("[data-checkout-overlay]")
      ?.setAttribute("aria-hidden", "false");
  }

  function closeCheckout() {
    if (requestPending) {
      return;
    }

    document.body.classList.remove("checkout-is-open");

    document
      .querySelector("[data-checkout-overlay]")
      ?.setAttribute("aria-hidden", "true");
  }

  function showCartToast(message) {
    const toast = document.querySelector("[data-cart-toast]");

    if (!toast) {
      return;
    }

    toast.textContent = message;
    toast.classList.add("is-visible");

    window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2600);
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
