#!/bin/bash
set -euo pipefail

# Prefer a background Terminal session only when launched from Finder without LaunchAgent.
if [[ "${FLOBAMA_LOCAL_RUNNER_TERMINAL:-}" != "1" && "${FLOBAMA_LOCAL_RUNNER_LAUNCHD:-}" != "1" ]]; then
  osascript - "$0" <<'APPLESCRIPT'
on run argv
  set runner to item 1 of argv
  tell application "Terminal"
    activate
    do script "export FLOBAMA_LOCAL_RUNNER_TERMINAL=1; exec " & quoted form of runner
  end tell
end run
APPLESCRIPT
  exit 0
fi

echo "FloBama Local Runner 1.0.4"

APP_ROOT="$(cd "$(dirname "$0")/../Resources/app" && pwd)"
SUPPORT="$HOME/Library/Application Support/FloBama Local Runner"
NODE_HOME="$SUPPORT/node"
CONFIG="$SUPPORT/local-runner.config.json"
NODE_VERSION="v22.22.2"
mkdir -p "$SUPPORT" "/Users/Shared/FloBamaOS/media/blobs" "/Users/Shared/FloBamaOS/media/tmp" 2>/dev/null || true
chmod -R u+rwX,go+rX "/Users/Shared/FloBamaOS" 2>/dev/null || true

if [[ ! -x "$NODE_HOME/bin/node" ]]; then
  echo "Downloading Node.js ${NODE_VERSION}…"
  case "$(uname -m)" in
    arm64) plat="darwin-arm64" ;;
    x86_64) plat="darwin-x64" ;;
    *)
      echo "This Mac architecture is not supported: $(uname -m)"
      exit 1
      ;;
  esac
  tmp="$(mktemp -d)"
  curl -fL "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-${plat}.tar.gz" | tar -xz -C "$tmp"
  rm -rf "$NODE_HOME"
  mv "$tmp/node-${NODE_VERSION}-${plat}" "$NODE_HOME"
  rm -rf "$tmp"
fi

ask() {
  osascript - "$1" "$2" <<'APPLESCRIPT'
on run argv
  try
    set reply to display dialog (item 1 of argv) default answer (item 2 of argv) with title "FloBama Local Runner" buttons {"Cancel", "Continue"} default button "Continue"
    return text returned of reply
  on error
    error number -128
  end try
end run
APPLESCRIPT
}

ask_secret() {
  osascript - "$1" <<'APPLESCRIPT'
on run argv
  try
    set reply to display dialog (item 1 of argv) default answer "" with hidden answer with title "FloBama Local Runner" buttons {"Cancel", "Continue"} default button "Continue"
    return text returned of reply
  on error
    error number -128
  end try
end run
APPLESCRIPT
}

config_has_token() {
  [[ -f "$CONFIG" ]] || return 1
  "$NODE_HOME/bin/node" -e '
    const fs = require("fs");
    try {
      const c = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      process.exit(c.token && String(c.token).trim() ? 0 : 1);
    } catch {
      process.exit(1);
    }
  ' "$CONFIG"
}

write_base_config() {
  local api="$1" host="$2" port="$3" pass="$4"
  "$NODE_HOME/bin/node" -e '
    const fs = require("fs");
    const [file, apiBase, obsHost, obsPort, obsPassword] = process.argv.slice(1);
    let previous = {};
    try { previous = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
    fs.writeFileSync(file, JSON.stringify({
      ...previous,
      apiBase,
      token: previous.token || "",
      deviceId: previous.deviceId || "",
      label: previous.label || "FloBama Local Runner",
      obsHost,
      obsPort,
      obsPassword,
      bindHost: previous.bindHost || "127.0.0.1",
      bindPort: previous.bindPort || 4173,
      cacheRoot: previous.cacheRoot || "/Users/Shared/FloBamaOS/media",
      maxCacheBytes: previous.maxCacheBytes || 40000000000,
      heartbeatMs: previous.heartbeatMs || 2000,
      menubarEnabled: previous.menubarEnabled !== false
    }, null, 2) + "\n");
  ' "$CONFIG" "$api" "$host" "$port" "$pass"
}

pair_with_code() {
  local code="$1"
  echo "Pairing with FloBama OS…"
  if ! (cd "$APP_ROOT" && "$NODE_HOME/bin/node" "$APP_ROOT/index.mjs" --pair --code="$code" "$CONFIG"); then
    echo ""
    echo "Pairing failed."
    echo "1) In FloBama → Screens → Display devices, create a new LED Local Runner code."
    echo "2) Confirm the display_devices SQL migrations were applied in Supabase."
    echo "3) Open this app again (or double-click Reset settings on the DMG first)."
    exit 1
  fi
}

run_setup() {
  echo "Setup needed — no device token yet."
  default_api="https://flobama-os.vercel.app"
  if [[ -f "$CONFIG" ]]; then
    default_api="$("$NODE_HOME/bin/node" -e 'try{const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(c.apiBase||"")}catch{process.stdout.write("")}' "$CONFIG")"
    [[ -n "$default_api" ]] || default_api="https://flobama-os.vercel.app"
  fi
  api="$(ask "FloBama OS address" "$default_api")" || exit 1
  echo ""
  echo "Create a pairing code now:"
  echo "  FloBama OS → Screens → Display devices → kind: LED Local Runner → Create pairing code"
  echo ""
  code=""
  while [[ -z "$code" ]]; do
    code="$(ask "Paste the pairing code from Screens → Display devices" "")" || exit 1
  done
  host="$(ask "OBS WebSocket host" "127.0.0.1")" || exit 1
  port="$(ask "OBS WebSocket port" "4455")" || exit 1
  pass="$(ask_secret "OBS WebSocket password (blank if none)")" || exit 1
  write_base_config "$api" "$host" "$port" "$pass"
  pair_with_code "$code"
}

# Exit code 77 from index.mjs means the saved token was rejected — clear and re-pair.
while true; do
  if ! config_has_token; then
    run_setup
  fi

  if ! config_has_token; then
    echo "Still no token after pairing. Check Screens → Display devices and try Reset settings."
    exit 1
  fi

  echo "Local wall: http://127.0.0.1:4173/wall"
  echo "Point the LED media OBS Browser Source at that URL."
  echo "Logs: ~/Library/Logs/FloBamaLocalRunner/runner.log"
  set +e
  (cd "$APP_ROOT" && "$NODE_HOME/bin/node" "$APP_ROOT/index.mjs" "$CONFIG")
  code=$?
  set -e
  if [[ "$code" -eq 77 ]]; then
    echo ""
    echo "Saved device token was rejected (revoked or expired)."
    echo "Create a new LED Local Runner pairing code, then continue."
    continue
  fi
  exit "$code"
done
