# LM-3D Commerce

Base do e-commerce da LM-3D para venda de impressoes 3D prontas e personalizadas.

## Estrutura

- `apps/web`: storefront e painel admin em Next.js.
- `apps/api`: backend Express para operacoes sensiveis, checkout e webhooks.
- `packages/shared`: tipos, status e utilitarios compartilhados.
- `supabase`: migrations e politicas RLS nas proximas fases.

## Como rodar localmente

```bash
npm install
npm run dev:web
```

Em outro terminal:

```bash
npm run dev:api
```

## Variaveis de ambiente

Copie `.env.example` para `.env` e preencha somente o que for necessario para a fase atual.

Credenciais sensiveis como `SUPABASE_SERVICE_ROLE_KEY` e `MERCADO_PAGO_ACCESS_TOKEN` devem existir apenas no backend.

## Fases

1. Estrutura base, rotas e layout.
2. Supabase/Postgres, migrations, RLS e modelos.
3. Admin protegido.
4. CRUD de produtos e categorias.
5. Vitrine publica.
6. Carrinho.
7. Mercado Pago.
8. Webhooks e status de pedido.
9. Calculadora de preco.
10. Polimento UX, copy e responsividade.
11. Seguranca, testes e deploy.
