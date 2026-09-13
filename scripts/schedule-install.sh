#!/bin/bash
# Registers (or removes) the weekly refresh with launchd on macOS.
#   npm run schedule:install     — every Sunday at 06:00 local time
#   npm run schedule:uninstall
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="dev.neurobase.refresh"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

if [ "${1:-install}" = "uninstall" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Removed the weekly refresh."
  exit 0
fi

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$PROJECT_DIR/scripts/refresh.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key><integer>0</integer>
    <key>Hour</key><integer>6</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>WorkingDirectory</key><string>$PROJECT_DIR</string>
  <key>StandardErrorPath</key><string>$PROJECT_DIR/.refresh-logs/launchd.err</string>
  <key>StandardOutPath</key><string>$PROJECT_DIR/.refresh-logs/launchd.out</string>
  <!-- Runs at the next opportunity if the machine was asleep at the scheduled time. -->
  <key>RunAtLoad</key><false/>
</dict>
</plist>
PLISTEOF

mkdir -p "$PROJECT_DIR/.refresh-logs"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Weekly refresh installed: Sundays at 06:00 local time."
echo "  Check it:   launchctl print gui/$(id -u)/$LABEL | head -20"
echo "  Run it now: bash $PROJECT_DIR/scripts/refresh.sh"
echo "  Remove it:  npm run schedule:uninstall"
