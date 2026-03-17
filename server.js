require("dotenv").config();

const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const {
  PORT = 3000,
  DB_HOST,
  DB_USER,
  DB_PASS,
  DB_NAME,
  DB_PORT = 3306,
  JWT_SECRET,
  ADMIN_USER,
  ADMIN_PASS,
  CORS_ORIGIN,
} = process.env;

if (!JWT_SECRET) {
  console.error("JWT_SECRET nao definido no .env");
  process.exit(1);
}

if (!DB_HOST || !DB_USER || !DB_NAME) {
  console.error("DB_HOST, DB_USER e DB_NAME sao obrigatorios no .env");
  process.exit(1);
}

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  port: Number(DB_PORT),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const app = express();

if (CORS_ORIGIN) {
  app.use(cors({ origin: CORS_ORIGIN }));
}

app.use(express.json({ limit: "1mb" }));

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Nao autorizado." });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Sessao expirada." });
  }
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (Number.isNaN(num)) throw new Error("Preco invalido.");
  return num;
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/login", (req, res) => {
  const user = String(req.body?.user || "").trim();
  const pass = String(req.body?.pass || "");

  if (!ADMIN_USER || !ADMIN_PASS) {
    return res.status(500).json({ error: "ADMIN_USER/ADMIN_PASS nao definidos." });
  }

  if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
    return res.status(401).json({ error: "Credenciais invalidas." });
  }

  const token = jwt.sign({ user: ADMIN_USER }, JWT_SECRET, { expiresIn: "7d" });
  return res.json({ token });
});

app.get("/api/auth/check", requireAuth, (req, res) => {
  res.json({ ok: true });
});

app.get("/api/products", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, affiliate_link, title, category, price, image, description, created_at FROM products ORDER BY created_at DESC"
    );
    res.json(rows || []);
  } catch (error) {
    res.status(500).json({ error: "Falha ao carregar produtos." });
  }
});

app.post("/api/products", requireAuth, async (req, res) => {
  try {
    const { affiliate_link, title, image, description, category } = req.body || {};
    const price = toNullableNumber(req.body?.price);

    if (!affiliate_link || !title) {
      return res.status(400).json({ error: "Affiliate_link e titulo sao obrigatorios." });
    }

    const [result] = await pool.query(
      "INSERT INTO products (affiliate_link, title, category, price, image, description) VALUES (?, ?, ?, ?, ?, ?)",
      [affiliate_link, title, category || null, price, image || null, description || null]
    );

    res.json({ id: result.insertId });
  } catch (error) {
    const message = error?.message === "Preco invalido." ? error.message : "Falha ao salvar produto.";
    res.status(500).json({ error: message });
  }
});

app.put("/api/products/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { affiliate_link, title, image, description, category } = req.body || {};
    const price = toNullableNumber(req.body?.price);

    if (!affiliate_link || !title) {
      return res.status(400).json({ error: "Affiliate_link e titulo sao obrigatorios." });
    }

    await pool.query(
      "UPDATE products SET affiliate_link = ?, title = ?, category = ?, price = ?, image = ?, description = ? WHERE id = ?",
      [affiliate_link, title, category || null, price, image || null, description || null, id]
    );

    res.json({ ok: true });
  } catch (error) {
    const message = error?.message === "Preco invalido." ? error.message : "Falha ao atualizar produto.";
    res.status(500).json({ error: message });
  }
});

app.delete("/api/products/:id", requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await pool.query("DELETE FROM products WHERE id = ?", [id]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Falha ao remover produto." });
  }
});

app.use(express.static(path.join(__dirname)));

app.listen(Number(PORT), () => {
  console.log(`Servidor CompraTech rodando em http://localhost:${PORT}`);
});