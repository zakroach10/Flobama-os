#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_SRC="$ROOT/macos/com.flobama.mac-camera-connector.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.flobama.mac-camera-connector.plist"
LOG_DIR="$HOME/Library/Logs/FloBamaMacConnector"
NODE_BIN="$(command -v node || true)"

if [[ -z "$NODE_BIN" ]]; then
  echo "Node.js is required. Install from https://nodejs.org (LTS) and re-run."
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

if [[ ! -f "$ROOT/mac-camera.config.json" ]]; then
  cp "$ROOT/config.example.json" "$ROOT/mac-camera.config.json"
  echo "Created $ROOT/mac-camera.config.json — set apiBase, then pair before starting."
fi

sed \
  -e "s|__CONNECTOR_DIR__|$ROOT|g" \
  -e "s|__HOME__|$HOME|g" \
  -e "s|/usr/local/bin/node|$NODE_BIN|g" \
  "$PLIST_SRC" > "$PLIST_DST"

launchctl bootout "gui/$(id -u)/com.flobama.mac-camera-connector" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"
launchctl enable "gui/$(id -u)/com.flobama.mac-camera-connector"
launchctl kickstart -k "gui/$(id -u)/com.flobama.mac-camera-connector"

echo "Installed and started FloBama Mac Connector."
echo "Logs: $LOG_DIR"
echo "Disable remote control: set remoteControlEnabled=false in mac-camera.config.json"
