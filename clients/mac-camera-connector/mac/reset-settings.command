#!/bin/bash
rm -f "$HOME/Library/Application Support/FloBama Mac Camera/mac-camera.config.json"
osascript -e 'display dialog "Saved Mac Camera pairing was removed. Open FloBama Mac Camera again to enter a new pairing code." buttons {"OK"} default button "OK" with title "FloBama Mac Camera"'
