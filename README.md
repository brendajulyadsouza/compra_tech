# CompraTech com Supabase (sem servidor proprio)

## 1) Configurar Supabase

1. Crie um projeto no Supabase.
2. Abra `SQL Editor` e rode `supabase-setup.sql`.
3. Em `Authentication > Users`, crie o usuario admin (email/senha).
4. Em `Project Settings > API`, copie:
   - Project URL
   - anon public key

## 2) Configurar o front

1. Abra `supabase-config.js`.
2. Preencha:
   - `window.SUPABASE_URL`
   - `window.SUPABASE_ANON_KEY`

## 3) Publicar

Publique no Vercel normalmente.

## Como funciona

- `index.html` le os produtos da tabela `products`.
- `admin.html` faz login com Supabase Auth e cadastra/remove produtos.
- Tudo sincroniza para todos os dispositivos.
