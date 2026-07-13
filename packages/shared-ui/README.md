# @levelup/shared-ui

Shared shadcn/ui components library for the LevelUp monorepo.

## Overview

This package contains 50 shadcn/ui components copied from the LevelUp-App,
configured as a shared package with Tailwind CSS and all required Radix UI
dependencies.

## Components Included

- **50 UI Components**: All shadcn/ui components from LevelUp-App
- **Utilities**: CN utility for class name merging
- **Hooks**: Custom hooks for mobile detection and toast notifications
- **Tailwind Config**: Complete LevelUp theme configuration with HSL variables

## Usage

```typescript
import { Button, Card, Dialog } from "@levelup/shared-ui";
```

## Installation

This package is part of the LevelUp monorepo and uses workspace dependencies.

## Dependencies

### Radix UI Components

- All 27 Radix UI primitives used by shadcn/ui
- Includes: accordion, alert-dialog, avatar, checkbox, dialog, dropdown-menu,
  and more

### Supporting Libraries

- `class-variance-authority`: Component variants
- `clsx` & `tailwind-merge`: Class name utilities
- `lucide-react`: Icons
- `cmdk`: Command palette
- `sonner`: Toast notifications
- `vaul`: Drawer component
- `embla-carousel-react`: Carousel functionality
- `recharts`: Chart components
- `react-day-picker`: Calendar/date picker
- `next-themes`: Theme switching

## Configuration

### Tailwind CSS

The package includes a complete Tailwind configuration with:

- HSL-based color system
- Custom animations (glow, float, pulse-glow, slide-up, cosmic-spin)
- LevelUp-specific colors (tier colors, state colors)
- Responsive container settings
- Custom shadows and gradients

### TypeScript

Configured with path aliases:

- `@/*` maps to `src/*`
- Proper type definitions for all components

## Components List

1. Accordion
2. Alert
3. Alert Dialog
4. Aspect Ratio
5. Avatar
6. Badge
7. Breadcrumb
8. Button
9. Calendar
10. Card
11. Carousel
12. Chart
13. Checkbox
14. Collapsible
15. Command
16. Context Menu
17. Dialog
18. Drawer
19. Dropdown Menu
20. Form
21. Hover Card
22. Input
23. Input OTP
24. Label
25. Loading
26. Menubar
27. Navigation Menu
28. Pagination
29. Popover
30. Progress
31. Radio Group
32. Resizable
33. Scroll Area
34. Select
35. Separator
36. Sheet
37. Sidebar
38. Skeleton
39. Slider
40. Sonner
41. Switch
42. Table
43. Tabs
44. Textarea
45. Toast
46. Toaster
47. Toggle
48. Toggle Group
49. Tooltip
50. use-toast (hook)

## File Structure

```
packages/shared-ui/
├── src/
│   ├── components/
│   │   └── ui/           # 50 shadcn components
│   ├── lib/
│   │   └── utils.ts      # CN utility
│   ├── hooks/
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   └── index.ts          # Main export file
├── components.json       # shadcn config
├── tailwind.config.ts    # Tailwind configuration
├── tsconfig.json         # TypeScript config
├── package.json
└── README.md
```

## License

Private - Part of LevelUp monorepo
