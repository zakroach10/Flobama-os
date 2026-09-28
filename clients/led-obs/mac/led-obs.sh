#!/bin/bash
set -euo pipefail

if [[ "${FLOBAMA_LED_OBS_TERMINAL:-}" != "1" ]]; then
  osascript - "$0" <<'APPLESCRIPT'
on run argv
  set runner to item 1 of argv
  tell application "Terminal"
    activate
    do script "export FLOBAMA_LED_OBS_TERMINAL=1; exec " & quoted form of runner
  end tell
end run
APPLESCRIPT
  exit 0
fi

echo "FloBama LED OBS 1.0.1"

APP_ROOT="$(cd "$(dirname "$0")/../Resources/app" && pwd)"
SUPPORT="$HOME/Library/Application Support/FloBama LED OBS"
NODE_HOME="$SUPPORT/node"
CONFIG="$SUPPORT/led-obs.config.json"
NODE_VERSION="v22.22.2"
mkdir -p "$SUPPORT"

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
    set reply to display dialog (item 1 of argv) default answer (item 2 of argv) with title "FloBama LED OBS" buttons {"Cancel", "Continue"} default button "Continue"
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
    set reply to display dialog (item 1 of argv) default answer "" with hidden answer with title "FloBama LED OBS" buttons {"Cancel", "Continue"} default button "Continue"
    return text returned of reply
  on error
    error number -128
  end try
end run
APPLESCRIPT
}

if [[ ! -f "$CONFIG" ]]; then
  api="$(ask "FloBama OS address" "https://flobama-os.vercel.app")" || exit 1
  token=""
  while [[ -z "$token" ]]; do
    token="$(ask "Booth token from Screens, then LED wall" "")" || exit 1
  done
  host="$(ask "OBS WebSocket host" "127.0.0.1")" || exit 1
  port="$(ask "OBS WebSocket port" "4455")" || exit 1
  pass="$(ask_secret "OBS WebSocket password")" || exit 1
  "$NODE_HOME/bin/node" -e '
    const fs = require("fs");
    const [file, apiBase, token, obsHost, obsPort, obsPassword] = process.argv.slice(1);
    fs.writeFileSync(file, JSON.stringify({ apiBase, token, obsHost, obsPort, obsPassword }, null, 2) + "\n");
  ' "$CONFIG" "$api" "$token" "$host" "$port" "$pass"
fi

echo "FloBama LED OBS is running. Leave this window open next to OBS."
echo "To enter a new token, double-click Reset settings on the disk image, then open this app again."
cd "$APP_ROOT"
exec "$NODE_HOME/bin/node" "$APP_ROOT/index.mjs" "$CONFIG"
