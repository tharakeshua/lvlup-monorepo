# Mobile build & push — Firebase App Distribution

Build a standalone Android APK (no Expo Go, no Metro) and push it to your phone.
On the phone you "pull the latest version" through Google's **App Tester** app:
every build pushed here appears there with a one-tap **Update**.

```
  this machine                          Firebase                  your phone
 ┌────────────┐   assembleRelease   ┌──────────────────┐      ┌──────────────┐
 │ gradlew →  │ ─── app-release.apk →│ App Distribution │ ───▶ │  App Tester  │
 │ release    │   appdistribution:  │  group: testers  │ push │  "Update" ⟳  │
 └────────────┘     distribute      └──────────────────┘      └──────────────┘
```

## One-time setup

### On this machine

Already done — for reference:

- Firebase CLI logged in (`firebase login`) on project **`lvlup-ff6fa`**.
- Three Android apps registered in the Firebase project (one per package):

  | App     | Package                   | Firebase App ID                                 |
  | ------- | ------------------------- | ----------------------------------------------- |
  | student | `academy.levelup.student` | `1:504506746594:android:c4d464e59dc598f05f80bb` |
  | admin   | `academy.levelup.admin`   | `1:504506746594:android:c3d7523940f6f6aa5f80bb` |
  | teacher | `academy.levelup.teacher` | `1:504506746594:android:7395f4d711a626135f80bb` |

- A tester group **`testers`** exists; `manzilshaik95@gmail.com` is in it.

  Add more testers:

  ```bash
  firebase appdistribution:testers:add someone@gmail.com \
    --group-alias testers --project lvlup-ff6fa
  ```

- Android toolchain (from `apps/mobile-*/PHONE-TEST.md`): Java 17,
  `ANDROID_HOME=$HOME/Library/Android/sdk`, **Node 20** (Gradle/Metro must not
  run on Node 25). The release script sets these on `PATH` automatically.

### On your phone (once)

1. Accept the email invite from Firebase App Distribution (check
   `manzilshaik95@gmail.com`), **or** open
   <https://appdistribution.firebase.dev> and sign in with that Google account.
2. Install the **App Tester** app when prompted.
3. Enable **Settings → Apps → Special access → Install unknown apps** for App
   Tester (needed to install/update sideloaded APKs).

## Push a new build

```bash
# from repo root
pnpm release:student                       # build + push student
pnpm release:admin
pnpm release:teacher                        # auto-runs `expo prebuild` first time
pnpm release:mobile all "weekly drop"       # all three, with release notes

# or call the script directly with custom notes
scripts/release-mobile.sh student "fixed login + new Learn tab"
```

What it does, per app:

1. `expo prebuild` if the native `android/` dir is missing (teacher).
2. `./gradlew assembleRelease` →
   `android/app/build/outputs/apk/release/app-release.apk` (JS bundle baked in —
   runs with no Metro).
3. `firebase appdistribution:distribute … --groups testers`.

Within ~a minute App Tester shows the new build → tap **Update**.

## Notes & gotchas

- **Signing.** Release builds are currently signed with the per-app **debug
  keystore** (`android/app/debug.keystore`). That's fine for internal App
  Distribution and gives stable in-place updates _as long as builds come from
  this machine_. Before any Play Store / multi-machine release, generate a real
  upload keystore and point `signingConfigs.release` at it in
  `apps/mobile-*/android/app/build.gradle`.
- **Backend.** APKs point at PROD `lvlup-ff6fa` (`asia-south1`, `v2_` seed),
  same as `PHONE-TEST.md`. No emulators are reachable from a phone.
- **Bumping the version** users see: edit `version` in `apps/mobile-*/app.json`,
  re-prebuild (or bump `versionCode`/`versionName` in
  `android/app/build.gradle`). App Distribution also auto-assigns a build number
  per upload.
- **One Gradle build at a time** — it holds an exclusive lock. If a build is
  already running (`ps aux | grep -i gradle`), let it finish.
- **iOS** is not covered here (needs an Apple Developer account +
  ad-hoc/TestFlight provisioning). App Distribution supports iOS `.ipa`s if you
  set that up later.
