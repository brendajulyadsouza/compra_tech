const grid = document.getElementById("products-grid");
const emptyState = document.getElementById("empty-state");

function safeUrl(value) {
  try {
    return new URL(value).toString();
  } catch {
    return "";
  }
}

function renderProducts() {
  const products = loadProducts();
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

    if (product.price) {
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

renderProducts();
