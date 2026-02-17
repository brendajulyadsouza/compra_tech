const loginGate = document.getElementById("login-gate");
const adminApp = document.getElementById("admin-app");
const loginForm = document.getElementById("login-form");
const loginUser = document.getElementById("login-user");
const loginPass = document.getElementById("login-pass");
const loginStatus = document.getElementById("login-status");
const logoutBtn = document.getElementById("logout-btn");

const form = document.getElementById("product-form");
const autoFillBtn = document.getElementById("auto-fill-btn");
const statusMessage = document.getElementById("status-message");
const adminProductsList = document.getElementById("admin-products-list");
const adminEmptyState = document.getElementById("admin-empty-state");

const inputAffiliateLink = document.getElementById("affiliate-link");
const inputTitle = document.getElementById("title");
const inputPrice = document.getElementById("price");
const inputImage = document.getElementById("image");
const inputDescription = document.getElementById("description");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? "#b91c1c" : "#0f766e";
}

function setLoginStatus(message, isError = false) {
  loginStatus.textContent = message;
  loginStatus.style.color = isError ? "#b91c1c" : "#0f766e";
}

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isHttpOnlyUrl(value) {
  try {
    return new URL(String(value).trim()).protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeUrl(value) {
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

function previewScreenshotFromLink(link) {
  const normalized = normalizeUrl(link);
  if (!normalized) return "";
  return `https://image.microlink.io/?url=${encodeURIComponent(normalized)}&screenshot=false&meta=true`;
}

function decodeDeep(value, rounds = 3) {
  let current = String(value);
  for (let i = 0; i < rounds; i += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }
  return current;
}

function findItemIdInText(text) {
  const match = String(text).match(/\b(ML[A-Z]{1,3}\d{6,})\b/i);
  return match?.[1]?.toUpperCase() || null;
}

function extractItemId(url) {
  const candidates = [String(url), decodeDeep(url)];

  for (const candidate of candidates) {
    const direct = findItemIdInText(candidate);
    if (direct) return direct;

    try {
      const parsed = new URL(candidate);
      const pieces = [parsed.pathname, parsed.hash];

      for (const piece of pieces) {
        const found = findItemIdInText(decodeDeep(piece));
        if (found) return found;
      }

      for (const [, value] of parsed.searchParams.entries()) {
        const found = findItemIdInText(decodeDeep(value));
        if (found) return found;
      }
    } catch {
      // Ignore parse errors and continue with other candidates.
    }
  }

  return null;
}

async function tryResolveFinalUrl(link) {
  try {
    const response = await fetch(link, { redirect: "follow" });
    if (response?.url) return response.url;
  } catch {
    // Some affiliate domains block CORS in browser; fallback to original link.
  }
  return link;
}

function buildTitleFromUrl(link) {
  try {
    const parsed = new URL(link);
    const lastPath = parsed.pathname.split("/").filter(Boolean).pop() || "";
    const decoded = decodeDeep(lastPath)
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (decoded) return decoded.slice(0, 100);
    return `Produto de ${parsed.hostname}`;
  } catch {
    return "Produto afiliado";
  }
}

async function fetchLinkPreviewData(link) {
  try {
    const normalized = normalizeUrl(link) || link;
    const endpoint = `https://api.microlink.io/?url=${encodeURIComponent(normalized)}`;
    const response = await fetch(endpoint);
    if (!response.ok) return null;
    const result = await response.json();
    const data = result?.data;
    if (!data) return null;
    const imageCandidate = normalizeUrl(data.image?.url || data.logo?.url || "");
    const image = imageCandidate && !isLikelyIconUrl(imageCandidate)
      ? imageCandidate
      : previewScreenshotFromLink(normalized);
    return {
      title: data.title || "",
      price: "",
      image,
      description: data.description || "",
      source: "preview",
    };
  } catch {
    return null;
  }
}

async function fetchProductDataFromLink(link) {
  const isShein = /shein/i.test(link);

  if (isShein) {
    const previewShein = await fetchLinkPreviewData(link);
    if (previewShein) return previewShein;
  }

  let itemId = extractItemId(link);
  if (!itemId) {
    const resolvedUrl = await tryResolveFinalUrl(link);
    itemId = extractItemId(resolvedUrl);
  }

  if (itemId) {
    const response = await fetch(`https://api.mercadolibre.com/items/${itemId}`);
    if (response.ok) {
      const data = await response.json();
      return {
        title: data.title || "",
        price: data.price || "",
        image: data.thumbnail || "",
        description: data.warranty || "",
        source: "meli_api",
      };
    }
  }

  const preview = await fetchLinkPreviewData(link);
  if (preview) return preview;

  return {
    title: buildTitleFromUrl(link),
    price: "",
    image: "",
    description: "",
    source: "fallback",
  };
}

function showAdmin() {
  loginGate.hidden = true;
  adminApp.hidden = false;
}

function showLogin() {
  loginGate.hidden = false;
  adminApp.hidden = true;
}

async function loadProducts() {
  const client = window.supabaseClient;
  const { data, error } = await client
    .from("products")
    .select("id, affiliate_link, title, price, image, description, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function renderAdminProducts() {
  adminProductsList.innerHTML = "";
  const products = await loadProducts();

  if (!products.length) {
    adminEmptyState.style.display = "block";
    return;
  }

  adminEmptyState.style.display = "none";

  for (const product of products) {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <div>
        <h3>${escapeHtml(product.title)}</h3>
        <p>${product.price !== null && product.price !== undefined ? formatBRL(product.price) : "Preco nao informado"}</p>
      </div>
      <button class="btn-danger" type="button" data-product-id="${product.id}">Excluir</button>
    `;
    adminProductsList.appendChild(row);
  }

  adminProductsList.querySelectorAll("[data-product-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const client = window.supabaseClient;
        const id = button.getAttribute("data-product-id");
        const { error } = await client.from("products").delete().eq("id", id);
        if (error) throw error;
        await renderAdminProducts();
        setStatus("Produto removido.");
      } catch (error) {
        setStatus(error.message || "Falha ao remover produto.", true);
      }
    });
  });
}

async function fillByAffiliateLink() {
  const link = inputAffiliateLink.value.trim();
  if (!link) {
    setStatus("Informe o link de afiliacao primeiro.", true);
    return;
  }
  if (!isValidUrl(link)) {
    setStatus("Informe um link valido (http/https).", true);
    return;
  }

  setStatus("Buscando dados do produto...");
  try {
    const data = await fetchProductDataFromLink(link);
    inputTitle.value = data.title || "";
    inputPrice.value = data.price || "";
    inputImage.value = normalizeUrl(data.image) || previewScreenshotFromLink(link) || "";
    inputDescription.value = data.description || "";
    if (isHttpOnlyUrl(data.image)) {
      setStatus("Imagem em http detectada: convertida automaticamente para https.", false);
      return;
    }
    setStatus(data.source === "meli_api" ? "Dados preenchidos automaticamente." : "Preenchimento parcial aplicado.");
  } catch (error) {
    setStatus(error.message || "Nao foi possivel preencher automatico.", true);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const client = window.supabaseClient;
    const { error } = await client.auth.signInWithPassword({
      email: loginUser.value.trim(),
      password: loginPass.value,
    });
    if (error) throw error;
    loginForm.reset();
    setLoginStatus("Acesso liberado.");
    showAdmin();
    await renderAdminProducts();
  } catch (error) {
    setLoginStatus(error.message || "Falha no login.", true);
  }
});

logoutBtn.addEventListener("click", async () => {
  const client = window.supabaseClient;
  await client.auth.signOut();
  showLogin();
  setLoginStatus("Sessao encerrada.");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const affiliateLink = inputAffiliateLink.value.trim();
  let title = inputTitle.value.trim();
  let price = inputPrice.value;
  const rawImage = inputImage.value.trim();
  let image = normalizeUrl(rawImage);
  let description = inputDescription.value.trim();

  if (!affiliateLink) return setStatus("Link de afiliacao e obrigatorio.", true);
  if (!isValidUrl(affiliateLink)) return setStatus("Informe um link valido (http/https).", true);

  if (!title) {
    try {
      const data = await fetchProductDataFromLink(affiliateLink);
      title = data.title || "";
      price = price || data.price || "";
      image = image || data.image || "";
      description = description || data.description || "";
    } catch {
      // fallback
    }
  }
  if (!title) return setStatus("Titulo e obrigatorio.", true);
  if (!image) image = previewScreenshotFromLink(affiliateLink);
  if (image && !isValidUrl(image)) return setStatus("URL da imagem invalida.", true);
  if (rawImage && isHttpOnlyUrl(rawImage)) {
    setStatus("Imagem em http detectada: convertida para https antes de salvar.");
  }

  try {
    const client = window.supabaseClient;
    const { error } = await client.from("products").insert({
      affiliate_link: normalizeUrl(affiliateLink) || affiliateLink,
      title,
      price: price === "" ? null : Number(price),
      image,
      description,
    });
    if (error) throw error;
    form.reset();
    await renderAdminProducts();
    setStatus("Produto salvo e publicado na vitrine.");
  } catch (error) {
    setStatus(error.message || "Nao foi possivel salvar produto.", true);
  }
});

autoFillBtn.addEventListener("click", fillByAffiliateLink);

async function initAuth() {
  try {
    const client = window.supabaseClient;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data?.session) {
      showAdmin();
      await renderAdminProducts();
      return;
    }
    showLogin();
    setLoginStatus("Use seu email e senha de admin.");
  } catch {
    showLogin();
    setLoginStatus("Use seu email e senha de admin.");
  }
}

initAuth();
