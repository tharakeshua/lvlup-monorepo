#!/usr/bin/env bash
#
# Build a standalone RELEASE APK and push it to Firebase App Distribution.
# No Expo Go, no Metro at runtime — the JS bundle is baked into the APK.
#
# On your phone: install Google's "App Tester" app once (signed in as a tester),
# and every build pushed here shows up there with a one-tap "Update".
#
# Usage:
#   scripts/release-mobile.sh <student|admin|teacher|all> ["release notes"]
#
# Examples:
#   scripts/release-mobile.sh student
#   scripts/release-mobile.sh student "fixed login + new Learn tab"
#   scripts/release-mobile.sh all "weekly drop"
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="lvlup-ff6fa"
GROUP="testers"

# Toolchain — matches the verified setup in apps/mobile-*/PHONE-TEST.md.
# Metro/Gradle must run on Node 20 (NOT 25) and Java 17.
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/platform-tools:/opt/homebrew/opt/node@20/bin:$PATH"

build_one() {
  local app="$1" notes="$2" dir fb_app
  case "$app" in
    student) dir="apps/mobile-student"; fb_app="1:504506746594:android:c4d464e59dc598f05f80bb" ;;
    admin)   dir="apps/mobile-admin";   fb_app="1:504506746594:android:c3d7523940f6f6aa5f80bb" ;;
    teacher) dir="apps/mobile-teacher"; fb_app="1:504506746594:android:7395f4d711a626135f80bb" ;;
    *) echo "✗ Unknown app: $app (use student|admin|teacher|all)"; return 1 ;;
  esac

  echo ""
  echo "════════════════════════════════════════════════════════"
  echo "  $app  →  $dir"
  echo "════════════════════════════════════════════════════════"
  cd "$ROOT/$dir"

  # Managed apps (e.g. teacher) have no native project yet — generate it.
  if [ ! -d android ]; then
    echo "▶ No android/ dir — running expo prebuild…"
    pnpm exec expo prebuild --platform android --no-install
  fi

  echo "▶ Gradle assembleRelease… (first run may auto-install the NDK)"
  ( cd android && ./gradlew assembleRelease )

  local apk="android/app/build/outputs/apk/release/app-release.apk"
  [ -f "$apk" ] || { echo "✗ APK not found at $apk"; return 1; }
  echo "✓ Built $(du -h "$apk" | cut -f1)  →  $dir/$apk"

  echo "▶ Pushing to Firebase App Distribution (group: $GROUP)…"
  firebase appdistribution:distribute "$apk" \
    --app "$fb_app" \
    --groups "$GROUP" \
    --release-notes "$notes" \
    --project "$PROJECT"

  echo "✓ $app pushed — testers in '$GROUP' get a notification in App Tester."
}

main() {
  local target="${1:-}" notes="${2:-Build $(date '+%Y-%m-%d %H:%M')}"
  [ -n "$target" ] || { echo "Usage: scripts/release-mobile.sh <student|admin|teacher|all> [notes]"; exit 1; }

  if [ "$target" = "all" ]; then
    for a in student admin teacher; do build_one "$a" "$notes"; done
  else
    build_one "$target" "$notes"
  fi
  echo ""
  echo "🎉 Done."
}

main "$@"
