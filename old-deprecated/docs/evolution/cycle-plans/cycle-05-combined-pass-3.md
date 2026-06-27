# Evolution Cycle 5: Combined Pass 3 — Completion & Polish

## Cycle Goal

Final combined pass covering **Feature Completion + Integration + Quality + UX
Polish** across ALL 13 verticals (V1-V13). Push from 95% to **100%
feature-complete**. Fix ALL remaining issues from Cycles 3-4. Every feature
works, every integration is solid, every edge case is handled, and the UX is
polished to near-production quality.

## How This Cycle Works

This is the FINAL combined pass. After this, no more feature work — only
performance, security, testing, docs, and production prep remain.

1. **Feature**: 100% complete — zero missing features, zero stubs, zero TODOs
2. **Integration**: 100% solid — all cross-vertical flows work flawlessly
3. **Quality**: All bugs fixed, all edge cases handled, all validation in place
4. **UX**: Near-production polish — consistent, smooth, professional feel

## Execution Strategy

Same tier-based parallelization. Each vertical: **Plan → Implement → Test**.

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

Same 3-phase structure. Workers MUST read Cycle 3 AND Cycle 4 outputs first,
then fix everything remaining. Output to: cycle5-plan.md, cycle5-changelog.md,
cycle5-test-report.md

---

## Vertical-by-Vertical Instructions

### V1: Type System (🏗️ Foundation Architect)

**Feature**: Zero `any` types. All branded types. All Zod schemas. Complete
glossary. Complete barrel exports. DONE. **Integration**: `tsc --noEmit` passes
with zero errors across entire monorepo. Zero circular dependencies. All type
contracts verified. **Quality**: All strict null checks in place. All runtime
guards at boundaries. All discriminated unions for status fields. **UX**: Full
JSDoc on all exports. Type aliases for all complex types. Developer experience
is excellent.

### V2: API (🏗️ Foundation Architect)

**Feature**: All 25 endpoints production-ready. Zero deprecated code. All
frontend services using new API. **Integration**: Every frontend service → API →
response chain verified. Error propagation works for every endpoint and error
type. **Quality**: All Zod validation with perfect error messages. All edge
cases handled. Request deduplication active. Rate limiting verified. **UX**:
Optimistic updates on all save operations. Pagination with metadata on all
lists. All error messages user-friendly and actionable.

### V3: Error Handling (🏗️ Foundation Architect)

**Feature**: Complete error hierarchy, rate limiting, TTLs, cleanup, cascade
deletes, error boundaries. **Integration**: Full-stack error propagation
verified for every error type. Rate limiting tested under load. Cleanup verified
with realistic data. **Quality**: Zero swallowed errors. Structured logging
everywhere. Circuit breakers on external services. Graceful degradation works.
**UX**: All toasts polished with icons, copy, retry. Recovery suggestions for
every error type. Progress indicators on all long operations.

### V4: Learning Platform (📚 Learning Engineer)

**Feature**: ALL content features complete and working. Space lifecycle,
templates, cloning, versioning, all item types, editor, progress, resume,
search. **Integration**: Complete content → enrollment → learning → progress →
dashboard pipeline verified. Content + AI integration solid. **Quality**:
Concurrent editing handled. Missing media graceful. Large dataset performance
verified. All inputs validated. **UX**: Smooth transitions. Polished
breadcrumbs. Keyboard shortcuts. Animated progress. Auto-save with indicator.
Unsaved changes warning.

### V5: AutoGrade & AI (🤖 AI & Grading Engineer)

**Feature**: ALL grading features complete. OCR, batch grading, confidence,
review, chat, observability, image quality. **Integration**: Full grading
pipeline end-to-end with V6 exams, V9 dashboards, V7 admin metrics. AI chat
contextual with V4 content. **Quality**: All AI failures handled gracefully. All
edge cases (blank, illegible, mixed language). Retry/backoff solid. Cost
tracking accurate. **UX**: AI chat feels natural (typing indicator, smooth
flow). Grading review interface is efficient. Confidence indicators clear.
Loading states smooth.

### V6: Digital Testing (📚 Learning Engineer)

**Feature**: ALL testing features complete. Lifecycle, timer, navigation, all
question types, presets, question bank, analytics, adaptive testing.
**Integration**: Full assess → grade → results pipeline with V5 and V9. Question
bank linked to V4 content topics. **Quality**: Browser crash recovery works.
Auto-save reliable. Timer handles all edge cases. Concurrent sessions safe.
Submission validation complete. **UX**: Test-taking is distraction-free and
smooth. Question navigation intuitive. Result reveal delightful. Timer urgency
clear. Confetti on passing.

### V7: Admin Dashboards (🔧 Platform Engineer)

**Feature**: ALL admin features complete for both super admin and school admin
portals. **Integration**: All dashboards show accurate real data from V4, V5,
V6. All admin actions propagate correctly. **Quality**: Pagination, search,
filters work for any data volume. All forms validated. Confirmation on
destructive actions. Empty states handled. **UX**: Animated charts. Polished
data tables. Quick actions. Keyboard shortcuts. Breadcrumbs. Smooth sidebar.
Professional admin feel.

### V8: Multi-Tenancy (🔧 Platform Engineer)

**Feature**: ALL multi-tenancy features complete. Onboarding, branding, billing,
analytics, isolation, export, permissions, wizard. **Integration**: Complete
tenant isolation verified across V4-V7. Billing captures all usage. Branding
applies across all tenant views. **Quality**: Firestore rules 100% secure. All
tenant edge cases handled. Data export complete and accurate. Concurrent
operations safe. **UX**: Onboarding wizard smooth and guiding. Branding preview
live. Role switching seamless. Welcome tour helpful.

### V9: User Experience (🎨 Design Systems Engineer)

**Feature**: ALL role portals complete. Student (dashboard, achievements,
notifications, planner, leaderboard, resume). Parent (progress, notifications,
alerts, multi-child). Teacher (dashboard, assignments, grading, reports,
content). PDF export. **Integration**: All dashboards show correct, real-time
data from all backend verticals. Notifications flow end-to-end. **Quality**:
Zero UI bugs. All states handled (loading/error/empty/offline). All inputs
validated with inline errors. **UX**: Student gamification is delightful. Parent
data viz is clear. Teacher workflow is efficient. PDF reports are professional.

### V10: Design System (🎨 Design Systems Engineer)

**Feature**: ALL design system components complete and adopted across all 5
apps. Design tokens complete. Accessibility WCAG AA. **Integration**: Every view
in every app uses shared-ui consistently. Dark/light mode works everywhere. All
cross-vertical views styled correctly. **Quality**: All components handle
extreme content. All states verified. Zero style inconsistencies between apps.
**UX**: All animations at 250ms ease-out. Skeleton shimmer everywhere. Empty
states with illustrations. Focus rings smooth. Hover effects subtle. Color
hierarchy perfect. App feels premium.

### V11: Performance (⚡ Performance Engineer)

**Feature**: PWA complete (manifest, SW, offline, install). Code splitting done.
Bundle optimized. Images optimized. Responsive complete at all breakpoints.
**Integration**: Performance targets met with full feature set: FCP < 1.5s, TTI
< 3s. Mobile responsive on all integrated views. **Quality**: Zero memory leaks.
All Firestore queries indexed. PWA cache correct. 3G performance acceptable.
**UX**: 60fps everywhere. Blur-up placeholders. Route prefetching. Instant
transitions. Smart PWA install.

### V12: Testing (🧪 QA Engineer)

**Feature**: E2E for all 5 apps + cross-app journeys. Unit tests for all
functions. Integration tests for security rules + auth + tenancy. CI/CD fully
automated. **Integration**: Cross-vertical E2E journeys all pass. CI runs full
suite successfully. **Quality**: Zero flaky tests. All edge cases covered. All
negative tests. Coverage > 80%. **UX**: Visual regression tests complete.
Animation tests. Screenshot tests at all breakpoints. Test execution < 10 min.

### V13: Marketing Website (🌐 Marketing Site Builder)

**Feature**: ALL pages complete: hero, features, how-it-works, demo, pricing,
testimonials, FAQ, contact form. Full SEO (meta, OG, JSON-LD, sitemap, robots).
**Integration**: Pricing matches V8 billing. Features match V4-V10. Screenshots
from real app. Links work. Forms deliver. **Quality**: Zero broken links. All
forms validate. All responsive. Cross-browser verified. SEO audit clean. **UX**:
Hero animation polished. Scroll animations smooth. Carousel smooth. Mobile menu
polished. Lighthouse 95+ across all pages.

---

## Quality Gates (100% Feature Complete Verification)

- [ ] `pnpm build` + `pnpm lint` — zero errors
- [ ] All tests pass (unit + E2E + integration)
- [ ] Zero known bugs
- [ ] Zero TODO/FIXME/HACK comments in code
- [ ] All 13 verticals at 100% feature complete
- [ ] All cross-vertical integrations verified
- [ ] All edge cases handled
- [ ] All UX polished to near-production quality
- [ ] Marketing website complete and matching product
- [ ] App feels professional and sellable

## After This Cycle

The app is 100% feature-complete. Remaining cycles focus on:

- Cycle 6: Performance optimization
- Cycle 7: Security hardening
- Cycle 8: Testing coverage
- Cycle 9: Documentation
- Cycle 10: Production readiness
- Cycle 11: Final polish & ship
