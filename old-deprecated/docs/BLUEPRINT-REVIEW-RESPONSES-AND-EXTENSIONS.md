# Blueprint Review Responses & Architecture Extensions

## Unified Architecture Blueprint — v1.1 Addendum

**Date:** 2026-02-19 **Status:** Extending Blueprint v1.0 based on Review
Feedback **Reviews Addressed:**

- `docs/UNIFIED-ARCHITECTURE-BLUEPRINT-REVIEW.md` (Reviewer 1)
- `docs/REVIEW-UNIFIED-ARCHITECTURE-BLUEPRINT.md` (Reviewer 2)

---

## Table of Contents

1. [Critical Issues — Resolved](#1-critical-issues--resolved)
2. [Missing Entity Definitions](#2-missing-entity-definitions)
3. [Security Extensions](#3-security-extensions)
4. [Architecture Gaps — New Sections](#4-architecture-gaps--new-sections)
5. [Migration Strategy — Hardened](#5-migration-strategy--hardened)
6. [Implementation Roadmap — Clarifications](#6-implementation-roadmap--clarifications)
7. [Data Model Corrections & Clarifications](#7-data-model-corrections--clarifications)
8. [Open Questions — Decisions Finalized](#8-open-questions--decisions-finalized)
9. [Minor Fixes & Reconciliations](#9-minor-fixes--reconciliations)
10. [Summary of Blueprint Edits](#10-summary-of-blueprint-edits)

---

## 1. Critical Issues — Resolved

### 1.1 Gemini API Key Storage & Encryption (C1 / S1)

**Issue:** Both reviewers flagged that `Tenant.settings.geminiApiKey` is
described as "encrypted, per-tenant" without specifying the encryption
mechanism.

**Decision: Google Cloud Secret Manager + Firestore Reference**

The API key will NOT be stored in the Firestore `Tenant` document, even
encrypted. Instead:

```
Architecture:
┌──────────────────────┐     ┌──────────────────────────────┐
│  Firestore           │     │  Google Cloud Secret Manager  │
│  /tenants/{tenantId} │     │                              │
│  settings: {         │────▶│  tenants/{tenantId}/gemini   │
│    geminiKeyRef: ... │     │  (versioned, IAM-protected)  │
│  }                   │     │                              │
└──────────────────────┘     └──────────────────────────────┘
         │                              │
         │  TenantAdmin writes key      │  Only CF service account
         │  via Cloud Function          │  can read via IAM
         │  (never direct)              │
         ▼                              ▼
    Cloud Function: setTenantApiKey()
    1. Receives plaintext key from admin UI (over HTTPS)
    2. Writes to Secret Manager: projects/{proj}/secrets/tenant-{tenantId}-gemini
    3. Stores reference path in Firestore: Tenant.settings.geminiKeyRef
    4. Key is NEVER in Firestore, NEVER in client bundle
```

**Access Control:**

- Cloud Functions service account has `secretmanager.secretAccessor` IAM role
- No client SDK can access Secret Manager
- TenantAdmins can SET keys via a callable Cloud Function but never READ them
  back
- Admin UI shows only `****` masked confirmation that a key is set
- Key rotation: create new version in Secret Manager, old version auto-disabled

**Firestore Tenant Change:**

```typescript
// BEFORE (blueprint v1.0)
settings: {
  geminiApiKey?: string; // Encrypted, per-tenant — REMOVED
}

// AFTER (v1.1)
settings: {
  geminiKeyRef?: string; // Secret Manager reference path (e.g., "tenant-{tenantId}-gemini")
  geminiKeySet: boolean; // Whether a key has been configured
  // ...rest unchanged
}
```

**Cloud Functions:** | Function | Trigger | Action |
|----------|---------|--------| | `setTenantApiKey` | Callable (TenantAdmin) |
Validate, store in Secret Manager, update `geminiKeyRef` | |
`deleteTenantApiKey` | Callable (TenantAdmin) | Delete from Secret Manager,
clear `geminiKeyRef` | | `LLMWrapper.getKey(tenantId)` | Internal | Read from
Secret Manager using `geminiKeyRef` |

---

### 1.2 Roll Number Synthetic Email — Collision Prevention (C2 / S2)

**Issue:** Reviewer 1 flagged collision risk if `tenantCode` uniqueness is not
atomically enforced. Reviewer 2 flagged that `tenantCode` can change
(rebranding), invalidating all student auth emails.

**Decision: Use `tenantId` (immutable) instead of `tenantCode`**

```
// BEFORE (blueprint v1.0)
{rollNumber}@{tenantCode}.autograde.internal

// AFTER (v1.1)
{rollNumber}@{tenantId}.levelup.internal
```

**Rationale:**

- `tenantId` is a Firestore document ID — immutable by definition
- `tenantCode` is a human-readable code that may change (school rebranding,
  mergers)
- Eliminates the collision scenario entirely — `tenantId` is globally unique
- Domain changed from `autograde.internal` to `levelup.internal` to reflect
  unified platform branding

**Additional safeguard — `tenantCode` uniqueness:** Even though synthetic emails
no longer depend on `tenantCode`, uniqueness is still required for the
school-code login flow. Enforcement:

```typescript
// Cloud Function: createTenant()
async function createTenant(data: CreateTenantRequest) {
  const tenantCodeRef = db.collection("tenantCodes").doc(data.tenantCode);

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(tenantCodeRef);
    if (existing.exists) {
      throw new functions.https.HttpsError(
        "already-exists",
        "Tenant code already in use"
      );
    }

    const tenantRef = db.collection("tenants").doc();
    tx.set(tenantRef, { ...tenantData, tenantCode: data.tenantCode });
    tx.set(tenantCodeRef, {
      tenantId: tenantRef.id,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}
```

A new global collection `/tenantCodes/{code}` serves as a uniqueness index,
updated atomically with tenant creation.

---

### 1.3 Migration Rollback Plan (M1 from Review 2)

**Issue:** Review 2 flagged that the migration strategy defines forward phases
only, with no rollback plan.

**Decision: Snapshot + Rollback Triggers + Procedures**

```
Migration Safety Net:

PRE-MIGRATION (per tenant):
1. Firestore Export: gcloud firestore export gs://{bucket}/migration-snapshots/{tenantId}/{date}/
2. RTDB Backup: Copy RTDB paths to backup location
3. Record migration manifest: { tenantId, sourceCollections, docCounts, checksums }

ROLLBACK TRIGGERS:
- Data verification checksum mismatch > 0.1% of documents
- Cloud Function errors spike > 5% during dual-write phase
- User-reported data access failures > 3 incidents
- Manual trigger by engineering lead

ROLLBACK PROCEDURE:
Phase A (Dual-Write) Rollback:
  1. Disable writes to new collections (feature flag)
  2. App continues reading/writing old collections (no user impact)
  3. Delete new collection documents for affected tenant
  4. Investigate and fix migration script

Phase B (Read-New) Rollback:
  1. Flip read path back to old collections (feature flag)
  2. Sync any writes that went to new collections back to old
  3. User impact: brief inconsistency window (<5 min)

Phase C (Old Deleted) — NO ROLLBACK:
  Phase C only starts after:
  - 2-week parallel run with zero divergence alerts
  - Explicit sign-off from engineering lead
  - Firestore export snapshot taken and verified as restorable
```

---

## 2. Missing Entity Definitions

### 2.1 Parent Entity (D1)

```typescript
// /tenants/{tenantId}/parents/{parentId}
interface Parent {
  id: string;
  tenantId: string;
  schoolId?: string;
  authUid?: string; // Firebase Auth UID
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  linkedStudentIds: string[]; // Children in this tenant
  relationship?: "mother" | "father" | "guardian" | "other";
  notificationPreferences?: {
    emailNotifications: boolean;
    resultReleaseAlerts: boolean;
    weeklyProgressDigest: boolean;
    atRiskAlerts: boolean;
  };
  status: "active" | "inactive" | "deleted";
  lastLogin?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 2.2 AcademicSession Entity (D2)

```typescript
// /tenants/{tenantId}/academicSessions/{sessionId}
interface AcademicSession {
  id: string;
  tenantId: string;
  name: string; // "2025-26", "Fall 2025"
  type: "annual" | "semester" | "trimester" | "quarter" | "custom";
  startDate: Timestamp;
  endDate: Timestamp;
  isCurrent: boolean; // Only one can be current per tenant
  status: "upcoming" | "active" | "completed" | "archived";
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 2.3 Scanner Entity (D4)

```typescript
// /scanners/{scannerId} — Global collection
interface Scanner {
  id: string;
  tenantId: string; // Assigned tenant
  deviceName: string; // "Scanner Room 1", "Lab Scanner"
  deviceType: "dedicated_scanner" | "mobile_app" | "web_upload";
  authUid?: string; // Firebase Auth UID (custom token auth)
  status: "active" | "inactive" | "revoked";
  lastActiveAt?: Timestamp;
  lastUploadAt?: Timestamp;
  totalUploads: number;
  ipWhitelist?: string[]; // Optional IP restriction
  createdBy: string; // TenantAdmin who registered it
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 2.4 Section Entity Clarification (D3)

**Decision:** Remove `/sections/{sectionId}` from the collection hierarchy
diagram. Sections start as a string field on `Student` and `Class`. If a full
entity is needed later, it will be promoted.

Current approach:

```typescript
// On Student:
sectionIds?: string[];  // e.g., ["A", "B"] — simple string identifiers

// On Class:
// Sections are implicit — derived from distinct sectionIds across students in the class
```

The hierarchy diagram in Section 3.1 should remove the `/sections/{sectionId}`
line.

---

## 3. Security Extensions

### 3.1 Answer Key Security — Explicit Client Prohibition (S3)

**Rule:** Answer keys for active timed tests MUST NEVER be sent to the client
before submission.

Implementation:

```
TIMED TESTS (assessment StoryPoints):
- Item documents in Firestore contain `correctAnswer` / `answerKey` fields
- Firestore security rules DENY read access to answer key fields for students
- Cloud Function evaluates answers server-side and returns only:
  { score, feedback, correctness } — NEVER the correct answer during active test
- After test submission + grading, correct answers MAY be revealed based on
  Space.showCorrectAnswers setting

PRACTICE MODE:
- Immediate feedback is the core UX — correct answers shown after each attempt
- Answer keys are readable by students ONLY for items in practice-mode StoryPoints
- Firestore rule: allow read if storyPoint.type == 'practice'

ITEM BANK (teacher authoring):
- Answer keys stored in a server-only subcollection:
  /tenants/{tenantId}/spaces/{spaceId}/items/{itemId}/answerKeys/{keyId}
- Readable only via Admin SDK (Cloud Functions)
- Teachers see answer keys in the editor via a Cloud Function proxy
```

### 3.2 RTDB Security Rules (H2)

**New section to be added to blueprint Appendix B:**

```json
{
  "rules": {
    "practiceProgress": {
      "$tenantId": {
        ".read": "auth != null && auth.token.tenantId === $tenantId",
        ".write": false,
        "$userId": {
          ".write": "auth != null && auth.uid === $userId && auth.token.tenantId === $tenantId",
          ".read": "auth != null && (auth.uid === $userId || auth.token.role === 'teacher' || auth.token.role === 'tenantAdmin')"
        }
      }
    },
    "leaderboards": {
      "$tenantId": {
        ".read": "auth != null && auth.token.tenantId === $tenantId",
        ".write": false,
        "$spaceId": {
          ".read": "auth != null && auth.token.tenantId === $tenantId",
          ".write": "auth != null && auth.token.tenantId === $tenantId && (auth.token.role === 'tenantAdmin' || root.child('leaderboardWriters').child($tenantId).child(auth.uid).exists())"
        }
      }
    }
  }
}
```

**Key rules:**

- Students can only write their OWN practice progress
- Teachers and admins can read any student's progress within their tenant
- Leaderboard reads are open to all tenant members
- Leaderboard writes go through Cloud Functions only (via a service-account
  writer pattern)
- Cross-tenant reads are structurally impossible (path-based isolation)

### 3.3 classIds[] in Claims — Scalability Cap (H1)

**Decision: Cap at 15 class IDs in claims. Fallback to Firestore for overflow.**

```typescript
// When setting claims in Cloud Functions:
const MAX_CLAIM_CLASS_IDS = 15;

async function setUserClaims(uid: string, membership: UserMembership) {
  const classIds = membership.permissions?.managedClassIds || [];

  const claims: PlatformClaims = {
    role: membership.role,
    tenantId: membership.tenantId,
    tenantCode: membership.tenantCode,
    teacherId: membership.teacherId,
    studentId: membership.studentId,
    parentId: membership.parentId,
    classIds: classIds.slice(0, MAX_CLAIM_CLASS_IDS),
    classIdsOverflow: classIds.length > MAX_CLAIM_CLASS_IDS, // Signal to rules
  };

  await admin.auth().setCustomUserClaims(uid, claims);
}
```

**Firestore rules pattern for overflow:**

```javascript
function canAccessClass(tenantId, classId) {
  // Fast path: check claims
  return request.auth.token.classIds.hasAny([classId])
    // Slow path: check Firestore membership (only if overflow)
    || (request.auth.token.classIdsOverflow == true
        && exists(/databases/$(database)/documents/userMemberships/$(request.auth.uid)_$(tenantId))
        && get(/databases/$(database)/documents/userMemberships/$(request.auth.uid)_$(tenantId)).data.permissions.managedClassIds.hasAny([classId]));
}
```

---

## 4. Architecture Gaps — New Sections

### 4.1 Notification & Messaging Architecture (A2)

```
Notification System Architecture:

┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
│ Cloud Function│───▶│ Notification │───▶│ Delivery Channels │
│ (trigger)     │    │ Service      │    │                  │
└──────────────┘    └──────────────┘    │ ├─ In-App (Firestore)
                                        │ ├─ Push (FCM)
                                        │ └─ Email (SendGrid/Mailgun)
                                        └──────────────────┘
```

**Firestore Collection:**

```typescript
// /tenants/{tenantId}/notifications/{notificationId}
interface Notification {
  id: string;
  tenantId: string;
  recipientUid: string;
  type:
    | "result_released"
    | "space_published"
    | "at_risk_alert"
    | "budget_warning"
    | "exam_ready"
    | "recommendation"
    | "system";
  title: string;
  body: string;
  data?: Record<string, string>; // Deep link params
  channels: ("in_app" | "push" | "email")[];
  read: boolean;
  readAt?: Timestamp;
  createdAt: Timestamp;
}
```

**Trigger Points:** | Event | Recipient | Channels |
|-------|-----------|----------| | Exam results released | Students + Parents in
class | In-app + Push + Email | | Space published | Students in assigned classes
| In-app + Push | | At-risk student detected | Assigned teachers | In-app | | AI
budget at 80% | TenantAdmin | In-app + Email | | AI budget at 100% | TenantAdmin
| In-app + Email + Push | | New recommendation | Student | In-app |

**Implementation Phase:** Phase 2 (foundation) with channel additions in Phase
3-5.

### 4.2 AI Pipeline Error Handling & Retry Strategy (A5)

```
Grading Pipeline State Machine:

  submission_uploaded
        │
        ▼
  ocr_processing ──[fail]──▶ ocr_failed (retry 3x, exponential backoff)
        │                           │
     [success]                [max retries]
        │                           │
        ▼                           ▼
  scouting_processing        manual_review_needed
        │                    (teacher notified)
        ▼
  scouting_complete
        │
        ▼
  grading_processing ──[partial fail]──▶ grading_partial
        │                                    │
     [all pass]                    (N of M questions graded)
        │                          (teacher can review partial + retry failed)
        ▼                                    │
  grading_complete ◀────────[manual retry]───┘
        │
        ▼
  ready_for_review
```

**Retry Policy:**

```typescript
interface RetryConfig {
  maxRetries: 3;
  backoffMs: [5000, 15000, 45000]; // Exponential
  deadLetterAfter: 3; // Move to manual review
}
```

**Per-Question Failure Handling:**

- Each `questionSubmission` has its own `gradingStatus`:
  `pending | processing | graded | failed | manual`
- If RELMS fails for individual questions, the submission moves to
  `grading_partial`
- Teacher sees which questions graded successfully and which need manual grading
  or retry
- Cloud Function `retryFailedQuestions(submissionId)` retries only failed
  questions

**Dead Letter Queue:**

```typescript
// /tenants/{tenantId}/gradingDeadLetter/{entryId}
interface GradingDeadLetterEntry {
  id: string;
  submissionId: string;
  questionSubmissionId?: string;
  pipelineStep: "ocr" | "scouting" | "grading";
  error: string;
  attempts: number;
  lastAttemptAt: Timestamp;
  resolvedAt?: Timestamp;
  resolvedBy?: string; // Manual resolution by teacher/admin
  createdAt: Timestamp;
}
```

### 4.3 RTDB → Firestore Flush Mechanism (A7)

**Decision: Hybrid — Client session-end + Cloud Scheduler periodic flush**

```
Flush Architecture:

Student Practice Session:
  │
  ├─ Every answer → Write to RTDB (immediate)
  │
  ├─ On session end (explicit "Done" button or navigate away):
  │   └─ Client calls Cloud Function: flushPracticeProgress(tenantId, userId, spaceId)
  │       └─ Reads RTDB path → Writes summary to Firestore spaceProgress
  │
  ├─ On browser close / tab close (beforeunload):
  │   └─ Best-effort: navigator.sendBeacon() to flush endpoint
  │       └─ May not complete — Cloud Scheduler catches it
  │
  └─ Cloud Scheduler (every 10 minutes):
      └─ Cloud Function: flushStalePracticeProgress()
          └─ Scans RTDB for entries with lastUpdated > 10 min ago
          └─ Flushes to Firestore
          └─ Marks RTDB entries as flushed
```

**Data consistency:** RTDB is the source of truth during an active session.
Firestore `spaceProgress` reflects the last flush. The UI reads from RTDB during
practice, from Firestore for dashboards/analytics.

### 4.4 Rate Limiting for AI Calls (A4)

```typescript
// Rate limits enforced in LLMWrapper Cloud Function
interface RateLimits {
  perUser: {
    chatMessagesPerMinute: 10;
    evaluationsPerMinute: 5;
  };
  perTenant: {
    gradingCallsPerMinute: 50; // Scales with plan
    chatCallsPerMinute: 100;
  };
  perPlan: {
    trial: { monthlyBudgetUsd: 5 };
    basic: { monthlyBudgetUsd: 50 };
    premium: { monthlyBudgetUsd: 200 };
    enterprise: { monthlyBudgetUsd: "custom" };
  };
}
```

**Enforcement:** Cloud Functions check a rate-limit counter in RTDB (fast
read/write) before each AI call. Budget checks read from
`costSummaries/monthly/{YYYY-MM}`. When limits are hit, the function returns a
429 with a user-friendly message.

### 4.5 File Upload Limits & Processing (A3)

| Upload Type           | Max Size                         | Accepted Formats     | Processing                                                 |
| --------------------- | -------------------------------- | -------------------- | ---------------------------------------------------------- |
| Question paper images | 10 MB/image, 20 images/exam      | JPEG, PNG, PDF       | Resize to 2048px max dimension, compress to 80% quality    |
| Answer sheet images   | 10 MB/image, 40 pages/submission | JPEG, PNG, PDF       | Same as above                                              |
| Space media (video)   | 500 MB                           | MP4, WebM            | Transcode to H.264 if needed (via Cloud Function + ffmpeg) |
| Space media (PDF)     | 50 MB                            | PDF                  | No processing                                              |
| Space media (images)  | 10 MB                            | JPEG, PNG, GIF, WebP | Resize for thumbnails                                      |
| Profile photos        | 5 MB                             | JPEG, PNG            | Resize to 256x256                                          |
| CSV bulk import       | 10 MB                            | CSV, XLSX            | Parse and validate in Cloud Function                       |

**Storage Rules:** Enforce max sizes in Firebase Storage security rules.
Content-type validation in Cloud Functions.

### 4.6 Offline / PWA Strategy — Scanner App (A1)

```
Scanner App Offline Strategy:

1. Service Worker: Cache app shell + static assets
2. IndexedDB Queue: Store captured images locally when offline
3. Background Sync: When connectivity returns, upload queued images
4. UI Indicators: Show offline status, queue size, sync progress

Flow:
  [Capture] → [Store in IndexedDB] → [Queue for upload]
                                           │
                             ┌─────────────┴──────────────┐
                             │ Online?                     │ Offline?
                             ▼                             ▼
                    Upload immediately              Hold in queue
                    via Cloud Function              Show "X pending"
                             │                             │
                         [Success]                    [Retry on reconnect]
                             │                             │
                    Remove from queue               Background Sync API
```

**Scope:** Offline support is required only for the Scanner app (Phase 3).
Student/Teacher web apps assume reliable connectivity. PWA capabilities (install
prompt, offline shell) can be added incrementally in Phase 6.

### 4.7 Caching Strategy (A6)

| Layer                | Strategy               | Implementation                                                   |
| -------------------- | ---------------------- | ---------------------------------------------------------------- |
| Static assets        | CDN (Firebase Hosting) | Cache-Control: max-age=31536000 for hashed assets                |
| Firestore queries    | TanStack Query         | staleTime: 5min for lists, 30s for detail views, 0 for real-time |
| RTDB reads           | Firebase SDK cache     | Default persistence enabled, keepSynced for leaderboards         |
| AI responses         | No cache               | Each evaluation is unique; no caching                            |
| User profile         | Zustand + persistence  | Cache active user + membership in localStorage                   |
| Media (images/video) | CDN + browser cache    | Firebase Storage download URLs with token-based cache busting    |

### 4.8 Testing Strategy (R2)

| Test Type                        | Tool                               | Scope                                                   | Phase    |
| -------------------------------- | ---------------------------------- | ------------------------------------------------------- | -------- |
| Unit tests                       | Vitest                             | Shared packages, utility functions, state logic         | Phase 0+ |
| Firestore rule tests             | `@firebase/rules-unit-testing`     | All security rules                                      | Phase 1+ |
| Cloud Function integration tests | Vitest + Firebase Emulator         | Auth flows, grading pipeline, CRUD operations           | Phase 1+ |
| Component tests                  | Vitest + Testing Library           | React components (shared-ui)                            | Phase 0+ |
| E2E tests                        | Playwright                         | Critical user journeys (login, take test, view results) | Phase 3+ |
| Migration tests                  | Custom scripts + Firebase Emulator | Data integrity verification per migration step          | Phase 1+ |

**Coverage expectations:**

- Shared packages: 80%+ line coverage
- Cloud Functions: 70%+ (all happy paths + critical error paths)
- Firestore rules: 100% of rule branches tested
- E2E: Top 10 critical user flows

### 4.9 Monitoring & Observability (R3)

| Concern                | Tool                                       | Details                                    |
| ---------------------- | ------------------------------------------ | ------------------------------------------ |
| Cloud Function errors  | Google Cloud Error Reporting               | Auto-captured; alert on error rate > 1%    |
| Cloud Function latency | Google Cloud Monitoring                    | Alert on p95 > 10s for grading functions   |
| Firestore usage        | Firebase Console + Cloud Monitoring        | Daily reads/writes/deletes dashboard       |
| AI pipeline health     | Custom dashboard (Firestore `llmCallLogs`) | Success rate, avg latency, cost per tenant |
| Client errors          | Sentry (or equivalent)                     | Capture unhandled exceptions + breadcrumbs |
| Uptime                 | Firebase Hosting + Cloud Monitoring        | Uptime checks on critical endpoints        |
| Budget alerts          | Cloud Billing alerts                       | Project-level spend alerts                 |

### 4.10 Firestore Backup & PITR (M4 from Review 1)

**Decision: Enable PITR + Daily Exports**

- **PITR:** Enable Firestore Point-in-Time Recovery on project setup (Phase 0).
  Allows recovery to any point within 7 days.
- **Daily Exports:** Cloud Scheduler triggers `gcloud firestore export` to a
  dedicated Cloud Storage bucket daily.
- **Retention:** Daily exports retained for 90 days, monthly exports retained
  for 1 year.
- **Compliance:** Meets standard EdTech data retention requirements. Schools
  with specific compliance needs (FERPA, etc.) can be addressed per-tenant.

---

## 5. Migration Strategy — Hardened

### 5.1 Parallel Run Monitoring (M2 from Review 2)

```
Monitoring During Dual-Write Phase:

1. Automated Comparison Script (Cloud Scheduler, every 6 hours):
   - For each migrated tenant:
     a. Count documents in old collection vs new collection
     b. Sample 100 random documents, compare field-by-field
     c. Log divergence rate to /migrationMonitoring/{tenantId}/{date}
   - Alert (email to engineering lead) if divergence > 0

2. Success Criteria for Proceeding to Phase B (Read-New):
   ✅ Zero divergence across 3 consecutive comparison runs (18 hours)
   ✅ No user-reported data issues for the tenant
   ✅ Cloud Function error rate < 0.1% for dual-write functions
   ✅ Engineering lead explicit sign-off

3. Success Criteria for Proceeding to Phase C (Delete Old):
   ✅ 2-week parallel run with zero divergence
   ✅ Firestore export snapshot taken and verified
   ✅ All app surfaces confirmed reading from new paths
   ✅ Engineering lead + product lead sign-off
```

### 5.2 Consumer User Migration Path (M3 from Review 2)

**Decision: Consumer users remain membership-free. No `platform_public`
membership created.**

```
Consumer User Migration:

LevelUp consumer users (no org affiliation):
1. /users/{uid} → /users/{uid} (UnifiedUser with consumerProfile)
2. NO userMembership created — consumers are identified by:
   - user.consumerProfile exists AND
   - No active userMemberships
3. Enrolled courses:
   - /courses/{courseId} with orgId=null → /tenants/platform_public/spaces/{spaceId}
   - user.consumerProfile.enrolledSpaceIds updated to reference new space IDs
4. Progress data:
   - /userStoryPointProgress/{uid}_{courseId} → /tenants/platform_public/spaceProgress/{uid}_{spaceId}

Access pattern:
  Consumer logs in → No memberships found → App reads consumerProfile
  → Loads spaces from platform_public tenant using enrolledSpaceIds
  → Firestore rules: allow read on platform_public spaces if user is authenticated
```

### 5.3 LevelUp Effort Estimate Revision (M4 from Review 2)

**Revised estimate: 1-2 weeks** (up from 3-5 days)

Breakdown: | Sub-task | Estimate | |----------|----------| | Migration script
development | 2-3 days | | Test against staging data (per-school dry runs) | 2-3
days | | Fix issues found in testing | 1-2 days | | Production migration (batch,
per-tenant) | 1-2 days | | Verification and monitoring | 1-2 days |

---

## 6. Implementation Roadmap — Clarifications

### 6.1 Team Size Assumptions (R1 from Review 2)

The 16-week roadmap assumes:

- **2-3 full-stack engineers** working full-time
- **1 part-time engineering lead** for architecture decisions and code review
- Engineers familiar with Firebase, React, TypeScript
- Phases can partially overlap (e.g., Phase 4 LevelUp UI can start while Phase 3
  AutoGrade Cloud Functions are being tested)

If the team is smaller (1-2 engineers), add 4-8 weeks buffer. If larger (4+),
phases can be parallelized more aggressively.

### 6.2 Phase 6 Dependency Clarification

Phase 6 (Consumer path) depends on:

- **Phase 0** (monorepo, shared types) — hard dependency
- **Phase 1** (auth, consumer login) — hard dependency
- **Phase 4** (LevelUp spaces, viewer, practice) — hard dependency for content
- **Phase 5** (analytics, leaderboards) — soft dependency (can ship consumer
  without cross-system insights initially)

Consumer web development can start UI scaffolding in parallel with Phase 4, with
full integration in Phase 6.

### 6.3 Migration Script Timing

**Accepted recommendation from Review 1:** Begin migration script development
during Phase 0, running against staging data in parallel with monorepo setup.
This de-risks the migration work and surfaces data issues early.

---

## 7. Data Model Corrections & Clarifications

### 7.1 Soft-Delete Status on Entities (M3 from Review 1)

**Decision: Add `'deleted'` status to Student, Teacher, and Parent entities.**

```typescript
// Student
status: "active" | "inactive" | "graduated" | "deleted";

// Teacher
status: "active" | "inactive" | "deleted";

// Parent
status: "active" | "inactive" | "deleted";
```

**Data retention policy:**

- When a student/teacher/parent is soft-deleted, their entity document remains
  with `status: 'deleted'`
- All associated progress data, submissions, and evaluations are RETAINED
- Soft-deleted entities are excluded from active queries (all list queries
  filter `status != 'deleted'`)
- Hard deletion (permanent removal) requires SuperAdmin action and a separate
  data purge Cloud Function
- Retention period: minimum 3 years for academic records (configurable
  per-tenant for compliance)

### 7.2 Exam-Space Linkage — Unidirectional (M1 from Review 1)

**Decision: Make the linkage unidirectional. Exam owns the link.**

```typescript
// Exam entity — KEEPS linkedSpaceId
interface Exam {
  // ...
  linkedSpaceId?: string; // Points to a LevelUp Space
  linkedStoryPointId?: string; // Optionally to a specific StoryPoint
  // ...
}

// Space entity — REMOVE linkedExamIds[]
interface Space {
  // ...
  // linkedExamIds?: string[];         // REMOVED in v1.1
  // ...
}
```

**To find exams linked to a space:**

```typescript
const linkedExams = await db
  .collection(`tenants/${tenantId}/exams`)
  .where("linkedSpaceId", "==", spaceId)
  .get();
```

This avoids the bidirectional synchronization problem entirely. Add a composite
index: `exams: linkedSpaceId ASC, status ASC`.

### 7.3 userMemberships — Single Role Per Tenant Clarification (D6)

**Decision: Intentional — one role per tenant per user.**

The composite key `{uid}_{tenantId}` intentionally prevents multiple roles in
the same tenant. This is by design:

- A teacher who is also a parent in the same school has ONE membership with
  `role: 'teacher'` and parent-like access granted via
  `permissions.canViewChildProgress` or similar
- The alternative (multiple memberships) creates ambiguity in custom claims and
  complicates the UI's role-based routing

**Edge case — teacher-parent:** If a teacher needs to view their own child's
results:

```typescript
// On UserMembership (teacher)
parentLinkedStudentIds?: string[];     // Optional: teacher's own children in this tenant
```

This is a lightweight extension that avoids the complexity of dual memberships.

### 7.4 Denormalized Count Maintenance (D5 from Review 2)

**Cloud Functions responsible for counter maintenance:**

| Counter                      | Location   | Update Trigger           | Mechanism                                |
| ---------------------------- | ---------- | ------------------------ | ---------------------------------------- |
| `Tenant.stats.totalStudents` | Tenant doc | Student created/deleted  | Firestore trigger `onStudentWrite`       |
| `Tenant.stats.totalTeachers` | Tenant doc | Teacher created/deleted  | Firestore trigger `onTeacherWrite`       |
| `Tenant.stats.totalClasses`  | Tenant doc | Class created/archived   | Firestore trigger `onClassWrite`         |
| `Class.studentCount`         | Class doc  | Student.classIds changed | Firestore trigger `onStudentWrite`       |
| `Space.stats.totalStudents`  | Space doc  | SpaceProgress created    | Firestore trigger `onSpaceProgressWrite` |

**Race condition mitigation:** All counter updates use `FieldValue.increment()`
(atomic) rather than read-modify-write. For high-contention counters (e.g.,
`Space.stats.totalStudents` during bulk enrollment), use distributed counters if
increment rate exceeds 1/second.

### 7.5 Offline/Paper-Only Student Lifecycle (H3 from Review 1)

```
Paper-Only Student Lifecycle:

1. ENROLLMENT (by TenantAdmin via CSV import):
   → Student entity created with authUid: null
   → rollNumber assigned
   → No Firebase Auth account created
   → Student appears in class roster, can receive submissions

2. ANSWER SHEET GRADING:
   → Scanner uploads answer sheet
   → TenantAdmin/Teacher assigns submission to student by rollNumber
   → submissionId linked to studentId (not authUid)
   → Grading pipeline runs normally
   → Results stored under studentId

3. RESULT ACCESS (before account creation):
   → Teacher views results via studentId in grading dashboard
   → Parent (if linked and has account) views via parent portal
     → Parent.linkedStudentIds includes this studentId
     → Parent dashboard shows results for child by studentId lookup
   → Student cannot view own results (no login capability)

4. ACCOUNT ACTIVATION (when student gets digital access):
   → TenantAdmin triggers "Activate Student Account" for student
   → Cloud Function:
     a. Creates Firebase Auth account (synthetic email from rollNumber)
     b. Sets student.authUid = new UID
     c. Creates UserMembership
     d. Sets custom claims
   → Student can now log in and see all historical results
   → All existing submissions/progress already linked via studentId (no migration needed)
```

### 7.6 `orgAnalytics` Naming Fix (Minor Note 3 from Review 2)

**Decision:** Rename `orgAnalytics/current` to `tenantAnalytics/current` per
ADR-001.

---

## 8. Open Questions — Decisions Finalized

### Q1: Scanner Auth Model — **DECIDED: Custom Token (B)**

```
Scanner Authentication Flow:

1. TenantAdmin registers scanner device via Admin UI
   → Cloud Function creates /scanners/{scannerId} document
   → Cloud Function creates Firebase Auth account (service account pattern)
   → Returns one-time setup code

2. Scanner device enters setup code
   → Cloud Function validates code, generates custom token
   → Scanner stores refresh token locally
   → Custom token TTL: 1 hour (auto-refresh via Cloud Function)

3. Device Revocation:
   → TenantAdmin marks scanner as 'revoked' in Admin UI
   → Cloud Function deletes Firebase Auth account
   → Next token refresh fails → scanner is locked out
   → Revocation is immediate (within token TTL window)
```

### Q4: `platform_public` Tenant — **DESIGNED**

```typescript
// Created during Firebase project setup (Phase 0)
const platformPublicTenant: Tenant = {
  id: "platform_public", // Fixed, well-known ID
  name: "LevelUp Public",
  slug: "public",
  tenantCode: "PUBLIC", // Not used for login
  ownerUid: "<superadmin-uid>", // Platform SuperAdmin

  status: "active",

  subscription: {
    plan: "enterprise", // No limits
    maxStudents: undefined, // Unlimited
    maxSpaces: undefined,
  },

  features: {
    autoGradeEnabled: false, // No exam grading for public
    levelUpEnabled: true,
    scannerAppEnabled: false,
    aiChatEnabled: true, // Platform-funded AI for public spaces
    aiGradingEnabled: false,
    analyticsEnabled: true,
    parentPortalEnabled: false,
    bulkImportEnabled: false,
    apiAccessEnabled: false,
  },

  settings: {
    geminiKeyRef: "platform-public-gemini", // Platform-funded API key
  },
};
```

**Consumer enrollment:** Consumers do NOT get a `userMembership` for
`platform_public`. Instead, their `consumerProfile.enrolledSpaceIds` references
space IDs within the `platform_public` tenant. Firestore rules allow
authenticated users to read spaces in `platform_public`:

```javascript
match /tenants/platform_public/spaces/{spaceId} {
  allow read: if request.auth != null && resource.data.accessType == 'public_store';
}
```

### Q5: Section Entity — **DECIDED: String field. Remove subcollection from hierarchy.**

(See Section 2.4 above)

### Q8: Practice Scoring Flush Interval — **DECIDED: 10 minutes + session end**

(See Section 4.3 above)

### Q9: Timer Grace Period — **DECIDED**

Per Review 2 recommendation, add a grace period to server-side validation:

```typescript
const TIMER_GRACE_PERIOD_SECONDS = 30; // Network latency buffer

function validateTimedSubmission(
  session: DigitalTestSession,
  submittedAt: Timestamp
): boolean {
  const allowedEndTime =
    session.startedAt.toMillis() +
    session.durationMinutes * 60 * 1000 +
    TIMER_GRACE_PERIOD_SECONDS * 1000;

  return submittedAt.toMillis() <= allowedEndTime;
}
```

---

## 9. Minor Fixes & Reconciliations

### 9.1 Question Type Count (Minor Note 1 from Review 2)

**Correct count: 15 question subtypes.** Section 9.3's mention of "16" is a
typo. The canonical list from Section 4.4:

1. MCQ
2. MCAQ
3. true-false
4. numerical
5. text
6. paragraph
7. code
8. fill-blanks
9. fill-blanks-dd
10. matching
11. jumbled
12. audio
13. image_evaluation
14. group-options
15. chat_agent_question

Section 9.3 should read "15 question subtypes" (not 16).

### 9.2 Material Subtype Count (Minor Note 2 from Review 2)

**Correct count: 7 material subtypes.** Section 9.3 lists: text, video, PDF,
link, interactive, story, rich. The "6 material subtypes" label is incorrect —
it should read "7 material subtypes."

### 9.3 `classProgressSummaries` Debounce Window (H4 from Review 1)

**Decision: 3-minute debounce window using Cloud Tasks.**

When a `studentProgressSummary` is updated, instead of immediately updating
`classProgressSummaries`:

1. Enqueue a Cloud Task with a 3-minute delay for the affected class
2. If another student summary update arrives within 3 minutes, the task is
   already queued (idempotent — check if task exists)
3. When the task fires, it reads all student summaries for the class and
   recomputes the class summary in one write

This prevents write contention during simultaneous submissions (50 students
submitting a test at once → 1 class summary update instead of 50).

### 9.4 `parentIds[]` Denormalization on Class (Observation 1 from Review 1)

**Decision: Do NOT denormalize `parentIds` onto Class at this time.**

The 2-hop query (Class → Students → Parents) is acceptable for the notification
use case because:

- Bulk parent notifications are infrequent (result releases, not real-time)
- The Cloud Function performing notifications can handle the fan-out
- Adding `parentIds[]` to Class creates another denormalization to maintain

If notification performance becomes a bottleneck, this can be revisited.

### 9.5 Cost Summary Confirmation (Observation 3 from Review 1)

**Confirmed:** The daily Cloud Scheduler for cost aggregation
(`costSummaries/daily/{YYYY-MM-DD}`) is part of Phase 5 deliverables. The
scheduler runs at 00:05 UTC daily, aggregates the previous day's `llmCallLogs`
for each tenant, and writes/updates the daily + monthly summary documents.

---

## 10. Summary of Blueprint Edits

The following changes should be applied to
`docs/UNIFIED-ARCHITECTURE-BLUEPRINT.md` v1.0 to produce v1.1:

| #   | Section                        | Edit                                                                                     |
| --- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| 1   | Section 3.2, Tenant entity     | Replace `geminiApiKey?: string` with `geminiKeyRef?: string` and `geminiKeySet: boolean` |
| 2   | Section 3.1, Hierarchy         | Remove `/sections/{sectionId}` line                                                      |
| 3   | Section 3.2                    | Add Parent, AcademicSession, Scanner entity definitions                                  |
| 4   | Section 3.2, Space entity      | Remove `linkedExamIds?: string[]` field                                                  |
| 5   | Section 3.2, Student entity    | Change status to `'active' \| 'inactive' \| 'graduated' \| 'deleted'`                    |
| 6   | Section 3.2, Teacher entity    | Change status to `'active' \| 'inactive' \| 'deleted'`                                   |
| 7   | Section 3.3, PlatformClaims    | Add `classIdsOverflow?: boolean` field                                                   |
| 8   | Section 3.4, Indexes           | Add `exams: linkedSpaceId ASC, status ASC`                                               |
| 9   | Section 8.1, Roll Number Login | Change email pattern to `{rollNumber}@{tenantId}.levelup.internal`                       |
| 10  | Section 9.3                    | Fix "16 question subtypes" → "15 question subtypes"                                      |
| 11  | Section 9.3                    | Fix "6 material subtypes" → "7 material subtypes"                                        |
| 12  | Section 11.3                   | Change `orgAnalytics/current` to `tenantAnalytics/current`                               |
| 13  | Section 11.3                   | Specify `classProgressSummaries` debounce: 3-minute via Cloud Tasks                      |
| 14  | Section 15.1                   | Mark Q1 (Scanner auth) as "Decided: Custom Token"                                        |
| 15  | Section 15.1                   | Mark Q4 (Public courses) as "Decided: platform_public tenant"                            |
| 16  | Section 15.1                   | Mark Q5 (Sections) as "Decided: String field"                                            |
| 17  | Appendix B                     | Add RTDB security rules section                                                          |
| 18  | New Section 16                 | Add Notification Architecture                                                            |
| 19  | New Section 17                 | Add AI Pipeline Error Handling & Retry                                                   |
| 20  | New Section 18                 | Add Testing Strategy                                                                     |
| 21  | New Section 19                 | Add Monitoring & Observability                                                           |
| 22  | Section 12                     | Add rollback plan and monitoring procedures                                              |
| 23  | Section 12.3                   | Revise LevelUp migration estimate from "3-5 days" to "1-2 weeks"                         |

---

**Document Version:** 1.1 Addendum **Date:** 2026-02-19 **Status:** Complete —
All review items addressed
