CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  affiliate_link TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NULL,
  price NUMERIC(12,2) NULL,
  image TEXT NULL,
  description TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
