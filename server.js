require("dotenv").config();

const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const dns = require("dns").promises;

const {
  PORT = 3000,
  DB_HOST,
  DB_USER,
  DB_PASS,
  DB_NAME,
  DB_PORT = 5432,
  JWT_SECRET,
  ADMIN_USER,
  ADMIN_PASS,
  CORS_ORIGIN,
  DATABASE_URL,
} = process.env;

if (!JWT_SECRET) {
  console.error("JWT_SECRET nao definido no .env");
  process.exit(1);
}

if (!DATABASE_URL && (!DB_HOST || !DB_USER || !DB_NAME)) {
  console.error("DATABASE_URL ou DB_HOST/DB_USER/DB_NAME sao obrigatorios no .env");
  process.exit(1);
}

const useSsl = Boolean(DATABASE_URL);

async function buildPool() {
  if (DATABASE_URL) {
    const parsed = new URL(DATABASE_URL);
    const { address } = await dns.lookup(parsed.hostname, { family: 4 });
    return new Pool({
      host: address,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, "") || "postgres",
      port: Number(parsed.port) || 5432,
      ssl: { rejectUnauthorized: false },
    });
  }

  const { address } = await dns.lookup(DB_HOST, { family: 4 });
  return new Pool({
    host: address,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    port: Number(DB_PORT),
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });
}

const poolPromise = buildPool().catch((error) => {
  console.error("Falha ao iniciar conexao com o banco:", error);
  process.exit(1);
});

const app = express();

const allowedOrigins = String(CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowAllOrigins = allowedOrigins.length === 0 || allowedOrigins.includes("*");

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowAllOrigins || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin nao permitido pelo CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || allowAllOrigins || allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin || "*");
  }
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  return next();
});

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

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
    const pool = await poolPromise;
    const { rows } = await pool.query(
      "SELECT id, affiliate_link, title, category, price, image, description, created_at FROM products ORDER BY created_at DESC"
    );
    res.json(rows || []);
  } catch (error) {
    console.error("Erro ao carregar produtos:", error);
    res.status(500).json({ error: "Falha ao carregar produtos." });
  }
});

app.post("/api/products", requireAuth, async (req, res) => {
  try {
    const pool = await poolPromise;
    const { affiliate_link, title, image, description, category } = req.body || {};
    const price = toNullableNumber(req.body?.price);

    if (!affiliate_link || !title) {
      return res.status(400).json({ error: "Affiliate_link e titulo sao obrigatorios." });
    }

    const { rows } = await pool.query(
      "INSERT INTO products (affiliate_link, title, category, price, image, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [affiliate_link, title, category || null, price, image || null, description || null]
    );

    res.json({ id: rows?.[0]?.id });
  } catch (error) {
    const message = error?.message === "Preco invalido." ? error.message : "Falha ao salvar produto.";
    res.status(500).json({ error: message });
  }
});

app.put("/api/products/:id", requireAuth, async (req, res) => {
  try {
    const pool = await poolPromise;
    const id = req.params.id;
    const { affiliate_link, title, image, description, category } = req.body || {};
    const price = toNullableNumber(req.body?.price);

    if (!affiliate_link || !title) {
      return res.status(400).json({ error: "Affiliate_link e titulo sao obrigatorios." });
    }

    await pool.query(
      "UPDATE products SET affiliate_link = $1, title = $2, category = $3, price = $4, image = $5, description = $6 WHERE id = $7",
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
    const pool = await poolPromise;
    const id = req.params.id;
    await pool.query("DELETE FROM products WHERE id = $1", [id]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Falha ao remover produto." });
  }
});

app.use(express.static(path.join(__dirname)));

app.listen(Number(PORT), () => {
  console.log(`Servidor CompraTech rodando em http://localhost:${PORT}`);
});
