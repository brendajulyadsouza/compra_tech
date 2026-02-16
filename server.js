const fs = require("fs");
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "change_this_to_a_strong_secret";
const ADMIN_USER = process.env.ADMIN_USER || "CompraTech";
const ADMIN_PASS = process.env.ADMIN_PASS || "Brend@12";
const AUTH_COOKIE = "compratech_admin_token";
const IS_PROD = process.env.NODE_ENV === "production";

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "app.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    affiliate_link TEXT NOT NULL,
    title TEXT NOT NULL,
    price REAL,
    image TEXT,
    description TEXT,
    created_at TEXT NOT NULL
  );
`);

function ensureDefaultAdmin() {
  const found = db.prepare("SELECT id FROM admins WHERE username = ?").get(ADMIN_USER);
  if (found) return;
  const hash = bcrypt.hashSync(ADMIN_PASS, 12);
  db.prepare("INSERT INTO admins (username, password_hash, created_at) VALUES (?, ?, ?)")
    .run(ADMIN_USER, hash, new Date().toISOString());
}
ensureDefaultAdmin();

if (JWT_SECRET === "change_this_to_a_strong_secret") {
  console.warn("Warning: configure JWT_SECRET in .env before production.");
}

app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname, { extensions: ["html"] }));

function safeUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
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

function extractItemId(url) {
  const candidates = [String(url || ""), decodeDeep(url)];
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
      // invalid URL
    }
  }
  return null;
}

function buildTitleFromUrl(link) {
  try {
    const parsed = new URL(link);
    const lastPath = parsed.pathname.split("/").filter(Boolean).pop() || "";
    const decoded = decodeDeep(lastPath).replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    if (decoded) return decoded.slice(0, 100);
    return `Produto de ${parsed.hostname}`;
  } catch {
    return "Produto afiliado";
  }
}

async function tryResolveFinalUrl(link) {
  try {
    const response = await fetch(link, { redirect: "follow" });
    return response?.url || link;
  } catch {
    return link;
  }
}

async function fetchLinkPreviewData(link) {
  try {
    const endpoint = `https://api.microlink.io/?url=${encodeURIComponent(link)}`;
    const response = await fetch(endpoint);
    if (!response.ok) return null;
    const result = await response.json();
    const data = result?.data;
    if (!data) return null;
    return {
      title: data.title || "",
      price: "",
      image: data.image?.url || data.logo?.url || "",
      description: data.description || "",
      source: "preview",
    };
  } catch {
    return null;
  }
}

async function resolveProductDataFromLink(link) {
  let itemId = extractItemId(link);
  if (!itemId) {
    const resolvedUrl = await tryResolveFinalUrl(link);
    itemId = extractItemId(resolvedUrl);
  }

  if (itemId) {
    try {
      const response = await fetch(`https://api.mercadolibre.com/items/${itemId}`);
      if (response.ok) {
        const data = await response.json();
        return {
          title: data.title || "",
          price: data.price || "",
          image: data.thumbnail || "",
          description: data.warranty || "",
          source: "meli_api",
        };
      }
    } catch {
      // fallback
    }
  }

  const preview = await fetchLinkPreviewData(link);
  if (preview) return preview;

  return {
    title: buildTitleFromUrl(link),
    price: "",
    image: "",
    description: "",
    source: "fallback",
  };
}

function signAuthToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: "12h" });
}

function authRequired(req, res, next) {
  const token = req.cookies[AUTH_COOKIE];
  if (!token) return res.status(401).json({ error: "Nao autenticado." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Sessao invalida." });
  }
}

app.post("/api/auth/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (!username || !password) return res.status(400).json({ error: "Credenciais obrigatorias." });

  const user = db.prepare("SELECT * FROM admins WHERE username = ?").get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Usuario ou senha invalidos." });
  }

  const token = signAuthToken(user);
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD,
    maxAge: 12 * 60 * 60 * 1000,
    path: "/",
  });
  return res.json({ ok: true, username: user.username });
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { path: "/" });
  return res.json({ ok: true });
});

app.get("/api/auth/me", authRequired, (req, res) => {
  res.json({ ok: true, username: req.user.username });
});

app.get("/api/products", (_req, res) => {
  const rows = db.prepare(
    "SELECT id, affiliate_link AS affiliateLink, title, price, image, description, created_at AS createdAt FROM products ORDER BY datetime(created_at) DESC"
  ).all();
  res.json({ products: rows });
});

app.post("/api/products", authRequired, (req, res) => {
  const affiliateLink = safeUrl(req.body?.affiliateLink);
  const title = String(req.body?.title || "").trim();
  const description = String(req.body?.description || "").trim();
  const imageRaw = String(req.body?.image || "").trim();
  const image = imageRaw ? safeUrl(imageRaw) : "";
  const priceRaw = req.body?.price;
  const price = priceRaw === null || priceRaw === undefined || priceRaw === "" ? null : Number(priceRaw);

  if (!affiliateLink) return res.status(400).json({ error: "Link de afiliacao invalido." });
  if (!title) return res.status(400).json({ error: "Titulo obrigatorio." });
  if (imageRaw && !image) return res.status(400).json({ error: "URL da imagem invalida." });
  if (price !== null && Number.isNaN(price)) return res.status(400).json({ error: "Preco invalido." });

  const createdAt = new Date().toISOString();
  const result = db.prepare(
    "INSERT INTO products (affiliate_link, title, price, image, description, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(affiliateLink, title, price, image, description, createdAt);

  const inserted = db.prepare(
    "SELECT id, affiliate_link AS affiliateLink, title, price, image, description, created_at AS createdAt FROM products WHERE id = ?"
  ).get(result.lastInsertRowid);

  return res.status(201).json({ product: inserted });
});

app.delete("/api/products/:id", authRequired, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID invalido." });
  const result = db.prepare("DELETE FROM products WHERE id = ?").run(id);
  if (!result.changes) return res.status(404).json({ error: "Produto nao encontrado." });
  return res.json({ ok: true });
});

app.post("/api/products/resolve-link", authRequired, async (req, res) => {
  const link = safeUrl(req.body?.link);
  if (!link) return res.status(400).json({ error: "Link invalido." });
  const data = await resolveProductDataFromLink(link);
  return res.json({ data });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`CompraTech server running on http://localhost:${PORT}`);
});
