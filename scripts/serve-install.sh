#!/bin/bash
# Registers (or removes) the local server with launchd on macOS.
#   npm run serve:install     — serve on :3100, start at login, restart if it dies
#   npm run serve:uninstall
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="dev.neurobase.serve"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
PORT="${NEUROBASE_PORT:-3100}"

if [ "${1:-install}" = "uninstall" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Removed the local server."
  exit 0
fi

# Refusing here beats installing a service that restarts forever against a
# missing build.
if [ ! -f "$PROJECT_DIR/.next/BUILD_ID" ]; then
  echo "No production build in .next. Run 'npm run build' first." >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$PROJECT_DIR/.serve-logs"
cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$PROJECT_DIR/scripts/serve.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NEUROBASE_PORT</key><string>$PORT</string>
  </dict>
  <key>WorkingDirectory</key><string>$PROJECT_DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <!-- Without this a server that cannot start spins as fast as launchd will let it. -->
  <key>ThrottleInterval</key><integer>10</integer>
  <!-- serve.sh does its own logging so it can rotate; these catch what escapes it. -->
  <key>StandardErrorPath</key><string>$PROJECT_DIR/.serve-logs/launchd.err</string>
  <key>StandardOutPath</key><string>$PROJECT_DIR/.serve-logs/launchd.out</string>
</dict>
</plist>
PLISTEOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "NeuroBase installed as a local service on http://localhost:$PORT"
echo "  Status:  launchctl print gui/$(id -u)/$LABEL | head -20"
echo "  Logs:    tail -f $PROJECT_DIR/.serve-logs/serve.log"
echo "  Restart: launchctl kickstart -k gui/$(id -u)/$LABEL"
echo "  Remove:  npm run serve:uninstall"
