# CompraTech - Vitrine compartilhada entre dispositivos

## Como funciona agora

- O cadastro no `admin.html` salva no banco SQLite.
- A `index.html` carrega os produtos da API.
- Resultado: os produtos aparecem para todos os dispositivos.

## Rodar local

1. `npm install`
2. `npm start`
3. Abra `http://localhost:3000`

## Login admin

- Usuario e senha estao no arquivo `.env`:
  - `ADMIN_USER`
  - `ADMIN_PASS`

## Arquivos principais

- `server.js` (API + auth + SQLite)
- `admin.js` (painel integrado com API)
- `site.js` (vitrine integrada com API)
