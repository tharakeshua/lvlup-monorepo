# V2: API Redesign & Consolidation — Cycle 3 Changelog

**Vertical**: V2 | **Cycle**: 3 | **Team**: Foundation Architect **Date**:
2026-03-07

---

## Changed

### Edge Case Validation in All Callable Schemas

- **`packages/shared-types/src/schemas/callable-schemas.ts`** — Comprehensive
  edge case hardening across all ~42 Zod callable request schemas:

#### Validation Constants Added

- `MAX_SHORT_TEXT = 200` — Names, titles, labels
- `MAX_MEDIUM_TEXT = 2000` — Descriptions, messages
- `MAX_LONG_TEXT = 10000` — Chat messages, long-form content
- `MAX_ARRAY_ITEMS = 100` — Standard array limits
- `MAX_BULK_ITEMS = 500` — Bulk import limits
- `firestoreId` — Reusable validator:
  `z.string().min(1).max(1500).regex(/^[^/]+$/)`

#### Schema Improvements (all 42 schemas)

- All ID fields now use `firestoreId` pattern (validates non-empty, no slashes,
  max 1500 chars)
- All string fields have appropriate max length constraints
- All array fields have max item limits (`MAX_ARRAY_ITEMS` or `MAX_BULK_ITEMS`)
- Email fields use `z.string().email()` validation
- Password fields enforce minimum length (6 chars)
- Descriptive error messages on all constraints

#### Key Schema Changes

- `SaveStudentRequestSchema` — email validation, name max lengths
- `SaveTeacherRequestSchema` — email validation, name max lengths
- `BulkImportStudentsRequestSchema` — `.max(MAX_BULK_ITEMS)` on students array
- `SaveExamRequestSchema` — title max length, questions array limit
- `SendChatMessageRequestSchema` — `MAX_LONG_TEXT` on message field
- `CreateOrgUserRequestSchema` — password min(6), email validation
- `SaveItemRequestSchema` — payload string limits, options array limits

## Status

- **37 active callable endpoints** (increased from initial 25 target due to
  legitimate new features: questionBank, rubricPresets, spaceReview,
  purchaseSpace, joinTenant)
- **All 42 request schemas** have comprehensive edge case validation
- **Build**: 12/12 tasks pass, 0 errors
