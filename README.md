# LM-3D Commerce

Base do e-commerce da LM-3D para venda de impressões 3D prontas e personalizadas.

## Estrutura

- `apps/web`: storefront e painel admin em Next.js.
- `apps/api`: backend Express para operações sensíveis, checkout e webhooks.
- `packages/shared`: tipos, status e utilitários compartilhados.
- `supabase`: migrations e políticas RLS.

## Como rodar localmente

```bash
npm install
npm run dev:web
```

Em outro terminal:

```bash
npm run dev:api
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha somente o que for necessário para a fase atual.

Credenciais sensiveis como `SUPABASE_SERVICE_ROLE_KEY` e `MERCADO_PAGO_ACCESS_TOKEN` devem existir apenas no backend.

## Deploy

- GitHub Pages publica o frontend estático usando `.github/workflows/pages.yml`.
- Render pode publicar o backend usando `render.yaml`.
- Depois do deploy do backend, configure `NEXT_PUBLIC_API_URL` no GitHub/Vercel apontando para `https://seu-backend.onrender.com/api`.
- No Render, preencha as variáveis marcadas como secretas no painel. Mercado Pago fica pendente até a fase final.

## Fases

1. Estrutura base, rotas e layout.
2. Supabase/Postgres, migrations, RLS e modelos.
3. Admin protegido.
4. CRUD de produtos e categorias.
5. Vitrine pública.
6. Carrinho.
7. Mercado Pago.
8. Webhooks e status de pedido.
9. Calculadora de preço.
10. Polimento UX, copy e responsividade.
11. Segurança, testes e deploy.
