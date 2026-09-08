#!/usr/bin/env bash
# Write .env.local from a running local Supabase stack (`npx supabase start`).
set -euo pipefail
cd "$(dirname "$0")/.."

if ! npx supabase status >/dev/null 2>&1; then
  echo "Start the stack first: npm run supabase:start" >&2
  exit 1
fi

eval "$(npx supabase status -o env)"

url="${API_URL:-}"
anon="${ANON_KEY:-${PUBLISHABLE_KEY:-}}"

if [[ -z "$url" || -z "$anon" ]]; then
  echo "Could not read API_URL / ANON_KEY from supabase status." >&2
  exit 1
fi

cat > .env.local <<EOF
# Generated from local Supabase. Do not commit.
NEXT_PUBLIC_SUPABASE_URL=${url}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}
NEXT_PUBLIC_SITE_URL=http://localhost:43123
EOF

echo "Wrote .env.local from local Supabase (${url})"
echo "Restart npm run dev, then create a staff user in Studio (http://127.0.0.1:54323)"
echo "and assign admin with supabase/bootstrap_admin.sql."
