const sheinGrid = document.getElementById("shein-only-grid");
const sheinEmpty = document.getElementById("shein-only-empty");

function safeUrl(value) {
  try {
    return new URL(value).toString();
  } catch {
    return "";
  }
}

function isSheinLink(value) {
  try {
    return new URL(value).hostname.toLowerCase().includes("shein");
  } catch {
    return false;
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
    image.src = safeUrl(product.image) || "https://via.placeholder.com/800x800?text=Produto";
    image.alt = product.title || "Produto";
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
    link.href = safeUrl(product.affiliate_link) || "#";
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
