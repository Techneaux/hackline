#!/bin/bash
# Installs Hack Line as a launchd user agent: builds the app, writes the plist,
# and (re)loads the service so it starts at login and stays running on :3000.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.hackline.app"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
NODE_BIN="$(dirname "$(command -v node)")"
LOG_DIR="$APP_DIR/data/logs"

echo "Building production bundle…"
cd "$APP_DIR"
npm run build

mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN/node</string>
    <string>$APP_DIR/node_modules/next/dist/bin/next</string>
    <string>start</string>
    <string>-H</string>
    <string>127.0.0.1</string>
    <string>-p</string>
    <string>3000</string>
  </array>
  <key>WorkingDirectory</key><string>$APP_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$NODE_BIN:/usr/bin:/bin</string>
    <key>NODE_ENV</key><string>production</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG_DIR/hackline.out.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/hackline.err.log</string>
</dict>
</plist>
EOF

echo "Loading service…"
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "Done. Hack Line runs at http://localhost:3000 (starts at login, auto-restarts)."
echo "  stop:    launchctl unload $PLIST"
echo "  start:   launchctl load $PLIST"
echo "  logs:    tail -f $LOG_DIR/hackline.err.log"
echo "  develop: launchctl unload $PLIST && npm run dev"
