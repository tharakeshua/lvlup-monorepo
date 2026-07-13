# AGENTS.md

<INSTRUCTIONS>
- Add project-specific agent instructions here.
</INSTRUCTIONS>

## Available Team Members

### ui-ux-designer

- **Agent File**: `~/.claude/agents/ui-ux-designer.md`
- **Role**: Senior UI/UX Designer & Frontend Architect
- **Expertise**: Visual design systems, component architecture (shadcn/ui +
  CVA), responsive layouts, accessibility (WCAG 2.1 AA), interaction & motion
  design, dark mode theming, form design
- **Tech**: React 18, Tailwind CSS 3.4, shadcn/ui, Radix UI, Lucide, CVA, clsx,
  tailwind-merge, next-themes, recharts, sonner, embla-carousel,
  react-day-picker, cmdk, vaul, @dnd-kit
- **Scope**: All 5 apps (admin-web, teacher-web, student-web, parent-web,
  super-admin) + `packages/shared-ui` + `packages/tailwind-config`
- **Maestro Usage**: Spawn as a worker with `agentType: "general-purpose"` and
  name `"ui-ux-designer"`

### playwright-tester

- **Agent File**: `~/.claude/agents/playwright-tester.md`
- **Role**: Senior Playwright E2E Test Engineer
- **Scope**: E2E tests across all 5 web apps

### tester-pro

- **Agent File**: `~/.claude/agents/tester-pro.md`
- **Role**: Specialist QA Engineer
- **Scope**: Unit tests (Vitest) + E2E tests (Playwright)
