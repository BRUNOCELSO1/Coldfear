# Deploy no Railway (sem bugs de cache)

Este projeto é uma SPA estática (HTML/CSS/JS) servida por um servidor Python simples ([app.py](file:///Users/ocelso/Desktop/coldfear/app.py)).

## Por que às vezes “não atualiza” após o deploy?

1. O Railway/CDN e o navegador podem manter assets estáticos em cache (`app.js`, `styles.css`).
2. Se o cache não for quebrado, o Chrome pode continuar a executar JS antigo mesmo depois do redeploy.

## Como o projeto resolve isso

O servidor [app.py](file:///Users/ocelso/Desktop/coldfear/app.py) faz 3 coisas:

1. Envia headers de **no-cache** para todos os ficheiros.
2. Serve `index.html` de forma dinâmica, injetando `?v=<BUILD_ID>` em:
   - `./app.js`
   - `./styles.css`
3. Expõe endpoints de diagnóstico:
   - `/health` → `ok`
   - `/supabase-config.js` → configuração gerada por variáveis de ambiente

O `BUILD_ID` vem (se existir) de `RAILWAY_GIT_COMMIT_SHA`/`RAILWAY_DEPLOYMENT_ID` e, em último caso, do timestamp de boot.

## Passo a passo

1. Subir o repositório inteiro no GitHub (pasta principal).
2. Railway → New Project → Deploy from GitHub.
3. Em Variables no Railway, definir:
   - `CF_SUPABASE_URL`
   - `CF_SUPABASE_ANON_KEY`
   - `CF_LOGIN_EMAIL`
   - `CF_LOGIN_ALIAS`
4. Redeploy.

## Como validar que atualizou

1. Abrir `https://SEU-DOMINIO/health` → tem de retornar `ok`.
2. Abrir o dashboard e verificar o rodapé:
   - aparece `build-XXXXXXXXXXXX` (build atual do servidor).
3. Abrir `https://SEU-DOMINIO/supabase-config.js` e confirmar URL/anonKey/loginEmail.

