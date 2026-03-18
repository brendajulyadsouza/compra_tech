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
const autoFillBtn = document.getElementById("auto-fill-btn");
const inputTitle = document.getElementById("title");
const inputCategory = document.getElementById("category");
const inputCategoryCustom = document.getElementById("category-custom");
const inputCategoryCustomWrap = document.getElementById("category-custom-wrap");
const inputPrice = document.getElementById("price");
const inputImage = document.getElementById("image");
const inputDescription = document.getElementById("description");

const supabase = window.supabaseClient;
let currentEditingId = null;
let cachedProducts = [];
let lastAutoFilledLink = "";

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
  if (inputCategoryCustomWrap) {
    inputCategoryCustomWrap.hidden = true;
    inputCategoryCustom.value = "";
  }
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

function setCategoryValue(value) {
  if (!inputCategoryCustomWrap || !inputCategoryCustom) {
    inputCategory.value = normalizeCategory(value);
    return;
  }
  const category = normalizeCategory(value);
  const option = Array.from(inputCategory.options).find((item) => item.value === category);
  if (option) {
    inputCategory.value = option.value;
    inputCategoryCustomWrap.hidden = true;
    inputCategoryCustom.value = "";
    return;
  }
  inputCategory.value = "Outros";
  inputCategoryCustomWrap.hidden = false;
  inputCategoryCustom.value = category;
}

function getCategoryValue() {
  if (inputCategory.value === "Outros" && inputCategoryCustom) {
    return normalizeCategory(inputCategoryCustom.value);
  }
  return normalizeCategory(inputCategory.value);
}

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
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
      // ignore
    }
  }
  return null;
}

function inferCategoryFromText(text) {
  const value = String(text || "").toLowerCase();
  if (!value) return "Sem categoria";
  if (/(smartphone|celular|iphone|samsung|xiaomi|motorola)/i.test(value)) return "Celulares";
  if (/(notebook|pc|computador|monitor|teclado|mouse|ssd|hd)/i.test(value)) return "Informatica";
  if (/(console|playstation|xbox|nintendo|jogo|gamer)/i.test(value)) return "Games";
  if (/(liquidificador|cafeteira|cozinha|panela|casa|lar)/i.test(value)) return "Casa e Cozinha";
  if (/(bebe|bebê|bebes|bebês|fralda|mamadeira|chupeta|berco|berço|carrinho)/i.test(value)) return "Bebes";
  if (/(camisa|tenis|moda|roupa|vestido|bermuda)/i.test(value)) return "Moda";
  if (/(perfume|maquiagem|skincare|beleza|cabelo)/i.test(value)) return "Beleza";
  if (/(saude|saúde|vitamina|suplemento|farmacia|farmácia|medicamento)/i.test(value)) return "Saude";
  if (/(pet|pets|racao|ração|cachorro|gato|coleira|areia)/i.test(value)) return "Pets";
  if (/(bike|bicicleta|academia|esporte|futebol|lazer)/i.test(value)) return "Esporte e Lazer";
  if (/(furadeira|parafusadeira|ferramenta|chave|serra)/i.test(value)) return "Ferramentas";
  return "Eletronicos";
}

function previewScreenshotFromLink(link) {
  const normalized = normalizeUrl(link);
  if (!normalized) return "";
  return `https://image.microlink.io/?url=${encodeURIComponent(normalized)}&screenshot=false&meta=true`;
}

async function fetchProductDataFromLink(link) {
  let itemId = extractItemId(link);
  if (itemId) {
    const response = await fetch(`https://api.mercadolibre.com/items/${itemId}`);
    if (response.ok) {
      const data = await response.json();
      return {
        title: data.title || "",
        price: data.price || "",
        image: data.thumbnail || "",
        description: data.warranty || "",
      };
    }
  }

  const fallbackTitle = (() => {
    try {
      const parsed = new URL(link);
      const lastPath = parsed.pathname.split("/").filter(Boolean).pop() || "";
      const decoded = decodeDeep(lastPath).replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
      return decoded ? decoded.slice(0, 100) : `Produto de ${parsed.hostname}`;
    } catch {
      return "Produto afiliado";
    }
  })();

  return {
    title: fallbackTitle,
    price: "",
    image: previewScreenshotFromLink(link),
    description: "",
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, affiliate_link, title, category, price, image, description, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error("Falha ao carregar produtos.");
  return Array.isArray(data) ? data : [];
}

async function renderAdminProducts() {
  adminProductsList.innerHTML = "";
  const products = await loadProducts();
  cachedProducts = products;

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
        <h3>${escapeHtml(product.title || "Produto")}</h3>
        <p>${escapeHtml(normalizeCategory(product.category))}</p>
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
      setCategoryValue(product.category || "");
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
        const { error } = await supabase.from("products").delete().eq("id", id);
        if (error) throw new Error("Falha ao remover produto.");
        await renderAdminProducts();
        setStatus("Produto removido.");
      } catch (error) {
        setStatus(error.message || "Falha ao remover produto.", true);
      }
    });
  });
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoginStatus("Entrando...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: loginUser.value.trim(),
    password: loginPass.value,
  });

  if (error || !data?.session) {
    setLoginStatus("Falha no login. Verifique email e senha.", true);
    return;
  }

  loginForm.reset();
  setLoginStatus("Acesso liberado.");
  showAdmin();
  await renderAdminProducts();
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  showLogin();
  setLoginStatus("Sessao encerrada.");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const affiliateLink = normalizeUrl(inputAffiliateLink.value.trim());
  const title = inputTitle.value.trim();
  const category = getCategoryValue();
  const price = inputPrice.value === "" ? null : Number(inputPrice.value);
  const image = normalizeUrl(inputImage.value.trim());
  const description = inputDescription.value.trim();

  if (!affiliateLink) return setStatus("Link de afiliacao e obrigatorio.", true);
  if (!title) return setStatus("Titulo e obrigatorio.", true);
  if (inputCategory.value === "Outros" && inputCategoryCustom && !inputCategoryCustom.value.trim()) {
    return setStatus("Informe o nome da categoria personalizada.", true);
  }

  const payload = {
    affiliate_link: affiliateLink,
    title,
    category,
    price,
    image,
    description,
  };

  try {
    const wasEditing = Boolean(currentEditingId);
    if (currentEditingId) {
      const { error } = await supabase.from("products").update(payload).eq("id", currentEditingId);
      if (error) throw new Error("Nao foi possivel atualizar produto.");
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) throw new Error("Nao foi possivel salvar produto.");
    }

    resetProductForm();
    await renderAdminProducts();
    setStatus(wasEditing ? "Produto atualizado com sucesso." : "Produto salvo e publicado na vitrine.");
  } catch (error) {
    setStatus(error.message || "Nao foi possivel salvar produto.", true);
  }
});

cancelEditBtn.addEventListener("click", () => {
  resetProductForm();
  setStatus("Edicao cancelada.");
});

if (inputCategoryCustomWrap) {
  inputCategory.addEventListener("change", () => {
    inputCategoryCustomWrap.hidden = inputCategory.value !== "Outros";
    if (inputCategory.value !== "Outros") inputCategoryCustom.value = "";
  });
}

autoFillBtn.addEventListener("click", async () => {
  const link = normalizeUrl(inputAffiliateLink.value.trim());
  if (!link || !isValidUrl(link)) {
    setStatus("Informe um link valido (http/https).", true);
    return;
  }
  if (link === lastAutoFilledLink) {
    setStatus("Este link ja foi preenchido.", false);
    return;
  }
  setStatus("Buscando dados do produto...");
  try {
    const data = await fetchProductDataFromLink(link);
    inputTitle.value = data.title || "";
    inputPrice.value = data.price || "";
    inputImage.value = data.image || "";
    inputDescription.value = data.description || "";
    setCategoryValue(inferCategoryFromText(`${data.title} ${data.description}`));
    lastAutoFilledLink = link;
    setStatus("Dados preenchidos automaticamente.");
  } catch {
    setStatus("Nao foi possivel preencher automaticamente.", true);
  }
});

async function initAuth() {
  const { data } = await supabase.auth.getSession();
  if (data?.session) {
    showAdmin();
    await renderAdminProducts();
    return;
  }
  showLogin();
  setLoginStatus("Use seu email e senha de admin.");
}

resetProductForm();
initAuth();
