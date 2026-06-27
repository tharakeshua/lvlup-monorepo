# Evolution Cycle 8: Security & Resilience

## Cycle Goal

Harden every vertical against security threats and ensure the system is
resilient to failures. After this cycle, the app should pass a security audit,
handle infrastructure failures gracefully, and protect user data at every layer.

## Execution Strategy

Same tier-based parallelization. Each vertical: Plan → Implement → Test.

## Team Member → Vertical Mapping

Same as all cycles — see cycle-03-feature-completion.md for full mapping table.

---

## Vertical-by-Vertical Instructions

### V1: Type System (🏗️ Foundation Architect)

- Audit types for security: ensure no sensitive fields are exposed in
  public-facing types
- Add readonly modifiers to types that should be immutable
- Verify generic constraints prevent unsafe type widening
- Ensure no type assertions (`as any`, `as unknown`) bypass security checks

### V2: API (🏗️ Foundation Architect)

- Security audit all 25 callable endpoints: auth checks, input sanitization,
  output filtering
- Verify no endpoint returns sensitive data (passwords, tokens, internal IDs)
- Add request signing/validation for webhook endpoints
- Implement API key rotation strategy for external service integrations
- Add CORS configuration audit — ensure only allowed origins
- Implement request body size limits on all endpoints

### V3: Error Handling (🏗️ Foundation Architect)

- Ensure error messages don't leak internal details (stack traces, file paths,
  query structures)
- Add security-sensitive error logging (auth failures, permission denials,
  suspicious patterns)
- Implement account lockout after N failed login attempts
- Add anomaly detection for unusual API usage patterns
- Implement proper secret management (no hardcoded keys, use environment
  variables)
- Audit all .env files and .gitignore for leaked secrets

### V4: Learning Platform (📚 Learning Engineer)

- Validate all uploaded content (file type, size, malware scan hooks)
- Sanitize all rich text content (prevent XSS in content items)
- Ensure content access respects enrollment and tenant boundaries
- Add content integrity checks (detect tampering)
- Implement content moderation hooks for user-generated content

### V5: AutoGrade & AI (🤖 AI & Grading Engineer)

- Secure AI prompts against prompt injection attacks
- Validate all AI API responses before processing (prevent malicious responses)
- Implement AI safety filters (detect inappropriate content in student
  answers/chat)
- Secure OCR pipeline against malicious file uploads (zip bombs, oversized
  images)
- Add AI usage audit trail (who used what, when)
- Implement cost caps per tenant to prevent abuse

### V6: Digital Testing (📚 Learning Engineer)

- Implement anti-cheating measures: tab-switch detection, copy-paste prevention
  (optional), session fingerprinting
- Secure test session tokens (prevent session hijacking)
- Validate submission timing (reject submissions after test expiry)
- Encrypt sensitive test content at rest
- Add test integrity logging (track suspicious behavior)

### V7: Admin Dashboards (🔧 Platform Engineer)

- Implement audit logging for all admin actions (who did what, when)
- Add two-factor authentication option for admin accounts
- Verify admin role checks on every protected route (frontend + backend)
- Implement session timeout for admin portals
- Add IP allowlisting option for super admin access

### V8: Multi-Tenancy (🔧 Platform Engineer)

- **Full security rules audit**: Verify every Firestore rule enforces tenant
  isolation
- Test cross-tenant data access attempts (should all fail)
- Implement tenant-level encryption keys (preparation for enterprise)
- Add data residency awareness (metadata for compliance)
- Verify tenant deactivation completely blocks all access
- Implement secure tenant data export (encrypted, time-limited download links)

### V9: User Experience (🎨 Design Systems Engineer)

- Add CSRF protection on all forms
- Implement secure password requirements UI (strength indicator)
- Add session expiry warning with graceful re-authentication
- Verify no sensitive data displayed in URL parameters
- Implement secure file upload UI (type/size validation before upload)

### V10: Design System (🎨 Design Systems Engineer)

- Audit all components for XSS vectors (dangerouslySetInnerHTML usage,
  href="javascript:")
- Ensure all external links use rel="noopener noreferrer"
- Verify no component stores sensitive data in localStorage without encryption
- Add Content Security Policy (CSP) headers
- Implement Subresource Integrity (SRI) for CDN resources

### V11: Performance (⚡ Performance Engineer)

- Add HTTP security headers (HSTS, X-Frame-Options, X-Content-Type-Options)
- Implement service worker security (scope limitation, update validation)
- Ensure PWA cache doesn't store sensitive data unencrypted
- Add secure cookie flags (HttpOnly, Secure, SameSite)
- Implement network request integrity (HTTPS everywhere)

### V12: Testing (🧪 QA Engineer)

- Add security-focused test suite: auth bypass attempts, XSS injection, SQL
  injection (Firestore equivalent)
- Test Firestore security rules exhaustively (every collection, every role,
  every operation)
- Add penetration testing scenarios in E2E
- Test for common OWASP Top 10 vulnerabilities
- Add dependency vulnerability scanning to CI (npm audit, Snyk)
- Test RBAC: verify each role can only access their permitted resources

### V13: Marketing Site (🌐 Marketing Site Builder)

- Add security headers to static site hosting
- Implement form submission spam protection (honeypot, rate limiting)
- Ensure no tracking scripts leak user data
- Add privacy policy and terms of service pages
- Verify GDPR/data privacy compliance indicators

---

## Quality Gates

- [ ] Zero security vulnerabilities in `npm audit`
- [ ] All Firestore security rules tested (every collection, every role)
- [ ] No sensitive data in client-side storage (localStorage, cookies) without
      encryption
- [ ] All admin actions logged in audit trail
- [ ] No XSS vectors in any component
- [ ] CORS correctly configured (no wildcard origins in production)
- [ ] All secrets managed via environment variables (none in code)
- [ ] Rate limiting active on all endpoints
