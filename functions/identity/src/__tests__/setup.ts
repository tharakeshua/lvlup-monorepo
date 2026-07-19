import * as admin from "firebase-admin";

// Initialize Admin SDK for emulator testing
if (!admin.apps.length) {
  admin.initializeApp({ projectId: "lvlup-ff6fa" });
}

export { admin };
