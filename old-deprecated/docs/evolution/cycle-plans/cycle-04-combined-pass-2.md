# Evolution Cycle 4: Combined Pass 2 — Refinement

## Cycle Goal

Second combined pass covering **Feature Completion + Integration + Quality + UX
Polish** across ALL 13 verticals (V1-V13). Build on Cycle 3's 80% state and push
to ~95%. Complete remaining features, fix integration gaps found in Cycle 3,
handle edge cases, and refine the UX to near-final quality.

## How This Cycle Works

Same structure as Cycle 3 but DEEPER. For each vertical:

1. **Feature**: Complete any features still missing after Cycle 3
2. **Integration**: Fix cross-vertical gaps discovered in Cycle 3
3. **Quality**: Handle edge cases, improve validation, fix all known bugs
4. **UX**: Refine animations, polish states, improve micro-interactions

## Execution Strategy

Same tier-based parallelization as Cycle 3. Each vertical: **Plan → Implement →
Test**.

### Parallelization

```
TIER 1 (Sequential — 🏗️ Foundation Architect): V1 → V2 → V3
TIER 2 (V4 ∥ V5 parallel, then V6): V4 ∥ V5 → V6
TIER 3 (Sequential — 🔧 Platform Engineer): V7 → V8
TIER 4 (Sequential — 🎨 Design Systems Engineer): V9 → V10
TIER 5 (All parallel): V11 ∥ V12 ∥ V13
```

## Team Member → Vertical Mapping

| Team Member                | ID                         | Verticals  |
| -------------------------- | -------------------------- | ---------- |
| 🏗️ Foundation Architect    | tm_1772827423990_e254lbuxp | V1, V2, V3 |
| 📚 Learning Engineer       | tm_1772827431038_ba107mn2u | V4, V6     |
| 🤖 AI & Grading Engineer   | tm_1772827435178_pdjja48sg | V5         |
| 🔧 Platform Engineer       | tm_1772827442479_ubakln3h3 | V7, V8     |
| 🎨 Design Systems Engineer | tm_1772827447174_t1bzhuvt8 | V9, V10    |
| ⚡ Performance Engineer    | tm_1772827454409_bun9c5rcc | V11        |
| 🧪 QA Engineer             | tm_1772827458070_4g36ik1na | V12        |
| 🌐 Marketing Site Builder  | (create if needed)         | V13        |

## Per-Phase Worker Instructions

Same 3-phase structure (Plan → Implement → Test). Workers should:

1. **Read Cycle 3 outputs** first: /docs/evolution/{vertical-id}/cycle3-plan.md,
   cycle3-changelog.md, cycle3-test-report.md
2. Identify what's still at <95% and fix it
3. Output to: cycle4-plan.md, cycle4-changelog.md, cycle4-test-report.md

---

## Vertical-by-Vertical Instructions

### V1: Type System (🏗️ Foundation Architect)

**Feature**: Verify zero `any` types remain. Complete any missing branded types
or Zod schemas. **Integration**: Run full type-check across all 5 apps + 4
function modules — fix all errors. Verify no circular dependencies. **Quality**:
Add strict null checks everywhere. Add discriminated unions for all status
fields. Add runtime type guards at every external boundary. **UX**: Complete
JSDoc documentation with usage examples. Add type aliases for complex union
types.

### V2: API (🏗️ Foundation Architect)

**Feature**: Verify all 25 endpoints fully functional. Remove any remaining
deprecated endpoints. **Integration**: Test every frontend service → API
endpoint connection. Verify error propagation chain works for every endpoint.
**Quality**: Add comprehensive Zod validation with human-readable errors. Handle
all edge cases (empty, null, oversized, malformed). Add request deduplication.
**UX**: Implement optimistic updates for save operations. Add pagination
metadata to all list endpoints. Polish error messages to be user-actionable.

### V3: Error Handling (🏗️ Foundation Architect)

**Feature**: Verify all error classes, rate limiting, TTLs, cleanup functions,
cascade deletes work correctly. **Integration**: Test full error propagation:
function → service → store → boundary → toast. Verify rate limiting across all
endpoints with concurrent requests. **Quality**: Audit every try/catch — no
swallowed errors. Add structured logging with correlation IDs. Implement circuit
breaker for external services. **UX**: Polish all error toasts (icons, copy,
retry buttons). Add recovery suggestions. Add progress indicators for long
operations.

### V4: Learning Platform (📚 Learning Engineer)

**Feature**: Complete any remaining content features. Verify space templates,
cloning, versioning all work. **Integration**: Test teacher creates → publishes
→ student enrolls → learns → completes → progress flows to parent/teacher
dashboards. **Quality**: Test concurrent editing. Handle missing media
gracefully. Test with 100+ spaces, 1000+ items. **UX**: Refine transitions
between content. Polish breadcrumb navigation. Add keyboard shortcuts for
teachers. Animate progress visualization.

### V5: AutoGrade & AI (🤖 AI & Grading Engineer)

**Feature**: Complete any remaining pipeline features. Verify batch grading,
confidence scoring, cost tracking. **Integration**: Test full grading flow
end-to-end with V6 exams and V9 result dashboards. Verify AI chat uses V4
content context. **Quality**: Test AI API failures (timeout, rate limit, bad
response). Handle blank/illegible submissions. Verify retry with backoff.
**UX**: Polish AI chat (typing indicator, smooth responses). Polish grading
review (side-by-side, easy navigation). Refine confidence indicators.

### V6: Digital Testing (📚 Learning Engineer)

**Feature**: Complete all question types, adaptive testing, question bank
features. **Integration**: Full flow: assign → take → auto-submit → grade (V5) →
results in dashboard (V9). **Quality**: Test browser crash recovery. Test
auto-save. Handle timer edge cases (timezone, sleep, tab switch). Test
concurrent sessions. **UX**: Polish test-taking UI (distraction-free). Refine
question navigation. Polish result reveal with animations. Countdown timer with
visual urgency.

### V7: Admin Dashboards (🔧 Platform Engineer)

**Feature**: Verify all super admin and school admin features complete.
**Integration**: Verify dashboards pull real data from V4, V5, V6. Verify admin
actions propagate correctly. **Quality**: Handle pagination for 1000+ records.
Validate all form inputs. Add confirmation for destructive actions. Empty states
for new tenants. **UX**: Animated charts with count-up. Polish data tables
(sort, search, filter). Quick-action cards. Keyboard shortcuts for power users.

### V8: Multi-Tenancy (🔧 Platform Engineer)

**Feature**: Verify billing structure, tenant branding, data export, role
permissions all work. **Integration**: Verify complete tenant isolation across
V4-V7. Test billing captures usage from all verticals. **Quality**: Full
Firestore security rules audit. Test deactivated tenant, expired subscription,
concurrent admin operations. **UX**: Polish onboarding wizard. Add branding
preview. Welcome tour for new tenants. Smooth role switching.

### V9: User Experience (🎨 Design Systems Engineer)

**Feature**: Verify all role portals complete (student achievements, parent
multi-child, teacher batch grading, PDF reports). **Integration**: Verify all
dashboards show correct data from V4, V5, V6, V7. **Quality**: Fix all remaining
UI bugs. Handle all empty/error/loading states. Validate all user inputs.
**UX**: Polish gamification (XP bars, level-up animations, badges with shine,
streaks). Clean data viz for parents. Efficient teacher workflows. Gesture-based
mobile navigation.

### V10: Design System (🎨 Design Systems Engineer)

**Feature**: Verify all shared-ui components complete and used consistently
across all 5 apps. **Integration**: Verify loading/error/empty states work for
all cross-vertical data fetches. Dark/light mode on all views. **Quality**: Test
components with extreme content. Verify all state handling
(loading/error/disabled). Fix style inconsistencies. **UX**: Refine all
micro-animations (250ms ease-out). Skeleton shimmer everywhere. Polish empty
state illustrations. Smooth focus rings. Hover effects. Color hierarchy
consistency.

### V11: Performance (⚡ Performance Engineer)

**Feature**: Verify PWA fully functional. Code splitting complete. Bundle
optimized. **Integration**: Performance audit with full feature set (FCP < 1.5s,
TTI < 3s). Verify code splitting with cross-vertical imports. **Quality**: Fix
memory leaks. Fix render performance issues. Optimize Firestore queries. Test on
3G. **UX**: 60fps animations. Blur-up image placeholders. Route prefetching.
Instant page transitions.

### V12: Testing (🧪 QA Engineer)

**Feature**: Verify complete E2E coverage for all 5 apps. Unit tests for all
Cloud Functions. CI/CD pipeline working. **Integration**: Cross-vertical E2E
journeys. Test CI with full integration suite. **Quality**: Fix flaky tests. Add
edge case scenarios. Add negative testing. Coverage > 75%. **UX**: Visual
regression tests. Test animations with reduced-motion. Screenshot tests at all
breakpoints.

### V13: Marketing Website (🌐 Marketing Site Builder)

**Feature**: Complete all pages. Verify pricing matches V8 billing tiers. All
forms functional. **Integration**: Live product screenshots from actual app.
Links to product work. Feature descriptions accurate. **Quality**: All links
work. Forms validate correctly. Responsive at all breakpoints. Cross-browser
(Chrome, Firefox, Safari). **UX**: Refine hero animation. Polish
scroll-triggered effects. Testimonial carousel smooth. Mobile menu polished.
Lighthouse 90+.

---

## Quality Gates

- [ ] `pnpm build` + `pnpm lint` — zero errors
- [ ] All tests pass (unit + E2E)
- [ ] All cross-vertical user journeys work without errors
- [ ] No known bugs remaining from Cycle 3
- [ ] All edge cases from Cycle 3 test reports addressed
- [ ] All UI states (loading/error/empty) polished
- [ ] Marketing website matches product features accurately
- [ ] All verticals at ≥95% feature complete
