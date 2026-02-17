const mlGrid = document.getElementById("ml-only-grid");
const mlEmpty = document.getElementById("ml-only-empty");

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

function buildPreviewImageFromLink(link) {
  const normalized = normalizeAffiliateUrl(link);
  if (!normalized) return "";
  return `https://image.microlink.io/?url=${encodeURIComponent(normalized)}&screenshot=true&meta=false`;
}

function pickProductImage(product) {
  const imageUrl = normalizeAffiliateUrl(product.image);
  if (imageUrl && !isLikelyIconUrl(imageUrl)) return imageUrl;
  return buildPreviewImageFromLink(product.affiliate_link);
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
    image.src = pickProductImage(product) || "https://via.placeholder.com/800x800?text=Produto";
    image.alt = product.title || "Produto";
    image.addEventListener("error", () => {
      const fallback = buildPreviewImageFromLink(product.affiliate_link);
      if (fallback && image.src !== fallback) {
        image.src = fallback;
        return;
      }
      image.src = "https://via.placeholder.com/800x800?text=Produto";
    });
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
