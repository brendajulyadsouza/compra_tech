const grid = document.getElementById("products-grid");
const emptyState = document.getElementById("empty-state");

function safeUrl(value) {
  try {
    return new URL(value).toString();
  } catch {
    return "";
  }
}

async function fetchProducts() {
  const response = await fetch("/api/products");
  if (!response.ok) throw new Error("Falha ao carregar produtos.");
  const payload = await response.json();
  return Array.isArray(payload.products) ? payload.products : [];
}

function renderProducts(products) {
  grid.innerHTML = "";

  if (!products.length) {
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

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
    link.href = safeUrl(product.affiliateLink) || "#";
    link.textContent = "Ver no Mercado Livre";
    content.appendChild(link);

    card.appendChild(content);
    grid.appendChild(card);
  }
}

async function initStorefront() {
  try {
    const products = await fetchProducts();
    renderProducts(products);
  } catch (error) {
    console.error(error);
    emptyState.style.display = "block";
    emptyState.textContent = "Nao foi possivel carregar produtos agora.";
  }
}

initStorefront();
