CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  affiliate_link TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NULL,
  price NUMERIC(12,2) NULL,
  image TEXT NULL,
  description TEXT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  sales INTEGER NOT NULL DEFAULT 0,
  commission_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  commission_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products ADD COLUMN IF NOT EXISTS clicks INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sales INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_pct NUMERIC(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_value NUMERIC(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE products SET clicks = 0 WHERE clicks IS NULL;
UPDATE products SET sales = 0 WHERE sales IS NULL;
UPDATE products SET commission_pct = 0 WHERE commission_pct IS NULL;
UPDATE products SET commission_value = ROUND((COALESCE(price, 0) * COALESCE(commission_pct, 0)) / 100.0, 2)
WHERE commission_value IS NULL;
UPDATE products SET updated_at = NOW() WHERE updated_at IS NULL;

ALTER TABLE products ALTER COLUMN clicks SET DEFAULT 0;
ALTER TABLE products ALTER COLUMN sales SET DEFAULT 0;
ALTER TABLE products ALTER COLUMN commission_pct SET DEFAULT 0;
ALTER TABLE products ALTER COLUMN commission_value SET DEFAULT 0;
ALTER TABLE products ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE products ALTER COLUMN clicks SET NOT NULL;
ALTER TABLE products ALTER COLUMN sales SET NOT NULL;
ALTER TABLE products ALTER COLUMN commission_pct SET NOT NULL;
ALTER TABLE products ALTER COLUMN commission_value SET NOT NULL;
ALTER TABLE products ALTER COLUMN updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION set_products_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.commission_value = ROUND((COALESCE(NEW.price, 0) * COALESCE(NEW.commission_pct, 0)) / 100.0, 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION set_products_updated_at();

CREATE TABLE IF NOT EXISTS product_events (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('click', 'sale')),
  source TEXT NULL,
  order_id TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_events_product_created
ON product_events (product_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_product_events_sale_order
ON product_events (order_id)
WHERE event_type = 'sale' AND order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION track_product_event(
  p_product_id BIGINT,
  p_event_type TEXT,
  p_source TEXT DEFAULT NULL,
  p_order_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  ok BOOLEAN,
  message TEXT,
  clicks INTEGER,
  sales INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type TEXT := LOWER(TRIM(COALESCE(p_event_type, '')));
  v_product_clicks INTEGER := 0;
  v_product_sales INTEGER := 0;
  v_inserted BOOLEAN := FALSE;
BEGIN
  IF p_product_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'product_id obrigatorio', 0, 0;
    RETURN;
  END IF;

  IF v_event_type NOT IN ('click', 'sale') THEN
    RETURN QUERY SELECT FALSE, 'event_type invalido', 0, 0;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_product_id) THEN
    RETURN QUERY SELECT FALSE, 'produto nao encontrado', 0, 0;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO product_events (
      product_id,
      event_type,
      source,
      order_id,
      metadata
    ) VALUES (
      p_product_id,
      v_event_type,
      NULLIF(TRIM(p_source), ''),
      NULLIF(TRIM(p_order_id), ''),
      COALESCE(p_metadata, '{}'::jsonb)
    );
    v_inserted := TRUE;
  EXCEPTION
    WHEN unique_violation THEN
      v_inserted := FALSE;
  END;

  IF v_event_type = 'click' THEN
    IF v_inserted THEN
      UPDATE products
      SET clicks = clicks + 1
      WHERE id = p_product_id
      RETURNING clicks, sales INTO v_product_clicks, v_product_sales;
      RETURN QUERY SELECT TRUE, 'click registrado', v_product_clicks, v_product_sales;
    ELSE
      SELECT clicks, sales
      INTO v_product_clicks, v_product_sales
      FROM products
      WHERE id = p_product_id;
      RETURN QUERY SELECT FALSE, 'click ignorado', v_product_clicks, v_product_sales;
    END IF;
    RETURN;
  END IF;

  IF v_inserted THEN
    UPDATE products
    SET sales = sales + 1
    WHERE id = p_product_id
    RETURNING clicks, sales INTO v_product_clicks, v_product_sales;
    RETURN QUERY SELECT TRUE, 'venda registrada', v_product_clicks, v_product_sales;
  ELSE
    SELECT clicks, sales
    INTO v_product_clicks, v_product_sales
    FROM products
    WHERE id = p_product_id;
    RETURN QUERY SELECT FALSE, 'venda ja registrada', v_product_clicks, v_product_sales;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION track_product_event(BIGINT, TEXT, TEXT, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION track_product_event(BIGINT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
