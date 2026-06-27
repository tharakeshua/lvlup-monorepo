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
exports.cleanupInactiveChats =
  exports.cleanupStaleSessions =
  exports.onSpacePublished =
  exports.onSpaceDeleted =
  exports.onTestSessionExpired =
  exports.purchaseSpace =
  exports.listStoreSpaces =
  exports.saveSpaceReview =
  exports.sendChatMessage =
  exports.saveRubricPreset =
  exports.importFromBank =
  exports.listQuestionBank =
  exports.saveQuestionBankItem =
  exports.recordItemAttempt =
  exports.evaluateAnswer =
  exports.submitTestSession =
  exports.startTestSession =
  exports.manageNotifications =
  exports.listVersions =
  exports.getItemForEdit =
  exports.saveItem =
  exports.saveStoryPoint =
  exports.saveSpace =
    void 0;
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
// ─────────────────────────────────────────────────────
// Consolidated Endpoints
// ─────────────────────────────────────────────────────
var save_space_1 = require("./callable/save-space");
Object.defineProperty(exports, "saveSpace", {
  enumerable: true,
  get: function () {
    return save_space_1.saveSpace;
  },
});
var save_story_point_1 = require("./callable/save-story-point");
Object.defineProperty(exports, "saveStoryPoint", {
  enumerable: true,
  get: function () {
    return save_story_point_1.saveStoryPoint;
  },
});
var save_item_1 = require("./callable/save-item");
Object.defineProperty(exports, "saveItem", {
  enumerable: true,
  get: function () {
    return save_item_1.saveItem;
  },
});
var get_item_for_edit_1 = require("./callable/get-item-for-edit");
Object.defineProperty(exports, "getItemForEdit", {
  enumerable: true,
  get: function () {
    return get_item_for_edit_1.getItemForEdit;
  },
});
var list_versions_1 = require("./callable/list-versions");
Object.defineProperty(exports, "listVersions", {
  enumerable: true,
  get: function () {
    return list_versions_1.listVersions;
  },
});
var manage_notifications_1 = require("./callable/manage-notifications");
Object.defineProperty(exports, "manageNotifications", {
  enumerable: true,
  get: function () {
    return manage_notifications_1.manageNotifications;
  },
});
// ─────────────────────────────────────────────────────
// Assessment (Callable)
// ─────────────────────────────────────────────────────
var start_test_session_1 = require("./callable/start-test-session");
Object.defineProperty(exports, "startTestSession", {
  enumerable: true,
  get: function () {
    return start_test_session_1.startTestSession;
  },
});
var submit_test_session_1 = require("./callable/submit-test-session");
Object.defineProperty(exports, "submitTestSession", {
  enumerable: true,
  get: function () {
    return submit_test_session_1.submitTestSession;
  },
});
var evaluate_answer_1 = require("./callable/evaluate-answer");
Object.defineProperty(exports, "evaluateAnswer", {
  enumerable: true,
  get: function () {
    return evaluate_answer_1.evaluateAnswer;
  },
});
var record_item_attempt_1 = require("./callable/record-item-attempt");
Object.defineProperty(exports, "recordItemAttempt", {
  enumerable: true,
  get: function () {
    return record_item_attempt_1.recordItemAttempt;
  },
});
// ─────────────────────────────────────────────────────
// Question Bank & Rubric Presets (Callable)
// ─────────────────────────────────────────────────────
var save_question_bank_item_1 = require("./callable/save-question-bank-item");
Object.defineProperty(exports, "saveQuestionBankItem", {
  enumerable: true,
  get: function () {
    return save_question_bank_item_1.saveQuestionBankItem;
  },
});
var list_question_bank_1 = require("./callable/list-question-bank");
Object.defineProperty(exports, "listQuestionBank", {
  enumerable: true,
  get: function () {
    return list_question_bank_1.listQuestionBank;
  },
});
var import_from_bank_1 = require("./callable/import-from-bank");
Object.defineProperty(exports, "importFromBank", {
  enumerable: true,
  get: function () {
    return import_from_bank_1.importFromBank;
  },
});
var save_rubric_preset_1 = require("./callable/save-rubric-preset");
Object.defineProperty(exports, "saveRubricPreset", {
  enumerable: true,
  get: function () {
    return save_rubric_preset_1.saveRubricPreset;
  },
});
// ─────────────────────────────────────────────────────
// AI Chat (Callable)
// ─────────────────────────────────────────────────────
var send_chat_message_1 = require("./callable/send-chat-message");
Object.defineProperty(exports, "sendChatMessage", {
  enumerable: true,
  get: function () {
    return send_chat_message_1.sendChatMessage;
  },
});
// ─────────────────────────────────────────────────────
// Reviews & Ratings (Callable)
// ─────────────────────────────────────────────────────
var save_space_review_1 = require("./callable/save-space-review");
Object.defineProperty(exports, "saveSpaceReview", {
  enumerable: true,
  get: function () {
    return save_space_review_1.saveSpaceReview;
  },
});
// ─────────────────────────────────────────────────────
// Consumer / B2C Store (Callable)
// ─────────────────────────────────────────────────────
var list_store_spaces_1 = require("./callable/list-store-spaces");
Object.defineProperty(exports, "listStoreSpaces", {
  enumerable: true,
  get: function () {
    return list_store_spaces_1.listStoreSpaces;
  },
});
var purchase_space_1 = require("./callable/purchase-space");
Object.defineProperty(exports, "purchaseSpace", {
  enumerable: true,
  get: function () {
    return purchase_space_1.purchaseSpace;
  },
});
// ─────────────────────────────────────────────────────
// Triggers
// ─────────────────────────────────────────────────────
var on_test_session_expired_1 = require("./triggers/on-test-session-expired");
Object.defineProperty(exports, "onTestSessionExpired", {
  enumerable: true,
  get: function () {
    return on_test_session_expired_1.onTestSessionExpired;
  },
});
var on_space_deleted_1 = require("./triggers/on-space-deleted");
Object.defineProperty(exports, "onSpaceDeleted", {
  enumerable: true,
  get: function () {
    return on_space_deleted_1.onSpaceDeleted;
  },
});
var on_space_published_1 = require("./triggers/on-space-published");
Object.defineProperty(exports, "onSpacePublished", {
  enumerable: true,
  get: function () {
    return on_space_published_1.onSpacePublished;
  },
});
// ─────────────────────────────────────────────────────
// Cleanup Schedulers
// ─────────────────────────────────────────────────────
var cleanup_stale_sessions_1 = require("./triggers/cleanup-stale-sessions");
Object.defineProperty(exports, "cleanupStaleSessions", {
  enumerable: true,
  get: function () {
    return cleanup_stale_sessions_1.cleanupStaleSessions;
  },
});
var cleanup_inactive_chats_1 = require("./triggers/cleanup-inactive-chats");
Object.defineProperty(exports, "cleanupInactiveChats", {
  enumerable: true,
  get: function () {
    return cleanup_inactive_chats_1.cleanupInactiveChats;
  },
});
//# sourceMappingURL=index.js.map
