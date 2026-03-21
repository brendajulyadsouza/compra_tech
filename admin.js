const supabase = window.supabaseClient;

const ADMIN_EMAIL = "brendajulyadsouza@gmail.com";
const APP_SETTINGS_KEY = "compra_tech_admin_settings_v2";
const ACTIVITY_KEY = "compra_tech_admin_activity_v1";
const DEFAULT_SETTINGS = {
  defaultCommissionPct: 0,
  autoSaveAfterAutofill: false,
};

const SECTION_META = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Resumo de produtos, cliques, vendas e comissoes.",
  },
  products: {
    title: "Produtos",
    subtitle: "Cadastro automatizado e gerenciamento completo de afiliados.",
  },
  clients: {
    title: "Clientes",
    subtitle: "Cadastre clientes e selecione os itens vinculados a cada nome.",
  },
  commissions: {
    title: "Comissoes",
    subtitle: "Visao detalhada de ganhos por produto e consolidado mensal.",
  },
  settings: {
    title: "Configuracoes",
    subtitle: "Preferencias de automacao e comportamento do painel.",
  },
};

const loginGate = document.getElementById("login-gate");
const adminApp = document.getElementById("admin-app");
const loginForm = document.getElementById("login-form");
const loginUser = document.getElementById("login-user");
const loginPass = document.getElementById("login-pass");
const loginStatus = document.getElementById("login-status");
const logoutBtn = document.getElementById("logout-btn");

const sidebar = document.getElementById("admin-sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const refreshBtn = document.getElementById("refresh-btn");
const navButtons = Array.from(document.querySelectorAll(".admin-nav__item"));
const sections = Array.from(document.querySelectorAll(".admin-section"));
const adminTitle = document.getElementById("admin-title");
const adminSubtitle = document.getElementById("admin-subtitle");

const form = document.getElementById("product-form");
const statusMessage = document.getElementById("status-message");
const formTitle = document.getElementById("form-title");
const formModeHint = document.getElementById("form-mode-hint");
const saveBtn = document.getElementById("save-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");

const inputAffiliateLink = document.getElementById("affiliate-link");
const autoFillBtn = document.getElementById("auto-fill-btn");
const inputAutoSave = document.getElementById("auto-save");
const inputTitle = document.getElementById("title");
const inputCategory = document.getElementById("category");
const inputCategoryCustomWrap = document.getElementById("category-custom-wrap");
const inputCategoryCustom = document.getElementById("category-custom");
const inputPrice = document.getElementById("price");
const inputCommissionPct = document.getElementById("commission-pct");
const inputCommissionValue = document.getElementById("commission-value");
const inputSales = document.getElementById("sales");
const inputClicks = document.getElementById("clicks");
const inputCommissionTotal = document.getElementById("commission-total");
const inputImage = document.getElementById("image");
const inputDescription = document.getElementById("description");

const adminProductsList = document.getElementById("admin-products-list");
const adminEmptyState = document.getElementById("admin-empty-state");
const filterCategory = document.getElementById("filter-category");
const filterClient = document.getElementById("filter-client");
const searchProducts = document.getElementById("search-products");

const clientForm = document.getElementById("client-form");
const inputClientName = document.getElementById("client-name");
const clientStatusMessage = document.getElementById("client-status-message");
const clientsList = document.getElementById("clients-list");
const clientsEmptyState = document.getElementById("clients-empty-state");
const clientSelection = document.getElementById("client-selection");
const clientProductsPicklist = document.getElementById("client-products-picklist");
const clientProductsEmpty = document.getElementById("client-products-empty");
const saveClientProductsBtn = document.getElementById("save-client-products-btn");

const statProducts = document.getElementById("stat-products");
const statClicks = document.getElementById("stat-clicks");
const statSales = document.getElementById("stat-sales");
const statCommission = document.getElementById("stat-commission");

const chartCanvas = document.getElementById("commission-chart");
const chartEmpty = document.getElementById("chart-empty");
const activityList = document.getElementById("activity-list");
const activityEmpty = document.getElementById("activity-empty");

const commissionSummary = document.getElementById("commission-summary");
const commissionEmpty = document.getElementById("commission-empty");

const settingsForm = document.getElementById("settings-form");
const settingDefaultCommission = document.getElementById("setting-default-commission");
const settingAutoSave = document.getElementById("setting-auto-save");
const adminEmail = document.getElementById("admin-email");
const eventUrlTemplate = document.getElementById("event-url-template");
const copyEventUrlBtn = document.getElementById("copy-event-url-btn");

const toastStack = document.getElementById("toast-stack");

const PRESET_CATEGORIES = [
  "Eletronicos",
  "Casa e Cozinha",
  "Informatica",
  "Celulares",
  "Games",
  "Moda",
  "Beleza",
  "Saude",
  "Pets",
  "Bebes",
  "Esporte e Lazer",
  "Ferramentas",
  "Outros",
];

let appSettings = loadSettings();
let currentEditingId = null;
let cachedProducts = [];
let cachedClients = [];
let cachedClientSelections = [];
let activeSection = "dashboard";
let lastAutoFilledLink = "";
let autoFillTimer = null;
let isAutofilling = false;

function loadSettings() {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      defaultCommissionPct: Number.isFinite(Number(parsed.defaultCommissionPct))
        ? Math.max(0, Number(parsed.defaultCommissionPct))
        : DEFAULT_SETTINGS.defaultCommissionPct,
      autoSaveAfterAutofill: Boolean(parsed.autoSaveAfterAutofill),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(appSettings));
}

function loadActivities() {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && item.message && item.timestamp);
  } catch {
    return [];
  }
}

function saveActivities(activities) {
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities.slice(0, 80)));
}

function pushActivity(message, type = "info") {
  const activities = loadActivities();
  activities.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    message,
    type,
    timestamp: new Date().toISOString(),
  });
  saveActivities(activities);
  renderActivities();
}

function showToast(message, type = "info") {
  if (!toastStack) return;
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  toastStack.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function setStatus(message, isError = false) {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? "#b91c1c" : "#0f766e";
}

function setLoginStatus(message, isError = false) {
  if (!loginStatus) return;
  loginStatus.textContent = message;
  loginStatus.style.color = isError ? "#b91c1c" : "#0f766e";
}

function setClientStatus(message, isError = false) {
  if (!clientStatusMessage) return;
  clientStatusMessage.textContent = message;
  clientStatusMessage.style.color = isError ? "#b91c1c" : "#0f766e";
}

function showAdmin() {
  if (loginGate) loginGate.hidden = true;
  if (adminApp) adminApp.hidden = false;
}

function showLogin() {
  if (loginGate) loginGate.hidden = false;
  if (adminApp) adminApp.hidden = true;
}

function switchSection(sectionKey) {
  activeSection = sectionKey;
  navButtons.forEach((button) => {
    const isActive = button.dataset.section === sectionKey;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");
  });

  sections.forEach((section) => {
    const isActive = section.dataset.section === sectionKey;
    section.hidden = !isActive;
  });

  const meta = SECTION_META[sectionKey] || SECTION_META.dashboard;
  adminTitle.textContent = meta.title;
  adminSubtitle.textContent = meta.subtitle;

  if (sidebar.classList.contains("is-open")) {
    sidebar.classList.remove("is-open");
    sidebarToggle.setAttribute("aria-expanded", "false");
  }
}

function setFormModeEditing(isEditing) {
  if (!formTitle || !formModeHint || !saveBtn || !cancelEditBtn) return;
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

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeCategory(value) {
  const text = String(value || "").trim();
  return text || "Sem categoria";
}

function normalizeClientName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function setCategoryValue(categoryValue) {
  const category = normalizeCategory(categoryValue);
  const match = Array.from(inputCategory.options).find((option) => option.value === category);
  if (match) {
    inputCategory.value = match.value;
    inputCategoryCustomWrap.hidden = true;
    inputCategoryCustom.value = "";
    return;
  }
  inputCategory.value = "Outros";
  inputCategoryCustomWrap.hidden = false;
  inputCategoryCustom.value = category;
}

function getCategoryValue() {
  if (inputCategory.value === "Outros") {
    return normalizeCategory(inputCategoryCustom.value);
  }
  return normalizeCategory(inputCategory.value);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function computeCommissionPerSale(price, commissionPct) {
  const safePrice = Math.max(0, toNumber(price, 0));
  const safePct = Math.max(0, toNumber(commissionPct, 0));
  return Number((safePrice * safePct) / 100);
}

function computeCommissionTotal(price, commissionPct, sales) {
  const perSale = computeCommissionPerSale(price, commissionPct);
  const safeSales = Math.max(0, toNumber(sales, 0));
  return Number(perSale * safeSales);
}

function updateCommissionFields() {
  const price = inputPrice.value;
  const pct = inputCommissionPct.value;
  const sales = inputSales.value;
  const perSale = computeCommissionPerSale(price, pct);
  const total = computeCommissionTotal(price, pct, sales);
  inputCommissionValue.value = formatBRL(perSale);
  inputCommissionTotal.value = formatBRL(total);
}

function inferCategoryFromText(text) {
  const value = String(text || "").toLowerCase();
  if (!value) return "Sem categoria";
  if (/(smartphone|celular|iphone|samsung|xiaomi|motorola)/i.test(value)) return "Celulares";
  if (/(notebook|pc|computador|monitor|teclado|mouse|ssd|hd)/i.test(value)) return "Informatica";
  if (/(console|playstation|xbox|nintendo|jogo|gamer)/i.test(value)) return "Games";
  if (/(liquidificador|cafeteira|cozinha|panela|casa|lar)/i.test(value)) return "Casa e Cozinha";
  if (/(bebe|bebes|fralda|mamadeira|chupeta|berco|carrinho)/i.test(value)) return "Bebes";
  if (/(camisa|tenis|moda|roupa|vestido|bermuda)/i.test(value)) return "Moda";
  if (/(perfume|maquiagem|skincare|beleza|cabelo)/i.test(value)) return "Beleza";
  if (/(saude|vitamina|suplemento|farmacia|medicamento)/i.test(value)) return "Saude";
  if (/(pet|pets|racao|cachorro|gato|coleira|areia)/i.test(value)) return "Pets";
  if (/(bike|bicicleta|academia|esporte|futebol|lazer)/i.test(value)) return "Esporte e Lazer";
  if (/(furadeira|parafusadeira|ferramenta|chave|serra)/i.test(value)) return "Ferramentas";
  return "Eletronicos";
}
function decodeDeep(value, rounds = 3) {
  let current = String(value || "");
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
  const match = String(text || "").match(/\b(ML[A-Z]{1,3}\d{6,})\b/i);
  return match?.[1]?.toUpperCase() || null;
}

function extractItemId(link) {
  const candidates = [String(link || ""), decodeDeep(link)];
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

function detectCommissionPctFromLink(link) {
  const normalized = normalizeUrl(link);
  if (!normalized) return null;

  try {
    const parsed = new URL(normalized);
    const commissionKeys = [
      "commission",
      "comissao",
      "commission_pct",
      "commission_percent",
      "pct",
      "share",
      "rate",
    ];

    for (const [key, value] of parsed.searchParams.entries()) {
      const keyLc = key.toLowerCase();
      const valueText = decodeDeep(value).replace(",", ".");
      const numeric = Number.parseFloat(valueText.replace(/[^\d.]/g, ""));
      if (commissionKeys.some((term) => keyLc.includes(term)) && Number.isFinite(numeric)) {
        return Math.max(0, Math.min(numeric, 100));
      }

      if (/%$/.test(valueText.trim())) {
        const pct = Number.parseFloat(valueText);
        if (Number.isFinite(pct)) return Math.max(0, Math.min(pct, 100));
      }
    }
  } catch {
    return null;
  }

  return null;
}

function clampCommissionPct(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(numeric, 100));
}

function pickCommissionPctFromObject(source, price) {
  if (!source || typeof source !== "object") return null;

  const directCandidates = [
    source.commission_pct,
    source.commission,
    source.sale_fee,
    source.sale_fee_percentage,
    source.sale_fee_details?.percentage_fee,
    source.sale_fee_details?.meli_percentage_fee,
    source.sale_fee_details?.percentage,
  ];

  for (const candidate of directCandidates) {
    const pct = clampCommissionPct(candidate);
    if (pct !== null) return pct;
  }

  const feeAmountCandidates = [
    source.sale_fee_amount,
    source.sale_fee_details?.gross_amount,
    source.sale_fee_details?.fee_amount,
  ];

  const safePrice = Number(price);
  if (Number.isFinite(safePrice) && safePrice > 0) {
    for (const amount of feeAmountCandidates) {
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount)) continue;
      const derivedPct = clampCommissionPct((numericAmount / safePrice) * 100);
      if (derivedPct !== null) return derivedPct;
    }
  }

  return null;
}

function pickCommissionPctFromListingPriceResponse(response, price) {
  if (!response) return null;

  const tryPick = (entry) => pickCommissionPctFromObject(entry, price);

  if (Array.isArray(response)) {
    for (const entry of response) {
      const pct = tryPick(entry);
      if (pct !== null) return pct;
    }
    return null;
  }

  const direct = tryPick(response);
  if (direct !== null) return direct;

  if (Array.isArray(response.results)) {
    for (const entry of response.results) {
      const pct = tryPick(entry);
      if (pct !== null) return pct;
    }
  }

  if (Array.isArray(response.prices)) {
    for (const entry of response.prices) {
      const pct = tryPick(entry);
      if (pct !== null) return pct;
    }
  }

  return null;
}

async function fetchMercadoLivreCommissionPct({ siteId, categoryId, listingTypeId, price, itemPayload }) {
  const fromItem = pickCommissionPctFromObject(itemPayload, price);
  if (fromItem !== null) return fromItem;

  if (!siteId || !categoryId || !listingTypeId || !Number.isFinite(Number(price)) || Number(price) <= 0) {
    return null;
  }

  try {
    const endpoint = new URL(`https://api.mercadolibre.com/sites/${encodeURIComponent(siteId)}/listing_prices`);
    endpoint.searchParams.set("price", String(price));
    endpoint.searchParams.set("category_id", categoryId);
    endpoint.searchParams.set("listing_type_id", listingTypeId);

    const response = await fetch(endpoint.toString());
    if (!response.ok) return null;

    const result = await response.json();
    return pickCommissionPctFromListingPriceResponse(result, price);
  } catch {
    return null;
  }
}

function previewScreenshotFromLink(link) {
  const normalized = normalizeUrl(link);
  if (!normalized) return "";
  return `https://image.microlink.io/?url=${encodeURIComponent(normalized)}&screenshot=false&meta=true`;
}

async function fetchPreviewData(link) {
  try {
    const normalized = normalizeUrl(link);
    if (!normalized) return null;
    const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(normalized)}`);
    if (!response.ok) return null;
    const result = await response.json();
    const data = result?.data || {};
    return {
      title: data.title || "",
      description: data.description || "",
      image: data.image?.url || data.logo?.url || "",
    };
  } catch {
    return null;
  }
}

async function fetchProductDataFromLink(link) {
  // Prioriza o endpoint oficial do Mercado Livre quando o item ID existe no link.
  const itemId = extractItemId(link);
  if (itemId) {
    const response = await fetch(`https://api.mercadolibre.com/items/${itemId}`);
    if (response.ok) {
      const data = await response.json();
      const normalizedPrice = Number.isFinite(Number(data.price)) ? Number(data.price) : null;
      let descriptionText = "";
      try {
        const descResponse = await fetch(`https://api.mercadolibre.com/items/${itemId}/description`);
        if (descResponse.ok) {
          const descData = await descResponse.json();
          descriptionText = descData?.plain_text || descData?.text || "";
        }
      } catch {
        // ignore description failures
      }

      if (!descriptionText) {
        const preview = await fetchPreviewData(link);
        if (preview?.description) descriptionText = preview.description;
      }

      const marketplaceCommissionPct = await fetchMercadoLivreCommissionPct({
        siteId: data.site_id || "MLB",
        categoryId: data.category_id || "",
        listingTypeId: data.listing_type_id || "",
        price: normalizedPrice,
        itemPayload: data,
      });

      return {
        title: data.title || "",
        price: normalizedPrice ?? "",
        image: data.thumbnail || "",
        description: descriptionText || data.warranty || "",
        marketplaceCommissionPct,
      };
    }
  }

  const preview = await fetchPreviewData(link);
  return {
    title: preview?.title || "Produto afiliado",
    price: "",
    image: preview?.image || previewScreenshotFromLink(link),
    description: preview?.description || "",
    marketplaceCommissionPct: null,
  };
}

function getFilteredProducts() {
  const category = filterCategory.value || "Todas";
  const client = filterClient?.value || "Todos";
  const search = String(searchProducts.value || "").trim().toLowerCase();
  const selectedForClient = client === "Todos" ? null : getSelectedProductIdsForClient(client);

  return cachedProducts.filter((product) => {
    const categoryOk = category === "Todas" || normalizeCategory(product.category) === category;
    const clientOk =
      !selectedForClient || selectedForClient.has(Number(product.id));
    const searchOk = !search || String(product.title || "").toLowerCase().includes(search);
    return categoryOk && clientOk && searchOk;
  });
}

function updateCategoryFilterOptions() {
  const values = new Set(["Todas", ...PRESET_CATEGORIES]);
  cachedProducts.forEach((product) => values.add(normalizeCategory(product.category)));

  const currentValue = filterCategory.value || "Todas";
  filterCategory.innerHTML = "";

  Array.from(values).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value === "Todas" ? "Todas as categorias" : value;
    filterCategory.appendChild(option);
  });

  filterCategory.value = Array.from(values).includes(currentValue) ? currentValue : "Todas";
}

function buildProductPayloadFromForm() {
  const affiliateLink = normalizeUrl(inputAffiliateLink.value.trim());
  const title = inputTitle.value.trim();
  const category = getCategoryValue();
  const price = inputPrice.value === "" ? null : Math.max(0, toNumber(inputPrice.value, 0));
  const image = normalizeUrl(inputImage.value.trim());
  const description = inputDescription.value.trim();
  const clicks = Math.max(0, Math.round(toNumber(inputClicks.value, 0)));
  const sales = Math.max(0, Math.round(toNumber(inputSales.value, 0)));
  const commissionPctRaw = String(inputCommissionPct.value || "").trim();
  const commissionPct = commissionPctRaw === "" ? null : Math.max(0, toNumber(commissionPctRaw, 0));
  const commissionValue = computeCommissionPerSale(price, commissionPct ?? 0);

  return {
    affiliate_link: affiliateLink,
    title,
    category,
    price,
    image,
    description,
    clicks,
    sales,
    commission_pct: commissionPct ?? 0,
    commission_value: commissionValue,
  };
}

function validatePayload(payload) {
  if (!payload.affiliate_link) return "Link de afiliacao e obrigatorio.";
  if (!isValidUrl(payload.affiliate_link)) return "Informe um link valido (http/https).";
  if (!payload.title) return "Titulo e obrigatorio.";
  if (String(inputCommissionPct.value || "").trim() === "") {
    return "Nao foi possivel puxar a comissao automaticamente. Informe a comissao do produto.";
  }
  if (inputCategory.value === "Outros" && !inputCategoryCustom.value.trim()) {
    return "Informe o nome da categoria personalizada.";
  }
  return "";
}

function resetProductForm() {
  form.reset();
  currentEditingId = null;
  setFormModeEditing(false);
  lastAutoFilledLink = "";
  setCategoryValue("Eletronicos");
  inputCommissionPct.value =
    appSettings.defaultCommissionPct > 0 ? String(appSettings.defaultCommissionPct) : "";
  inputClicks.value = "0";
  inputSales.value = "0";
  inputAutoSave.checked = Boolean(appSettings.autoSaveAfterAutofill);
  updateCommissionFields();
}
function renderAdminProducts() {
  adminProductsList.innerHTML = "";

  const products = getFilteredProducts();
  if (!products.length) {
    adminEmptyState.style.display = "block";
    return;
  }
  adminEmptyState.style.display = "none";

  products.forEach((product) => {
    const priceText =
      product.price === null || product.price === undefined || product.price === ""
        ? "Preco nao informado"
        : formatBRL(product.price);

    const commissionPct = toNumber(product.commission_pct, 0);
    const sales = Math.max(0, toNumber(product.sales, 0));
    const clicks = Math.max(0, toNumber(product.clicks, 0));
    const commissionPerSale = computeCommissionPerSale(product.price, commissionPct);
    const totalCommission = computeCommissionTotal(product.price, commissionPct, sales);

    const row = document.createElement("article");
    row.className = "admin-product-row";

    row.innerHTML = `
      <div class="admin-product-row__media">
        <img src="${escapeHtml(normalizeUrl(product.image) || previewScreenshotFromLink(product.affiliate_link))}" alt="${escapeHtml(product.title || "Produto")}" loading="lazy" referrerpolicy="no-referrer">
      </div>
      <div class="admin-product-row__content">
        <h3>${escapeHtml(product.title || "Produto")}</h3>
        <p class="admin-product-row__meta">${escapeHtml(normalizeCategory(product.category))}</p>
        <p class="admin-product-row__meta">${priceText}</p>
        <p class="admin-product-row__meta"><strong>Comissao:</strong> ${commissionPct.toFixed(2)}% (${formatBRL(commissionPerSale)}/venda)</p>
        <p class="admin-product-row__meta"><strong>Cliques:</strong> ${clicks} | <strong>Vendas:</strong> ${sales}</p>
        <p class="admin-product-row__meta"><strong>Total:</strong> ${formatBRL(totalCommission)}</p>
      </div>
      <div class="admin-actions admin-actions--stack">
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
      inputCommissionPct.value = String(toNumber(product.commission_pct, 0));
      inputClicks.value = String(Math.max(0, toNumber(product.clicks, 0)));
      inputSales.value = String(Math.max(0, toNumber(product.sales, 0)));
      inputImage.value = product.image || "";
      inputDescription.value = product.description || "";
      updateCommissionFields();

      switchSection("products");
      window.scrollTo({ top: 0, behavior: "smooth" });
      setStatus("Produto carregado para edicao.");
    });
  });

  adminProductsList.querySelectorAll("[data-product-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.getAttribute("data-product-id");
      const current = cachedProducts.find((item) => String(item.id) === String(id));
      const title = current?.title || "Produto";
      if (!window.confirm(`Deseja excluir "${title}"?`)) return;

      try {
        const { error } = await supabase.from("products").delete().eq("id", id);
        if (error) throw new Error("Falha ao remover produto.");
        pushActivity(`Produto removido: ${title}`, "warning");
        showToast("Produto removido.", "warning");
        setStatus("Produto removido com sucesso.");
        await refreshAllData();
      } catch (error) {
        console.error(error);
        setStatus(error.message || "Falha ao remover produto.", true);
        showToast("Nao foi possivel remover o produto.", "error");
      }
    });
  });
}

function getMonthKey(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(date);
}

function buildMonthlyCommissionSeries(products, monthsBack = 6) {
  const now = new Date();
  const months = [];
  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const byMonth = new Map();
  months.forEach((key) => byMonth.set(key, 0));

  products.forEach((product) => {
    const key = getMonthKey(product.created_at);
    if (!byMonth.has(key)) return;
    const total = computeCommissionTotal(product.price, product.commission_pct, product.sales);
    byMonth.set(key, byMonth.get(key) + total);
  });

  return months.map((key) => ({
    key,
    label: getMonthLabel(key),
    value: Number(byMonth.get(key) || 0),
  }));
}

function drawCommissionChart(series) {
  if (!chartCanvas) return;
  const context = chartCanvas.getContext("2d");
  if (!context) return;

  const parentWidth = chartCanvas.parentElement ? chartCanvas.parentElement.clientWidth : 640;
  const width = Math.max(300, parentWidth - 24);
  const height = 210;
  chartCanvas.width = width;
  chartCanvas.height = height;

  if (!series.length || series.every((item) => item.value <= 0)) {
    context.clearRect(0, 0, width, height);
    chartEmpty.hidden = false;
    return;
  }
  chartEmpty.hidden = true;

  const maxValue = Math.max(...series.map((item) => item.value), 1);
  const padding = { top: 24, right: 18, bottom: 36, left: 14 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const barWidth = Math.max(18, chartWidth / (series.length * 1.65));

  const drawFrame = (progress) => {
    context.clearRect(0, 0, width, height);

    context.fillStyle = "rgba(148, 163, 184, 0.16)";
    context.fillRect(padding.left, padding.top, chartWidth, chartHeight);

    series.forEach((item, index) => {
      const x = padding.left + (index + 0.5) * (chartWidth / series.length) - barWidth / 2;
      const valueRatio = item.value / maxValue;
      // Interpola a altura para animacao de entrada dos dados.
      const animatedRatio = valueRatio * progress;
      const barHeight = Math.max(0, chartHeight * animatedRatio);
      const y = padding.top + chartHeight - barHeight;

      const gradient = context.createLinearGradient(0, y, 0, padding.top + chartHeight);
      gradient.addColorStop(0, "#1d4ed8");
      gradient.addColorStop(1, "#60a5fa");

      context.fillStyle = gradient;
      context.beginPath();
      const radius = 8;
      context.moveTo(x, y + radius);
      context.arcTo(x, y, x + radius, y, radius);
      context.lineTo(x + barWidth - radius, y);
      context.arcTo(x + barWidth, y, x + barWidth, y + radius, radius);
      context.lineTo(x + barWidth, padding.top + chartHeight);
      context.lineTo(x, padding.top + chartHeight);
      context.closePath();
      context.fill();

      context.fillStyle = "#475569";
      context.font = "12px 'Plus Jakarta Sans', sans-serif";
      context.textAlign = "center";
      context.fillText(item.label, x + barWidth / 2, height - 12);
    });
  };

  const start = performance.now();
  const duration = 520;

  const animate = (now) => {
    const elapsed = now - start;
    const progress = Math.min(1, elapsed / duration);
    drawFrame(progress);
    if (progress < 1) requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
}

function animateNumber(element, endValue, format = "number") {
  if (!element) return;
  const start = performance.now();
  const duration = 550;

  const render = (value) => {
    if (format === "currency") {
      element.textContent = formatBRL(value);
      return;
    }
    element.textContent = Math.round(value).toLocaleString("pt-BR");
  };

  const frame = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - progress) * (1 - progress);
    render(endValue * eased);
    if (progress < 1) requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}

function renderDashboard(products) {
  const totals = products.reduce(
    (acc, item) => {
      acc.products += 1;
      acc.clicks += Math.max(0, toNumber(item.clicks, 0));
      acc.sales += Math.max(0, toNumber(item.sales, 0));
      acc.commission += computeCommissionTotal(item.price, item.commission_pct, item.sales);
      return acc;
    },
    { products: 0, clicks: 0, sales: 0, commission: 0 }
  );

  animateNumber(statProducts, totals.products, "number");
  animateNumber(statClicks, totals.clicks, "number");
  animateNumber(statSales, totals.sales, "number");
  animateNumber(statCommission, totals.commission, "currency");

  const monthlySeries = buildMonthlyCommissionSeries(products, 6);
  drawCommissionChart(monthlySeries);
}
function renderActivities() {
  const items = loadActivities();
  activityList.innerHTML = "";

  if (!items.length) {
    activityEmpty.hidden = false;
    return;
  }
  activityEmpty.hidden = true;

  items.slice(0, 8).forEach((item) => {
    const entry = document.createElement("li");
    entry.className = "activity-item";

    const when = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(item.timestamp));

    entry.innerHTML = `
      <span class="activity-item__dot activity-item__dot--${escapeHtml(item.type || "info")}"></span>
      <div>
        <p>${escapeHtml(item.message)}</p>
        <small>${when}</small>
      </div>
    `;

    activityList.appendChild(entry);
  });
}

function renderCommissionSummary(products) {
  commissionSummary.innerHTML = "";

  const rows = products
    .map((product) => {
      const commissionPct = Math.max(0, toNumber(product.commission_pct, 0));
      const sales = Math.max(0, toNumber(product.sales, 0));
      const perSale = computeCommissionPerSale(product.price, commissionPct);
      const total = computeCommissionTotal(product.price, commissionPct, sales);
      return {
        ...product,
        commissionPct,
        sales,
        perSale,
        total,
      };
    })
    .sort((a, b) => b.total - a.total);

  if (!rows.length) {
    commissionEmpty.hidden = false;
    return;
  }
  commissionEmpty.hidden = true;

  const header = document.createElement("div");
  header.className = "commission-summary__row commission-summary__row--head";
  header.innerHTML = `
    <span>Produto</span>
    <span>%</span>
    <span>Por venda</span>
    <span>Vendas</span>
    <span>Total</span>
  `;
  commissionSummary.appendChild(header);

  rows.forEach((row) => {
    const line = document.createElement("div");
    line.className = "commission-summary__row";
    line.innerHTML = `
      <span title="${escapeHtml(row.title || "Produto")}">${escapeHtml(row.title || "Produto")}</span>
      <span>${row.commissionPct.toFixed(2)}%</span>
      <span>${formatBRL(row.perSale)}</span>
      <span>${row.sales}</span>
      <span><strong>${formatBRL(row.total)}</strong></span>
    `;
    commissionSummary.appendChild(line);
  });
}

function getSelectedProductIdsForClient(clientId) {
  const targetId = Number(clientId);
  if (!Number.isFinite(targetId)) return new Set();
  const ids = cachedClientSelections
    .filter((entry) => Number(entry.client_id) === targetId)
    .map((entry) => Number(entry.product_id));
  return new Set(ids);
}

function renderClientOptions() {
  const normalizedClients = [...cachedClients].sort((a, b) =>
    String(a.full_name || "").localeCompare(String(b.full_name || ""), "pt-BR")
  );

  if (clientSelection) {
    const currentSelection = clientSelection.value || "";
    clientSelection.innerHTML = '<option value="">Selecione um cliente</option>';
    normalizedClients.forEach((client) => {
      const option = document.createElement("option");
      option.value = String(client.id);
      option.textContent = client.full_name || "Cliente";
      clientSelection.appendChild(option);
    });
    clientSelection.value = normalizedClients.some((c) => String(c.id) === currentSelection)
      ? currentSelection
      : "";
  }

  if (filterClient) {
    const currentFilter = filterClient.value || "Todos";
    filterClient.innerHTML = '<option value="Todos">Todos os clientes</option>';
    normalizedClients.forEach((client) => {
      const option = document.createElement("option");
      option.value = String(client.id);
      option.textContent = client.full_name || "Cliente";
      filterClient.appendChild(option);
    });
    filterClient.value = normalizedClients.some((c) => String(c.id) === currentFilter)
      ? currentFilter
      : "Todos";
  }
}

function renderClientsList() {
  if (!clientsList || !clientsEmptyState) return;
  clientsList.innerHTML = "";

  if (!cachedClients.length) {
    clientsEmptyState.style.display = "block";
    return;
  }

  clientsEmptyState.style.display = "none";

  const sortedClients = [...cachedClients].sort((a, b) =>
    String(a.full_name || "").localeCompare(String(b.full_name || ""), "pt-BR")
  );

  sortedClients.forEach((client) => {
    const selectedCount = cachedClientSelections.filter(
      (entry) => Number(entry.client_id) === Number(client.id)
    ).length;

    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <div>
        <h3>${escapeHtml(client.full_name || "Cliente")}</h3>
        <p>${selectedCount} item(ns) vinculado(s)</p>
      </div>
      <div class="admin-actions">
        <button class="btn-danger" type="button" data-client-id="${client.id}">Excluir</button>
      </div>
    `;

    clientsList.appendChild(row);
  });

  clientsList.querySelectorAll("[data-client-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const clientId = button.getAttribute("data-client-id");
      const target = cachedClients.find((item) => String(item.id) === String(clientId));
      const label = target?.full_name || "Cliente";
      if (!window.confirm(`Deseja excluir o cliente \"${label}\"?`)) return;

      try {
        const { error } = await supabase.from("clients").delete().eq("id", clientId);
        if (error) throw error;
        setClientStatus("Cliente removido com sucesso.");
        showToast("Cliente removido.", "warning");
        await refreshAllData();
      } catch (error) {
        console.error(error);
        setClientStatus("Nao foi possivel remover o cliente.", true);
        showToast("Falha ao remover cliente.", "error");
      }
    });
  });
}

function renderClientProductsPicklist() {
  if (!clientProductsPicklist || !clientProductsEmpty || !clientSelection) return;

  const selectedClientId = Number(clientSelection.value);
  clientProductsPicklist.innerHTML = "";

  if (!Number.isFinite(selectedClientId)) {
    clientProductsEmpty.style.display = "block";
    return;
  }

  if (!cachedProducts.length) {
    clientProductsEmpty.textContent = "Cadastre produtos antes de vincular ao cliente.";
    clientProductsEmpty.style.display = "block";
    return;
  }

  const selectedIds = getSelectedProductIdsForClient(selectedClientId);
  clientProductsEmpty.style.display = "none";

  cachedProducts.forEach((product) => {
    const item = document.createElement("label");
    item.className = "client-pick-item";
    item.innerHTML = `
      <input type="checkbox" value="${product.id}" ${selectedIds.has(Number(product.id)) ? "checked" : ""}>
      <span>${escapeHtml(product.title || "Produto sem titulo")}</span>
    `;
    clientProductsPicklist.appendChild(item);
  });
}

async function loadClients() {
  const { data, error } = await supabase
    .from("clients")
    .select("id, full_name, created_at")
    .order("full_name", { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function loadClientSelections() {
  const { data, error } = await supabase
    .from("client_product_selections")
    .select("id, client_id, product_id");

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, affiliate_link, title, category, price, image, description, clicks, sales, commission_pct, commission_value, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function refreshAllData(showFeedback = false) {
  try {
    // Fonte unica de sincronizacao para dashboard, listagem e resumo de comissoes.
    refreshBtn.disabled = true;
    refreshBtn.textContent = "Atualizando...";

    const [products, clients, clientSelections] = await Promise.all([
      loadProducts(),
      loadClients(),
      loadClientSelections(),
    ]);

    cachedProducts = products;
    cachedClients = clients;
    cachedClientSelections = clientSelections;

    updateCategoryFilterOptions();
    renderClientOptions();
    renderAdminProducts();
    renderClientsList();
    renderClientProductsPicklist();
    renderDashboard(cachedProducts);
    renderCommissionSummary(cachedProducts);
    renderActivities();

    if (showFeedback) {
      showToast("Dados atualizados.", "success");
      setStatus("Painel sincronizado com sucesso.");
    }
  } catch (error) {
    console.error(error);
    const hint = "Nao foi possivel atualizar o painel agora. Execute o SQL de migracao completo (db-setup.sql).";
    setStatus(hint, true);
    showToast(hint, "error");
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "Atualizar dados";
  }
}

async function saveProduct(payload) {
  if (currentEditingId) {
    const { error } = await supabase.from("products").update(payload).eq("id", currentEditingId);
    if (error) throw error;
    return "updated";
  }
  const { error } = await supabase.from("products").insert(payload);
  if (error) throw error;
  return "created";
}

async function handleAutoFill(link, triggerAutoSave = false) {
  if (isAutofilling) return;
  isAutofilling = true;

  try {
    autoFillBtn.disabled = true;
    autoFillBtn.classList.add("is-loading");
    autoFillBtn.textContent = "Buscando...";
    setStatus("Buscando dados do produto pelo link...");

    const data = await fetchProductDataFromLink(link);
    inputTitle.value = data.title || "";
    inputPrice.value = data.price || "";
    inputImage.value = normalizeUrl(data.image || "");
    inputDescription.value = data.description || "";
    setCategoryValue(inferCategoryFromText(`${data.title} ${data.description}`));

    const detectedCommission = detectCommissionPctFromLink(link);
    const marketplaceCommission = clampCommissionPct(data.marketplaceCommissionPct);
    if (detectedCommission !== null) {
      inputCommissionPct.value = detectedCommission.toFixed(2);
      setStatus(`Dados preenchidos. Comissao detectada: ${detectedCommission.toFixed(2)}%.`);
    } else if (marketplaceCommission !== null) {
      inputCommissionPct.value = marketplaceCommission.toFixed(2);
      setStatus(`Dados preenchidos. Comissao puxada do Mercado Livre: ${marketplaceCommission.toFixed(2)}%.`);
    } else if (!inputCommissionPct.value && appSettings.defaultCommissionPct > 0) {
      inputCommissionPct.value = String(appSettings.defaultCommissionPct);
      setStatus("Dados preenchidos automaticamente com comissao fallback.");
    } else if (!inputCommissionPct.value) {
      setStatus("Dados preenchidos, mas a comissao nao veio no link/produto. Informe manualmente.");
    } else {
      setStatus("Dados preenchidos automaticamente.");
    }

    updateCommissionFields();
    lastAutoFilledLink = link;
    showToast("Produto preenchido a partir do link.", "success");

    if (triggerAutoSave && inputAutoSave.checked) {
      const payload = buildProductPayloadFromForm();
      const issue = validatePayload(payload);
      if (!issue) {
        await saveProduct(payload);
        pushActivity(`Produto adicionado automaticamente: ${payload.title}`, "success");
        showToast("Produto salvo automaticamente.", "success");
        resetProductForm();
        await refreshAllData();
      }
    }
  } catch (error) {
    console.error(error);
    setStatus("Nao foi possivel preencher automaticamente o produto.", true);
    showToast("Falha ao buscar dados do link.", "error");
  } finally {
    isAutofilling = false;
    autoFillBtn.disabled = false;
    autoFillBtn.classList.remove("is-loading");
    autoFillBtn.textContent = "Buscar dados do produto";
  }
}

async function handleAuthSession() {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  const email = session?.user?.email || "";

  if (session && email === ADMIN_EMAIL) {
    showAdmin();
    adminEmail.textContent = email;
    await refreshAllData();
    return;
  }

  if (session && email !== ADMIN_EMAIL) {
    await supabase.auth.signOut();
    setLoginStatus("Acesso permitido apenas para o admin.", true);
  }

  showLogin();
  setLoginStatus("Use seu email e senha de admin.");
}
loginForm?.addEventListener("submit", async (event) => {
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

  const email = data.session.user?.email || "";
  if (email !== ADMIN_EMAIL) {
    await supabase.auth.signOut();
    setLoginStatus("Acesso permitido apenas para o admin.", true);
    return;
  }

  loginForm.reset();
  showAdmin();
  adminEmail.textContent = email;
  setLoginStatus("Acesso liberado.");
  showToast("Login realizado.", "success");
  pushActivity("Sessao admin iniciada.", "info");
  await refreshAllData();
});

logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  showLogin();
  setLoginStatus("Sessao encerrada.");
  showToast("Sessao encerrada.", "info");
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = buildProductPayloadFromForm();
  const validationError = validatePayload(payload);
  if (validationError) {
    setStatus(validationError, true);
    showToast(validationError, "error");
    return;
  }

  try {
    const action = await saveProduct(payload);
    const isEdit = action === "updated";
    pushActivity(`${isEdit ? "Produto atualizado" : "Novo produto cadastrado"}: ${payload.title}`, "success");
    showToast(isEdit ? "Produto atualizado." : "Produto cadastrado.", "success");
    setStatus(isEdit ? "Produto atualizado com sucesso." : "Produto salvo com sucesso.");

    resetProductForm();
    await refreshAllData();
  } catch (error) {
    console.error(error);
    const hint =
      String(error?.message || "").includes("column")
        ? "A tabela products nao possui todas as colunas novas. Rode o SQL de migracao."
        : "Nao foi possivel salvar o produto.";
    setStatus(hint, true);
    showToast(hint, "error");
  }
});

cancelEditBtn?.addEventListener("click", () => {
  resetProductForm();
  setStatus("Edicao cancelada.");
});

inputCategory?.addEventListener("change", () => {
  inputCategoryCustomWrap.hidden = inputCategory.value !== "Outros";
  if (inputCategory.value !== "Outros") inputCategoryCustom.value = "";
});

[inputPrice, inputCommissionPct, inputSales].forEach((element) => {
  element?.addEventListener("input", updateCommissionFields);
});

inputAffiliateLink?.addEventListener("input", () => {
  const link = normalizeUrl(inputAffiliateLink.value.trim());
  if (!link || !isValidUrl(link)) return;
  if (link === lastAutoFilledLink) return;

  if (autoFillTimer) clearTimeout(autoFillTimer);
  autoFillTimer = setTimeout(() => {
    handleAutoFill(link, true);
  }, 900);
});

autoFillBtn?.addEventListener("click", async () => {
  const link = normalizeUrl(inputAffiliateLink.value.trim());
  if (!link || !isValidUrl(link)) {
    setStatus("Informe um link valido (http/https).", true);
    showToast("Link invalido.", "error");
    return;
  }
  await handleAutoFill(link, false);
});

refreshBtn?.addEventListener("click", async () => {
  await refreshAllData(true);
});

filterCategory?.addEventListener("change", renderAdminProducts);
filterClient?.addEventListener("change", renderAdminProducts);
searchProducts?.addEventListener("input", renderAdminProducts);

clientForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const fullName = normalizeClientName(inputClientName.value);
  if (!fullName) {
    setClientStatus("Informe o nome do cliente.", true);
    return;
  }

  try {
    const { error } = await supabase.from("clients").insert({ full_name: fullName });
    if (error) throw error;

    clientForm.reset();
    setClientStatus("Cliente cadastrado com sucesso.");
    showToast("Cliente cadastrado.", "success");
    await refreshAllData();
  } catch (error) {
    console.error(error);
    const duplicated = String(error?.message || "").toLowerCase().includes("duplicate");
    setClientStatus(duplicated ? "Este nome de cliente ja existe." : "Nao foi possivel cadastrar o cliente.", true);
    showToast("Falha ao cadastrar cliente.", "error");
  }
});

clientSelection?.addEventListener("change", () => {
  renderClientProductsPicklist();
});

saveClientProductsBtn?.addEventListener("click", async () => {
  const selectedClientId = Number(clientSelection?.value || "");
  if (!Number.isFinite(selectedClientId)) {
    setClientStatus("Selecione um cliente para vincular os produtos.", true);
    return;
  }

  const checkedProductIds = Array.from(
    clientProductsPicklist?.querySelectorAll('input[type=\"checkbox\"]:checked') || []
  ).map((element) => Number(element.value)).filter((value) => Number.isFinite(value));

  try {
    const { error: deleteError } = await supabase
      .from("client_product_selections")
      .delete()
      .eq("client_id", selectedClientId);
    if (deleteError) throw deleteError;

    if (checkedProductIds.length) {
      const payload = checkedProductIds.map((productId) => ({
        client_id: selectedClientId,
        product_id: productId,
      }));

      const { error: insertError } = await supabase
        .from("client_product_selections")
        .insert(payload);
      if (insertError) throw insertError;
    }

    setClientStatus("Itens vinculados ao cliente com sucesso.");
    showToast("Vinculos de cliente atualizados.", "success");
    await refreshAllData();
    if (clientSelection) clientSelection.value = String(selectedClientId);
    renderClientProductsPicklist();
    renderAdminProducts();
  } catch (error) {
    console.error(error);
    setClientStatus("Nao foi possivel salvar os itens do cliente.", true);
    showToast("Falha ao salvar itens do cliente.", "error");
  }
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    switchSection(button.dataset.section || "dashboard");
  });
});

sidebarToggle?.addEventListener("click", () => {
  const open = !sidebar.classList.contains("is-open");
  sidebar.classList.toggle("is-open", open);
  sidebarToggle.setAttribute("aria-expanded", String(open));
});

settingsForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const fallbackValue = String(settingDefaultCommission.value || "").trim();
  appSettings.defaultCommissionPct =
    fallbackValue === ""
      ? 0
      : Math.max(0, toNumber(fallbackValue, DEFAULT_SETTINGS.defaultCommissionPct));
  appSettings.autoSaveAfterAutofill = Boolean(settingAutoSave.checked);
  saveSettings();
  inputAutoSave.checked = appSettings.autoSaveAfterAutofill;

  if (!currentEditingId && !inputCommissionPct.value && appSettings.defaultCommissionPct > 0) {
    inputCommissionPct.value = String(appSettings.defaultCommissionPct);
  }
  updateCommissionFields();
  pushActivity("Configuracoes do painel atualizadas.", "info");
  showToast("Configuracoes salvas.", "success");
});

copyEventUrlBtn?.addEventListener("click", async () => {
  if (!eventUrlTemplate) return;
  const template = eventUrlTemplate.textContent || "";
  if (!template) return;

  try {
    await navigator.clipboard.writeText(template);
    showToast("Template de URL copiado.", "success");
  } catch {
    showToast("Nao foi possivel copiar automaticamente.", "error");
  }
});

function hydrateSettingsUI() {
  settingDefaultCommission.value =
    appSettings.defaultCommissionPct > 0 ? String(appSettings.defaultCommissionPct) : "";
  settingAutoSave.checked = appSettings.autoSaveAfterAutofill;
  inputAutoSave.checked = appSettings.autoSaveAfterAutofill;
  if (eventUrlTemplate) {
    eventUrlTemplate.textContent =
      `${window.location.origin}/event-track.html?event=sale&product_id={ID}&order_id={ORDER_ID}&source=afiliado`;
  }
}

function attachResizeRepaint() {
  let timer = null;
  window.addEventListener("resize", () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => drawCommissionChart(buildMonthlyCommissionSeries(cachedProducts)), 120);
  });
}

resetProductForm();
hydrateSettingsUI();
attachResizeRepaint();
switchSection(activeSection);
handleAuthSession();
