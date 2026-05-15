# Supabase (Setup)

## O que eu consigo fazer por você

Eu consigo preparar toda a estrutura (SQL, políticas, documentação e código) no projeto local.  
Mas eu **não consigo entrar na sua conta Supabase** nem criar recursos “clicando” por você — isso precisa ser feito no seu painel.

## Passo a passo (do zero)

### 1) Criar o projeto

1. Supabase → **New project**
2. Defina nome, password do database e região
3. Aguarde ficar “Ready”

### 2) Criar o usuário de login (compartilhado)

1. Supabase → **Authentication → Users**
2. **Add user**
3. Crie 1 usuário para os 3 sócios (ex.: um email qualquer) com a senha que você definiu

Se você quiser manter “BKJ” como login visual, a gente mapeia “BKJ → email” no frontend (sem expor segredos).

### 3) Criar tabelas + RLS (SQL)

1. Supabase → **SQL Editor**
2. Cole e rode este script:
   - [SUPABASE.sql](file:///Users/ocelso/Desktop/coldfear/dashboard-spa/SUPABASE.sql)

O script cria:
- `customers`
- `sales`
- `investments`
- triggers de `updated_at`
- RLS + policies para `authenticated`

### 4) Pegar as chaves (para conectar o dashboard)

Supabase → **Project Settings → API**
- `Project URL`
- `anon public key`

Não use `service_role key` no frontend.

## Próximo passo (para eu conectar o dashboard)

Me envie **somente** (pode colar aqui):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Com isso eu implemento no projeto:
- Login via Supabase Auth (no mesmo ecrã que já temos)
- Migração do `localStorage` para Supabase (CRUD de clientes, vendas, investimentos, histórico e métricas)
- Sincronização automática para os 3 sócios

