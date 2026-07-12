# 03 — Parent Journey (`apps/parent-web`)

**Port:** `4571` (`vite.config.ts`)  
**Local URL:** http://localhost:4571  
**Allowed roles:** `parent`  
**Credentials:** see [`TEST_CREDENTIALS.md`](../../TEST_CREDENTIALS.md) (e.g. `suresh.patel@gmail.com` / `Test@12345` / `GRN001`)

---

## Login start (exact steps)

1. Open http://localhost:4571/login
2. **School code** → `lookupTenantByCode` + `evaluateTenantAccess`
3. **Email + password** → `loginWithSchoolCode`
4. Optional: **Forgot password?** → Firebase `sendPasswordResetEmail`
5. Land on `/` Dashboard

### Session

- `useAuthStore.initialize()` + `useTenantStore.subscribe(currentTenantId)`
- Tenant switch: `useAuthStore.switchTenant` → `callSwitchActiveTenant`
- Claims typically include `parentId` + `studentIds` (linked children)

---

## Guards / empty & error states

| Condition | Behavior |
|-----------|----------|
| Loading | Loading UI |
| No auth | Redirect `/login` |
| Wrong role | Inline **Access Denied** |
| Unknown route | `NotFoundPage` |
| No linked children | Dashboard/children empty states (UI-dependent; parents cannot invent links) |

Parents **never** author content or trigger Gemini autograde.

---

## Full route tree (`App.tsx`)

| Path | Page | Purpose |
|------|------|---------|
| `/login` | LoginPage | Auth |
| `/` | DashboardPage | Linked children overview, at-risk, quick links |
| `/children` | ChildrenPage | List linked students (read-oriented) |
| `/results` | ExamResultsPage | Released autograde + per-question accordion |
| `/progress` | SpaceProgressPage | LevelUp space completion |
| `/child-progress` | ChildProgressPage | Detailed progress + PDF |
| `/alerts` | PerformanceAlertsPage | At-risk / insight alerts |
| `/compare` | ChildComparisonPage | Side-by-side child metrics |
| `/notifications` | NotificationsPage | Inbox |
| `/settings` | SettingsPage | Notification prefs |

---

## Sidebar nav (`AppLayout.tsx`)

| Group | Label | Path |
|-------|-------|------|
| **Overview** | Dashboard | `/` |
| **My Children** | Children | `/children` |
| | Exam Results | `/results` |
| | Space Progress | `/progress` |
| | Child Progress | `/child-progress` |
| | Alerts | `/alerts` |
| | Compare Children | `/compare` |
| **Account** | Notifications | `/notifications` *(badge = unread)* |
| | Settings | `/settings` |

**Mobile bottom nav:** Home `/` · Children `/children` · Results `/results` · Alerts `/notifications`

**Footer:** `RoleSwitcher` (parent memberships only)

---

## Primary CTAs → APIs

| Action | API | Notes |
|--------|-----|-------|
| Download PDF report | `callGenerateReport` / `v1.analytics.generateReport` | ExamResults + ChildProgress |
| View linked children | `listLinkedChildren` / `getChildSummary` (or equivalent query hooks) | Dashboard / Children |
| Performance alerts | `listInsights` / parent alert hooks | **Rule-based, not LLM** |
| Mark notification read | notification hooks | Notifications |
| Switch school (multi-tenant parent) | `switchActiveTenant` | RoleSwitcher |

---

## AI on this journey

- **No direct Gemini callables** from parent UI
- Consumes **released** exam results and **rule-based** analytics insights / at-risk flags
- PDF generation is analytics reporting (not generative tutoring)

---

## How parent connects to other roles

| Upstream | Effect |
|----------|--------|
| Admin links parent ↔ students | Claims `studentIds`; Children list populates |
| Teacher releases exam results | Appear under `/results` |
| Student completes LevelUp spaces | Space / child progress pages update |
| Teacher / analytics schedulers | Alerts on `/alerts` |
| Admin | Can manage parent users; sees school-wide analytics |

**In-app links to student/teacher portals:** not present.
