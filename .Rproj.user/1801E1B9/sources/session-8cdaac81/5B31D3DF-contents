"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const CHECKOUT_CONFIG = Object.freeze({
    apiUrl: "https://script.google.com/macros/s/AKfycbxICrnGOjEfJE6A2iIWbVIqJDsY9uWAQVCiHAWXKtjiFqksyQ6JVLGTtNjG0GbGyTMy/exec",
    cartStorageKey: "rumboCorcelCartV1",
    reservationStorageKey: "rumboCorcelReservaV1",
    requestTimeoutMs: 45000
  });

  let requestPending = false;
  let pendingAction = "";
  let requestTimeout = null;
  let countdownTimer = null;

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

    const payload = {
      action: "crearReserva",
      formato: "iframe",
      origen: window.location.origin,

      cliente: {
        nombre: String(formData.get("nombre") || "").trim(),
        correo: String(formData.get("correo") || "").trim(),
        whatsapp: String(formData.get("whatsapp") || "").trim(),
        region: String(formData.get("region") || "").trim(),
        comuna: String(formData.get("comuna") || "").trim(),
        direccion: String(formData.get("direccion") || "").trim(),
        tipoEntrega: String(
          formData.get("tipoEntrega") || "Despacho"
        ).trim()
      },

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

  function handleAppsScriptMessage(event) {
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
      savedAt: new Date().toISOString()
    };

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
    `;

    body
      .querySelector("[data-checkout-form]")
      ?.addEventListener("submit", submitReservation);
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

      <div class="transfer-total">
        <span>Total a transferir</span>
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
