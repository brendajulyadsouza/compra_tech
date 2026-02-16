# CompraTech - Site de Afiliados

## Uso local

1. Abra `index.html` para ver a vitrine.
2. Abra `admin.html` para cadastrar produtos.
3. No ADM, cole o link de afiliacao e salve.

## Publicar online (Passo 1)

### Opcao A: Vercel

1. Suba este projeto para um repositorio GitHub.
2. No painel da Vercel, clique em `Add New Project`.
3. Importe o repositorio e publique.
4. O arquivo `vercel.json` ja esta pronto.

### Opcao B: Netlify

1. Suba este projeto para um repositorio GitHub.
2. No painel da Netlify, clique em `Add new site` -> `Import an existing project`.
3. Escolha o repositorio e publique.
4. O arquivo `netlify.toml` ja esta pronto.

## Observacao importante

- Nesta versao, produtos e login ficam no navegador (`localStorage/sessionStorage`).
- Isso funciona para testes e uso simples, mas nao e backend seguro.

## Proximos passos (2 e 3)

1. Login seguro real com backend.
2. Importacao automatica de produtos com persistencia em banco.
