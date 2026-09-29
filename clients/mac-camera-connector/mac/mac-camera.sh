#!/bin/bash
set -euo pipefail

if [[ "${FLOBAMA_MAC_CAMERA_TERMINAL:-}" != "1" ]]; then
  osascript - "$0" <<'APPLESCRIPT'
on run argv
  set runner to item 1 of argv
  tell application "Terminal"
    activate
    do script "export FLOBAMA_MAC_CAMERA_TERMINAL=1; exec " & quoted form of runner
  end tell
end run
APPLESCRIPT
  exit 0
fi

echo "FloBama Mac Camera 1.1.0"

APP_ROOT="$(cd "$(dirname "$0")/../Resources/app" && pwd)"
SUPPORT="$HOME/Library/Application Support/FloBama Mac Camera"
NODE_HOME="$SUPPORT/node"
CONFIG="$SUPPORT/mac-camera.config.json"
NODE_VERSION="v22.22.2"
mkdir -p "$SUPPORT"
mkdir -p "$HOME/Library/Logs/FloBamaMacConnector"

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
    set reply to display dialog (item 1 of argv) default answer (item 2 of argv) with title "FloBama Mac Camera" buttons {"Cancel", "Continue"} default button "Continue"
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
    code="$(ask "Pairing code from FloBama OS → Cameras" "")" || exit 1
  done
  label="$(ask "Mac label" "FloBama Mac")" || exit 1
  "$NODE_HOME/bin/node" -e '
    const fs = require("fs");
    const [file, apiBase, label] = process.argv.slice(1);
    fs.writeFileSync(file, JSON.stringify({
      apiBase,
      token: "",
      deviceId: "",
      label,
      remoteControlEnabled: true,
      useSimulatedCameras: true,
      menubarEnabled: true,
      pollMs: 750,
      moveWatchdogMs: 1200,
      logDir: "~/Library/Logs/FloBamaMacConnector"
    }, null, 2) + "\n");
  ' "$CONFIG" "$api" "$label"
  echo "Pairing with FloBama OS…"
  cd "$APP_ROOT"
  if ! "$NODE_HOME/bin/node" "$APP_ROOT/index.mjs" --pair --code="$code" "$CONFIG"; then
    rm -f "$CONFIG"
    echo "Pairing failed. Open Cameras in FloBama OS for a new code, then try again."
    exit 1
  fi
fi

echo "FloBama Mac Camera is running. Leave this window open during shows."
echo "To re-pair, double-click Reset settings on the disk image, then open this app again."
echo "To disable remote PTZ locally, edit mac-camera.config.json and set remoteControlEnabled to false."
cd "$APP_ROOT"
exec "$NODE_HOME/bin/node" "$APP_ROOT/index.mjs" "$CONFIG"
