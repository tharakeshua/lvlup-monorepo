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
exports.staleSubmissionWatchdog =
  exports.onQuestionSubmissionUpdatedV2 =
  exports.onExamDeleted =
  exports.onSubmissionUpdated =
  exports.onSubmissionCreated =
  exports.onResultsReleased =
  exports.onExamPublished =
  exports.onAnswerSheetUpload =
  exports.onQuestionPaperUpload =
  exports.uploadAnswerSheets =
  exports.extractQuestions =
  exports.gradeQuestion =
  exports.saveExam =
    void 0;
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
// Allow undefined values in Firestore documents (converted to null)
admin.firestore().settings({ ignoreUndefinedProperties: true });
// ── Consolidated callable functions ─────────────────────────────────────────
var save_exam_1 = require("./callable/save-exam");
Object.defineProperty(exports, "saveExam", {
  enumerable: true,
  get: function () {
    return save_exam_1.saveExam;
  },
});
var grade_question_1 = require("./callable/grade-question");
Object.defineProperty(exports, "gradeQuestion", {
  enumerable: true,
  get: function () {
    return grade_question_1.gradeQuestion;
  },
});
// ── Unchanged callable functions ────────────────────────────────────────────
var extract_questions_1 = require("./callable/extract-questions");
Object.defineProperty(exports, "extractQuestions", {
  enumerable: true,
  get: function () {
    return extract_questions_1.extractQuestions;
  },
});
var upload_answer_sheets_1 = require("./callable/upload-answer-sheets");
Object.defineProperty(exports, "uploadAnswerSheets", {
  enumerable: true,
  get: function () {
    return upload_answer_sheets_1.uploadAnswerSheets;
  },
});
// ── Storage triggers ────────────────────────────────────────────────────────
var on_question_paper_upload_1 = require("./triggers/on-question-paper-upload");
Object.defineProperty(exports, "onQuestionPaperUpload", {
  enumerable: true,
  get: function () {
    return on_question_paper_upload_1.onQuestionPaperUpload;
  },
});
var on_answer_sheet_upload_1 = require("./triggers/on-answer-sheet-upload");
Object.defineProperty(exports, "onAnswerSheetUpload", {
  enumerable: true,
  get: function () {
    return on_answer_sheet_upload_1.onAnswerSheetUpload;
  },
});
// ── Notification triggers ─────────────────────────────────────────────────
var on_exam_published_1 = require("./triggers/on-exam-published");
Object.defineProperty(exports, "onExamPublished", {
  enumerable: true,
  get: function () {
    return on_exam_published_1.onExamPublished;
  },
});
var on_results_released_1 = require("./triggers/on-results-released");
Object.defineProperty(exports, "onResultsReleased", {
  enumerable: true,
  get: function () {
    return on_results_released_1.onResultsReleased;
  },
});
// ── Firestore triggers ─────────────────────────────────────────────────────
var on_submission_created_1 = require("./triggers/on-submission-created");
Object.defineProperty(exports, "onSubmissionCreated", {
  enumerable: true,
  get: function () {
    return on_submission_created_1.onSubmissionCreated;
  },
});
var on_submission_updated_1 = require("./triggers/on-submission-updated");
Object.defineProperty(exports, "onSubmissionUpdated", {
  enumerable: true,
  get: function () {
    return on_submission_updated_1.onSubmissionUpdated;
  },
});
var on_exam_deleted_1 = require("./triggers/on-exam-deleted");
Object.defineProperty(exports, "onExamDeleted", {
  enumerable: true,
  get: function () {
    return on_exam_deleted_1.onExamDeleted;
  },
});
// Exported as V2 to match the previously deployed Firestore trigger and avoid
// any leftover name clash with an old HTTPS function.
var on_question_submission_updated_1 = require("./triggers/on-question-submission-updated");
Object.defineProperty(exports, "onQuestionSubmissionUpdatedV2", {
  enumerable: true,
  get: function () {
    return on_question_submission_updated_1.onQuestionSubmissionUpdatedV2;
  },
});
// ── Scheduled functions ──────────────────────────────────────────────────
var stale_submission_watchdog_1 = require("./schedulers/stale-submission-watchdog");
Object.defineProperty(exports, "staleSubmissionWatchdog", {
  enumerable: true,
  get: function () {
    return stale_submission_watchdog_1.staleSubmissionWatchdog;
  },
});
//# sourceMappingURL=index.js.map
