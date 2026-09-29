#!/bin/bash
set -euo pipefail

EXPECTED_VERSION="1.4.1"

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

APP_ROOT="$(cd "$(dirname "$0")/../Resources/app" && pwd)"
SUPPORT="$HOME/Library/Application Support/FloBama Mac Camera"
NODE_HOME="$SUPPORT/node"
CONFIG="$SUPPORT/mac-camera.config.json"
NODE_VERSION="v22.22.2"
mkdir -p "$SUPPORT"
mkdir -p "$HOME/Library/Logs/FloBamaMacConnector"

BUNDLE_VERSION="$EXPECTED_VERSION"
if [[ -f "$APP_ROOT/VERSION" ]]; then
  BUNDLE_VERSION="$(tr -d '[:space:]' < "$APP_ROOT/VERSION")"
fi

echo "=========================================="
echo " FloBama Mac Camera ${BUNDLE_VERSION}"
echo "=========================================="
if [[ "$BUNDLE_VERSION" != "$EXPECTED_VERSION" ]]; then
  echo "WARNING: launcher expects ${EXPECTED_VERSION} but app bundle reports ${BUNDLE_VERSION}."
  echo "Delete /Applications/FloBama Mac Camera.app and reinstall from Cameras → Download."
fi
if [[ "$BUNDLE_VERSION" != "1.4.1" && "$BUNDLE_VERSION" != "1.4.0" ]]; then
  echo ""
  echo "This looks like an OLD install (not 1.4.x)."
  echo "NDI discovery will not work until you replace the app:"
  echo "  1) Quit this Terminal window"
  echo "  2) Eject any old FloBama Mac Camera disks"
  echo "  3) Delete /Applications/FloBama Mac Camera.app"
  echo "  4) Download Mac Camera 1.4.1 from FloBama OS → Cameras"
  echo "  5) Drag the NEW app into Applications, then open it"
  echo ""
fi

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

export PATH="$NODE_HOME/bin:$PATH"
if [[ -f "$APP_ROOT/package.json" ]]; then
  echo "Installing/updating NDI bindings (grandi)…"
  (
    cd "$APP_ROOT"
    npm install --omit=dev --no-fund --no-audit
  ) || echo "Warning: npm install failed. NDI discovery may be unavailable until dependencies install."
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

echo ""
echo "NDI discovery needs Local Network permission for Terminal (this window)."
echo "If macOS shows a Local Network prompt, click Allow."
echo "Otherwise open: System Settings → Privacy & Security → Local Network → enable Terminal."
echo ""
open "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_LocalNetwork" 2>/dev/null \
  || open "x-apple.systempreferences:com.apple.preference.security?Privacy_LocalNetwork" 2>/dev/null \
  || true
"$NODE_HOME/bin/node" -e '
  const dgram = require("dgram");
  const s = dgram.createSocket({ type: "udp4", reuseAddr: true });
  s.on("error", () => process.exit(0));
  s.bind(0, () => {
    try { s.setBroadcast(true); } catch {}
    const buf = Buffer.from("FloBama-Mac-Camera-local-network-probe");
    s.send(buf, 0, buf.length, 5353, "224.0.0.251", () => {
      try { s.close(); } catch {}
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(0), 1200);
' || true

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

echo "FloBama Mac Camera ${BUNDLE_VERSION} is running. Leave this window open during shows."
echo "In FloBama OS → Cameras, Mac connector should show Connector ${BUNDLE_VERSION}."
echo "To re-pair, double-click Reset settings on the disk image, then open this app again."
echo "If NDI cameras do not appear: enable Local Network for Terminal, then restart this app."
cd "$APP_ROOT"
exec "$NODE_HOME/bin/node" "$APP_ROOT/index.mjs" "$CONFIG"
