# Evolution Cycle 7: Performance Pass

## Cycle Goal

Optimize every vertical for speed, efficiency, and minimal resource usage.
Target: all pages load in < 1.5s (FCP), interactive in < 3s (TTI), bundle sizes
minimized, Firestore reads reduced, and zero unnecessary re-renders.

## Execution Strategy

Same tier-based parallelization. Each vertical: Plan → Implement → Test.

## Team Member → Vertical Mapping

Same as all cycles — see cycle-03-feature-completion.md for full mapping table.

---

## Vertical-by-Vertical Instructions

### V1: Type System (🏗️ Foundation Architect)

- Audit type imports — ensure no circular dependencies causing large bundles
- Use `type` imports everywhere (`import type { X }`) to enable tree-shaking
- Verify barrel exports don't cause unnecessary module loading
- Optimize generic types to reduce TypeScript compilation time

### V2: API (🏗️ Foundation Architect)

- Add response compression for large payloads
- Implement cursor-based pagination for all list endpoints (replace
  offset-based)
- Add field selection (return only requested fields to reduce payload size)
- Cache frequently-read, rarely-changed data (evaluation presets, tenant config)
- Implement batch read operations (get multiple documents in one call)
- Add request deduplication (prevent duplicate concurrent requests)

### V3: Error Handling (🏗️ Foundation Architect)

- Optimize logging — reduce log volume in production, use structured JSON
  logging
- Implement error rate sampling (don't log every instance of known errors)
- Optimize rate limiter storage (use in-memory for hot path, Firestore for
  persistence)
- Profile and optimize cleanup Cloud Functions execution time

### V4: Learning Platform (📚 Learning Engineer)

- Implement virtual scrolling for long content lists (spaces, story points)
- Add Firestore query pagination with cursor-based loading
- Cache space metadata locally (avoid re-fetching on every navigation)
- Lazy load rich content (images, videos) with intersection observer
- Optimize progress calculation queries (aggregate on write, not read)
- Prefetch next likely content item

### V5: AutoGrade & AI (🤖 AI & Grading Engineer)

- Optimize OCR processing pipeline (parallel extraction where possible)
- Implement grading queue with priority levels (single vs batch)
- Cache LLM responses for identical questions (evaluation preset + answer =
  cached grade)
- Optimize AI chat context window (summarize old messages instead of sending
  full history)
- Reduce Gemini API token usage through prompt optimization
- Add connection pooling for AI API calls

### V6: Digital Testing (📚 Learning Engineer)

- Optimize test session initialization (preload questions, prefetch assets)
- Implement efficient answer auto-save (debounced, only changed answers)
- Optimize evaluation computation (batch grade calculation, not per-question)
- Cache question bank queries with proper invalidation
- Reduce Firestore reads during active test sessions

### V7: Admin Dashboards (🔧 Platform Engineer)

- Implement server-side aggregation for dashboard metrics (don't compute in
  browser)
- Add dashboard data caching with TTL (refresh every 5 minutes, not every page
  load)
- Virtualize all data tables (handle 10K+ rows without lag)
- Implement lazy loading for dashboard widgets (load above-fold first)
- Optimize Firestore composite queries with proper indexes

### V8: Multi-Tenancy (🔧 Platform Engineer)

- Optimize tenant lookup (cache tenant config in memory per session)
- Reduce security rule evaluation complexity (fewer nested gets)
- Optimize bulk operations (batch writes for student/teacher management)
- Implement efficient data export (streaming, not in-memory)
- Profile and optimize tenant isolation checks in Cloud Functions

### V9: User Experience (🎨 Design Systems Engineer)

- Optimize dashboard rendering (React.memo for heavy components)
- Implement efficient notification polling (WebSocket or long-polling instead of
  frequent reads)
- Optimize chart rendering with data windowing
- Reduce initial render time for role portals (code-split role-specific
  components)
- Implement efficient PDF generation (server-side, not client-side)

### V10: Design System (🎨 Design Systems Engineer)

- Audit component re-render frequency (React DevTools Profiler)
- Optimize animation performance (use `transform` and `opacity` only, avoid
  layout thrash)
- Implement lazy loading for below-fold shared-ui components
- Reduce CSS bundle size (purge unused Tailwind classes)
- Optimize SVG icons (inline critical, lazy-load rest)

### V11: Performance (⚡ Performance Engineer)

- **Core Web Vitals audit**: LCP < 2.5s, FID < 100ms, CLS < 0.1 across all 5
  apps
- Bundle analysis: identify and eliminate duplicate dependencies
- Implement aggressive code splitting: vendor chunk, framework chunk, per-route
  chunks
- Add preload hints for critical resources
- Implement resource hints (dns-prefetch, preconnect for Firebase, Gemini API)
- Configure Vite build optimization: manualChunks, rollupOptions
- Implement HTTP/2 push or preload for critical assets
- Add Brotli compression for production builds
- Profile and optimize Vite HMR for development speed

### V12: Testing (🧪 QA Engineer)

- Add performance benchmarks to CI (fail if FCP > 2s)
- Add bundle size checks to CI (fail if bundle grows > 10%)
- Create load testing scripts (simulate 100 concurrent users)
- Add Lighthouse CI integration (fail PR if score drops)
- Profile test execution time and optimize slow tests

### V13: Marketing Site (🌐 Marketing Site Builder)

- Achieve 95+ Lighthouse performance score
- Optimize all images (WebP, AVIF, responsive srcset)
- Implement critical CSS inlining
- Add resource hints for third-party domains
- Ensure Time to First Byte < 200ms (static site should be fast)
- Implement efficient asset caching headers

---

## Quality Gates

- [ ] FCP < 1.5s on all 5 apps (tested on 4G throttled connection)
- [ ] TTI < 3s on all 5 apps
- [ ] Bundle size: main chunk < 200KB gzipped per app
- [ ] No unnecessary Firestore reads (audit with emulator stats)
- [ ] Zero memory leaks (verified with Chrome DevTools)
- [ ] Core Web Vitals pass on all pages
- [ ] Marketing site: Lighthouse 95+ performance
