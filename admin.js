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

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Erro na requisicao.");
  return payload;
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
  const payload = await api("/api/products", { method: "GET" });
  return Array.isArray(payload.products) ? payload.products : [];
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

  const buttons = adminProductsList.querySelectorAll("[data-product-id]");
  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const id = button.getAttribute("data-product-id");
        await api(`/api/products/${id}`, { method: "DELETE" });
        await renderAdminProducts();
        setStatus("Produto removido.");
      } catch (error) {
        setStatus(error.message, true);
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
    const payload = await api("/api/products/resolve-link", {
      method: "POST",
      body: JSON.stringify({ link }),
    });
    const data = payload.data || {};
    inputTitle.value = data.title || "";
    inputPrice.value = data.price || "";
    inputImage.value = data.image || "";
    inputDescription.value = data.description || "";
    setStatus(data.source === "meli_api" ? "Dados preenchidos automaticamente." : "Preenchimento parcial aplicado.");
  } catch (error) {
    setStatus(error.message || "Nao foi possivel preencher automatico.", true);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: loginUser.value.trim(), password: loginPass.value }),
    });
    loginForm.reset();
    setLoginStatus("Acesso liberado.");
    showAdmin();
    await renderAdminProducts();
  } catch (error) {
    setLoginStatus(error.message || "Falha no login.", true);
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    // ignore
  }
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

  if (!affiliateLink) return setStatus("Link de afiliacao e obrigatorio.", true);
  if (!isValidUrl(affiliateLink)) return setStatus("Informe um link valido (http/https).", true);

  if (!title) {
    try {
      const payload = await api("/api/products/resolve-link", {
        method: "POST",
        body: JSON.stringify({ link: affiliateLink }),
      });
      const data = payload.data || {};
      title = data.title || "";
      price = price || data.price || "";
      image = image || data.image || "";
      description = description || data.description || "";
    } catch {
      // continue and validate title below
    }
  }
  if (!title) return setStatus("Titulo e obrigatorio.", true);
  if (image && !isValidUrl(image)) return setStatus("URL da imagem invalida.", true);

  try {
    await api("/api/products", {
      method: "POST",
      body: JSON.stringify({
        affiliateLink,
        title,
        price: price === "" ? null : Number(price),
        image,
        description,
      }),
    });
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
    await api("/api/auth/me", { method: "GET" });
    showAdmin();
    await renderAdminProducts();
  } catch {
    showLogin();
    setLoginStatus("Use seu acesso de administrador.");
  }
}

initAuth();
