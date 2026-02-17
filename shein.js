const sheinGrid = document.getElementById("shein-only-grid");
const sheinEmpty = document.getElementById("shein-only-empty");

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

function isSheinLink(value) {
  try {
    return new URL(normalizeAffiliateUrl(value)).hostname.toLowerCase().includes("shein");
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
  const next = () => {
    while (idx < sources.length) {
      const src = sources[idx++];
      if (src) {
        img.src = src;
        return;
      }
    }
    img.src = "https://via.placeholder.com/800x800?text=Produto";
  };
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
  sheinGrid.innerHTML = "";
  if (!products.length) {
    sheinEmpty.style.display = "block";
    return;
  }
  sheinEmpty.style.display = "none";

  for (const product of products) {
    const card = document.createElement("article");
    card.className = "product-card";

    const image = document.createElement("img");
    image.referrerPolicy = "no-referrer";
    image.alt = product.title || "Produto";
    applyImageFallbacks(image, [
      toProxyImageUrl(pickProductImage(product)),
      pickProductImage(product),
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
    link.textContent = "Ver oferta Shein";
    content.appendChild(link);

    card.appendChild(content);
    sheinGrid.appendChild(card);
  }
}

async function init() {
  try {
    const products = await fetchProducts();
    render(products.filter((item) => isSheinLink(item.affiliate_link)));
  } catch (error) {
    console.error(error);
    sheinEmpty.style.display = "block";
    sheinEmpty.textContent = "Nao foi possivel carregar produtos agora.";
  }
}

init();
