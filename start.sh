#!/usr/bin/env sh
set -eu

ROOT_DIR="${ROOT_DIR:-dashboard-spa}"
CFG_FILE="${ROOT_DIR}/supabase-config.js"

if [ -n "${CF_SUPABASE_URL:-}" ] && [ -n "${CF_SUPABASE_ANON_KEY:-}" ] && [ -n "${CF_LOGIN_EMAIL:-}" ]; then
  cat > "${CFG_FILE}" <<EOF
window.CF_SUPABASE = {
  url: "${CF_SUPABASE_URL}",
  anonKey: "${CF_SUPABASE_ANON_KEY}",
  loginAlias: "${CF_LOGIN_ALIAS:-BKJ}",
  loginEmail: "${CF_LOGIN_EMAIL}"
}
EOF
fi

PORT="${PORT:-8080}"
exec python3 -m http.server "${PORT}" --bind 0.0.0.0 --directory "${ROOT_DIR}"
