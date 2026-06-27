# Evolution Cycle 11: Production Readiness

## Cycle Goal

Prepare every vertical for production deployment. Address all remaining issues
that would prevent shipping to real users: production Firebase configuration,
monitoring, alerting, backup strategy, deployment automation, and operational
readiness.

## Execution Strategy

Same tier-based parallelization. Each vertical: Plan → Implement → Test.

## Team Member → Vertical Mapping

Same as all cycles — see cycle-03-feature-completion.md for full mapping table.

---

## Vertical-by-Vertical Instructions

### V1: Type System (🏗️ Foundation Architect)

- Final type audit — run `tsc --noEmit` with strictest settings, zero errors
- Verify all type exports work correctly when consumed by all 5 apps and 4
  function modules
- Lock down type package version (semver, changelog)
- Ensure no development-only types leak into production builds

### V2: API (🏗️ Foundation Architect)

- Configure production Cloud Functions: memory, timeout, min/max instances,
  region
- Set up function monitoring (execution count, error rate, latency P50/P95/P99)
- Implement graceful function cold-start handling
- Add request tracing (correlation IDs across function chains)
- Configure production CORS origins
- Set up Cloud Function alerting (error rate > threshold → notification)

### V3: Error Handling (🏗️ Foundation Architect)

- Configure production error logging (Firebase Crashlytics or equivalent)
- Set up error alerting rules (critical errors → immediate notification,
  warnings → daily digest)
- Verify rate limiting works under production load
- Test scheduled cleanup functions on production data volume
- Configure error budgets and SLOs

### V4: Learning Platform (📚 Learning Engineer)

- Test with realistic data volumes (500+ spaces, 10K+ items, 50K+ progress
  records)
- Verify all Firestore indexes exist for production queries
- Test content delivery under load (many students accessing same space
  simultaneously)
- Verify all file storage (images, videos) uses production Firebase Storage
  bucket
- Configure Firestore backup for content collections

### V5: AutoGrade & AI (🤖 AI & Grading Engineer)

- Configure production Gemini API keys and quotas
- Set up AI cost monitoring and alerting (per-tenant, per-day, per-month)
- Test grading pipeline under production load (50 concurrent submissions)
- Verify AI safety filters work in production (test with adversarial inputs)
- Set up AI model versioning (pin to specific model version)
- Configure fallback behavior for AI API outages

### V6: Digital Testing (📚 Learning Engineer)

- Test with realistic test volumes (100+ students taking test simultaneously)
- Verify Firestore indexes for test query patterns
- Test auto-submit under network instability
- Configure test session cleanup for production (24h TTL + scheduled cleanup)
- Verify test data integrity under concurrent modifications

### V7: Admin Dashboards (🔧 Platform Engineer)

- Configure production analytics aggregation (scheduled functions for metrics)
- Test admin operations at production scale (1000+ students, 100+ classes)
- Set up admin action audit log with 90-day retention
- Configure admin session management (timeout, multi-device handling)
- Set up system health dashboard with real production metrics

### V8: Multi-Tenancy (🔧 Platform Engineer)

- Final security rules audit with production scenarios
- Configure production tenant limits (max students, max storage per tier)
- Set up tenant usage monitoring and alerting
- Test tenant isolation with production-like data volumes
- Configure production backup strategy for tenant data
- Set up tenant SLA monitoring

### V9: User Experience (🎨 Design Systems Engineer)

- Final cross-browser testing (Chrome, Firefox, Safari, Edge — latest 2
  versions)
- Final mobile device testing (iOS Safari, Android Chrome)
- Verify all user flows work on production Firebase (not just emulator)
- Test with real user data patterns (realistic names, realistic content)
- Configure error tracking for frontend (source maps, error boundaries
  reporting)

### V10: Design System (🎨 Design Systems Engineer)

- Final visual QA pass across all 5 apps
- Verify all components render correctly in production build (no dev-only
  features)
- Confirm all animation performance in production build
- Verify dark/light mode works on all production pages
- Ensure no console warnings or errors in production build

### V11: Performance (⚡ Performance Engineer)

- Production build performance audit (Lighthouse on production URLs)
- Verify service worker and PWA work on production domain
- Configure CDN caching headers for static assets
- Test under realistic production load (simulate 200 concurrent users)
- Configure performance monitoring (Web Vitals reporting)
- Verify production bundle sizes are within budget
- Set up performance degradation alerting

### V12: Testing (🧪 QA Engineer)

- CI/CD pipeline fully configured for production deployment
- Staging environment set up and tested
- Blue-green or canary deployment strategy documented
- Rollback procedure documented and tested
- Post-deployment smoke test suite
- Production monitoring dashboard
- Incident response runbook created

### V13: Marketing Site (🌐 Marketing Site Builder)

- Production domain configured with SSL
- CDN configured for global distribution
- Analytics integration (Google Analytics or similar)
- Contact form connected to production CRM/email
- SEO verified with Google Search Console
- Social media preview tags tested
- Verify all links point to production app URLs

---

## Quality Gates

- [ ] All 5 apps + 4 function modules deploy to production Firebase without
      errors
- [ ] Production monitoring is active and alerting works
- [ ] Firestore backup strategy tested and documented
- [ ] All production environment variables configured (no dev/test values)
- [ ] Performance meets targets on production infrastructure
- [ ] Security headers configured on production hosting
- [ ] SSL/TLS configured correctly on all domains
- [ ] CI/CD pipeline deploys to staging on PR merge, production on release
- [ ] Rollback procedure documented and tested
- [ ] Operational runbook created for common scenarios
