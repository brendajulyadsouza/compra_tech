const AUTH_SESSION_KEY = "adm_auth_ok_v1";
const ADMIN_USER = "CompraTech";
const ADMIN_PASS = "Brend@12";

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
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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
    const endpoint = `https://api.microlink.io/?url=${encodeURIComponent(link)}`;
    const response = await fetch(endpoint);
    if (!response.ok) return null;
    const result = await response.json();
    const data = result?.data;
    if (!data) return null;
    return {
      title: data.title || "",
      price: "",
      image: data.image?.url || data.logo?.url || "",
      description: data.description || "",
      source: "preview",
    };
  } catch {
    return null;
  }
}

async function fetchProductDataFromLink(link) {
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

async function fillByAffiliateLink() {
  const link = inputAffiliateLink.value.trim();
  if (!link) {
    setStatus("Informe o link de afiliacao primeiro.", true);
    return;
  }

  setStatus("Buscando dados do produto...");

  try {
    const data = await fetchProductDataFromLink(link);
    inputTitle.value = data.title || "";
    inputPrice.value = data.price || "";
    inputImage.value = data.image || "";
    inputDescription.value = data.description || "";
    if (data.source === "meli_api") {
      setStatus("Dados preenchidos automaticamente. Revise e salve.");
    } else {
      setStatus("Link aceito. Preenchimento parcial aplicado, revise e salve.");
    }
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Nao foi possivel buscar automaticamente.", true);
  }
}

function renderAdminProducts() {
  const products = loadProducts();
  adminProductsList.innerHTML = "";

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
        <p>${product.price ? formatBRL(product.price) : "Preco nao informado"}</p>
      </div>
      <button class="btn-danger" type="button" data-product-id="${product.id}">Excluir</button>
    `;
    adminProductsList.appendChild(row);
  }

  const buttons = adminProductsList.querySelectorAll("[data-product-id]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-product-id");
      removeProduct(id);
      renderAdminProducts();
      setStatus("Produto removido.");
    });
  });
}

function isAuthenticated() {
  return sessionStorage.getItem(AUTH_SESSION_KEY) === "1";
}

function showAdmin() {
  loginGate.hidden = true;
  adminApp.hidden = false;
}

function showLogin() {
  loginGate.hidden = false;
  adminApp.hidden = true;
}

function initAuth() {
  if (isAuthenticated()) {
    showAdmin();
    renderAdminProducts();
    return;
  }
  showLogin();
  setLoginStatus("Use seu acesso de administrador.");
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const user = loginUser.value.trim();
  const pass = loginPass.value;

  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    sessionStorage.setItem(AUTH_SESSION_KEY, "1");
    loginForm.reset();
    setLoginStatus("Acesso liberado.");
    showAdmin();
    renderAdminProducts();
    return;
  }

  setLoginStatus("Credenciais invalidas.", true);
});

logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  showLogin();
  setLoginStatus("Sessao encerrada.");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const affiliateLink = inputAffiliateLink.value.trim();
  let title = inputTitle.value.trim();
  let price = inputPrice.value;
  let image = inputImage.value.trim();
  let description = inputDescription.value.trim();

  if (!affiliateLink) {
    setStatus("Link de afiliacao e obrigatorio.", true);
    return;
  }

  if (!isValidUrl(affiliateLink)) {
    setStatus("Informe um link de afiliacao valido (http/https).", true);
    return;
  }

  if (!title) {
    setStatus("Titulo vazio. Tentando preencher automaticamente...");
    try {
      const data = await fetchProductDataFromLink(affiliateLink);
      title = data.title || "";
      price = price || data.price || "";
      image = image || data.image || "";
      description = description || data.description || "";
    } catch {
      title = buildTitleFromUrl(affiliateLink);
    }
  }

  if (!title) {
    setStatus("Titulo e obrigatorio.", true);
    return;
  }

  if (image && !isValidUrl(image)) {
    setStatus("URL da imagem invalida.", true);
    return;
  }

  addProduct({
    id: uid(),
    affiliateLink,
    title,
    price: price ? Number(price) : null,
    image,
    description,
    createdAt: new Date().toISOString(),
  });

  form.reset();
  renderAdminProducts();
  setStatus("Produto salvo e publicado na pagina inicial.");
});

autoFillBtn.addEventListener("click", fillByAffiliateLink);
initAuth();
