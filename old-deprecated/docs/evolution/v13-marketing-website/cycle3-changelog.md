# V13: Marketing Website - Cycle 3 Changelog

## Cycle 3 - Combined Pass 1

### New Files Created

#### Project Setup

- `website/package.json` - Astro project package with build scripts
- `website/astro.config.mjs` - Astro config with Tailwind + Sitemap integrations
- `website/tsconfig.json` - TypeScript config extending Astro strict
- `website/tailwind.config.mjs` - Tailwind config importing shared tokens from
  `@levelup/tailwind-config`

#### Styles

- `website/src/styles/global.css` - Global CSS with Tailwind layers, CSS
  variables, component classes (btn-primary, card, scroll-reveal)

#### Layout

- `website/src/layouts/Layout.astro` - Base HTML layout with full SEO meta, Open
  Graph, Twitter Card, JSON-LD, Google Fonts, scroll-reveal IntersectionObserver

#### Components

- `website/src/components/Nav.astro` - Floating navigation with scroll progress
  bar, mobile hamburger menu, backdrop blur
- `website/src/components/Hero.astro` - Hero section with animated gradient
  background, blurred orbs, product preview mock, social proof, CTA buttons
- `website/src/components/Features.astro` - 4-role feature showcase (Schools,
  Teachers, Students, Parents) with color-coded cards, stats bar
- `website/src/components/HowItWorks.astro` - 4-step alternating timeline with
  step cards and connecting line
- `website/src/components/Testimonials.astro` - Horizontal scroll carousel with
  6 testimonials, prev/next navigation
- `website/src/components/FAQ.astro` - Accordion FAQ with 8 questions,
  single-open behavior
- `website/src/components/CTA.astro` - Gradient CTA banner with dual action
  buttons
- `website/src/components/Footer.astro` - 4-column footer with brand info, link
  sections, social icons, copyright

#### Pages

- `website/src/pages/index.astro` - Homepage composing all sections with
  SoftwareApplication JSON-LD
- `website/src/pages/pricing.astro` - Pricing page with 4-tier grid, feature
  comparison table, ContactPage JSON-LD
- `website/src/pages/contact.astro` - Contact page with validated form
  (firstName, lastName, email, org, role, inquiry, message)

#### Public Assets

- `website/public/favicon.svg` - SVG favicon (blue rounded rect with upward
  arrow)
- `website/public/robots.txt` - Robots.txt with sitemap reference

### Modified Files

- `pnpm-workspace.yaml` - Added `"website"` to workspace packages

### Build Output

- 3 pages built successfully in 1.16s
- `sitemap-index.xml` auto-generated
- Static output at `website/dist/`
