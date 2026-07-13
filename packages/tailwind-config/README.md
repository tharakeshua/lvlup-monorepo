# @levelup/tailwind-config

Shared Tailwind CSS configuration with LevelUp HSL theming for the monorepo.

## Features

- **HSL Color System**: Flexible theming using CSS custom properties
- **Skill Progression Tiers**: Silver, Gold, Platinum, Diamond colors
- **Learning States**: Locked, Available, Progress, Completed states
- **Premium Animations**: Glow, float, pulse, cosmic effects
- **Consistent Design**: Unified design tokens across all apps

## Usage

### Basic Setup

```js
// tailwind.config.js
const baseConfig = require("@levelup/tailwind-config");

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...baseConfig,
  content: [
    "./src/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
    // Add your content paths here
  ],
};
```

### Custom Overrides

```js
// tailwind.config.js
const baseConfig = require("@levelup/tailwind-config");

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...baseConfig,
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    ...baseConfig.theme,
    extend: {
      ...baseConfig.theme.extend,
      // Add your custom overrides here
      colors: {
        ...baseConfig.theme.extend.colors,
        custom: "hsl(var(--custom-color))",
      },
    },
  },
};
```

## Color System

All colors use HSL format and are defined as CSS variables. Define these in your
global CSS:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --primary-glow: 262 83% 58%;

  /* Skill Progression Tiers */
  --tier-silver: 0 0% 75%;
  --tier-gold: 45 100% 50%;
  --tier-platinum: 180 50% 70%;
  --tier-diamond: 195 100% 70%;

  /* Learning States */
  --state-locked: 0 0% 50%;
  --state-available: 210 100% 60%;
  --state-progress: 45 100% 55%;
  --state-completed: 142 71% 45%;

  /* ... more variables */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... dark mode overrides */
}
```

## Animations

Available animations:

- `animate-glow`: Pulsing glow effect
- `animate-float`: Floating motion
- `animate-pulse-glow`: Scale and opacity pulse
- `animate-slide-up`: Slide up with fade
- `animate-cosmic-spin`: Slow rotation

## Design Tokens

### Tiers

```jsx
<div className="bg-tier-gold text-white">Gold Tier</div>
<div className="bg-tier-diamond text-white">Diamond Tier</div>
```

### States

```jsx
<div className="bg-state-locked">Locked Content</div>
<div className="bg-state-progress">In Progress</div>
<div className="bg-state-completed">Completed</div>
```

### Shadows

```jsx
<div className="shadow-card">Card Shadow</div>
<div className="shadow-glow">Glow Shadow</div>
<div className="shadow-tier-gold">Gold Tier Shadow</div>
```

## Peer Dependencies

```bash
pnpm add -D tailwindcss
```
