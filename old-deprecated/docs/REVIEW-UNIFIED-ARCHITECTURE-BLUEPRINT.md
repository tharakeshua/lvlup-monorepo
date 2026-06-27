# Review: Unified Architecture Blueprint

**Reviewed by:** Architecture Review Agent **Date:** 2026-02-19 **Document Under
Review:** `docs/UNIFIED-ARCHITECTURE-BLUEPRINT.md` v1.0 **Overall Assessment:**
Strong — Ready for implementation with targeted improvements

---

## 1. Executive Assessment

This is a well-structured, comprehensive architecture blueprint that
successfully synthesizes the AutoGrade and LevelUp domains into a coherent
unified platform. The document covers identity, multi-tenancy, content modeling,
AI infrastructure, migration strategy, and implementation roadmap. It is notably
thorough for a v1.0 blueprint.

**Verdict: Approve with recommendations.** No blocking issues found. Several
improvements suggested below.

---

## 2. Strengths

### 2.1 Sound Core Architecture Decisions

- **Path-based tenant isolation** (`/tenants/{tenantId}/...`) is the correct
  choice. It provides security at the data model level, not just rules, and is
  proven in the AutoGrade codebase.
- **Two-track content model** (Space + Exam coexistence) is pragmatic.
  Attempting to merge physical-paper and digital pipelines into a single entity
  would create a brittle, over-generalized schema.
- **Server-side AI only** is the right call for security, cost tracking, and key
  management.
- **Slim custom claims** respecting the 1000-byte JWT limit is a frequently
  overlooked constraint. Good that it's called out explicitly.

### 2.2 Comprehensive Coverage

- All six user roles are well-defined with a clear permission matrix.
- User journey maps for every role provide excellent context for frontend
  developers.
- ADR log captures key decisions with rationale — invaluable for future team
  members.
- Migration strategy addresses both codebases with a realistic phased approach.

### 2.3 Practical Migration Design

- Dual-write migration pattern (Phase A/B/C) is industry-standard and low-risk.
- Per-tenant feature flag for migration rollout is smart — enables incremental
  rollout.
- AutoGrade migration correctly identified as lower risk than LevelUp.

---

## 3. Issues & Recommendations

### 3.1 CRITICAL — Security

| #   | Issue                                      | Severity | Details                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | **Gemini API key storage**                 | Critical | `Tenant.settings.geminiApiKey` is described as "encrypted, per-tenant" but no encryption mechanism is specified. Firestore has no built-in field encryption. The document must specify: (a) how keys are encrypted at rest (e.g., Cloud KMS envelope encryption), (b) who can decrypt (only Cloud Functions service account), and (c) that keys are NEVER readable by client SDKs, even by TenantAdmins. A dedicated `/tenantSecrets/{tenantId}` collection with Admin SDK-only access would be safer than a field on the Tenant document. |
| S2  | **Roll number synthetic email**            | Medium   | `{rollNumber}@{tenantCode}.autograde.internal` — if `tenantCode` changes (e.g., school rebranding), all student auth emails become invalid. Recommend using `tenantId` (immutable) instead of `tenantCode` in the synthetic email domain.                                                                                                                                                                                                                                                                                                  |
| S3  | **Answer key security (Open Question #7)** | Medium   | The recommendation of "C for timed tests, B for item bank" is good, but the document should explicitly state that answer keys for active timed tests must NEVER be sent to the client before submission. This is a common vulnerability in EdTech platforms.                                                                                                                                                                                                                                                                               |

### 3.2 DATA MODEL — Gaps & Inconsistencies

| #   | Issue                                           | Severity | Details                                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Missing `Parent` entity definition**          | Medium   | Section 3.2 defines Student, Teacher, and mentions `/tenants/{tenantId}/parents/{parentId}` in the hierarchy, but no `Parent` interface is provided. Need: `linkedStudentIds[]`, `authUid`, contact info.                                                                     |
| D2  | **Missing `AcademicSession` entity definition** | Low      | Referenced in the hierarchy and roadmap but no TypeScript interface defined.                                                                                                                                                                                                  |
| D3  | **Missing `Section` entity definition**         | Low      | Open question #5 recommends "start with string field, promote to entity if needed," but the hierarchy shows `/sections/{sectionId}` as a subcollection. The document should be consistent — either remove the subcollection from the hierarchy diagram or provide the entity. |
| D4  | **`Scanner` entity incomplete**                 | Low      | `/scanners/{scannerId}` appears in global collections but has no interface definition. What fields does it need? Device type, last active, assigned tenant?                                                                                                                   |
| D5  | **Denormalization risks**                       | Medium   | `Class.studentCount`, `Tenant.stats.*`, `Space.stats.*` are denormalized. The document should specify which Cloud Functions maintain these counters and how race conditions are handled (e.g., Firestore transactions or distributed counters).                               |
| D6  | **`userMemberships` composite key**             | Low      | `{uid}_{tenantId}` as document ID is clean, but the document should note that this prevents a user from having multiple roles in the same tenant (e.g., a teacher who is also a parent). If this is intentional, state it explicitly.                                         |

### 3.3 ARCHITECTURE — Gaps

| #   | Issue                                                   | Severity | Details                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **No offline/PWA strategy**                             | Medium   | The Scanner app will be used in schools with potentially unreliable internet. The document doesn't address offline-first patterns, queued uploads, or service workers.                                                                                                                 |
| A2  | **No notification/messaging architecture**              | Medium   | Multiple journeys mention "receive notification when results released" but there's no notification system design — no FCM setup, no in-app notification collection, no email integration.                                                                                              |
| A3  | **No file upload limits or processing**                 | Low      | Answer sheet uploads and question paper uploads need defined: max file sizes, accepted formats, image compression/optimization pipeline, virus scanning.                                                                                                                               |
| A4  | **No rate limiting design**                             | Medium   | AI calls have budget limits but no per-user or per-request rate limiting. A single teacher could trigger hundreds of simultaneous grading calls.                                                                                                                                       |
| A5  | **No error handling / retry strategy for AI pipelines** | Medium   | The grading pipeline (OCR → Panopticon → RELMS) has no defined behavior for partial failures. What happens if Panopticon succeeds but RELMS fails for 3 of 20 questions? Is the submission stuck in "grading" forever? Need: retry policy, dead-letter handling, manual recovery path. |
| A6  | **No caching strategy**                                 | Low      | No mention of CDN for static assets, Firestore query caching patterns, or RTDB caching for frequently-read leaderboard data.                                                                                                                                                           |
| A7  | **RTDB → Firestore flush mechanism undefined**          | Medium   | Practice progress uses "periodic flush to Firestore" but no mechanism is defined. Is this a Cloud Scheduler? A client-side debounce? Triggered on session end? What happens if the user closes the browser mid-practice?                                                               |

### 3.4 MIGRATION — Risks

| #   | Issue                                            | Severity | Details                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M1  | **No rollback plan**                             | High     | The migration strategy defines forward phases (A → B → C) but no rollback plan. If Phase B reveals data corruption, how do you revert? Recommend: snapshot old collections before migration, define rollback triggers and procedures.      |
| M2  | **"2-week parallel run" — monitoring undefined** | Medium   | The parallel run needs: (a) automated data comparison scripts, (b) alerting on divergence, (c) defined success criteria to proceed to cleanup.                                                                                             |
| M3  | **Consumer user migration gap**                  | Medium   | LevelUp consumer users (no org) need a clear migration path. The document mentions `platform_public` tenant for orphan courses but doesn't clarify whether consumer users get a membership in `platform_public` or remain membership-free. |
| M4  | **LevelUp effort estimate seems low**            | Low      | "3-5 days" for migrating global collections with progress data to tenant-scoped paths seems optimistic for production data with verification. Consider 1-2 weeks with testing.                                                             |

### 3.5 IMPLEMENTATION ROADMAP — Observations

| #   | Issue                                | Severity | Details                                                                                                                                                                                                      |
| --- | ------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | **16-week timeline is aggressive**   | Low      | The roadmap covers a massive scope (6 apps, full migration, cross-system intelligence) in 16 weeks. This assumes a well-staffed team. The document should state team size assumptions.                       |
| R2  | **Testing strategy absent**          | Medium   | No mention of: unit test expectations, integration tests for Cloud Functions, Firestore rule tests, E2E tests for critical flows. Recommend adding a testing section or referencing a separate testing plan. |
| R3  | **No monitoring/observability plan** | Medium   | No mention of: Cloud Function error monitoring, Firestore usage dashboards, AI pipeline health checks, user-facing error tracking (Sentry/equivalent).                                                       |

---

## 4. Open Questions — Review of Recommendations

| #   | Question                      | Blueprint Recommendation                 | Review Assessment                                                                                  |
| --- | ----------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Scanner auth                  | Custom Token (B)                         | **Agree.** Custom tokens with short TTL are the best fit for device auth.                          |
| 2   | Consumer-to-school transition | Email match (A) with manual fallback (B) | **Agree.** Add: merge prompt UX so users explicitly consent to account linking.                    |
| 3   | Roll number login             | Synthetic email                          | **Agree with caveat** — use `tenantId` not `tenantCode` in the domain (see S2).                    |
| 4   | Public courses                | `platform_public` tenant (A)             | **Agree.** Simplest approach; avoids special-casing global collections.                            |
| 5   | Section depth                 | String field, promote later (B)          | **Agree.** Remove `/sections/{sectionId}` from hierarchy diagram for consistency.                  |
| 6   | Academic sessions             | Optional (B)                             | **Agree.** Schools should be able to use the platform without configuring sessions.                |
| 7   | Answer key security           | C for timed, B for item bank             | **Agree.** Add explicit client-side prohibition (see S3).                                          |
| 8   | Practice scoring              | RTDB + periodic Firestore flush (C)      | **Agree.** Define the flush mechanism (see A7).                                                    |
| 9   | Timer enforcement             | Server validates on submit (C)           | **Agree.** Also add: reject submissions where `submittedAt - startedAt > duration + grace_period`. |
| 10  | Rubric versioning             | Snapshot at grading time (A)             | **Strongly agree.** This is essential for audit trails and prevents retroactive grade disputes.    |

---

## 5. Minor / Stylistic Notes

1. **Line count discrepancy**: Section 9.3 says "16 question subtypes" but lists
   only 15 in the bullet. The count in Section 4.4 says "15 question types."
   Reconcile.
2. **Material subtypes**: Section 9.3 lists 7 material subtypes ("text, video,
   PDF, link, interactive, story, rich") but says "6 material subtypes." Fix the
   count.
3. **`orgAnalytics` naming**: Section 11.3 references `orgAnalytics/current` —
   should this be `tenantAnalytics/current` per ADR-001?
4. **Appendix C**: Reference documents listed should include this blueprint
   itself as the synthesis output.
5. **Version tracking**: Consider adding a changelog section for future
   revisions.

---

## 6. Summary of Action Items

### Must-Fix (Before Implementation Starts)

1. Define API key encryption mechanism (S1)
2. Add `Parent` entity definition (D1)
3. Define migration rollback plan (M1)

### Should-Fix (During Phase 0)

4. Fix synthetic email to use `tenantId` (S2)
5. Define notification architecture (A2)
6. Define AI pipeline error/retry strategy (A5)
7. Define RTDB → Firestore flush mechanism (A7)
8. Add testing strategy section (R2)
9. Resolve count discrepancies (minor notes 1-2)

### Nice-to-Have (Can Be Addressed Incrementally)

10. Offline/PWA strategy for Scanner app (A1)
11. Rate limiting design (A4)
12. Caching strategy (A6)
13. Monitoring/observability plan (R3)
14. Rename `orgAnalytics` → `tenantAnalytics` (minor note 3)

---

**Review complete.** The blueprint is architecturally sound and demonstrates
strong synthesis of both product domains. The issues identified above are
typical for a first-pass architecture document and none are fundamental design
flaws. With the must-fix items addressed, this document is ready to guide
implementation.
