# CompraTech com Supabase (frontend + painel admin)

## 1) Criar tabela e migrar colunas

No Supabase SQL Editor, execute o arquivo `db-setup.sql` inteiro.

Ele cria/atualiza a tabela `products` com os campos:
- `affiliate_link`, `title`, `category`, `price`, `image`, `description`
- `clicks`, `sales`
- `commission_pct`, `commission_value`
- `created_at`, `updated_at`

Tambem cria:
- `product_events` (historico de eventos `click` e `sale`)
- funcao RPC `track_product_event(...)` com deduplicacao de venda por `order_id`
- `clients` (clientes cadastrados, com `access_code`)
- `client_product_selections` (vinculo cliente x produtos)
- `client_portal_login(...)` e `client_portal_products(...)` para area do cliente

## 2) Habilitar RLS + policies

Rode o `db-setup.sql` completo. Ele agora ja aplica:
- `GRANT` e `RLS` para `products`, `clients` e `client_product_selections`
- policies de leitura/escrita para `authenticated`
- leitura publica (`anon`) apenas em `products`

Se quiser aplicar manualmente, use ao menos:

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

No Supabase: **Authentication -> Users -> Add user**.

## 4) Configurar Supabase no frontend

Edite `supabase-config.js` com:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## 5) Painel admin

`admin.html` + `admin.js` incluem:
- Dashboard com KPIs (produtos, cliques, vendas, comissao total)
- Grafico animado de comissoes por mes
- Cadastro automatico por link afiliado (titulo, preco, imagem, descricao)
- Tentativa de puxar comissao automaticamente do Mercado Livre pelo link/produto
- Gestao completa de produtos (editar, excluir, filtro, busca)
- Cadastro de clientes com codigo de acesso e vinculacao de produtos por nome de cliente
- Calculo automatico de comissao por produto e acumulada
- Notificacoes e atividades recentes
- Template de URL para postback de eventos

Observacao:
- Nao existe comissao fixa no sistema.
- Se a comissao nao vier automaticamente no link/produto, o painel exige preenchimento manual.
- O campo "Comissao fallback (%)" nas configuracoes e opcional.

## 6) Area do cliente (login por nome + codigo)

`cliente.html` + `cliente.js` incluem:
- Login com `nome` + `codigo de acesso`
- Exibicao apenas dos produtos vinculados ao cliente logado
- Filtro por categoria, refresh da lista e logout
- Sem exibicao de comissao

No painel admin:
- Ao cadastrar cliente, o codigo pode ser digitado ou gerado automaticamente
- Na lista de clientes, o codigo pode ser copiado e renovado

## 7) Tracking real por evento

Cliques:
- A vitrine publica registra `click` automaticamente ao abrir o link afiliado.

Vendas:
- Use o endpoint publico `event-track.html` para registrar evento de `sale`.
- URL base (template):
  `https://SEU-DOMINIO/event-track.html?event=sale&product_id={ID}&order_id={ORDER_ID}&source=afiliado`
- `order_id` evita venda duplicada para o mesmo pedido.
- A funcao `track_product_event` ja recebe `GRANT EXECUTE` para `anon` e `authenticated`.

Exemplo:
`https://SEU-DOMINIO/event-track.html?event=sale&product_id=12&order_id=PED123&source=mercado_livre`

## Regra importante

A comissao aparece apenas no ADMIN. A vitrine publica (`index.html` / `mercado-livre.html`) e a area do cliente (`cliente.html`) nao exibem dados de comissao.
