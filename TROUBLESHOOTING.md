# Troubleshooting

## Não aparece “Detalhes/Editar” no Chrome (mas aparece noutro navegador)

Quase sempre é JS antigo em cache. Este projeto força no-cache e quebra de cache via `?v=<BUILD_ID>`, mas valida assim:

1. Abrir `https://SEU-DOMINIO/health` e confirmar `ok`.
2. No dashboard, no rodapé, confirmar que aparece `build-...`.
3. Se ainda estiver desatualizado, confirmar no Railway:
   - se o último deploy ficou como **Success/Live**
   - se o serviço está a fazer deploy do **repo/branch** corretos

## /supabase-config.js dá 404

Faltam variáveis no Railway:

- `CF_SUPABASE_URL`
- `CF_SUPABASE_ANON_KEY`
- `CF_LOGIN_EMAIL`

