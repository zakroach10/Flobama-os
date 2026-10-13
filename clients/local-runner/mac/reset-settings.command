#!/bin/bash
set -euo pipefail
SUPPORT="$HOME/Library/Application Support/FloBama Local Runner"
rm -f "$SUPPORT/local-runner.config.json" "$SUPPORT/status.json"
echo "Cleared Local Runner settings in:"
echo "  $SUPPORT"
echo "Media cache under /Users/Shared/FloBamaOS/media was kept."
echo "Open FloBama Local Runner again to re-pair."
read -r -p "Press Return to close…"
