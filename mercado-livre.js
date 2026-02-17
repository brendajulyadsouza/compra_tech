const mlGrid = document.getElementById("ml-only-grid");
const mlEmpty = document.getElementById("ml-only-empty");
const FALLBACK_PRODUCT_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4a5b78"/><stop offset="100%" stop-color="#1f355c"/></linearGradient></defs><rect width="800" height="800" fill="url(#g)"/><text x="400" y="420" text-anchor="middle" fill="#dbeafe" font-family="Arial,sans-serif" font-size="42">Imagem indisponivel</text></svg>'
  );

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
    .select("id, affiliate_link, title, price, image, description, created_at")
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

async function init() {
  try {
    const products = await fetchProducts();
    render(products.filter((item) => isMercadoLivreLink(item.affiliate_link)));
  } catch (error) {
    console.error(error);
    mlEmpty.style.display = "block";
    mlEmpty.textContent = "Nao foi possivel carregar produtos agora.";
  }
}

init();
