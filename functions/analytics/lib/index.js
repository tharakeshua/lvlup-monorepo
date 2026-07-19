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
exports.generateInsights =
  exports.dailyCostAggregation =
  exports.nightlyAtRiskDetection =
  exports.updateLeaderboard =
  exports.onUserStoryPointProgressWrite =
  exports.onProgressMilestone =
  exports.onExamResultsReleased =
  exports.onStudentSummaryUpdated =
  exports.onSpaceProgressUpdated =
  exports.onSubmissionGraded =
  exports.generateReport =
  exports.getSummary =
    void 0;
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
// ── Callable functions ──────────────────────────────────────────────────────
var get_summary_1 = require("./callable/get-summary");
Object.defineProperty(exports, "getSummary", {
  enumerable: true,
  get: function () {
    return get_summary_1.getSummary;
  },
});
var generate_report_1 = require("./callable/generate-report");
Object.defineProperty(exports, "generateReport", {
  enumerable: true,
  get: function () {
    return generate_report_1.generateReport;
  },
});
// ── Firestore triggers ──────────────────────────────────────────────────────
var on_submission_graded_1 = require("./triggers/on-submission-graded");
Object.defineProperty(exports, "onSubmissionGraded", {
  enumerable: true,
  get: function () {
    return on_submission_graded_1.onSubmissionGraded;
  },
});
var on_space_progress_updated_1 = require("./triggers/on-space-progress-updated");
Object.defineProperty(exports, "onSpaceProgressUpdated", {
  enumerable: true,
  get: function () {
    return on_space_progress_updated_1.onSpaceProgressUpdated;
  },
});
var on_student_summary_updated_1 = require("./triggers/on-student-summary-updated");
Object.defineProperty(exports, "onStudentSummaryUpdated", {
  enumerable: true,
  get: function () {
    return on_student_summary_updated_1.onStudentSummaryUpdated;
  },
});
var on_exam_results_released_1 = require("./triggers/on-exam-results-released");
Object.defineProperty(exports, "onExamResultsReleased", {
  enumerable: true,
  get: function () {
    return on_exam_results_released_1.onExamResultsReleased;
  },
});
var on_progress_milestone_1 = require("./triggers/on-progress-milestone");
Object.defineProperty(exports, "onProgressMilestone", {
  enumerable: true,
  get: function () {
    return on_progress_milestone_1.onProgressMilestone;
  },
});
var on_user_story_point_progress_write_1 = require("./triggers/on-user-story-point-progress-write");
Object.defineProperty(exports, "onUserStoryPointProgressWrite", {
  enumerable: true,
  get: function () {
    return on_user_story_point_progress_write_1.onUserStoryPointProgressWrite;
  },
});
var update_leaderboard_1 = require("./triggers/update-leaderboard");
Object.defineProperty(exports, "updateLeaderboard", {
  enumerable: true,
  get: function () {
    return update_leaderboard_1.updateLeaderboard;
  },
});
// ── Scheduled functions ─────────────────────────────────────────────────────
var nightly_at_risk_detection_1 = require("./schedulers/nightly-at-risk-detection");
Object.defineProperty(exports, "nightlyAtRiskDetection", {
  enumerable: true,
  get: function () {
    return nightly_at_risk_detection_1.nightlyAtRiskDetection;
  },
});
var daily_cost_aggregation_1 = require("./schedulers/daily-cost-aggregation");
Object.defineProperty(exports, "dailyCostAggregation", {
  enumerable: true,
  get: function () {
    return daily_cost_aggregation_1.dailyCostAggregation;
  },
});
var generate_insights_1 = require("./schedulers/generate-insights");
Object.defineProperty(exports, "generateInsights", {
  enumerable: true,
  get: function () {
    return generate_insights_1.generateInsights;
  },
});
//# sourceMappingURL=index.js.map
