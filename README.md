# CompraTech com Supabase (somente frontend)

## 1) Criar projeto no Supabase

Crie o projeto e a tabela `products` no Supabase. Execute:

```sql
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
```

## 2) Habilitar RLS + policies

Ative RLS na tabela `products` e rode:

```sql
create policy "public read"
on public.products
for select
to anon
using (true);

create policy "authenticated insert"
on public.products
for insert
to authenticated
with check (true);

create policy "authenticated update"
on public.products
for update
to authenticated
using (true);

create policy "authenticated delete"
on public.products
for delete
to authenticated
using (true);
```

## 3) Criar usuario admin

No Supabase: **Authentication → Users → Add user**.

## 4) Configurar Supabase no frontend

Edite `supabase-config.js` com:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## 5) Publicar

Hospede o projeto como site estatico (Vercel, Netlify, etc.).

## Como funciona

- `admin.html` autentica via Supabase Auth.
- `admin.js` cadastra/remove produtos direto no Supabase.
- `index.html` e `mercado-livre.html` leem produtos direto do Supabase.
