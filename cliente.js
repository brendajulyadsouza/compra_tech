const supabase = window.supabaseClient;

const SESSION_KEY = "compra_tech_client_portal_session_v1";
const FALLBACK_PRODUCT_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4a5b78"/><stop offset="100%" stop-color="#1f355c"/></linearGradient></defs><rect width="800" height="800" fill="url(#g)"/><text x="400" y="420" text-anchor="middle" fill="#dbeafe" font-family="Arial,sans-serif" font-size="42">Imagem indisponivel</text></svg>'
  );
const DEFAULT_CATEGORY = "Sem categoria";

const loginGate = document.getElementById("client-login-gate");
const loginForm = document.getElementById("client-login-form");
const loginNameInput = document.getElementById("client-login-name");
const loginCodeInput = document.getElementById("client-login-code");
const loginStatus = document.getElementById("client-login-status");

const app = document.getElementById("client-app");
const portalTitle = document.getElementById("client-portal-title");
const portalSubtitle = document.getElementById("client-portal-subtitle");
const refreshBtn = document.getElementById("client-refresh-btn");
const logoutBtn = document.getElementById("client-logout-btn");
const categoryFilter = document.getElementById("client-category-filter");
const productsGrid = document.getElementById("client-products-grid");
const emptyState = document.getElementById("client-products-empty");

let activeClient = null;
let allProducts = [];
let activeCategory = "Todas";

function formatBRL(value) {
  if (value === null || value === undefined || value === "") return "";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeCode(value) {
  return String(value || "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 24);
}

function normalizeCategory(value) {
  const text = String(value || "").trim();
  return text || DEFAULT_CATEGORY;
}

function setLoginStatus(message, isError = false) {
  if (!loginStatus) return;
  loginStatus.textContent = message;
  loginStatus.style.color = isError ? "#b91c1c" : "#0f766e";
}

function showLogin() {
  if (loginGate) loginGate.hidden = false;
  if (app) app.hidden = true;
}

function showApp() {
  if (loginGate) loginGate.hidden = true;
  if (app) app.hidden = false;
}

function saveSession(session) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore storage errors
  }
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.fullName || !parsed?.accessCode) return null;
    return {
      fullName: normalizeText(parsed.fullName),
      accessCode: normalizeCode(parsed.accessCode),
    };
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore storage errors
  }
}

async function trackProductEvent(productId, eventType, options = {}) {
  const numericProductId = Number(productId);
  if (!Number.isFinite(numericProductId)) return null;

  const payload = {
    p_product_id: numericProductId,
    p_event_type: eventType,
    p_source: options.source || null,
    p_order_id: options.orderId || null,
    p_metadata: options.metadata || {},
  };

  const { data, error } = await supabase.rpc("track_product_event", payload);
  if (error) throw error;
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

function normalizeAffiliateUrl(value) {
  if (!value) return "";
  let raw = String(value).trim();

  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(raw);
      if (decoded === raw) break;
      raw = decoded;
    } catch {
      break;
    }
  }

  if (raw.startsWith("www.")) raw = `https://${raw}`;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;

  try {
    let parsed = new URL(raw);
    const redirectKeys = ["url", "target", "redirect", "redirect_url", "to", "link"];
    for (const key of redirectKeys) {
      const candidate = parsed.searchParams.get(key);
      if (candidate && /^https?:\/\//i.test(candidate)) {
        parsed = new URL(candidate);
        break;
      }
    }
    if (parsed.protocol === "http:") parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return "";
  }
}

function isLikelyIconUrl(urlValue) {
  const value = String(urlValue || "").toLowerCase();
  return (
    value.includes("logo") ||
    value.includes("favicon") ||
    value.includes("icon") ||
    value.includes("apple-touch") ||
    value.endsWith(".ico")
  );
}

function isGeneratedPreviewUrl(urlValue) {
  const value = String(urlValue || "").toLowerCase();
  return value.includes("image.thum.io") || value.includes("image.microlink.io");
}

function buildPreviewImageFromLink(link) {
  const normalized = normalizeAffiliateUrl(link);
  if (!normalized) return "";
  return `https://image.microlink.io/?url=${encodeURIComponent(normalized)}&screenshot=false&meta=true`;
}

function buildScreenshotImageFromLink(link) {
  const normalized = normalizeAffiliateUrl(link);
  if (!normalized) return "";
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(normalized)}?w=900`;
}

function toProxyImageUrl(urlValue) {
  const normalized = normalizeAffiliateUrl(urlValue);
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    const noProtocol = `${parsed.host}${parsed.pathname}${parsed.search}`;
    return `https://images.weserv.nl/?url=${encodeURIComponent(noProtocol)}&w=900&h=900&fit=contain`;
  } catch {
    return "";
  }
}

function pickProductImage(product) {
  const imageUrl = normalizeAffiliateUrl(product.image);
  if (imageUrl && !isLikelyIconUrl(imageUrl) && !isGeneratedPreviewUrl(imageUrl)) return imageUrl;
  return buildPreviewImageFromLink(product.affiliate_link);
}

function applyImageFallbacks(img, sources) {
  let idx = 0;
  let settled = false;
  const next = () => {
    if (settled) return;
    while (idx < sources.length) {
      const src = sources[idx++];
      if (src) {
        img.src = src;
        return;
      }
    }
    settled = true;
    img.src = FALLBACK_PRODUCT_IMAGE;
  };
  img.addEventListener("load", () => {
    if (img.naturalWidth < 48 || img.naturalHeight < 48) next();
  });
  img.addEventListener("error", next);
  next();
}

function openAffiliateWithTracking(product) {
  const href = normalizeAffiliateUrl(product.affiliate_link);
  if (!href) return;

  window.open(href, "_blank", "noopener,noreferrer");

  trackProductEvent(product.id, "click", {
    source: "cliente_portal",
    metadata: {
      page: window.location.pathname,
      client_id: activeClient?.id || null,
      category: normalizeCategory(product.category),
    },
  }).catch((error) => {
    console.error("Falha ao registrar click:", error);
  });
}

function getFilteredProducts() {
  if (activeCategory === "Todas") return allProducts;
  return allProducts.filter((product) => normalizeCategory(product.category) === activeCategory);
}

function getCategoryList(products) {
  const categories = new Set(["Todas"]);
  products.forEach((item) => categories.add(normalizeCategory(item.category)));
  return Array.from(categories);
}

function renderCategoryFilter(categories) {
  if (!categoryFilter) return;
  const previous = activeCategory;
  categoryFilter.innerHTML = "";

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category === "Todas" ? "Todas as categorias" : category;
    categoryFilter.appendChild(option);
  });

  categoryFilter.value = categories.includes(previous) ? previous : "Todas";
  activeCategory = categoryFilter.value;
}

function renderProducts(products) {
  if (!productsGrid || !emptyState) return;
  productsGrid.innerHTML = "";

  if (!products.length) {
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  products.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";

    const image = document.createElement("img");
    image.referrerPolicy = "no-referrer";
    image.alt = product.title || "Produto";
    const rawImage = normalizeAffiliateUrl(product.image);
    const finalImage = pickProductImage(product);
    applyImageFallbacks(image, [
      toProxyImageUrl(finalImage),
      finalImage,
      toProxyImageUrl(rawImage),
      rawImage,
      buildScreenshotImageFromLink(product.affiliate_link),
      buildPreviewImageFromLink(product.affiliate_link),
    ]);
    card.appendChild(image);

    const content = document.createElement("div");
    content.className = "product-card__content";

    const meta = document.createElement("div");
    meta.className = "product-card__meta";
    const chip = document.createElement("span");
    chip.className = "store-chip";
    chip.textContent = normalizeCategory(product.category);
    meta.appendChild(chip);
    content.appendChild(meta);

    const title = document.createElement("h3");
    title.textContent = product.title || "Produto sem titulo";
    content.appendChild(title);

    if (product.price !== null && product.price !== undefined && product.price !== "") {
      const price = document.createElement("p");
      price.className = "price";
      price.textContent = formatBRL(product.price);
      content.appendChild(price);
    }

    if (product.description) {
      const description = document.createElement("p");
      description.className = "description";
      description.textContent = product.description;
      content.appendChild(description);
    }

    const link = document.createElement("a");
    link.className = "btn-buy";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.href = normalizeAffiliateUrl(product.affiliate_link) || "#";
    link.textContent = "Ver oferta";
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openAffiliateWithTracking(product);
    });
    content.appendChild(link);

    card.appendChild(content);
    productsGrid.appendChild(card);
  });
}

async function clientPortalLogin(fullName, accessCode) {
  const { data, error } = await supabase.rpc("client_portal_login", {
    p_full_name: fullName,
    p_access_code: accessCode,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row || null;
}

async function fetchClientProducts(clientId, accessCode) {
  const { data, error } = await supabase.rpc("client_portal_products", {
    p_client_id: Number(clientId),
    p_access_code: accessCode,
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function authenticateAndLoad(credentials, showInvalidMessage = true) {
  const normalizedName = normalizeText(credentials?.fullName);
  const normalizedCode = normalizeCode(credentials?.accessCode);

  if (!normalizedName || !normalizedCode) {
    if (showInvalidMessage) setLoginStatus("Informe nome e codigo de acesso.", true);
    return false;
  }

  const auth = await clientPortalLogin(normalizedName, normalizedCode);
  if (!auth?.ok || !Number.isFinite(Number(auth.client_id))) {
    clearSession();
    showLogin();
    if (showInvalidMessage) setLoginStatus("Nome ou codigo de acesso invalido.", true);
    return false;
  }

  const products = await fetchClientProducts(auth.client_id, normalizedCode);
  activeClient = {
    id: Number(auth.client_id),
    name: auth.client_name || normalizedName,
    fullName: normalizedName,
    accessCode: normalizedCode,
  };
  allProducts = products;
  saveSession({
    fullName: normalizedName,
    accessCode: normalizedCode,
  });

  if (portalTitle) portalTitle.textContent = `Produtos de ${activeClient.name}`;
  if (portalSubtitle) {
    portalSubtitle.textContent = `${allProducts.length} item(ns) vinculados ao seu cadastro.`;
  }

  const categories = getCategoryList(allProducts);
  renderCategoryFilter(categories);
  renderProducts(getFilteredProducts());
  showApp();
  setLoginStatus("");
  return true;
}

async function refreshCurrentClient() {
  if (!activeClient?.id || !activeClient?.accessCode) return;
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Atualizando...";
  try {
    const products = await fetchClientProducts(activeClient.id, activeClient.accessCode);
    allProducts = products;
    if (portalSubtitle) {
      portalSubtitle.textContent = `${allProducts.length} item(ns) vinculados ao seu cadastro.`;
    }
    const categories = getCategoryList(allProducts);
    renderCategoryFilter(categories);
    renderProducts(getFilteredProducts());
  } catch (error) {
    console.error(error);
    if (portalSubtitle) {
      portalSubtitle.textContent = "Nao foi possivel atualizar agora. Tente novamente em instantes.";
    }
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "Atualizar lista";
  }
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoginStatus("");

  const credentials = {
    fullName: normalizeText(loginNameInput?.value),
    accessCode: normalizeCode(loginCodeInput?.value),
  };

  if (!credentials.fullName || !credentials.accessCode) {
    setLoginStatus("Informe nome e codigo de acesso.", true);
    return;
  }

  try {
    const ok = await authenticateAndLoad(credentials, true);
    if (!ok) return;
    if (loginCodeInput) loginCodeInput.value = "";
  } catch (error) {
    console.error(error);
    setLoginStatus("Nao foi possivel entrar agora. Tente novamente.", true);
  }
});

logoutBtn?.addEventListener("click", () => {
  activeClient = null;
  allProducts = [];
  activeCategory = "Todas";
  clearSession();
  if (loginForm) loginForm.reset();
  setLoginStatus("Sessao encerrada.");
  showLogin();
});

refreshBtn?.addEventListener("click", async () => {
  await refreshCurrentClient();
});

categoryFilter?.addEventListener("change", () => {
  activeCategory = categoryFilter.value || "Todas";
  renderProducts(getFilteredProducts());
});

async function init() {
  showLogin();
  const session = loadSession();
  if (!session) return;

  try {
    const ok = await authenticateAndLoad(session, false);
    if (!ok) setLoginStatus("Sua sessao expirou. Faca login novamente.", true);
  } catch (error) {
    console.error(error);
    clearSession();
    setLoginStatus("Nao foi possivel restaurar sua sessao.", true);
    showLogin();
  }
}

init();
