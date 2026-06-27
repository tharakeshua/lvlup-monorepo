# Architecture Review: UNIFIED-ARCHITECTURE-BLUEPRINT.md

**Reviewer:** Maestro Worker (`sess_1771520303042_n90ncoeao`) **Date:**
2026-02-19 **Document Reviewed:** `docs/UNIFIED-ARCHITECTURE-BLUEPRINT.md` v1.0
**Status:** Review Complete

---

## Executive Verdict

**Overall Assessment: STRONG — Ready for Implementation with Minor
Clarifications**

This is a well-structured, comprehensive architecture document that demonstrates
clear thinking about the challenges of merging two production Firebase
applications into a unified multi-tenant SaaS platform. The blueprint is
thorough, internally consistent, and actionable. The key design decisions are
sound and well-reasoned.

---

## Strengths

### 1. Clear Separation of Concerns

The two-track content model (Space domain + Exam domain) is the right call.
Attempting to merge a physical paper scanning pipeline with a digital learning
pipeline would create an unmaintainable monster schema. The decision to
coexist-but-link via `linkedSpaceId` is pragmatic.

### 2. Tenant Isolation Model

Path-based isolation under `/tenants/{tenantId}/...` is the correct approach for
Firebase. It makes Firestore security rules significantly simpler and more
auditable than field-based filtering. Cross-tenant data leaks become
structurally impossible rather than relying purely on rule correctness.

### 3. Minimal Custom Claims Design

The JWT 1000-byte limit is a real constraint that many teams hit in production.
Keeping claims slim (role, tenantId, classIds) while fetching rich permissions
from Firestore is the right pattern. The explicit callout of the 1-hour
staleness window is important and often overlooked.

### 4. Server-Side AI Architecture

Migrating LevelUp's client-side Gemini calls to Cloud Functions is essential.
Hardcoded API keys in client bundles are a serious security vulnerability. The
per-tenant API key model with cost tracking and budget alerts is
production-grade thinking.

### 5. Dual Scoring Preserved

Keeping `marks` (academic) and `points` (gamified) as separate fields rather
than trying to unify them is correct. They serve fundamentally different UX
purposes and should not be conflated. The `correctness` (0–1) normalization for
cross-system comparison is a clean bridge.

### 6. Composite Indexes Documented

Explicitly listing the required composite indexes (Section 3.4) is excellent
practice. Teams regularly discover missing indexes in production under load.
Having these upfront prevents surprises.

### 7. Migration Strategy

The incremental migration approach (dual-write → swap reads → delete old) is
sound. Prioritizing AutoGrade first (lower risk) and LevelUp second (higher
effort) is the correct sequencing. The 2-week parallel run before deleting old
collections adds appropriate safety.

### 8. Phase-Wise Roadmap Granularity

The 6-phase roadmap with specific deliverables per phase is actionable. Each
phase has a clear goal and measurable outputs. This is ready to be translated
directly into sprint planning.

---

## Issues & Concerns

### Critical

#### C1: `geminiApiKey` Storage in Firestore

**Location:** Section 3.2, `Tenant.settings.geminiApiKey` **Issue:** The
document says "Encrypted, per-tenant" but does not specify the encryption
mechanism. Storing encrypted API keys in Firestore is workable, but the
implementation detail matters enormously:

- Who holds the encryption key?
- Is it Google Cloud KMS? A hardcoded secret? Firebase Functions config?
- What is the decryption flow inside Cloud Functions?

**Recommendation:** Define the key management approach explicitly before
Phase 1. Google Cloud Secret Manager (with Cloud Functions accessing via IAM) is
the recommended pattern. Firestore-stored encrypted blobs require a key
management strategy that is easy to get wrong.

---

#### C2: Roll Number Login — Synthetic Email Collision Risk

**Location:** Section 8.1, Roll Number Login **Issue:** The synthetic email
pattern `{rollNumber}@{tenantCode}.autograde.internal` could collide if roll
numbers are not globally unique within a tenant. The document says "Unique
within tenant" for `rollNumber`, which prevents intra-tenant collisions, but:

- What if two tenants happen to use the same `tenantCode`?
- `tenantCode` uniqueness is enforced via Cloud Function (ADR note), but is this
  enforced before auth account creation?

**Recommendation:** Validate `tenantCode` uniqueness atomically (Firestore
transaction) during tenant creation. Document a collision recovery procedure.

---

### High Priority

#### H1: `classIds[]` on Custom Claims — Scalability Limit

**Location:** Section 3.3, `PlatformClaims.classIds[]` **Issue:** Storing
`classIds[]` in JWT claims works for teachers with 2–5 classes, but a
TenantAdmin or SuperAdmin reviewing classrooms across the tenant would not have
`classIds` in claims (they're not "teaching" specific classes). More
importantly, if a teacher is assigned to many classes (20+), the claims could
approach the 1000-byte limit.

**Recommendation:** Document the expected maximum for `classIds[]` in claims
(suggest: cap at 15). For users with more classes, fall through to Firestore
`userMemberships` for class-level checks. Firestore rules should handle this
gracefully with a `hasActiveMembership` check as fallback.

---

#### H2: RTDB Security Rules Not Addressed

**Location:** Section 3.1, RTDB paths **Issue:** The document defines two RTDB
paths (`practiceProgress` and `leaderboards`) but Appendix B only covers
Firestore security rules. RTDB has entirely separate security rules that need to
be designed.

- How are RTDB reads/writes authenticated?
- Can a student read another student's `practiceProgress`?
- Are leaderboard reads public within a tenant?

**Recommendation:** Add a Section or Appendix covering RTDB security rules
before Phase 4 (LevelUp Core) begins.

---

#### H3: Offline/Paper-Only Student Identity Gap

**Location:** Section 3.2, `Student.authUid?: string` (nullable) **Issue:**
Students without `authUid` (paper-only) can receive AutoGrade results but cannot
log in to view them. The workflow for "paper-only student gets results" is not
defined:

- How does a paper-only student transition to having an account?
- When a `rollNumber` submission is graded, how does the result get associated
  with a student who has no Firebase Auth UID?
- Can a parent view results for a paper-only child?

**Recommendation:** Define the paper-only student lifecycle explicitly: (1) How
are they enrolled (CSV), (2) How are submissions matched to them (by
`rollNumber` on submission), (3) How can they or their parent access results
once an account is created.

---

#### H4: `studentProgressSummaries` Update SLA Under Load

**Location:** Section 11.3, Analytics Pipeline **Issue:**
`studentProgressSummaries` is promised at `< 30s` SLA triggered on every space
progress write. In a class of 50 students all submitting a timed test
simultaneously, this triggers 50 concurrent Cloud Function invocations.
Firestore write contention on `classProgressSummaries` (which reads from student
summaries) could cascade.

**Recommendation:** Add a debouncing/batching strategy for the
`classProgressSummaries` update path (the document mentions "debounced" without
specifying the window — define it: suggest 2–5 minutes). Consider using Cloud
Tasks for reliable, rate-limited fan-out rather than direct Firestore triggers.

---

### Medium Priority

#### M1: `linkedExamIds[]` on Space — Bidirectional vs Unidirectional

**Location:** Section 3.2, `Space.linkedExamIds[]` + `Exam.linkedSpaceId`
**Issue:** There is a bidirectional link: `Space.linkedExamIds[]` (an array) and
`Exam.linkedSpaceId` (a single string). This introduces a synchronization
problem:

- If `Space.linkedExamIds` includes exam A, does exam A's `linkedSpaceId` also
  point back?
- Who is the source of truth?
- What happens when one side of the link is deleted?

**Recommendation:** Make this unidirectional. The Exam owns the link
(`Exam.linkedSpaceId`). The Space does not store `linkedExamIds`. Instead, query
exams by `linkedSpaceId` when needed. This avoids the dual-write synchronization
problem entirely.

---

#### M2: `platform_public` Tenant for Consumer Users

**Location:** Section 15.1, Open Question #4 **Issue:** The recommendation to
use a `platform_public` tenant for public LevelUp courses is listed as
"Recommended" but not fully designed. Key questions:

- Who is the `ownerUid` of `platform_public`?
- What subscription plan does it have? What feature flags?
- Consumer users would have a `userMembership` for `platform_public` — does this
  mean every new consumer user gets a membership record created?
- How does a consumer discover and enroll in spaces from `platform_public`?

**Recommendation:** Fully design the `platform_public` tenant before Phase 6
(Consumer path). Define: creation (during Firebase project setup), ownership
(SuperAdmin or a service account), and whether consumer enrollment creates a
`userMembership` or uses a lighter enrollment mechanism via
`consumerProfile.enrolledSpaceIds`.

---

#### M3: `status: 'deleted'` Not Present on All Entities

**Location:** Various entity definitions **Issue:** `UnifiedUser` has
`status: 'active' | 'suspended' | 'deleted'` but `Student`, `Teacher`, and
`Class` only have `'active' | 'inactive'` or `'active' | 'archived'`. There is
no soft-delete status that preserves historical data (exam grades, progress)
while marking the entity as removed.

**Recommendation:** Add `'deleted'` as a status option to `Student`, `Teacher`,
and `Parent` entities. When a student leaves a school, their progress data
should be retained but their entity marked deleted. Define data retention
policy.

---

#### M4: No Mention of Firestore Backup / PITR

**Location:** Not addressed in document **Issue:** Given that this platform
holds student academic records (exam grades, progress), the document does not
mention Firestore backup strategy or Point-in-Time Recovery (PITR).

**Recommendation:** Add a note in Phase 0 or Phase 6 to enable Firestore PITR
(available for databases in multi-region/regional configurations). Daily exports
to Cloud Storage should also be considered for compliance.

---

### Low Priority / Suggestions

#### L1: `UnifiedItem` Has 16 Question Types + 6 Material Types — No List in Schema Section

**Location:** Section 9.3 **Issue:** The item types are referenced in Section
9.3 but the complete payload definitions are not in this document (they're
presumably in phase3c). For implementers starting from this blueprint, it would
help to have the full list of discriminated union payloads at least referenced.

**Recommendation:** Add a reference to where the full `UnifiedItem` payload
definitions live, or add a summary table.

---

#### L2: Scanner App Authentication Not Decided

**Location:** Section 15.1, Open Question #1 **Issue:** Scanner auth model is
listed as "Needs decision" with custom tokens recommended. The scanner
represents a physical shared device in a school (not tied to a personal
account). This has significant security implications — if a scanner device is
stolen, how is access revoked?

**Recommendation:** Decide before Phase 3 (AutoGrade Core). Custom tokens
(Option B) are correct. Add device revocation to the `switchActiveTenant` /
scanner lifecycle Cloud Functions.

---

#### L3: `academicSessionId` Is Optional Everywhere

**Location:** Multiple entities **Issue:** `academicSessionId` is optional on
`Class`, `Space`, `Exam`, and `Submission`. While the document correctly decides
not to require it (Open Question #6, "don't block adoption"), this creates a
reporting challenge — analytics across sessions become difficult without session
context.

**Recommendation:** While keeping it optional at the entity level, ensure the
Insight Engine and analytics aggregations handle the `null` session case
gracefully. Document that schools are encouraged (not required) to set sessions
for better analytics.

---

## Schema Observations

### Observation 1: Missing `parentIds` on `Class`

Classes have `teacherIds[]` but not `parentIds[]`. Parents are linked to
individual students, not classes directly. This is correct as designed, but
means "notify all parents of students in class X" requires:
`Class → Student[] (by classIds contains) → Student.parentIds[]`. This is a
2-hop query that cannot be done in a single Firestore query. Consider
denormalizing `parentIds[]` onto `Class` if bulk parent notifications are
needed.

### Observation 2: `stats` Fields on Tenant Are Counts — Staleness Risk

`Tenant.stats.totalStudents` etc. are denormalized counts. These will drift from
actual counts unless a Cloud Function maintains them on every student
creation/deletion. Document the Cloud Function responsible for maintaining these
and its SLA.

### Observation 3: `costSummaries/daily/{YYYY-MM-DD}` Path Design

The cost summary path uses a document ID that is a date string inside a `daily`
subcollection. This means listing all daily summaries requires a collection
group query or a known date range. This is fine. Confirm the daily Cloud
Scheduler for this aggregation is part of Phase 5.

---

## Roadmap Observations

| Phase   | Concern                                                                                                                     |
| ------- | --------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 | Good. The monorepo setup and shared types foundation is correctly prioritized.                                              |
| Phase 1 | Auth foundation is correctly the second priority. Roll number login implementation timing is appropriate.                   |
| Phase 2 | Solid. Parent-student linkage at this phase is correct — parents need students to exist first.                              |
| Phase 3 | AutoGrade core is the right third priority — it's the more revenue-critical product and lower migration risk.               |
| Phase 4 | LevelUp migration in Phase 4 is appropriate. The timed test runner server-enforcement is non-trivial — allocate extra time. |
| Phase 5 | Cross-system intelligence is correctly last in the core sequence — it depends on both systems being live.                   |
| Phase 6 | Consumer path in Phase 6 is fine but should clarify if this is a hard dependency on Phase 4 or can be partially parallel.   |

**Overall**: 16 weeks for a platform of this scope is aggressive. The migration
scripts alone (Phases 1–4) represent significant testing surface. Recommend
building migration scripts and running them against staging data during Phase 0
in parallel with monorepo setup.

---

## Open Questions Status Review

| #   | Question                      | Assessment                                                                                                             |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | Scanner auth                  | Custom Token (B) is correct. Decide before Phase 3.                                                                    |
| 2   | Consumer-to-school transition | Email match with manual link fallback is practical. Implement in Phase 6.                                              |
| 3   | Roll number login             | Accepted design is correct. See C2 above for collision risk.                                                           |
| 4   | Public LevelUp courses        | `platform_public` tenant is cleanest. Needs full design (see M2).                                                      |
| 5   | Section entity depth          | Start with string field is correct. Promotes cleanly to entity if needed.                                              |
| 6   | Academic sessions optional    | Correct call — don't gate adoption on administrative setup.                                                            |
| 7   | Answer key security           | Option C for timed tests is correct. Never store raw answer keys where rules alone protect them.                       |
| 8   | Practice scoring storage      | RTDB + periodic Firestore flush is the right call. Define flush interval (suggest: every 5 minutes or on session end). |
| 9   | Digital test timer            | Server-side validation on submit (`submittedAt <= endTime`) is correct and sufficient.                                 |
| 10  | Rubric versioning             | Snapshot at grading time is correct. Prevents retroactive grade invalidation.                                          |

---

## Summary of Actionable Items

### Before Implementation Starts

1. **Decide scanner auth model** (recommend: Custom Token with device
   revocation)
2. **Define `geminiApiKey` encryption/storage mechanism** (recommend: Cloud
   Secret Manager)
3. **Design `platform_public` tenant fully** for consumer users
4. **Cap and document `classIds[]` in claims** (suggest max 15 entries)

### During Phase 0

5. **Write RTDB security rules** for `practiceProgress` and `leaderboards`
6. **Enable Firestore PITR** on project setup
7. **Begin migration script development** in parallel with monorepo setup

### During Phase 1

8. **Implement `tenantCode` uniqueness validation** atomically in Cloud Function
9. **Define paper-only student lifecycle** for result access

### During Phase 4

10. **Make Exam-Space linkage unidirectional** (`Exam.linkedSpaceId` only;
    remove `Space.linkedExamIds[]`)
11. **Define Cloud Tasks strategy** for `classProgressSummaries` fan-out
12. **Add `'deleted'` status** to `Student`, `Teacher`, `Parent` entities

---

## Final Recommendation

**Approve this blueprint for implementation.** The core architecture decisions
are sound and well-reasoned. The document is at the right level of detail for a
team to begin Phase 0 work immediately.

The issues identified above are refinements and clarifications, not fundamental
design problems. None require rethinking the core architecture. The most
important pre-implementation decision is the `geminiApiKey` storage mechanism
(C1) and scanner auth model (L2 / Open Question #1).

The migration strategy is realistic and the phased rollout approach (feature
flag per tenantId, new schools directly in `/tenants/`) is the right way to
de-risk a production migration.

---

_Review completed by Maestro Worker `sess_1771520303042_n90ncoeao`_
