const loginGate = document.getElementById("login-gate");
const adminApp = document.getElementById("admin-app");
const loginForm = document.getElementById("login-form");
const loginUser = document.getElementById("login-user");
const loginPass = document.getElementById("login-pass");
const loginStatus = document.getElementById("login-status");
const logoutBtn = document.getElementById("logout-btn");

const form = document.getElementById("product-form");
const statusMessage = document.getElementById("status-message");
const adminProductsList = document.getElementById("admin-products-list");
const adminEmptyState = document.getElementById("admin-empty-state");
const formTitle = document.getElementById("form-title");
const formModeHint = document.getElementById("form-mode-hint");
const saveBtn = document.getElementById("save-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");

const inputAffiliateLink = document.getElementById("affiliate-link");
const inputTitle = document.getElementById("title");
const inputCategory = document.getElementById("category");
const inputPrice = document.getElementById("price");
const inputImage = document.getElementById("image");
const inputDescription = document.getElementById("description");

const API_BASE = window.API_BASE || "";
const TOKEN_KEY = "compraTechToken";
let currentEditingId = null;
let cachedProducts = [];

function buildApiUrl(path) {
  return `${API_BASE}${path}`;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(value) {
  if (!value) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, value);
}

async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = "Erro na requisicao.";
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? "#b91c1c" : "#0f766e";
}

function setLoginStatus(message, isError = false) {
  loginStatus.textContent = message;
  loginStatus.style.color = isError ? "#b91c1c" : "#0f766e";
}

function showAdmin() {
  loginGate.hidden = true;
  adminApp.hidden = false;
}

function showLogin() {
  loginGate.hidden = false;
  adminApp.hidden = true;
}

function setFormModeEditing(isEditing) {
  if (isEditing) {
    formTitle.textContent = "Editar produto";
    formModeHint.hidden = false;
    saveBtn.textContent = "Atualizar produto";
    cancelEditBtn.hidden = false;
    return;
  }
  formTitle.textContent = "Novo produto";
  formModeHint.hidden = true;
  saveBtn.textContent = "Salvar produto";
  cancelEditBtn.hidden = true;
}

function resetProductForm() {
  form.reset();
  currentEditingId = null;
  setFormModeEditing(false);
}

function normalizeUrl(value) {
  if (!value) return "";
  let raw = String(value).trim();
  if (raw.startsWith("www.")) raw = `https://${raw}`;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  return raw;
}

function normalizeCategory(value) {
  const text = String(value || "").trim();
  return text || "Sem categoria";
}

function renderProductsList(products) {
  adminProductsList.innerHTML = "";
  if (!products.length) {
    adminEmptyState.style.display = "block";
    return;
  }

  adminEmptyState.style.display = "none";

  products.forEach((product) => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <div>
        <h3>${product.title || "Produto"}</h3>
        <p>${normalizeCategory(product.category)}</p>
        <p>${product.price !== null && product.price !== undefined ? formatBRL(product.price) : "Preco nao informado"}</p>
      </div>
      <div class="admin-actions">
        <button class="btn-secondary" type="button" data-edit-product-id="${product.id}">Editar</button>
        <button class="btn-danger" type="button" data-product-id="${product.id}">Excluir</button>
      </div>
    `;
    adminProductsList.appendChild(row);
  });

  adminProductsList.querySelectorAll("[data-edit-product-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-edit-product-id");
      const product = cachedProducts.find((item) => String(item.id) === String(id));
      if (!product) return;
      currentEditingId = product.id;
      setFormModeEditing(true);
      inputAffiliateLink.value = product.affiliate_link || "";
      inputTitle.value = product.title || "";
      inputCategory.value = product.category || "";
      inputPrice.value = product.price ?? "";
      inputImage.value = product.image || "";
      inputDescription.value = product.description || "";
      setStatus("Produto carregado para edicao.");
    });
  });

  adminProductsList.querySelectorAll("[data-product-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const id = button.getAttribute("data-product-id");
        await apiRequest(`/api/products/${id}`, { method: "DELETE" });
        await loadAndRenderProducts();
        setStatus("Produto removido.");
      } catch (error) {
        setStatus(error.message || "Falha ao remover produto.", true);
      }
    });
  });
}

async function loadAndRenderProducts() {
  const data = await apiRequest("/api/products");
  cachedProducts = Array.isArray(data) ? data : [];
  renderProductsList(cachedProducts);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await apiRequest("/api/login", {
      method: "POST",
      body: JSON.stringify({
        user: loginUser.value.trim(),
        pass: loginPass.value,
      }),
    });
    if (!result?.token) throw new Error("Falha no login.");
    setToken(result.token);
    loginForm.reset();
    setLoginStatus("Acesso liberado.");
    showAdmin();
    await loadAndRenderProducts();
  } catch (error) {
    setLoginStatus(error.message || "Falha no login.", true);
  }
});

logoutBtn.addEventListener("click", () => {
  setToken(null);
  showLogin();
  setLoginStatus("Sessao encerrada.");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const affiliateLink = normalizeUrl(inputAffiliateLink.value.trim());
  const title = inputTitle.value.trim();
  const category = normalizeCategory(inputCategory.value);
  const price = inputPrice.value === "" ? null : Number(inputPrice.value);
  const image = normalizeUrl(inputImage.value.trim());
  const description = inputDescription.value.trim();

  if (!affiliateLink) return setStatus("Link de afiliacao e obrigatorio.", true);
  if (!title) return setStatus("Titulo e obrigatorio.", true);

  try {
    const wasEditing = Boolean(currentEditingId);
    const payload = {
      affiliate_link: affiliateLink,
      title,
      category,
      price,
      image,
      description,
    };

    if (currentEditingId) {
      await apiRequest(`/api/products/${currentEditingId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await apiRequest("/api/products", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    resetProductForm();
    await loadAndRenderProducts();
    setStatus(wasEditing ? "Produto atualizado com sucesso." : "Produto salvo e publicado na vitrine.");
  } catch (error) {
    const message = error.message || "Nao foi possivel salvar produto.";
    if (/Nao autorizado|Sessao expirada/i.test(message)) {
      setToken(null);
      showLogin();
      setLoginStatus("Sua sessao expirou. Entre novamente.", true);
      return;
    }
    setStatus(message, true);
  }
});

cancelEditBtn.addEventListener("click", () => {
  resetProductForm();
  setStatus("Edicao cancelada.");
});

async function initAuth() {
  try {
    const token = getToken();
    if (!token) {
      showLogin();
      setLoginStatus("Use seu usuario e senha de admin.");
      return;
    }
    await apiRequest("/api/auth/check");
    showAdmin();
    await loadAndRenderProducts();
  } catch {
    setToken(null);
    showLogin();
    setLoginStatus("Use seu usuario e senha de admin.");
  }
}

resetProductForm();
initAuth();
