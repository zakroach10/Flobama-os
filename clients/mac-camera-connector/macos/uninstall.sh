#!/usr/bin/env bash
set -euo pipefail

LABEL="com.flobama.mac-camera-connector"
PLIST_DST="$HOME/Library/LaunchAgents/${LABEL}.plist"

launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
rm -f "$PLIST_DST"
echo "FloBama Mac Connector launch agent removed."
echo "Config and logs were left in place. Delete clients/mac-camera-connector/mac-camera.config.json to drop the device credential."
