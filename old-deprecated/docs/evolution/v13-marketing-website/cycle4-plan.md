# V13 Cycle 4 Plan: Marketing Website & Landing Pages

**Vertical**: V13 — Marketing Website & Landing Pages **Cycle**: 4 (Combined
Pass 2 — Refinement) **Status**: PLANNED **Date**: 2026-03-08 **Engineer**: 🌐
Marketing Site Builder

---

## Executive Summary

Cycle 3 delivered the foundation: 3 pages (Home, Pricing, Contact), 8
components, full SEO skeleton (meta, OG, Twitter, JSON-LD, sitemap, robots.txt),
scroll-reveal animations, and responsive layout — 38/38 tests passing at ~85%
completion. Cycle 4 pushes to ~95% by **polishing the hero and animations**,
**adding missing legal/content pages**, **creating a real OG image and favicon
set**, **achieving Lighthouse 90+**, **deepening WCAG AA compliance**, and
**integrating the contact form with a backend endpoint**.

---

## Current State Audit Summary

### Strengths

- Astro 5.x static site with Tailwind CSS + shared `@levelup/tailwind-config`
  tokens
- 3 well-structured pages with JSON-LD per page
- SEO: canonical URLs, OG tags, Twitter Card, sitemap-index.xml, robots.txt
- 8 polished components: Nav, Hero, Features, HowItWorks, Testimonials, FAQ,
  CTA, Footer
- Scroll-reveal IntersectionObserver animation system
- Pricing page with 4-tier grid + 11-feature comparison table
- Contact form with full client-side validation (6 fields, role/inquiry
  selectors)
- `prefers-reduced-motion` support in global CSS
- FERPA/COPPA compliance badge in footer
- Mobile hamburger menu with slide-in animation, scroll progress bar

### Gaps Identified

| #   | Gap                                       | Severity | Details                                                                                            |
| --- | ----------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| G1  | Hero mock dashboard is placeholder shapes | High     | SVG rectangles, not a real product screenshot or polished illustration                             |
| G2  | No OG image asset                         | High     | Layout references `/og-default.png` — file doesn't exist in `public/`                              |
| G3  | Missing legal/content pages               | High     | Footer links to `/blog`, `/privacy`, `/terms`, `/compliance`, `/cookies` — all 404                 |
| G4  | Contact form has no backend               | High     | Client-side validation only; form submit is placeholder (no API call, no email)                    |
| G5  | No skip-to-content link                   | Medium   | Required for WCAG AA keyboard navigation                                                           |
| G6  | No apple-touch-icon                       | Medium   | Only SVG favicon; no PNG fallback for iOS/Android                                                  |
| G7  | Font loading not optimized                | Medium   | Google Fonts loaded via stylesheet link — no `font-display: swap`, no preload for critical weights |
| G8  | No FAQ JSON-LD schema                     | Medium   | Homepage FAQ section exists but no FAQPage structured data for rich results                        |
| G9  | No breadcrumb JSON-LD on sub-pages        | Medium   | Pricing/Contact pages lack BreadcrumbList schema                                                   |
| G10 | Testimonial carousel no auto-play         | Low      | Manual nav only; no auto-advance option                                                            |
| G11 | No page transition animation              | Low      | Hard cuts between routes (Home→Pricing→Contact)                                                    |
| G12 | Pricing page lacks monthly/annual toggle  | Low      | Fixed monthly pricing only; no annual discount option                                              |
| G13 | CTA buttons lack micro-interactions       | Low      | No hover scale, press feedback, or ripple effects                                                  |
| G14 | No 404 page                               | Medium   | Astro default 404 instead of branded error page                                                    |
| G15 | Feature cards lack deeper exploration     | Low      | "Learn more" links go nowhere; no feature detail expansion                                         |

---

## Cycle 4 Phases

### Phase A: Missing Pages & Content (Priority: High)

**Estimated Files**: 8–10

#### A1. Privacy Policy Page — `website/src/pages/privacy.astro`

- Standard privacy policy for educational SaaS
- Sections: Information Collection, Use, Sharing, Security, Children's Privacy
  (COPPA), Data Retention, User Rights, Contact
- JSON-LD: WebPage schema
- Reuses Layout with SEO meta

#### A2. Terms of Service Page — `website/src/pages/terms.astro`

- Terms covering: Account Terms, Acceptable Use, Service Level, Intellectual
  Property, Termination, Limitation of Liability
- JSON-LD: WebPage schema

#### A3. FERPA Compliance Page — `website/src/pages/compliance.astro`

- Dedicated compliance page: FERPA, COPPA, SOC 2 Type II
- Data handling practices, parental consent procedures
- Compliance badges and certifications section
- JSON-LD: WebPage schema

#### A4. Cookie Policy Page — `website/src/pages/cookies.astro`

- Cookie types used (essential, analytics, preferences)
- How to manage cookies
- Third-party cookies disclosure
- JSON-LD: WebPage schema

#### A5. Blog Index Page — `website/src/pages/blog.astro`

- Placeholder blog landing page with "Coming Soon" state
- 3 placeholder article cards with titles and excerpts
- Styled consistently with the rest of the site
- JSON-LD: Blog schema

#### A6. 404 Page — `website/src/pages/404.astro`

- Branded 404 error page matching site design
- Friendly message, search suggestion, link to homepage
- Animated illustration (CSS-only)

---

### Phase B: Hero & Animation Polish (Priority: High)

**Estimated Files**: 5–7

#### B1. Hero Product Preview Upgrade — `website/src/components/Hero.astro`

- Replace placeholder SVG shapes with a high-fidelity CSS/HTML product mockup
- Browser chrome with realistic sidebar nav, metric cards with actual data
  labels, mini bar chart with bars and labels
- Add subtle floating animation to the entire mockup
- Gradient text animation smoothing (use `background-clip: text` with
  `gradient-shift` keyframe)
- Add hover parallax effect on product preview (CSS `transform: perspective()`)

#### B2. CTA Button Micro-Interactions — `website/src/styles/global.css`

- Add `btn-primary` hover: slight scale (1.02), shadow lift, color brighten
- Add `btn-primary` active: scale (0.98), shadow flatten
- Add `btn-secondary` hover: border color shift, background tint
- Transition: 150ms ease-out for all states
- Respect `prefers-reduced-motion`

#### B3. Page Transition via View Transitions — `website/src/layouts/Layout.astro`

- Enable Astro View Transitions API (`<ViewTransitions />`)
- Add `transition:animate` directives to Nav (persist), main content (fade),
  Footer (persist)
- Cross-fade between pages with 200ms duration
- Fallback: instant navigation for unsupported browsers

#### B4. Testimonial Carousel Auto-Play — `website/src/components/Testimonials.astro`

- Add auto-advance every 5 seconds
- Pause on hover / focus-within
- Pause when `prefers-reduced-motion` is set
- Add dot indicators below carousel showing current position
- Dot indicators are clickable for direct navigation

#### B5. Feature Cards Interactive Enhancement — `website/src/components/Features.astro`

- Add hover lift effect (translateY -4px, shadow increase)
- "Learn more" links scroll to expanded detail below the card grid (anchor
  targets)
- Add brief role-specific taglines below each card title
- Stagger animation refined: 100ms delay per card

---

### Phase C: SEO & Performance (Priority: High)

**Estimated Files**: 6–8

#### C1. OG Image & Favicon Set — `website/public/`

- Create `og-default.png` (1200×630): branded card with logo, tagline, gradient
  background
- Create `apple-touch-icon.png` (180×180): app icon for iOS
- Create `favicon-32x32.png` and `favicon-16x16.png` as PNG fallbacks
- Update Layout.astro `<head>` with full favicon manifest:
  ```html
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  ```

#### C2. FAQ Schema (JSON-LD) — `website/src/pages/index.astro`

- Add FAQPage structured data alongside existing SoftwareApplication schema
- Include all 8 FAQ items as Question/Answer pairs
- Enables Google rich results for FAQ

#### C3. Breadcrumb JSON-LD — `website/src/layouts/Layout.astro`

- Accept optional `breadcrumbs` prop: `Array<{ name: string, url: string }>`
- Render BreadcrumbList JSON-LD when provided
- Add to pricing.astro: `Home > Pricing`
- Add to contact.astro: `Home > Contact`
- Add to all new legal pages: `Home > Privacy`, `Home > Terms`, etc.

#### C4. Font Loading Optimization — `website/src/layouts/Layout.astro`

- Add `<link rel="preload">` for Inter 400 and 700 woff2 files
- Add `font-display: swap` to `@font-face` declarations
- Move Google Fonts from render-blocking `<link>` to async loading pattern:
  ```html
  <link
    rel="preload"
    href="fonts-url"
    as="style"
    onload="this.onload=null;this.rel='stylesheet'"
  />
  <noscript><link rel="stylesheet" href="fonts-url" /></noscript>
  ```

#### C5. Lighthouse Performance Audit & Fixes

- Ensure all images have `width`/`height` attributes (prevent CLS)
- Add `loading="lazy"` to below-fold content images
- Verify HTML compression is working (`compressHTML: true` in astro config)
- Inline critical CSS for above-fold content (Astro `inlineStylesheets: 'auto'`
  — verify)
- Minimize render-blocking resources
- Target: Performance 90+, Accessibility 95+, Best Practices 95+, SEO 100

#### C6. Sitemap Enhancement — `website/astro.config.mjs`

- Add `changefreq` and `priority` to sitemap entries
- Ensure all new pages (privacy, terms, compliance, cookies, blog, 404) are
  included
- Verify sitemap-index.xml references correct URLs

---

### Phase D: Accessibility (WCAG AA) (Priority: High)

**Estimated Files**: 8–10

#### D1. Skip-to-Content Link — `website/src/layouts/Layout.astro`

- Add visually hidden skip link as first focusable element:
  ```html
  <a href="#main-content" class="... sr-only focus:not-sr-only"
    >Skip to main content</a
  >
  ```
- Add `id="main-content"` to `<main>` element
- Visible only on focus with high-contrast styling

#### D2. Color Contrast Audit — `website/src/styles/global.css`

- Verify all text/background color pairs meet WCAG AA (4.5:1 for normal text,
  3:1 for large text)
- Known risk areas:
  - `muted-foreground` on `muted` background
  - Light gray text on white card backgrounds
  - Social proof text in hero section
  - Feature card descriptions
  - Footer link colors
- Fix any failing pairs by adjusting CSS variables

#### D3. ARIA Enhancements — Multiple components

- **Testimonials.astro**: Add `role="region"` with
  `aria-label="Customer testimonials"`, `aria-roledescription="carousel"`,
  `aria-live="polite"` for auto-play
- **FAQ.astro**: Verify `aria-expanded` toggles correctly, add `role="region"`
  to answer panels, `aria-controls` linking
- **Nav.astro**: Add `aria-current="page"` to active nav link,
  `aria-label="Main navigation"`
- **Pricing cards**: Add `aria-label` describing each tier, `role="group"`
- **Contact form**: Ensure `aria-describedby` links error messages to inputs,
  `aria-invalid` on validation failure

#### D4. Keyboard Navigation Audit — All pages

- Verify all interactive elements reachable via Tab
- Ensure focus order is logical (top→bottom, left→right)
- FAQ accordion: Enter/Space to toggle, focus trap within section
- Testimonial carousel: Arrow keys for navigation when focused
- Mobile menu: Escape to close, focus trap while open
- Contact form: Tab through fields logically, submit on Enter

#### D5. Focus Styles — `website/src/styles/global.css`

- Add consistent `focus-visible` outline to all interactive elements
- Style: 2px solid primary, 2px offset
- Ensure 3:1 contrast ratio for focus indicators
- Remove `outline: none` from any elements without replacement focus style

#### D6. Semantic HTML Audit — All pages

- Verify single `<h1>` per page
- Verify heading hierarchy (h1→h2→h3, no skips)
- Verify landmark regions: `<header>`, `<nav>`, `<main>`, `<footer>`,
  `<section>` with labels
- Verify all `<img>` tags have `alt` attributes
- Verify all form inputs have associated `<label>` elements

---

### Phase E: Contact Form Backend Integration (Priority: Medium)

**Estimated Files**: 3–4

#### E1. Netlify/Astro Form Handler — `website/src/pages/contact.astro`

- Add Netlify Forms integration (`data-netlify="true"`) or Astro server endpoint
- Recommended approach: Netlify Forms (zero-config, spam filtering, email
  notifications)
- Alternative: Astro API route at `website/src/pages/api/contact.ts` that sends
  email via Resend/SendGrid
- Add honeypot field for spam protection
- Add rate limiting indicator (client-side debounce on submit button)

#### E2. Form Success/Error States — `website/src/pages/contact.astro`

- Polish success state: animated checkmark, "We'll be in touch within 24 hours"
  message, fade transition
- Polish error state: inline error summary at top, scroll to first error field,
  shake animation
- Add loading state on submit button (spinner + "Sending..." text)
- Disable form re-submission while pending

#### E3. Thank You Redirect — `website/src/pages/thank-you.astro` (new)

- Post-submission thank you page
- Confirmation message with expected response time
- CTA: "Explore Features" and "Back to Home" buttons
- JSON-LD: WebPage schema

---

### Phase F: Cross-Browser & Responsive Polish (Priority: Medium)

**Estimated Files**: 4–6

#### F1. Responsive Breakpoint Audit — All pages

- Test at: 320px (small mobile), 375px (iPhone), 768px (tablet), 1024px
  (laptop), 1440px (desktop), 1920px (large)
- Pricing comparison table: horizontal scroll on mobile with sticky first column
- Contact form: single-column on mobile, two-column on desktop
- Feature cards: 1-col mobile, 2-col tablet, 4-col desktop
- Testimonial cards: full-width snap on mobile
- Hero: stack layout on mobile, side-by-side on desktop

#### F2. Cross-Browser Testing Checklist

- Chrome (latest): baseline
- Firefox (latest): verify gradient animations, scroll-snap
- Safari (latest): verify View Transitions fallback, `-webkit-` prefixes
- Mobile Safari (iOS): verify hamburger menu, touch targets ≥44px
- Verify all CSS custom properties fallback correctly

#### F3. Print Stylesheet — `website/src/styles/global.css`

- Add `@media print` rules:
  - Hide nav, footer, CTA section, mobile menu
  - Remove background gradients
  - Set text to black on white
  - Show full URLs for links
  - Ensure pricing table prints cleanly

---

## Implementation Priority Matrix

| Phase                | Priority | Effort | Impact | Dependencies              |
| -------------------- | -------- | ------ | ------ | ------------------------- |
| **A: Missing Pages** | High     | Medium | High   | None                      |
| **B: Hero & Polish** | High     | Medium | High   | None                      |
| **C: SEO & Perf**    | High     | Medium | High   | A (new pages need SEO)    |
| **D: Accessibility** | High     | Medium | High   | A, B (audit all content)  |
| **E: Form Backend**  | Medium   | Low    | Medium | None                      |
| **F: Cross-Browser** | Medium   | Low    | Medium | A, B (all content exists) |

**Recommended execution order**: A ∥ B → C → D ∥ E → F

---

## Task List

| #   | Task                                | Location                                  | Size | Phase | Blocks    |
| --- | ----------------------------------- | ----------------------------------------- | ---- | ----- | --------- |
| 1   | Privacy Policy page                 | website/src/pages/privacy.astro           | S    | A     | —         |
| 2   | Terms of Service page               | website/src/pages/terms.astro             | S    | A     | —         |
| 3   | FERPA Compliance page               | website/src/pages/compliance.astro        | S    | A     | —         |
| 4   | Cookie Policy page                  | website/src/pages/cookies.astro           | S    | A     | —         |
| 5   | Blog placeholder page               | website/src/pages/blog.astro              | S    | A     | —         |
| 6   | 404 error page                      | website/src/pages/404.astro               | S    | A     | —         |
| 7   | Hero product preview upgrade        | website/src/components/Hero.astro         | M    | B     | —         |
| 8   | CTA button micro-interactions       | website/src/styles/global.css             | S    | B     | —         |
| 9   | View Transitions integration        | website/src/layouts/Layout.astro          | S    | B     | —         |
| 10  | Testimonial auto-play + dots        | website/src/components/Testimonials.astro | M    | B     | —         |
| 11  | Feature cards hover + detail links  | website/src/components/Features.astro     | S    | B     | —         |
| 12  | OG image + favicon set              | website/public/                           | S    | C     | —         |
| 13  | FAQ JSON-LD schema                  | website/src/pages/index.astro             | S    | C     | —         |
| 14  | Breadcrumb JSON-LD on sub-pages     | website/src/layouts/Layout.astro          | S    | C     | 1–6       |
| 15  | Font loading optimization           | website/src/layouts/Layout.astro          | S    | C     | —         |
| 16  | Lighthouse audit + fixes            | multiple                                  | M    | C     | 1–15      |
| 17  | Sitemap enhancement                 | website/astro.config.mjs                  | S    | C     | 1–6       |
| 18  | Skip-to-content link                | website/src/layouts/Layout.astro          | S    | D     | —         |
| 19  | Color contrast audit + fixes        | website/src/styles/global.css             | M    | D     | —         |
| 20  | ARIA enhancements (all components)  | website/src/components/                   | M    | D     | 7, 10, 11 |
| 21  | Keyboard navigation audit           | all pages                                 | M    | D     | 1–11      |
| 22  | Focus styles standardization        | website/src/styles/global.css             | S    | D     | —         |
| 23  | Semantic HTML audit                 | all pages                                 | S    | D     | 1–6       |
| 24  | Contact form backend integration    | website/src/pages/contact.astro           | M    | E     | —         |
| 25  | Form success/error state polish     | website/src/pages/contact.astro           | S    | E     | 24        |
| 26  | Thank You page                      | website/src/pages/thank-you.astro         | S    | E     | 24        |
| 27  | Responsive breakpoint audit         | all pages                                 | M    | F     | 1–11      |
| 28  | Cross-browser testing               | all pages                                 | S    | F     | 27        |
| 29  | Print stylesheet                    | website/src/styles/global.css             | S    | F     | —         |
| 30  | Build verification + Lighthouse run | all                                       | S    | F     | 1–29      |
| 31  | Cycle 4 test report                 | docs                                      | S    | —     | 30        |

**Total: 31 tasks (7 new pages, ~15 modified files, ~3 new assets)**

---

## Execution Order

```
Parallel Group 1 (independent):
  ├── Phase A: Tasks 1, 2, 3, 4, 5, 6 (all independent)
  └── Phase B: Tasks 7, 8, 10, 11 (independent); Task 9 (Layout.astro — sequential after Phase A)

Sequential:
  Phase C: Tasks 12, 13, 15 → Task 14 → Task 17 → Task 16

Parallel Group 2:
  ├── Phase D: Tasks 18, 19, 22 (independent) → Tasks 20, 21, 23
  └── Phase E: Task 24 → Tasks 25, 26

Sequential:
  Phase F: Task 27 → Task 28 → Task 29 → Task 30 → Task 31
```

---

## Files to Create/Modify

### New Files (~10)

- `website/src/pages/privacy.astro` — Privacy Policy page
- `website/src/pages/terms.astro` — Terms of Service page
- `website/src/pages/compliance.astro` — FERPA Compliance page
- `website/src/pages/cookies.astro` — Cookie Policy page
- `website/src/pages/blog.astro` — Blog index placeholder
- `website/src/pages/404.astro` — Custom 404 error page
- `website/src/pages/thank-you.astro` — Contact form success redirect
- `website/public/og-default.png` — Open Graph image (1200×630)
- `website/public/apple-touch-icon.png` — iOS touch icon (180×180)
- `website/public/favicon-32x32.png` — PNG favicon fallback

### Modified Files (~12)

- `website/src/layouts/Layout.astro` — View Transitions, skip link, breadcrumb
  JSON-LD, font loading, favicon refs
- `website/src/styles/global.css` — button micro-interactions, focus styles,
  print stylesheet, contrast fixes
- `website/src/components/Hero.astro` — product preview upgrade, parallax effect
- `website/src/components/Testimonials.astro` — auto-play, dot indicators, ARIA
  carousel
- `website/src/components/Features.astro` — hover effects, detail anchors
- `website/src/components/FAQ.astro` — ARIA controls audit
- `website/src/components/Nav.astro` — aria-current, aria-label
- `website/src/components/Footer.astro` — verify all links resolve
- `website/src/pages/index.astro` — FAQ JSON-LD, breadcrumbs
- `website/src/pages/pricing.astro` — breadcrumb JSON-LD, ARIA labels
- `website/src/pages/contact.astro` — backend integration, ARIA improvements,
  error polish
- `website/astro.config.mjs` — sitemap enhancement, View Transitions

---

## Architecture Decisions

1. **Astro View Transitions over SPA router**: Native browser API, zero JS
   overhead, progressive enhancement with fallback
2. **Netlify Forms over custom API endpoint**: Zero-config spam protection,
   email notifications, form submissions dashboard — no backend to maintain for
   a static site
3. **CSS-only OG image**: Generate via SVG-to-PNG conversion at build time or
   use a simple branded graphic — no external image generation service
4. **Legal pages as static Astro pages**: No CMS needed; content changes
   infrequently, deployed with site builds
5. **Blog as placeholder**: Full blog with MDX/content collections deferred to
   Cycle 5; Cycle 4 establishes the page and visual structure
6. **Font preloading over self-hosting**: Continue using Google Fonts CDN
   (global edge caching) but with async loading pattern for performance
7. **Print stylesheet scoped to global.css**: Single `@media print` block rather
   than per-component print styles

---

## Risk Assessment

| Risk                                       | Impact | Mitigation                                                       |
| ------------------------------------------ | ------ | ---------------------------------------------------------------- |
| View Transitions browser support           | Low    | Astro provides automatic fallback to standard navigation         |
| Netlify Forms requires Netlify hosting     | Medium | Alternative: Astro API route with Resend; document both options  |
| OG image generation quality                | Low    | Start with static PNG; upgrade to dynamic generation later       |
| Legal page content accuracy                | Medium | Use standard SaaS templates; flag for legal review before launch |
| Lighthouse 90+ on all categories           | Medium | Iterative optimization; performance budget in CI                 |
| Color contrast fixes may change brand feel | Low    | Adjust only non-compliant pairs; maintain design intent          |

---

## Success Criteria

- [ ] All 31 tasks complete; `astro build` succeeds with 0 errors
- [ ] All footer links resolve (privacy, terms, compliance, cookies, blog)
- [ ] Custom 404 page renders for unknown routes
- [ ] Hero section has polished product mockup with micro-interactions
- [ ] View Transitions provide smooth page-to-page navigation
- [ ] Testimonial carousel auto-plays with dot indicators
- [ ] OG image renders correctly in social sharing previews
- [ ] FAQPage and BreadcrumbList JSON-LD on relevant pages
- [ ] Font loading is non-render-blocking
- [ ] Lighthouse scores: Performance 90+, Accessibility 95+, Best Practices 95+,
      SEO 100
- [ ] Skip-to-content link present and functional
- [ ] All color pairs meet WCAG AA contrast ratios
- [ ] All interactive elements have visible focus styles
- [ ] Keyboard navigation works through all sections and pages
- [ ] Contact form submits successfully with backend handling
- [ ] Thank You page confirms submission
- [ ] Site renders correctly on Chrome, Firefox, Safari (desktop + mobile)
- [ ] Responsive layout works at 320px–1920px without horizontal scroll
- [ ] Print stylesheet produces clean output
- [ ] `sitemap-index.xml` includes all new pages
