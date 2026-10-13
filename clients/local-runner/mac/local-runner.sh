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

echo "FloBama Local Runner 1.0.0"

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

if [[ ! -f "$CONFIG" ]]; then
  api="$(ask "FloBama OS address" "https://flobama-os.vercel.app")" || exit 1
  code=""
  while [[ -z "$code" ]]; do
    code="$(ask "Pairing code from Screens → Display devices (LED Local Runner)" "")" || exit 1
  done
  host="$(ask "OBS WebSocket host" "127.0.0.1")" || exit 1
  port="$(ask "OBS WebSocket port" "4455")" || exit 1
  pass="$(ask_secret "OBS WebSocket password")" || exit 1
  "$NODE_HOME/bin/node" -e '
    const fs = require("fs");
    const [file, apiBase, obsHost, obsPort, obsPassword] = process.argv.slice(1);
    fs.writeFileSync(file, JSON.stringify({
      apiBase,
      token: "",
      deviceId: "",
      label: "FloBama Local Runner",
      obsHost,
      obsPort,
      obsPassword,
      bindHost: "127.0.0.1",
      bindPort: 4173,
      cacheRoot: "/Users/Shared/FloBamaOS/media",
      maxCacheBytes: 40000000000,
      heartbeatMs: 2000,
      menubarEnabled: true
    }, null, 2) + "\n");
  ' "$CONFIG" "$api" "$host" "$port" "$pass"
  echo "Pairing with FloBama OS…"
  (cd "$APP_ROOT" && "$NODE_HOME/bin/node" "$APP_ROOT/index.mjs" --pair --code="$code" "$CONFIG")
fi

echo "Local wall: http://127.0.0.1:4173/wall"
echo "Point the LED media OBS Browser Source at that URL."
echo "Logs: ~/Library/Logs/FloBamaLocalRunner/runner.log"
cd "$APP_ROOT"
exec "$NODE_HOME/bin/node" "$APP_ROOT/index.mjs" "$CONFIG"
