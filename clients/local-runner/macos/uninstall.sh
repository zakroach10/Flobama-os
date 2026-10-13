#!/usr/bin/env bash
set -euo pipefail

PLIST_DST="$HOME/Library/LaunchAgents/com.flobama.local-runner.plist"
launchctl bootout "gui/$(id -u)/com.flobama.local-runner" 2>/dev/null || true
rm -f "$PLIST_DST"
echo "Removed Local Runner LaunchAgent."
echo "App and media cache were left in place."
