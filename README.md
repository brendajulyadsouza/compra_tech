# CompraTech com PostgreSQL + Node

## 1) Criar a base e tabela

Crie o banco no PostgreSQL e rode `db-setup.sql`.

## 2) Configurar .env

Edite `.env` com os dados do seu PostgreSQL (ou use `DATABASE_URL` no Render):

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASS`
- `DATABASE_URL` (opcional)

Defina tambem:
- `ADMIN_USER`
- `ADMIN_PASS`
- `JWT_SECRET`

## 3) Instalar dependencias

```bash
npm install
```

## 4) Rodar servidor

```bash
npm run dev
```

Acesse:
- Vitrine: `http://localhost:3000/index.html`
- Admin: `http://localhost:3000/admin.html`

## Como funciona

- `server.js` expoe a API e serve os arquivos estaticos.
- `admin.html` faz login via `/api/login` e cadastra/remove produtos.
- `index.html` e `mercado-livre.html` consomem `/api/products`.
