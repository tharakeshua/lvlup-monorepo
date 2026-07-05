# ID / field naming conventions (@levelup/domain)

Canonical naming rules for identifier fields on domain entities. Owned by the
domain package (Zod SSOT). Anything on the write path must follow these;
adapters may widen on read, never on write.

Ratified in `DATA-MODEL-FIX-PLAN.md` §10 (AD-1, AD-2, AD-3, AD-9). Enforced via
type brands in `src/primitives/brand.ts` + `src/primitives/branded-id.zod.ts`.

---

## The four id-shaped names

| Name       | Meaning                                              | Applies to                                                                                                 |
| ---------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `uid`      | Firebase Auth UID (subject of `auth.token`).         | `User.uid`, `UserMembership.uid`, custom-claim payloads.                                                   |
| `userId`   | FK to a `User` record on a **user-owned** subject.   | `SpaceProgress.userId`, `DigitalTestSession.userId`, `ChatSession.userId`.                                 |
| `<role>Id` | FK to the **role entity** (`Student`, `Teacher`, …). | Only where the role entity is the subject: `Submission.studentId`, `Class.teacherIds`, `Space.teacherIds`. |
| `authUid`  | **Not canonical.** Legacy synonym for `uid`.         | Migrate to `uid` when touched. Never introduced by new code.                                               |

### Why `userId`, not `studentId`, on learning-progress records

`SpaceProgress`, `DigitalTestSession`, `ChatSession`, and other user-owned
artefacts are keyed by the **User**, not the Student role. Deliberate: a user's
progress belongs to them across role changes (a student who graduates into a
teacher/alumni role keeps their learning history). If we keyed on `studentId` we
would orphan the artefact the moment the student record was archived or
replaced.

### Why `<role>Id` on the role-entity subject side

Where the role IS the actor (a submission is a student act; a class has teachers
assigned as teachers, not as generic users) we key by the role brand. This makes
rules and queries speak the domain language.

Concretely — the correction encoded in AD-3:

- ❌ `Space.teacherIds: z.array(zUserId)` — legacy, a Space's teachers are
  teachers-in-role
- ✅ `Space.teacherIds: z.array(zTeacherId)` — matches `Class.teacherIds`,
  matches rules

IDs are strings at rest, so this is a **types-only** correction — no data
migration.

### `authUid` deprecation

Legacy claim-builder and identity code carries `authUid`. The canonical field
name is `uid`. Read paths may accept `authUid` transitionally; write paths must
emit `uid`. When touching legacy code that reads `authUid`, migrate the field.

---

## Canonical brand pairs (aliases + deprecations)

The core-19 brand contract (`src/__tests__/brand.contract.test.ts`) enumerates
`SessionId`. It is retained for that contract but is otherwise **legacy**.

| Canonical                          | Deprecated alias           | Ratified in |
| ---------------------------------- | -------------------------- | ----------- |
| `TestSessionId` / `zTestSessionId` | `SessionId` / `zSessionId` | AD-1        |

- `zSessionId`/`SessionId`/`asSessionId` are JSDoc-`@deprecated`, retained (a)
  so the brand contract still asserts the core-19 set, and (b) for compat with
  any external imports we haven't yet migrated. **Do not introduce new usage.**
- Every test-session record in the new spine uses `TestSessionId`
  (`entities/levelup/test-session.ts`, `repositories/testsession-progress/*`).

---

## Canonical vs nested id fields

Where two id fields exist for the same reference, the top-level field on the
entity is canonical; nested duplicates are legacy read-through only.

### `Exam.evaluationSettingsId` — canonical vs nested (AD-2)

- ✅ **Canonical:** `Exam.evaluationSettingsId` (top-level on `ExamSchema`).
- ⚠️ **Legacy (read-only):** `Exam.gradingConfig.evaluationSettingsId` —
  JSDoc-`@deprecated`. Retained so pre-migration Firestore docs still parse.
- **Reader contract:**
  `exam.evaluationSettingsId ?? exam.gradingConfig?.evaluationSettingsId`.
- **Writer contract:** new code writes only the top-level field. The nested
  field is never written from new code.

---

## Rules of the road

1. **Prefer branded IDs at the field level.** `z.string()` on an id field is a
   mistake to flag on review; use the matching `z<Id>` schema so `z.infer`
   produces a nominal type.
2. **Cast at boundaries.** When a `UserId` legitimately flows into a `TeacherId`
   slot at a trust boundary (e.g. resolving `auth.uid` to a teacher), cast with
   the `asTeacherId(...)` factory at the boundary and comment the reason. Never
   widen the schema back to `zUserId` to avoid the cast.
3. **Read may widen, write must not.** Adapters live in `src/enums/legacy.ts` /
   `src/legacy/` (per AD-4) and are read-only; write-side schemas stay
   strict-canonical.
4. **Add-on-touch, not big-bang.** When touching code that uses `authUid`,
   `SessionId`, or nested `gradingConfig.evaluationSettingsId`, migrate it
   forward in the same change.

---

## References

- `DATA-MODEL-FIX-PLAN.md` §10 — the binding architectural decisions.
- `src/primitives/brand.ts` — brand types, `as*` factories, `BRAND_TAGS` core-19
  registry.
- `src/primitives/branded-id.zod.ts` — `z<Id>` schemas used inside entity
  shapes.
- `src/__tests__/brand.contract.test.ts` — contract-tests the core-19 set and
  factory/schema parity.
