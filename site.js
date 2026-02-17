const mlGrid = document.getElementById("ml-products-grid");
const mlEmptyState = document.getElementById("ml-empty-state");
const sheinGrid = document.getElementById("shein-products-grid");
const sheinEmptyState = document.getElementById("shein-empty-state");

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

function detectStore(urlValue) {
  try {
    const host = new URL(normalizeAffiliateUrl(urlValue)).hostname.toLowerCase();
    if (host.includes("shein")) return "Shein";
    if (host.includes("mercadolivre") || host.includes("mercadolibre")) return "Mercado Livre";
    return "Outros";
  } catch {
    return "Outros";
  }
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

function createProductCard(product) {
    const card = document.createElement("article");
  card.className = "product-card";

    const image = document.createElement("img");
    image.src = normalizeAffiliateUrl(product.image) || "https://via.placeholder.com/800x800?text=Produto";
  image.alt = product.title || "Produto";
  card.appendChild(image);

  const content = document.createElement("div");
  content.className = "product-card__content";

  const meta = document.createElement("div");
  meta.className = "product-card__meta";
  const chip = document.createElement("span");
  chip.className = "store-chip";
  chip.textContent = detectStore(product.affiliate_link);
  meta.appendChild(chip);
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
  link.textContent = "Ver oferta";
  content.appendChild(link);

  card.appendChild(content);
  return card;
}

function renderSection(products, grid, emptyState) {
  grid.innerHTML = "";
  if (!products.length) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";
  for (const product of products) {
    grid.appendChild(createProductCard(product));
  }
}

function renderProducts(products) {
  const mlProducts = products.filter((product) => detectStore(product.affiliate_link) === "Mercado Livre");
  const sheinProducts = products.filter((product) => detectStore(product.affiliate_link) === "Shein");

  renderSection(mlProducts, mlGrid, mlEmptyState);
  renderSection(sheinProducts, sheinGrid, sheinEmptyState);
}

async function initStorefront() {
  try {
    const products = await fetchProducts();
    renderProducts(products);
  } catch (error) {
    console.error(error);
    mlEmptyState.style.display = "block";
    sheinEmptyState.style.display = "block";
    mlEmptyState.textContent = "Nao foi possivel carregar produtos agora.";
    sheinEmptyState.textContent = "Nao foi possivel carregar produtos agora.";
  }
}

initStorefront();
