# LevelUp Student — Test on a Real Phone (Expo Go)

The app runs against **PROD `lvlup-ff6fa`** (region `asia-south1`, `v2_` seeded
data). A physical phone can't reach `localhost` emulators, so the build points
at the real backend by default (`.env` → `EXPO_PUBLIC_USE_EMULATORS=false`).

No custom native code is used beyond what Expo Go bundles (`react-native-svg`
ships in Expo Go; `lucide-react-native` is pure JS) — so **Expo Go works; no dev
build needed.**

> For a **native Android dev build** installed straight onto a USB-connected
> phone (no Expo Go), see
> [§A. Android native dev build](#a-android-native-dev-build-onthe-device) below
> — this is the path verified on the OnePlus 12.

---

## A. Android native dev build (on-the-device)

Verified end-to-end on a **OnePlus 12 (CPH2573)**, adb device `2f281218`, on
2026-06-26: build → install → launch → authenticated → real courses on the Learn
tab.

### Prereqs (this machine)

- **Node 20** on PATH (`/opt/homebrew/opt/node@20/bin`) — Expo/Metro must NOT
  run on Node 25.
- `ANDROID_HOME=$HOME/Library/Android/sdk`, **Java 17**, `adb` at
  `$ANDROID_HOME/platform-tools`.
- SDK platforms 35/36 + build-tools; the Gradle build auto-installs **NDK
  26.1.10909125** on first run (one-time ~minutes download). `android/` is
  already prebuilt (Expo prebuild).
- Phone in **Developer mode → USB debugging ON**, plugged in, RSA prompt
  **authorized** (`adb devices` shows it as `device`, not `unauthorized`).

### Build + install + launch (one command)

```bash
cd apps/mobile-student
ANDROID_HOME=$HOME/Library/Android/sdk \
PATH="$ANDROID_HOME/platform-tools:/opt/homebrew/opt/node@20/bin:$PATH" \
pnpm exec expo run:android
```

`expo run:android` runs Gradle `app:assembleDebug` → installs the **debug APK**
(`android/app/build/outputs/apk/debug/app-debug.apk`, ~68 MB, package
**`academy.levelup.student`**) → launches `MainActivity`. Gradle resumes from
cache, so a re-run after a stall continues rather than rebuilding. **Never run
two builds at once** (Gradle holds an exclusive lock) — if one is already in
flight (`ps aux | grep -i gradle`), let it finish.

### Point the device at the Metro dev server

A **debug** build loads its JS bundle from Metro at runtime. Either keep the
phone on the **same Wi-Fi** as this machine, or (more reliable over USB) forward
the port:

```bash
adb -s 2f281218 reverse tcp:8081 tcp:8081   # device localhost:8081 → this machine's Metro
adb -s 2f281218 reverse --list              # expect: UsbFfs tcp:8081 tcp:8081
```

Start Metro if it isn't up (prod target, Node 20):

```bash
PATH="/opt/homebrew/opt/node@20/bin:$PATH" pnpm exec expo start --port 8081
```

`adb reverse` is cleared by unplug/reboot — re-assert it after reconnecting.

### Verify on device

```bash
adb -s 2f281218 shell monkey -p academy.levelup.student -c android.intent.category.LAUNCHER 1
adb -s 2f281218 exec-out screencap -p > /tmp/shot.png   # eyeball the screen
adb -s 2f281218 logcat -d | grep ReactNativeJS           # JS logs ('Running "main"', firebase line)
```

A healthy boot logs `Running "main" ... fabric:true` and
`[firebase] live project lvlup-ff6fa region asia-south1` (confirms **PROD**).

### Gotchas seen on the OnePlus 12

- **`adb reverse` is per-connection** — re-run it after any
  unplug/`pm clear`/reinstall.
- **`pm clear` may not take** on this OEM build — to fully wipe persisted
  auth/AsyncStorage,
  `adb uninstall academy.levelup.student && adb install -r <apk>` instead.
- **Dev-only auto-login:** the Metro process here exports
  `EXPO_PUBLIC_AUTOLOGIN_EMAIL` / `EXPO_PUBLIC_AUTOLOGIN_PASSWORD` (Metro
  inlines `EXPO_PUBLIC_*` into the bundle). When set, `SessionProvider` signs in
  automatically and the gate skips the login screen straight to the learner
  tabs. To exercise the **login screen UI manually**, unset those two vars and
  restart Metro (`--clear`).
- **Home tab dev red box (`ApiError: not-found`):** the Home dashboard's
  gamification/summary queries (`useStudentSummary` / `useStudentLevel`) 404 for
  a student whose summary/level docs aren't seeded in `v2_` on prod. It's caught
  by `withScreenBoundary` / `ApiErrorBoundary` (graceful fallback in prod), but
  **dev mode surfaces caught errors as a LogBox red box** — tap **Minimize** to
  dismiss. The **Learn tab** uses the same boundary and renders the real spaces
  fine, so this is a seed gap, not an install/build failure.

---

## 1. Install Expo Go on your phone

- **iOS:** App Store → "Expo Go"
  (https://apps.apple.com/app/expo-go/id982107779)
- **Android:** Play Store → "Expo Go"
  (https://play.google.com/store/apps/details?id=host.exp.exponent)

Phone and computer must be on the **same Wi-Fi network**. (If they aren't, start
with `--tunnel` — see Troubleshooting.)

## 2. Start the dev server (on this machine)

```bash
cd apps/mobile-student
# Expo/Metro must run on Node 20 (not the default Node 25):
PATH="/opt/homebrew/opt/node@20/bin:$PATH" pnpm exec expo start
```

This prints a **QR code** and a URL like `exp://192.168.x.x:8081` in the
terminal.

> The `.env` already sets the prod target. To double-check it's live, the banner
> should NOT say "emulators". To force-confirm:
> `EXPO_PUBLIC_USE_EMULATORS=false`.

## 3. Scan the QR

- **iOS:** open the **Camera** app, point at the QR, tap the "Open in Expo Go"
  banner.
- **Android:** open **Expo Go** → "Scan QR code".

The JS bundle builds (first load ~30–60s), then the app opens on your phone.

## 4. Log in

```
Email:    nandini@learner.dev
Password: Student@123
```

## 5. Tap path to the seeded DSA space (the proof)

1. App opens on **Home** (bottom tab bar: Home · Learn · Tests · Progress ·
   Profile).
2. Tap the **Learn** tab → "My Spaces" list loads from the live callable SDK.
3. You should see **5 seeded spaces**, including **"Data Structures &
   Algorithms"**.
4. Tap **Data Structures & Algorithms** → space-detail learning track (story
   points).
5. Tap a story point → **learning content viewer** (materials + question items).

That confirms the full path: phone → Expo Go → fat callable SDK → `lvlup-ff6fa`
→ seeded v2 data.

---

## QR / URL (LIVE)

- **Dev server is running** (Metro on port 8081, prod target).
- **Scan this URL in Expo Go:** `exp://192.168.1.5:8081`
  - iOS: Camera app → point at the QR → "Open in Expo Go".
  - Android: Expo Go → "Scan QR code". Or in Expo Go, tap "Enter URL manually"
    and paste `exp://192.168.1.5:8081`.
- The QR encodes exactly that URL. When you run `expo start` yourself (§2), the
  scannable QR also prints in your terminal.
- ⚠️ `192.168.1.5` is this machine's LAN IP — your phone must be on the **same
  Wi-Fi**. If it isn't, restart with `--tunnel` (see Troubleshooting) and use
  the tunnel URL it prints.

---

## Troubleshooting

- **Phone can't connect / different networks:** run with a tunnel:
  `PATH="/opt/homebrew/opt/node@20/bin:$PATH" pnpm exec expo start --tunnel`
- **"Something went wrong" / red screen on a data screen:** the deployed
  backend's read payloads drift from the contract types
  (price/ratingAggregate/publishedAt); response validation is intentionally off
  and screens read defensively — if a specific screen still throws, it's a
  missing field guard in that screen lane.
- **Stuck bundling:** clear Metro cache: append `--clear` to `expo start`.
- **Login fails:** confirm the build is on prod
  (`EXPO_PUBLIC_USE_EMULATORS=false`) and the seeded creds above (also in
  `packages/seed/seed-credentials.json`).
- **Answering a question:** recording attempts is LIVE and verified end-to-end —
  **auto-gradable** types (true/false, MCQ, multi-select, numeric, match,
  ordering, fill-in-the-blank) are scored server-side from the answer key and
  update progress. **Subjective** types (short/long answer, code, diagram,
  file/audio) route to LLM grading, which needs a per-tenant Gemini key not
  provisioned on `lvlup-ff6fa` (→ "AiGatewayError") — that's a config prereq,
  not an app bug. Stick to auto-gradable items to see the full attempt →
  progress loop on the phone.
