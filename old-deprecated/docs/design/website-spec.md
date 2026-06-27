# Auto-LevelUp Website Design Specification

> Version 1.0 -- March 2026 Author: Aria, Creative Design Lead Purpose:
> Component-by-component breakdown a developer can implement directly.

---

## Global Setup

### Font Loading

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
  rel="stylesheet"
/>
```

### Tailwind Config

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        midnight: "#0A1628",
        "signal-blue": "#2563EB",
        verdigris: "#0D9488",
        graphite: "#4B5563",
        ash: "#F3F4F6",
        "dark-surface": "#111D2E",
        muted: "#94A3B8",
        subtle: "#64748B",
        "dark-border": "#1E293B",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
};
```

### CSS Custom Properties (for motion)

```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 150ms;
  --duration-base: 300ms;
  --duration-slow: 600ms;
}
```

### Responsive Breakpoints

| Breakpoint | Width     | Tailwind Prefix |
| ---------- | --------- | --------------- |
| Mobile     | < 640px   | default         |
| Tablet     | >= 640px  | `sm:`           |
| Desktop    | >= 1024px | `lg:`           |
| Wide       | >= 1280px | `xl:`           |

### Max Content Width

```html
<div class="mx-auto max-w-[1120px] px-6 lg:px-8"></div>
```

---

## 1. Navigation

### Structure

```html
<nav
  class="fixed left-0 right-0 top-0 z-50 h-16 transition-all duration-300"
  id="main-nav"
>
  <div
    class="mx-auto flex h-full max-w-[1120px] items-center justify-between px-6 lg:px-8"
  >
    <!-- Logo -->
    <a href="/" class="text-lg font-bold tracking-tight">
      <span class="text-midnight">Auto</span
      ><span class="text-signal-blue">LevelUp</span>
    </a>

    <!-- Nav Links (desktop) -->
    <div class="hidden items-center gap-8 lg:flex">
      <a
        href="#"
        class="text-graphite hover:text-signal-blue after:bg-signal-blue relative text-sm font-medium
                         transition-colors duration-150 after:absolute after:bottom-[-2px] after:left-0 after:h-[2px]
                         after:w-0 after:transition-all after:duration-200 hover:after:w-full"
      >
        Home
      </a>
      <a
        href="#features"
        class="text-graphite hover:text-signal-blue after:bg-signal-blue relative text-sm font-medium
                                  transition-colors duration-150 after:absolute after:bottom-[-2px] after:left-0 after:h-[2px]
                                  after:w-0 after:transition-all after:duration-200 hover:after:w-full"
      >
        Features
      </a>
      <a
        href="#how-it-works"
        class="text-graphite hover:text-signal-blue after:bg-signal-blue relative text-sm font-medium
                                      transition-colors duration-150 after:absolute after:bottom-[-2px] after:left-0 after:h-[2px]
                                      after:w-0 after:transition-all after:duration-200 hover:after:w-full"
      >
        How It Works
      </a>
      <a
        href="#for-schools"
        class="text-graphite hover:text-signal-blue after:bg-signal-blue relative text-sm font-medium
                                     transition-colors duration-150 after:absolute after:bottom-[-2px] after:left-0 after:h-[2px]
                                     after:w-0 after:transition-all after:duration-200 hover:after:w-full"
      >
        For Schools
      </a>
    </div>

    <!-- CTA -->
    <a
      href="/demo"
      class="bg-signal-blue hidden items-center rounded px-5 py-2 text-sm
                           font-semibold tracking-tight text-white transition-colors
                           duration-150 hover:bg-blue-700 lg:inline-flex"
    >
      Book a Demo
    </a>

    <!-- Mobile Hamburger -->
    <button
      class="flex h-6 w-6 flex-col justify-center gap-[5px] lg:hidden"
      aria-label="Menu"
    >
      <span class="bg-midnight h-[1.5px] w-full"></span>
      <span class="bg-midnight h-[1.5px] w-full"></span>
      <span class="bg-midnight h-[1.5px] w-full"></span>
    </button>
  </div>
</nav>
```

### Scroll Behavior

```js
// On scroll > 10px, add these classes to #main-nav:
// bg-white/80 backdrop-blur-lg
// Remove: bg-transparent
```

```css
#main-nav {
  background: transparent;
  transition:
    background-color 300ms var(--ease-out),
    backdrop-filter 300ms var(--ease-out);
}
#main-nav.scrolled {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
```

### Mobile Menu

```html
<div
  class="bg-midnight fixed inset-0 z-40 flex flex-col items-center justify-center gap-8
            transition-opacity duration-300"
  id="mobile-menu"
  style="display: none;"
>
  <a
    href="#"
    class="text-2xl font-semibold text-white opacity-0"
    style="animation: fadeInUp 400ms ease-out forwards; animation-delay: 0ms;"
    >Home</a
  >
  <a
    href="#features"
    class="text-2xl font-semibold text-white opacity-0"
    style="animation: fadeInUp 400ms ease-out forwards; animation-delay: 50ms;"
    >Features</a
  >
  <a
    href="#how-it-works"
    class="text-2xl font-semibold text-white opacity-0"
    style="animation: fadeInUp 400ms ease-out forwards; animation-delay: 100ms;"
    >How It Works</a
  >
  <a
    href="#for-schools"
    class="text-2xl font-semibold text-white opacity-0"
    style="animation: fadeInUp 400ms ease-out forwards; animation-delay: 150ms;"
    >For Schools</a
  >
  <a
    href="/demo"
    class="bg-signal-blue mt-4 rounded px-8 py-3 text-lg font-semibold text-white opacity-0"
    style="animation: fadeInUp 400ms ease-out forwards; animation-delay: 200ms;"
    >Book a Demo</a
  >
</div>
```

---

## 2. Hero Section

### Layout

Full viewport height. Split 55/45 on desktop. Stacked on mobile.

### Structure

```html
<section
  class="relative flex min-h-screen items-center overflow-hidden"
  style="background: linear-gradient(135deg, #0A1628 0%, #111D2E 100%);"
>
  <div
    class="mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-12
              px-6 py-24 lg:grid-cols-[55%_45%] lg:gap-8 lg:px-8 lg:py-0"
  >
    <!-- Left: Text Content -->
    <div>
      <!-- Overline -->
      <p
        class="text-signal-blue mb-4 translate-y-5 text-[11px] font-bold uppercase
                tracking-[0.08em] opacity-0"
        data-animate="fadeUp"
        data-delay="200"
      >
        AI-Powered Education Platform
      </p>

      <!-- Headline -->
      <h1
        class="mb-6 translate-y-5 text-[clamp(2rem,5vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.03em]
                 text-white opacity-0"
        data-animate="fadeUp"
        data-delay="200"
      >
        Every Student Deserves<br />to Level Up.
      </h1>

      <!-- Subheadline -->
      <p
        class="mb-8 max-w-[520px] translate-y-5 text-base
                text-[#94A3B8] opacity-0"
        data-animate="fadeUp"
        data-delay="400"
      >
        Auto-LevelUp is an AI education platform for schools. LvlUp Spaces gives
        every student a personalized AI tutor and adaptive learning experience.
        AutoGrade turns handwritten exam papers into fully graded, feedback-rich
        reports in minutes.
      </p>

      <!-- Buttons -->
      <div
        class="mb-6 flex translate-y-5 flex-wrap gap-4 opacity-0"
        data-animate="fadeUp"
        data-delay="600"
      >
        <a
          href="/demo"
          class="bg-signal-blue rounded px-6 py-3 text-sm font-semibold text-white
                               transition-colors duration-150 hover:bg-blue-700"
        >
          Book a Demo
        </a>
        <a
          href="#how-it-works"
          class="rounded border border-white/20 px-6 py-3 text-sm font-semibold text-white
                                       transition-colors duration-150 hover:border-white/40"
        >
          See How It Works
        </a>
      </div>

      <!-- Proof Strip -->
      <p
        class="text-xs tracking-wide text-[#64748B] opacity-0"
        data-animate="fadeUp"
        data-delay="700"
      >
        15 Question Types &middot; 8-Minute Grading &middot; 24/7 AI Tutor
      </p>
    </div>

    <!-- Right: Abstract UI Fragments -->
    <div class="relative hidden h-[400px] lg:block">
      <!-- Stylized card fragments positioned absolutely -->
      <!-- Each card uses exact brand tokens, built as flat CSS/SVG -->
      <!-- Cards shift 2-4px per 100px scroll for subtle parallax -->
      <div
        class="bg-dark-surface border-dark-border absolute left-[10%] top-[20%] w-[200px] translate-x-4 rounded-lg border
                  p-4 opacity-0"
        data-animate="fadeLeft"
        data-delay="800"
      >
        <!-- Progress bar card fragment -->
        <div class="mb-2 text-xs font-bold text-white">Progress</div>
        <div class="bg-midnight h-2 overflow-hidden rounded-full">
          <div class="bg-signal-blue h-full w-[72%] rounded-full"></div>
        </div>
        <div class="text-muted mt-1 text-[10px]">72% Complete</div>
      </div>

      <div
        class="bg-dark-surface border-dark-border absolute left-[30%] top-[45%] w-[180px] translate-x-4 rounded-lg border
                  p-4 opacity-0"
        data-animate="fadeLeft"
        data-delay="900"
      >
        <!-- Grade result fragment -->
        <div class="mb-1 text-xs font-bold text-white">Exam Result</div>
        <div class="text-verdigris text-2xl font-extrabold">87%</div>
        <div class="text-muted text-[10px]">Graded in 8 min</div>
      </div>

      <div
        class="bg-dark-surface border-dark-border absolute right-[5%] top-[15%] w-[160px] translate-x-4 rounded-lg border
                  p-3 opacity-0"
        data-animate="fadeLeft"
        data-delay="1000"
      >
        <!-- Badge notification fragment -->
        <div class="flex items-center gap-2">
          <div
            class="bg-signal-blue/10 flex h-8 w-8 items-center justify-center rounded-full"
          >
            <!-- badge icon inline SVG -->
          </div>
          <div>
            <div class="text-[10px] font-bold text-white">Badge Earned</div>
            <div class="text-muted text-[9px]">Quick Learner</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
```

### Motion Spec

```css
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeLeft {
  from {
    opacity: 0;
    transform: translateX(16px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

[data-animate="fadeUp"] {
  animation: fadeUp 600ms var(--ease-out) forwards;
}

[data-animate="fadeLeft"] {
  animation: fadeLeft 800ms var(--ease-out) forwards;
}

/* Apply data-delay as animation-delay via JS or inline style */
```

### Parallax (right-side cards)

```js
// On scroll, shift each card by (scrollY * 0.03) px vertically
// Maximum 8px shift. Use transform for GPU acceleration.
window.addEventListener("scroll", () => {
  const cards = document.querySelectorAll("[data-parallax]");
  const offset = Math.min(window.scrollY * 0.03, 8);
  cards.forEach((card) => {
    card.style.transform = `translateY(${offset}px)`;
  });
});
```

---

## 3. Problem Section

### Layout

White background. Max-width 1120px. Centered.

### Structure

```html
<section class="bg-white py-24">
  <div class="mx-auto max-w-[1120px] px-6 lg:px-8">
    <p
      class="text-graphite mb-3 text-[11px] font-bold uppercase tracking-[0.08em]"
    >
      The Challenge
    </p>
    <h2
      class="text-midnight mb-10 text-[2.25rem] font-extrabold leading-[1.1] tracking-[-0.025em]"
    >
      Schools Face Four Problems Every Day
    </h2>

    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <!-- Problem Card (repeat x4) -->
      <div
        class="bg-ash border-l-verdigris translate-y-3 rounded-lg border border-l-[3px] border-[#E5E7EB]
                  p-6 opacity-0"
        data-scroll-animate
        data-delay="0"
      >
        <div class="flex items-start gap-3">
          <span class="text-verdigris flex-shrink-0">
            <!-- Inline SVG icon (learning) -->
          </span>
          <div>
            <h4
              class="text-midnight mb-1 text-[1.125rem] font-semibold tracking-[-0.01em]"
            >
              One-Size-Fits-All Learning
            </h4>
            <p class="text-graphite text-sm leading-relaxed">
              Textbooks move at one pace. Advanced students disengage.
              Struggling students get left behind.
            </p>
          </div>
        </div>
      </div>
      <!-- ... 3 more cards with 100ms stagger -->
    </div>
  </div>
</section>
```

### Motion

```css
/* Scroll-triggered: IntersectionObserver at threshold 0.2 */
[data-scroll-animate] {
  transition:
    opacity 400ms var(--ease-out),
    transform 400ms var(--ease-out);
}
[data-scroll-animate].visible {
  opacity: 1;
  transform: translateY(0);
}
/* Stagger via transition-delay: data-delay * 100ms */
```

---

## 4. Solution Overview Section

### Layout

Midnight background. Full-width.

### Structure

```html
<section class="bg-midnight py-24">
  <div class="mx-auto max-w-[1120px] px-6 lg:px-8">
    <p
      class="text-signal-blue mb-3 text-[11px] font-bold uppercase tracking-[0.08em]"
    >
      The Solution
    </p>
    <h2
      class="mb-10 text-[2.25rem] font-extrabold leading-[1.1] tracking-[-0.025em] text-white"
    >
      Two Platforms. One Student Profile. Complete Insight.
    </h2>

    <div class="grid grid-cols-1 gap-8 lg:grid-cols-[60%_40%]">
      <!-- LvlUp Spaces Card -->
      <div
        class="bg-dark-surface border-dark-border border-t-signal-blue -translate-x-4 overflow-hidden
                  rounded-lg border
                  border-t-[4px] opacity-0"
        data-scroll-animate
      >
        <div class="p-6">
          <h3
            class="mb-1 text-[1.75rem] font-bold tracking-[-0.02em] text-white"
          >
            LvlUp Spaces
          </h3>
          <p class="text-muted mb-4 text-sm">Continuous AI-Powered Learning</p>
          <ul class="space-y-2">
            <!-- 5 bullets with inline SVG check icons, text-sm text-white -->
          </ul>
          <div class="border-dark-border mt-6 flex gap-8 border-t pt-4">
            <div class="text-center">
              <div class="text-signal-blue text-2xl font-extrabold">15</div>
              <div class="text-muted text-xs">Question Types</div>
            </div>
            <!-- more stats -->
          </div>
        </div>
      </div>

      <!-- AutoGrade Card -->
      <div
        class="bg-dark-surface border-dark-border border-t-verdigris translate-x-4 overflow-hidden
                  rounded-lg border
                  border-t-[4px] opacity-0"
        data-scroll-animate
        data-delay="150"
      >
        <!-- Same structure, verdigris accent -->
      </div>
    </div>
  </div>
</section>
```

### Motion

Cards slide in from their respective sides. 16px translate, 500ms ease-out.
Staggered by 150ms.

---

## 5. Features Section -- LvlUp Spaces

### Layout

White background. Alternating left-right layout.

### Structure (3 feature clusters)

```html
<section class="bg-white py-24" id="features">
  <div class="mx-auto max-w-[1120px] space-y-24 px-6 lg:px-8">
    <!-- Cluster 1: AI Tutor + Evaluator (text left, visual right) -->
    <div class="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
      <div class="-translate-x-4 opacity-0" data-scroll-animate>
        <p
          class="text-signal-blue mb-3 text-[11px] font-bold uppercase tracking-[0.08em]"
        >
          AI Intelligence
        </p>
        <h3
          class="text-midnight mb-3 text-[1.375rem] font-bold tracking-[-0.015em]"
        >
          Your Students Get a 24/7 AI Tutor
        </h3>
        <p class="text-graphite mb-4 text-base leading-relaxed">
          A Socratic assistant attached to every question. It asks guiding
          questions, never gives the answer directly, and adapts to each
          student's pace.
        </p>
        <ul class="space-y-2">
          <li class="text-graphite flex items-start gap-2 text-sm">
            <span
              class="bg-signal-blue mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full"
            ></span>
            Socratic dialogue builds understanding, not dependency
          </li>
          <!-- 2 more bullets -->
        </ul>
      </div>
      <div class="translate-x-4 opacity-0" data-scroll-animate data-delay="200">
        <!-- Stylized chat interface mockup: flat CSS cards showing Q&A exchange -->
        <div class="bg-ash rounded-lg border border-[#E5E7EB] p-6">
          <!-- Chat bubbles using brand tokens -->
        </div>
      </div>
    </div>

    <!-- Cluster 2: 15 Question Types (text right, visual left) -->
    <div class="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
      <div
        class="order-2 -translate-x-4 opacity-0 lg:order-1"
        data-scroll-animate
        data-delay="200"
      >
        <!-- Difficulty curve visualization: simple SVG line chart -->
      </div>
      <div
        class="order-1 translate-x-4 opacity-0 lg:order-2"
        data-scroll-animate
      >
        <p
          class="text-signal-blue mb-3 text-[11px] font-bold uppercase tracking-[0.08em]"
        >
          Content Variety
        </p>
        <h3
          class="text-midnight mb-3 text-[1.375rem] font-bold tracking-[-0.015em]"
        >
          15 Question Types. Adaptive Difficulty.
        </h3>
        <p class="text-graphite mb-4 text-base leading-relaxed">
          From instant-graded MCQ to AI-evaluated essays, coding challenges, and
          audio recordings.
        </p>
        <div class="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <!-- Question type chips -->
          <span
            class="text-graphite bg-ash rounded border border-[#E5E7EB] px-2 py-1 text-center text-xs font-medium"
            >MCQ</span
          >
          <!-- ... 14 more -->
        </div>
      </div>
    </div>

    <!-- Cluster 3: Gamification (text left, visual right) -->
    <div class="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
      <div class="-translate-x-4 opacity-0" data-scroll-animate>
        <p
          class="text-signal-blue mb-3 text-[11px] font-bold uppercase tracking-[0.08em]"
        >
          Motivation
        </p>
        <h3
          class="text-midnight mb-3 text-[1.375rem] font-bold tracking-[-0.015em]"
        >
          Learning Feels Like Leveling Up
        </h3>
        <p class="text-graphite mb-4 text-base leading-relaxed">
          XP for every question. Streaks for daily consistency. Badges across 5
          rarity tiers. Leaderboards that reset weekly for fresh competition.
        </p>
        <div class="flex gap-3">
          <!-- 5 badge tier chips: Common through Legendary -->
          <span
            class="text-graphite bg-ash rounded border border-[#E5E7EB] px-2.5 py-1 text-xs font-semibold"
            >Common</span
          >
          <!-- ... -->
        </div>
      </div>
      <div class="translate-x-4 opacity-0" data-scroll-animate data-delay="200">
        <!-- Progress dashboard fragment: XP bar, streak counter, level indicator -->
      </div>
    </div>
  </div>
</section>
```

### Motion per Cluster

Scroll-triggered. Text side fades in + 16px translate from its side. Visual side
fades in 200ms later. No parallax.

---

## 6. Features Section -- AutoGrade

### Layout

Ash background. Full-width.

### Structure

```html
<section class="bg-ash py-24">
  <div class="mx-auto max-w-[1120px] px-6 lg:px-8">
    <h2
      class="text-midnight mb-10 text-[2.25rem] font-extrabold leading-[1.1] tracking-[-0.025em]"
    >
      From Scan to Student Feedback -- Before the Next Period.
    </h2>

    <!-- 5-Step Pipeline (horizontal on desktop, vertical on mobile) -->
    <div
      class="relative mb-16 flex flex-col items-start gap-0 lg:flex-row lg:items-center"
    >
      <!-- Connecting line -->
      <div
        class="bg-verdigris absolute left-0 right-0 top-1/2 -z-0 hidden h-[1.5px] -translate-y-1/2 lg:block"
      ></div>

      <!-- Step (repeat x5) -->
      <div
        class="relative z-10 flex-1 translate-y-3 px-4 text-center opacity-0"
        data-scroll-animate
        data-delay="0"
      >
        <div
          class="border-verdigris hover:bg-verdigris group mx-auto mb-3 flex h-12 w-12
                    items-center justify-center rounded-full
                    border-2 bg-white transition-colors duration-200 hover:text-white"
        >
          <!-- Inline SVG icon, stroke="currentColor" -->
        </div>
        <h4 class="text-midnight mb-1 text-sm font-bold">Scan</h4>
        <p class="text-graphite text-xs">Any phone, no hardware</p>
      </div>
      <!-- Steps 2-5 with 100ms stagger each -->
    </div>

    <!-- 2x2 Feature Cards -->
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div
        class="border-l-verdigris rounded-lg border border-l-[3px] border-[#E5E7EB] bg-white p-6"
      >
        <h4 class="text-midnight mb-1 text-[1.125rem] font-semibold">
          Rubric Modes
        </h4>
        <p class="text-graphite text-sm">
          4 configurable modes: criteria, dimension, holistic, hybrid.
        </p>
      </div>
      <!-- Bulk Grading, Manual Override, Cost Tracking -->
    </div>
  </div>
</section>
```

### Pipeline Animation

Steps reveal left-to-right on scroll, 100ms stagger. The connecting line draws
in using `stroke-dashoffset` animation (300ms).

```css
.pipeline-line {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  transition: stroke-dashoffset 1s var(--ease-out);
}
.pipeline-line.visible {
  stroke-dashoffset: 0;
}
```

---

## 7. Stakeholder Sections

### Layout

One section per stakeholder. All use the SAME layout template. White background.

### Template

```html
<section class="border-t border-[#E5E7EB] bg-white py-24">
  <div
    class="mx-auto grid max-w-[1120px] grid-cols-1 items-start gap-12 px-6 lg:grid-cols-[40%_60%] lg:px-8"
  >
    <!-- Left: Text -->
    <div class="-translate-x-4 opacity-0" data-scroll-animate>
      <h2
        class="text-midnight mb-3 text-[1.75rem] font-bold tracking-[-0.02em]"
      >
        For Teachers
      </h2>
      <p class="text-graphite mb-4 text-base leading-relaxed">
        Auto-LevelUp gives teachers back their time. An exam that takes a
        weekend to grade takes 8-15 minutes with AutoGrade.
      </p>
      <ul class="space-y-2">
        <li class="text-graphite flex items-start gap-2 text-sm">
          <span
            class="bg-signal-blue mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full"
          ></span>
          Grade an entire class exam in 8-15 minutes
        </li>
        <!-- 4 more bullets -->
      </ul>
    </div>

    <!-- Right: Dashboard Preview -->
    <div class="translate-x-4 opacity-0" data-scroll-animate data-delay="200">
      <div class="bg-ash rounded-lg border border-[#E5E7EB] p-6">
        <!-- Flat, stylized card arrangement showing stakeholder's dashboard view -->
        <!-- Uses brand color tokens, not screenshots -->
      </div>
    </div>
  </div>
</section>
```

### Stakeholder Differentiation

All four sections (Teacher, Student, Parent, Admin) use identical CSS.
Differentiation is through content only -- different headline, bullets, and
dashboard mockup data. All use Midnight + Signal Blue. No per-stakeholder color
coding.

### Motion

Text fades in from left, dashboard preview fades in from right, 200ms stagger.

---

## 8. Stats Section

### Layout

Midnight background. Single row of 5 stats.

### Structure

```html
<section class="bg-midnight py-20">
  <div
    class="mx-auto flex max-w-[1120px] flex-wrap
              justify-center gap-12 px-6 lg:gap-16 lg:px-8"
  >
    <!-- Stat Item (repeat x5) -->
    <div class="text-center" data-count-up>
      <div
        class="text-[3rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-white"
        data-target="15"
      >
        0
      </div>
      <div class="text-muted mt-1 text-xs font-medium tracking-wide">
        Question Types
      </div>
    </div>
    <!-- 8 Apps, 8 Min, 24/7, 5 Signals -->
  </div>
</section>
```

### Count-Up Animation

```js
// IntersectionObserver triggers at threshold 0.5
// Each number counts from 0 to target over 200ms per digit
// Staggered 100ms between stats
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.target);
        animateCount(el, 0, target, 800);
      }
    });
  },
  { threshold: 0.5 }
);

function animateCount(el, start, end, duration) {
  const startTime = performance.now();
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(start + (end - start) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}
```

---

## 9. Footer

### Layout

Midnight background. Three rows.

### Structure

```html
<footer class="bg-midnight pb-8 pt-16">
  <div class="mx-auto max-w-[1120px] px-6 lg:px-8">
    <!-- Top Row -->
    <div
      class="mb-12 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center"
    >
      <div>
        <div class="mb-1 text-lg font-bold tracking-tight">
          <span class="text-white">Auto</span
          ><span class="text-signal-blue">LevelUp</span>
        </div>
        <p class="text-muted text-sm">Every Student Deserves to Level Up.</p>
      </div>
      <a
        href="/demo"
        class="bg-signal-blue rounded px-6 py-3 text-sm font-semibold text-white
                             transition-colors duration-150 hover:bg-blue-700"
      >
        Book a Demo
      </a>
    </div>

    <!-- Middle Row -->
    <div class="mb-8 grid grid-cols-2 gap-8 sm:grid-cols-3">
      <div>
        <h4 class="mb-3 text-xs font-bold uppercase tracking-wider text-white">
          Product
        </h4>
        <ul class="space-y-2">
          <li>
            <a
              href="#"
              class="text-muted text-sm transition-colors duration-150 hover:text-white"
              >LvlUp Spaces</a
            >
          </li>
          <li>
            <a
              href="#"
              class="text-muted text-sm transition-colors duration-150 hover:text-white"
              >AutoGrade</a
            >
          </li>
        </ul>
      </div>
      <div>
        <h4 class="mb-3 text-xs font-bold uppercase tracking-wider text-white">
          Company
        </h4>
        <ul class="space-y-2">
          <li>
            <a
              href="#"
              class="text-muted text-sm transition-colors duration-150 hover:text-white"
              >About</a
            >
          </li>
          <li>
            <a
              href="#"
              class="text-muted text-sm transition-colors duration-150 hover:text-white"
              >Contact</a
            >
          </li>
        </ul>
      </div>
      <div>
        <h4 class="mb-3 text-xs font-bold uppercase tracking-wider text-white">
          Legal
        </h4>
        <ul class="space-y-2">
          <li>
            <a
              href="#"
              class="text-muted text-sm transition-colors duration-150 hover:text-white"
              >Privacy</a
            >
          </li>
          <li>
            <a
              href="#"
              class="text-muted text-sm transition-colors duration-150 hover:text-white"
              >Terms</a
            >
          </li>
        </ul>
      </div>
    </div>

    <!-- Divider -->
    <div class="bg-dark-border mb-6 h-px"></div>

    <!-- Bottom Row -->
    <p class="text-subtle text-xs font-medium">
      &copy; 2026 Auto-LevelUp. All rights reserved.
    </p>
  </div>
</footer>
```

---

## 10. Global Motion System

### Scroll Reveal (IntersectionObserver)

```js
const scrollObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const delay = parseInt(entry.target.dataset.delay || 0);
        setTimeout(() => {
          entry.target.classList.add("visible");
        }, delay);
        scrollObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.2 }
);

document.querySelectorAll("[data-scroll-animate]").forEach((el) => {
  scrollObserver.observe(el);
});
```

### CSS Base for Animated Elements

```css
[data-scroll-animate] {
  opacity: 0;
  transition:
    opacity 400ms var(--ease-out),
    transform 400ms var(--ease-out);
}
[data-scroll-animate].visible {
  opacity: 1;
  transform: translateY(0) translateX(0);
}
```

### Animation Rules

| Context             | Duration  | Easing   | Transform         |
| ------------------- | --------- | -------- | ----------------- |
| Headline fade up    | 600ms     | ease-out | translateY(20px)  |
| Subheadline fade up | 600ms     | ease-out | translateY(20px)  |
| Button fade up      | 400ms     | ease-out | translateY(20px)  |
| Card reveal         | 400ms     | ease-out | translateY(12px)  |
| Card from left      | 500ms     | ease-out | translateX(-16px) |
| Card from right     | 500ms     | ease-out | translateX(16px)  |
| Pipeline step       | 300ms     | ease-out | translateY(12px)  |
| Micro-interactions  | 100-200ms | ease-out | n/a               |

### What Never Happens

- Nothing bounces.
- Nothing pulses.
- Nothing spins (unless it is a loading spinner).
- No spring physics.
- No overshoot.
- No decorative motion.

---

## 11. Icon Usage

All icons are inline SVG from the custom icon set at `docs/design/icons/`. Never
import from Lucide, Heroicons, or any icon library.

### Standard Usage

```html
<span class="text-verdigris">
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <!-- paths from icon file -->
  </svg>
</span>
```

### Sizing

| Context            | Size | Class       |
| ------------------ | ---- | ----------- |
| Inline with text   | 20px | `w-5 h-5`   |
| Card icon          | 24px | `w-6 h-6`   |
| Feature icon       | 32px | `w-8 h-8`   |
| Hero / stakeholder | 40px | `w-10 h-10` |

Color is always set via `text-{color}` on the parent, inherited through
`currentColor`.

---

_End of Website Design Specification v1.0_
