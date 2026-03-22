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

CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS access_code TEXT;

UPDATE clients
SET access_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FOR 8))
WHERE access_code IS NULL OR TRIM(access_code) = '';

UPDATE clients
SET access_code = UPPER(REGEXP_REPLACE(access_code, '\s+', '', 'g'))
WHERE access_code IS NOT NULL;

ALTER TABLE clients
ALTER COLUMN access_code
SET DEFAULT UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FOR 8));

ALTER TABLE clients ALTER COLUMN access_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_full_name_ci
ON clients (LOWER(full_name));

CREATE TABLE IF NOT EXISTS client_product_selections (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_client_product_selections_client
ON client_product_selections (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_product_selections_product
ON client_product_selections (product_id, created_at DESC);

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

CREATE OR REPLACE FUNCTION client_portal_login(
  p_full_name TEXT,
  p_access_code TEXT
)
RETURNS TABLE (
  ok BOOLEAN,
  client_id BIGINT,
  client_name TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT := TRIM(COALESCE(p_full_name, ''));
  v_code TEXT := UPPER(TRIM(COALESCE(p_access_code, '')));
  v_client_id BIGINT;
  v_client_name TEXT;
BEGIN
  IF v_name = '' OR v_code = '' THEN
    RETURN QUERY SELECT FALSE, NULL::BIGINT, NULL::TEXT, 'credenciais obrigatorias';
    RETURN;
  END IF;

  SELECT c.id, c.full_name
  INTO v_client_id, v_client_name
  FROM clients c
  WHERE LOWER(c.full_name) = LOWER(v_name)
    AND UPPER(c.access_code) = v_code
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::BIGINT, NULL::TEXT, 'credenciais invalidas';
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, v_client_id, v_client_name, 'acesso liberado';
END;
$$;

CREATE OR REPLACE FUNCTION client_portal_products(
  p_client_id BIGINT,
  p_access_code TEXT
)
RETURNS TABLE (
  id BIGINT,
  affiliate_link TEXT,
  title TEXT,
  category TEXT,
  price NUMERIC(12,2),
  image TEXT,
  description TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id BIGINT := p_client_id;
  v_code TEXT := UPPER(TRIM(COALESCE(p_access_code, '')));
  v_valid BOOLEAN := FALSE;
BEGIN
  IF v_client_id IS NULL OR v_code = '' THEN
    RETURN;
  END IF;

  SELECT TRUE
  INTO v_valid
  FROM clients c
  WHERE c.id = v_client_id
    AND UPPER(c.access_code) = v_code
  LIMIT 1;

  IF NOT COALESCE(v_valid, FALSE) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.affiliate_link,
    p.title,
    p.category,
    p.price,
    p.image,
    p.description,
    p.created_at
  FROM client_product_selections cps
  JOIN products p ON p.id = cps.product_id
  WHERE cps.client_id = v_client_id
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION track_product_event(BIGINT, TEXT, TEXT, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION track_product_event(BIGINT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION client_portal_login(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION client_portal_login(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION client_portal_products(BIGINT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION client_portal_products(BIGINT, TEXT) TO authenticated;

-- Permissoes e RLS/policies para painel admin (produtos, clientes e vinculos).
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON TABLE products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE client_product_selections TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE products_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE clients_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE client_product_selections_id_seq TO authenticated;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_product_selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_public_read ON products;
CREATE POLICY products_public_read
ON products
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS products_auth_insert ON products;
CREATE POLICY products_auth_insert
ON products
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS products_auth_update ON products;
CREATE POLICY products_auth_update
ON products
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS products_auth_delete ON products;
CREATE POLICY products_auth_delete
ON products
FOR DELETE
TO authenticated
USING (true);

DROP POLICY IF EXISTS clients_auth_read ON clients;
CREATE POLICY clients_auth_read
ON clients
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS clients_auth_insert ON clients;
CREATE POLICY clients_auth_insert
ON clients
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS clients_auth_update ON clients;
CREATE POLICY clients_auth_update
ON clients
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS clients_auth_delete ON clients;
CREATE POLICY clients_auth_delete
ON clients
FOR DELETE
TO authenticated
USING (true);

DROP POLICY IF EXISTS client_selections_auth_read ON client_product_selections;
CREATE POLICY client_selections_auth_read
ON client_product_selections
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS client_selections_auth_insert ON client_product_selections;
CREATE POLICY client_selections_auth_insert
ON client_product_selections
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS client_selections_auth_update ON client_product_selections;
CREATE POLICY client_selections_auth_update
ON client_product_selections
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS client_selections_auth_delete ON client_product_selections;
CREATE POLICY client_selections_auth_delete
ON client_product_selections
FOR DELETE
TO authenticated
USING (true);
