#!/usr/bin/env bash
# Capture current screen + recent error logs from the connected OnePlus.
# Usage: ./.bug-capture.sh <bug-slug>
set -euo pipefail
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
SLUG="${1:-bug}"
OUT="/tmp/lvlup-bugs/$SLUG"
mkdir -p "$OUT"
TS=$(date +%H%M%S)

# Screenshot
"$ADB" exec-out screencap -p > "$OUT/screen-$TS.png" 2>/dev/null && \
  echo "screenshot: $OUT/screen-$TS.png"

# Recent logcat: ReactNative/Expo/JS errors + crashes, last buffer dump
"$ADB" logcat -d -t 800 2>/dev/null | \
  grep -iE "ReactNative|ReactNativeJS|ExpoModules|AndroidRuntime|FATAL|Error|Exception|Hermes|levelup|firebase" \
  > "$OUT/logcat-$TS.txt" || true
echo "logcat: $OUT/logcat-$TS.txt ($(wc -l < "$OUT/logcat-$TS.txt") lines)"
