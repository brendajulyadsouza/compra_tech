const eventStatus = document.getElementById("event-status");
const eventDetails = document.getElementById("event-details");
const eventRedirectLink = document.getElementById("event-redirect-link");
const supabase = window.supabaseClient;

function setStatus(message, isError = false) {
  eventStatus.textContent = message;
  eventStatus.style.color = isError ? "#b91c1c" : "#0f766e";
}

function showDetails(data) {
  eventDetails.hidden = false;
  eventDetails.textContent = JSON.stringify(data, null, 2);
}

function getParam(params, keys) {
  for (const key of keys) {
    const value = params.get(key);
    if (value !== null && value !== "") return value;
  }
  return "";
}

function toSafeUrl(value) {
  if (!value) return "";
  try {
    const parsed = new URL(value, window.location.origin);
    return parsed.toString();
  } catch {
    return "";
  }
}

async function trackEventFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const eventType = getParam(params, ["event", "ct_event"]).toLowerCase() || "sale";
  const productIdRaw = getParam(params, ["product_id", "pid", "product"]);
  const productId = Number(productIdRaw);
  const source = getParam(params, ["source", "src"]) || "postback";
  const orderId = getParam(params, ["order_id", "oid", "order"]);
  const redirectUrl = toSafeUrl(getParam(params, ["redirect", "next"]));

  if (!Number.isFinite(productId)) {
    setStatus("Parametro obrigatorio ausente: product_id.", true);
    return;
  }

  if (!["click", "sale"].includes(eventType)) {
    setStatus("Parametro event invalido. Use click ou sale.", true);
    return;
  }

  try {
    const { data, error } = await supabase.rpc("track_product_event", {
      p_product_id: productId,
      p_event_type: eventType,
      p_source: source,
      p_order_id: orderId || null,
      p_metadata: {
        query: window.location.search,
        user_agent: navigator.userAgent,
      },
    });

    if (error) throw error;
    const result = Array.isArray(data) ? data[0] || null : data;
    if (!result) {
      setStatus("Evento recebido, mas sem retorno de status.", true);
      return;
    }

    const ok = Boolean(result.ok);
    setStatus(ok ? "Evento registrado com sucesso." : `Evento processado: ${result.message || "sem status"}`, !ok);
    showDetails(result);

    if (redirectUrl) {
      eventRedirectLink.hidden = false;
      eventRedirectLink.href = redirectUrl;
      eventRedirectLink.textContent = "Continuar para destino";
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 1800);
    }
  } catch (error) {
    console.error(error);
    setStatus("Falha ao registrar evento no Supabase.", true);
  }
}

trackEventFromQuery();
