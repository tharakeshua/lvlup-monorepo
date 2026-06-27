# Phase 10: Consumer B2C Path — Implementation Report

**Date:** 2026-02-24 **Engineer:** Frontend Apps Engineer **Task ID:**
task_1771884451005_zjytaifhi **Build Status:** All 10 packages pass
`pnpm run build`

---

## 1. Files Created / Modified

### Created (New Files)

| File Path                                             | Purpose                                                  |
| ----------------------------------------------------- | -------------------------------------------------------- |
| `functions/levelup/src/callable/publish-to-store.ts`  | Cloud Function: publish space to B2C store               |
| `functions/levelup/src/callable/purchase-space.ts`    | Cloud Function: consumer purchases/enrolls in a space    |
| `functions/levelup/src/callable/list-store-spaces.ts` | Cloud Function: list public store spaces with pagination |
| `apps/student-web/src/pages/StoreListPage.tsx`        | Store browsing page with search/filter                   |
| `apps/student-web/src/pages/StoreDetailPage.tsx`      | Space detail page with enroll CTA                        |
| `apps/student-web/src/pages/ConsumerProfilePage.tsx`  | Consumer profile with purchase history                   |
| `apps/student-web/src/layouts/ConsumerLayout.tsx`     | Sidebar layout for consumer users                        |

### Modified (Existing Files)

| File Path                                              | Changes                                                                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `packages/shared-types/src/identity/user.ts`           | Added `PurchaseRecord` interface; enhanced `ConsumerProfile` with `purchaseHistory: PurchaseRecord[]` and `totalSpend: number` |
| `packages/shared-types/src/levelup/space.ts`           | Added store fields to `Space`: `price?`, `currency?`, `publishedToStore?`, `storeDescription?`, `storeThumbnailUrl?`           |
| `functions/levelup/src/index.ts`                       | Registered 3 new callable exports: `publishToStore`, `purchaseSpace`, `listStoreSpaces`                                        |
| `apps/student-web/src/App.tsx`                         | Added consumer routes (`/store`, `/store/:spaceId`, `/my-spaces`, `/profile`) under `ConsumerLayout`; imported new pages       |
| `apps/student-web/src/pages/ConsumerDashboardPage.tsx` | Full rewrite: enrolled spaces grid, stats cards, store link, Firestore query for enrolled space details                        |

---

## 2. Cloud Functions for Store / Purchase

### `publishToStore` — `functions/levelup/src/callable/publish-to-store.ts`

- **Auth:** Requires teacher or tenantAdmin membership in the source tenant
  (`assertTeacherOrAdmin`)
- **Input:**
  `{ tenantId, spaceId, price, currency, storeDescription, storeThumbnailUrl? }`
- **Validation:** Space must already be in `published` status; price must be >=
  0
- **Behavior:**
  1. Copies space metadata to `/tenants/platform_public/spaces/{spaceId}` with
     `accessType: 'public_store'` and `publishedToStore: true`
  2. Stores `sourceTenantId` on the store listing for provenance
  3. Updates the original space doc with `publishedToStore: true`, `price`,
     `currency`, `storeDescription`
- **Region:** `asia-south1`

### `purchaseSpace` — `functions/levelup/src/callable/purchase-space.ts`

- **Auth:** Any authenticated user (`assertAuth`)
- **Input:** `{ spaceId, paymentToken? }` (paymentToken reserved for future
  payment gateway)
- **Validation:** Space must exist in `platform_public` and be
  `publishedToStore: true`; user must not already be enrolled
- **Behavior (MVP — no real payment):**
  1. Generates a transaction ID
  2. Atomically updates `/users/{uid}`:
     - `consumerProfile.enrolledSpaceIds` via `arrayUnion`
     - `consumerProfile.purchaseHistory` via `arrayUnion` with `PurchaseRecord`
     - `consumerProfile.totalSpend` via `increment`
  3. Increments `stats.totalStudents` on the store space doc
- **Returns:** `{ success: true, transactionId }`
- **Region:** `asia-south1`

### `listStoreSpaces` — `functions/levelup/src/callable/list-store-spaces.ts`

- **Auth:** Optional (works for any caller, including unauthenticated browsing)
- **Input:** `{ subject?, limit?, startAfter?, search? }`
- **Behavior:**
  1. Queries `/tenants/platform_public/spaces` where `publishedToStore == true`,
     ordered by `publishedAt desc`
  2. Optional `subject` filter applied server-side via Firestore `where`
  3. Cursor pagination via `startAfter` document ID
  4. Client-side title/description search filter for MVP (avoids full-text
     search dependency)
  5. Returns `StoreSpaceSummary[]` with: id, title, storeDescription,
     storeThumbnailUrl, subject, labels, price, currency, totalStudents,
     totalStoryPoints
- **Returns:** `{ spaces, hasMore, lastId }`
- **Region:** `asia-south1`

---

## 3. Frontend Pages

### `StoreListPage` — `/store`

- Browse all public store spaces in a responsive card grid (1/2/3 columns)
- **Search:** Client-side text filter over title + description
- **Subject Filter:** Dropdown (Math, Science, English, History) passed to cloud
  function
- **Space Cards:** Thumbnail (or placeholder icon), title, description (2-line
  clamp), price badge, enrolled count, lesson count, subject tag
- Cards link to `/store/:spaceId`
- Uses `@tanstack/react-query` with 5-min staleTime
- Calls `listStoreSpaces` cloud function via `httpsCallable`

### `StoreDetailPage` — `/store/:spaceId`

- Reads space doc directly from Firestore
  (`tenants/platform_public/spaces/{spaceId}`) for rich detail
- **Hero section:** Large thumbnail, title, subject badge, description, stats
  (lessons, enrolled)
- **CTA logic:**
  - If not enrolled → "Enroll Now" button triggers `purchaseSpace` mutation
  - If enrolled (or just purchased) → "Continue Learning" button navigates to
    `/spaces/{spaceId}`
- Success/error banners for purchase flow
- Back-to-store link
- Uses `useMutation` for purchase with `queryClient.invalidateQueries` on
  success

### `ConsumerDashboardPage` — `/consumer` and `/my-spaces`

- **Stats row:** Plan, Enrolled Spaces count, Total Spend
- **Enrolled Spaces grid:** Fetches space docs from `platform_public` using
  `where('__name__', 'in', enrolledIds)` (up to 30)
- Cards with thumbnail, title, lesson count → link to `/spaces/{spaceId}`
- Empty state with "Explore the Store" CTA
- Profile link and Sign Out button in header

### `ConsumerProfilePage` — `/profile`

- **Account info card:** Avatar placeholder, display name, email, plan, enrolled
  count, total spend
- **Join a School CTA:** Dashed border card with School icon, explanation text,
  and link to `/login` for school code entry (consumer-to-school transition path
  per ADR-007)
- **Purchase History table:** Lists all `PurchaseRecord` entries with space
  title, date, amount; empty state links to store

---

## 4. Auth Flow Changes

**No changes were needed.** The existing `LoginPage.tsx` already fully supported
the consumer auth flow:

- **Views:** `school-code` → `credentials` (B2B) and `consumer-login` →
  `consumer-signup` (B2C)
- "Don't have a school code? Sign in as learner" link switches to consumer login
- Consumer login: email/password + Google sign-in
- Consumer signup: name, email, password → `authService.signUp()` +
  `updateUserProfile()`
- "Back to school login" link returns to school code entry

The auth store's `loginWithGoogle` and `login` methods handle consumer users (no
tenantId, no membership). The `RequireAuth` guard without `allowedRoles` permits
any authenticated user, which covers consumers.

---

## 5. Router Updates

### Before (apps/student-web/src/App.tsx)

```
/login                          → LoginPage (AuthLayout)
/                               → DashboardPage (AppLayout, requires student role)
/spaces, /spaces/:id, etc.      → Space pages (AppLayout, requires student role)
/consumer                       → ConsumerDashboardPage (RequireAuth only, no layout)
```

### After

```
/login                          → LoginPage (AuthLayout)

── B2B School Routes (RequireAuth allowedRoles=['student'] + AppLayout) ──
/                               → DashboardPage
/spaces                         → SpacesListPage
/spaces/:spaceId                → SpaceViewerPage
/spaces/:spaceId/story-points/… → StoryPointViewerPage
/spaces/:spaceId/test/…         → TimedTestPage
/spaces/:spaceId/practice/…     → PracticeModePage
/results                        → ProgressPage
/notifications                  → NotificationsPage

── B2C Consumer Routes (RequireAuth + ConsumerLayout) ──
/consumer                       → ConsumerDashboardPage
/my-spaces                      → ConsumerDashboardPage (alias)
/store                          → StoreListPage
/store/:spaceId                 → StoreDetailPage
/profile                        → ConsumerProfilePage
```

### Key Design: Dual Layout System

- **AppLayout:** School student sidebar (Dashboard, My Spaces, Tests, Results,
  Leaderboard, Chat Tutor) with tenant switcher and notification bell
- **ConsumerLayout:** Consumer sidebar (My Learning, Space Store, Profile) —
  simpler, no tenant context

Both layouts use the shared `AppShell` + `AppSidebar` components from
`@levelup/shared-ui`.

---

## 6. Design Decisions

### D1: Separate ConsumerLayout vs. reusing AppLayout

**Decision:** Created a dedicated `ConsumerLayout` rather than conditionally
rendering in `AppLayout`.

**Rationale:** Consumer users have fundamentally different navigation (no tenant
switcher, no notifications, no class-based content). Separate layouts keep each
clean and avoid complex conditional rendering. Both share the same
`AppShell`/`AppSidebar` primitives from shared-ui.

### D2: Cloud function for listing vs. direct Firestore query

**Decision:** `listStoreSpaces` is a callable cloud function, not a direct
client Firestore query.

**Rationale:** (1) The store listing may eventually be publicly accessible
without auth — cloud functions support this more flexibly than Firestore rules.
(2) We return a curated `StoreSpaceSummary` subset rather than full Space
documents, reducing bandwidth. (3) Server-side pagination and filtering is more
controlled. The detail page (`StoreDetailPage`) does read directly from
Firestore for a single doc since it's simpler and the rules allow it.

### D3: MVP purchase without payment gateway

**Decision:** `purchaseSpace` records the enrollment and transaction without
actual payment processing. `paymentToken` parameter is reserved.

**Rationale:** Per task spec — payment integration is not in scope for Phase 10.
The function correctly validates, prevents duplicate enrollment, generates a
transaction ID, and atomically updates the user document. When a payment
provider is added later, the `paymentToken` parameter and a verification step
slot in naturally before the enrollment write.

### D4: Store space as copy under platform_public

**Decision:** `publishToStore` copies space metadata to
`/tenants/platform_public/spaces/{spaceId}` rather than creating a
reference/pointer.

**Rationale:** (1) The `platform_public` tenant pattern was already established
in Firestore rules. (2) A copy allows the store listing to evolve independently
(e.g., different description, pricing changes) without affecting the source
tenant's space. (3) `sourceTenantId` is stored for provenance. (4) Content
(story points, items) remains in the source tenant — the space viewer already
supports cross-tenant content access per existing architecture.

### D5: Consumer-to-school transition via login page

**Decision:** The ConsumerProfilePage has a "Join a School" CTA that links to
`/login` for school code entry.

**Rationale:** Per ADR-007, consumer data should be preserved when a school
membership is added. The existing login flow already handles school code lookup
and credential creation. A future enhancement could add a dedicated "link
account" modal, but for MVP the login page redirect achieves the same outcome —
the auth system can detect if the email matches an existing consumer user and
merge memberships.

### D6: `__name__` query for enrolled spaces

**Decision:** `ConsumerDashboardPage` fetches enrolled space details using
`where('__name__', 'in', enrolledIds)` with a 30-item batch limit.

**Rationale:** Firestore's `in` operator supports up to 30 values. For MVP, 30
enrolled spaces is sufficient. If users exceed this, the query can be batched or
switched to individual `getDoc` calls. This avoids a dedicated cloud function
for the dashboard — enrolled space IDs are already on the user document.
