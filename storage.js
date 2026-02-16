const STORAGE_KEY = "afiliados_ml_produtos_v1";

function loadProducts() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Falha ao ler produtos do localStorage", error);
    return [];
  }
}

function saveProducts(products) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

function addProduct(product) {
  const products = loadProducts();
  products.unshift(product);
  saveProducts(products);
}

function removeProduct(productId) {
  const products = loadProducts().filter((item) => item.id !== productId);
  saveProducts(products);
}

function formatBRL(value) {
  if (value === null || value === undefined || value === "") return "";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
