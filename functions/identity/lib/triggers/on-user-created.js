"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserCreated = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const functions = __importStar(require("firebase-functions/v1"));
const v2_1 = require("firebase-functions/v2");
const auth_helpers_1 = require("../utils/auth-helpers");
/**
 * Auth trigger: runs when a new Firebase Auth account is created.
 * Creates the platform-level /users/{uid} document.
 */
exports.onUserCreated = functions
  .region("asia-south1")
  .auth.user()
  .onCreate(async (user) => {
    try {
      const userDoc = {
        uid: user.uid,
        email: user.email ?? null,
        phone: user.phoneNumber ?? null,
        authProviders: [(0, auth_helpers_1.determineProvider)(user)],
        displayName: user.displayName ?? user.email?.split("@")[0] ?? "",
        firstName: null,
        lastName: null,
        photoURL: user.photoURL ?? null,
        isSuperAdmin: false,
        status: "active",
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        lastLogin: firestore_1.FieldValue.serverTimestamp(),
      };
      await admin.firestore().doc(`users/${user.uid}`).set(userDoc);
      v2_1.logger.info(`Created /users/${user.uid}`);
    } catch (error) {
      v2_1.logger.error(`Failed to create /users/${user.uid}`, error);
    }
  });
//# sourceMappingURL=on-user-created.js.map
