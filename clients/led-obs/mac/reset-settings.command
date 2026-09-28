#!/bin/bash
rm -f "$HOME/Library/Application Support/FloBama LED OBS/led-obs.config.json"
osascript -e 'display dialog "Saved booth settings were removed. Open FloBama LED OBS again to enter them." buttons {"OK"} default button "OK" with title "FloBama LED OBS"'
