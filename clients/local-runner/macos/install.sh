#!/usr/bin/env bash
set -euo pipefail

APP="${1:-/Applications/FloBama Local Runner.app}"
MACOS="$APP/Contents/MacOS"
PLIST_SRC="$(cd "$(dirname "$0")" && pwd)/com.flobama.local-runner.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.flobama.local-runner.plist"
LOG_DIR="$HOME/Library/Logs/FloBamaLocalRunner"

if [[ ! -x "$MACOS/local-runner" ]]; then
  echo "Install FloBama Local Runner.app to Applications first (or pass the .app path)."
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"
sed \
  -e "s|__APP_MACOS__|$MACOS|g" \
  -e "s|__HOME__|$HOME|g" \
  "$PLIST_SRC" > "$PLIST_DST"

launchctl bootout "gui/$(id -u)/com.flobama.local-runner" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"
launchctl enable "gui/$(id -u)/com.flobama.local-runner"
launchctl kickstart -k "gui/$(id -u)/com.flobama.local-runner"

echo "Installed LaunchAgent com.flobama.local-runner (starts at login)."
echo "Logs: $LOG_DIR"
