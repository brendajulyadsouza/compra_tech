const mlGrid = document.getElementById("ml-only-grid");
const mlEmpty = document.getElementById("ml-only-empty");
const mlCategoryFilters = document.getElementById("ml-category-filters");
const FALLBACK_PRODUCT_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4a5b78"/><stop offset="100%" stop-color="#1f355c"/></linearGradient></defs><rect width="800" height="800" fill="url(#g)"/><text x="400" y="420" text-anchor="middle" fill="#dbeafe" font-family="Arial,sans-serif" font-size="42">Imagem indisponivel</text></svg>'
  );
const DEFAULT_CATEGORY = "Sem categoria";
const PRESET_CATEGORIES = [
  "Eletronicos",
  "Casa e Cozinha",
  "Informatica",
  "Celulares",
  "Games",
  "Moda",
  "Beleza",
  "Esporte e Lazer",
  "Ferramentas",
];
let allMercadoLivreProducts = [];
let activeCategory = "Todas";

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

function isMercadoLivreLink(value) {
  try {
    const host = new URL(normalizeAffiliateUrl(value)).hostname.toLowerCase();
    return host.includes("mercadolivre") || host.includes("mercadolibre");
  } catch {
    return false;
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

function normalizeCategory(value) {
  const text = String(value || "").trim();
  return text || DEFAULT_CATEGORY;
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

async function fetchProducts() {
  const client = window.supabaseClient;
  if (!client) throw new Error("Supabase nao configurado.");
  const { data, error } = await client
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

function render(products) {
  mlGrid.innerHTML = "";
  if (!products.length) {
    mlEmpty.style.display = "block";
    return;
  }
  mlEmpty.style.display = "none";

  for (const product of products) {
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
    const categoryChip = document.createElement("span");
    categoryChip.className = "store-chip";
    categoryChip.textContent = normalizeCategory(product.category);
    meta.appendChild(categoryChip);
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
    link.textContent = "Ver oferta Mercado Livre";
    content.appendChild(link);

    card.appendChild(content);
    mlGrid.appendChild(card);
  }
}

function getCategoryList(products) {
  const dynamicCategories = products.map((item) => normalizeCategory(item.category));
  const categorySet = new Set([...PRESET_CATEGORIES, ...dynamicCategories]);
  return ["Todas", ...Array.from(categorySet)];
}

function getCategoryCounts(products) {
  const counts = new Map();
  counts.set("Todas", products.length);
  products.forEach((item) => {
    const category = normalizeCategory(item.category);
    counts.set(category, (counts.get(category) || 0) + 1);
  });
  return counts;
}

function getFilteredProducts() {
  if (activeCategory === "Todas") return allMercadoLivreProducts;
  return allMercadoLivreProducts.filter((item) => normalizeCategory(item.category) === activeCategory);
}

function renderCategoryFilters(categories) {
  if (!mlCategoryFilters) return;
  const counts = getCategoryCounts(allMercadoLivreProducts);
  mlCategoryFilters.innerHTML = "";
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-secondary category-filter-btn";
    const count = counts.get(category) || 0;
    button.textContent = `${category} (${count})`;
    button.setAttribute("aria-pressed", String(category === activeCategory));
    if (category === activeCategory) button.classList.add("is-active");
    button.addEventListener("click", () => {
      activeCategory = category;
      renderCategoryFilters(categories);
      render(getFilteredProducts());
    });
    mlCategoryFilters.appendChild(button);
  });
}

async function init() {
  try {
    const products = await fetchProducts();
    allMercadoLivreProducts = products.filter((item) => isMercadoLivreLink(item.affiliate_link));
    const categories = getCategoryList(allMercadoLivreProducts);
    renderCategoryFilters(categories);
    render(getFilteredProducts());
  } catch (error) {
    console.error(error);
    mlEmpty.style.display = "block";
    mlEmpty.textContent = "Nao foi possivel carregar produtos agora.";
  }
}

init();
