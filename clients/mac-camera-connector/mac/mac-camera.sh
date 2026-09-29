#!/bin/bash
set -euo pipefail

EXPECTED_VERSION="1.4.3"
APP_ROOT="$(cd "$(dirname "$0")/../Resources/app" && pwd)"
SUPPORT="$HOME/Library/Application Support/FloBama Mac Camera"
NODE_HOME="$SUPPORT/node"
CONFIG="$SUPPORT/mac-camera.config.json"
LOG_DIR="$HOME/Library/Logs/FloBamaMacConnector"
LOG_FILE="$LOG_DIR/connector.log"
PID_FILE="$SUPPORT/connector.pid"
NODE_VERSION="v22.22.2"

mkdir -p "$SUPPORT" "$LOG_DIR"

BUNDLE_VERSION="$EXPECTED_VERSION"
if [[ -f "$APP_ROOT/VERSION" ]]; then
  BUNDLE_VERSION="$(tr -d '[:space:]' < "$APP_ROOT/VERSION")"
fi

notify() {
  osascript - "$1" "FloBama Mac Camera ${BUNDLE_VERSION}" <<'APPLESCRIPT' >/dev/null 2>&1 || true
on run argv
  display notification (item 1 of argv) with title (item 2 of argv)
end run
APPLESCRIPT
}

alert() {
  osascript - "$1" "FloBama Mac Camera ${BUNDLE_VERSION}" <<'APPLESCRIPT' >/dev/null 2>&1 || true
on run argv
  display dialog (item 1 of argv) buttons {"OK"} default button "OK" with title (item 2 of argv)
end run
APPLESCRIPT
}

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

log_line() {
  local line="[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1"
  echo "$line" | tee -a "$LOG_FILE" >/dev/null
  echo "$1"
}

# Stop a previous instance started by this app.
if [[ -f "$PID_FILE" ]]; then
  old_pid="$(tr -d '[:space:]' < "$PID_FILE" || true)"
  if [[ -n "${old_pid:-}" ]] && kill -0 "$old_pid" 2>/dev/null; then
    kill "$old_pid" 2>/dev/null || true
    sleep 0.5
  fi
  rm -f "$PID_FILE"
fi

log_line "=========================================="
log_line " FloBama Mac Camera ${BUNDLE_VERSION}"
log_line "=========================================="
log_line "Running as the FloBama Mac Camera app (not Terminal) so Local Network permission can appear for this app."

if [[ "$BUNDLE_VERSION" != "$EXPECTED_VERSION" ]]; then
  alert "This app bundle reports ${BUNDLE_VERSION}, but the launcher expects ${EXPECTED_VERSION}. Delete /Applications/FloBama Mac Camera.app and reinstall from FloBama OS → Cameras."
fi

if [[ ! -x "$NODE_HOME/bin/node" ]]; then
  notify "Downloading Node.js…"
  log_line "Downloading Node.js ${NODE_VERSION}…"
  case "$(uname -m)" in
    arm64) plat="darwin-arm64" ;;
    x86_64) plat="darwin-x64" ;;
    *)
      alert "This Mac architecture is not supported: $(uname -m)"
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
  notify "Installing NDI bindings…"
  log_line "Installing/updating NDI bindings (grandi)…"
  (
    cd "$APP_ROOT"
    npm install --omit=dev --no-fund --no-audit
  ) >>"$LOG_FILE" 2>&1 || log_line "Warning: npm install failed. NDI discovery may be unavailable."
fi

# Probe Local Network while this process is still the FloBama Mac Camera app binary.
log_line "Probing Local Network (allow FloBama Mac Camera if macOS asks)…"
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
  setTimeout(() => process.exit(0), 1500);
' >>"$LOG_FILE" 2>&1 || true

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
  log_line "Pairing with FloBama OS…"
  cd "$APP_ROOT"
  if ! "$NODE_HOME/bin/node" "$APP_ROOT/index.mjs" --pair --code="$code" "$CONFIG" >>"$LOG_FILE" 2>&1; then
    rm -f "$CONFIG"
    alert "Pairing failed. Create a new code in FloBama OS → Cameras, then open this app again. Details: ${LOG_FILE}"
    exit 1
  fi
fi

alert "FloBama Mac Camera ${BUNDLE_VERSION} is running.

Look for Cam ● in the menu bar (click it to see NDI sources).

If macOS asks for Local Network, click Allow for FloBama Mac Camera.
You cannot manually add apps to that list — open this app once so it appears.

Logs: ${LOG_FILE}"

notify "Running — Cam ● in menu bar"
log_line "Connector starting under app process (Local Network subject: FloBama Mac Camera)."

cd "$APP_ROOT"
# Keep this app binary as the parent process so Local Network TCC attaches to the .app,
# not Terminal. Do not exec/replace this shell with node.
"$NODE_HOME/bin/node" "$APP_ROOT/index.mjs" "$CONFIG" >>"$LOG_FILE" 2>&1 &
NODE_PID=$!
echo "$NODE_PID" >"$PID_FILE"
trap 'kill "$NODE_PID" 2>/dev/null || true; rm -f "$PID_FILE"' EXIT INT TERM
wait "$NODE_PID"
exit_code=$?
rm -f "$PID_FILE"
exit "$exit_code"
