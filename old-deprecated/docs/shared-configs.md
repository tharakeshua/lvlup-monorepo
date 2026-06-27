# Shared Configuration Setup

This document describes the shared configuration packages for the LevelUp
monorepo.

## Overview

The monorepo uses shared configurations to maintain consistency across all apps
and packages:

1. **Root TypeScript Config** (`tsconfig.json`) - Strict TypeScript settings
2. **Prettier Config** (`.prettierrc`) - Code formatting standards
3. **ESLint Config** (`@levelup/eslint-config`) - Linting rules
4. **Tailwind Config** (`@levelup/tailwind-config`) - Design system with HSL
   theming

## Root TypeScript Configuration

Location: `/tsconfig.json`

### Features

- **Strict Mode Enabled**: All strict type-checking options turned on
- **Modern Module Resolution**: Using bundler resolution with ESNext modules
- **No Unused Code**: Warns on unused locals and parameters
- **Type Safety**: No implicit any, strict null checks, and more

### Usage in Projects

Projects should extend this base configuration:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
    // Add project-specific overrides
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Prettier Configuration

Location: `/.prettierrc`

### Settings

- **Semi-colons**: Required
- **Single Quotes**: No (use double quotes)
- **Print Width**: 100 characters
- **Tab Width**: 2 spaces
- **Trailing Commas**: ES5 compatible
- **Tailwind Plugin**: Enabled for class sorting

### Usage

Prettier is configured at the root and applies to all workspaces automatically.

Run formatting:

```bash
pnpm format
```

## ESLint Configuration

Package: `@levelup/eslint-config`

### Available Configurations

1. **Base Config** (`@levelup/eslint-config`)
   - TypeScript support
   - Import sorting and organization
   - General best practices

2. **React Config** (`@levelup/eslint-config/react`)
   - React and React Hooks rules
   - JSX accessibility checks
   - Performance best practices

3. **Node Config** (`@levelup/eslint-config/node`)
   - Node.js environment settings
   - Console allowed

### Usage

#### For React Apps

```js
// .eslintrc.js
module.exports = {
  root: true,
  extends: ["@levelup/eslint-config/react"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
};
```

#### For Node.js Projects

```js
// .eslintrc.js
module.exports = {
  root: true,
  extends: ["@levelup/eslint-config/node"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
};
```

### Key Rules

- **Import Organization**: Automatically sorts and groups imports
- **Type Imports**: Enforces `type` keyword for type-only imports
- **No Unused Variables**: With support for `_` prefix convention
- **Consistent Code Style**: Aligned with Prettier

## Tailwind CSS Configuration

Package: `@levelup/tailwind-config`

### Features

- **HSL Color System**: All colors use CSS custom properties
- **LevelUp Design System**:
  - Skill Progression Tiers (Silver, Gold, Platinum, Diamond)
  - Learning States (Locked, Available, Progress, Completed)
- **Premium Animations**: Glow, float, pulse, cosmic effects
- **Responsive Container**: Centered with breakpoints
- **Dark Mode Support**: Class-based dark mode

### Usage

```js
// tailwind.config.js
const baseConfig = require("@levelup/tailwind-config");

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...baseConfig,
  content: ["./src/**/*.{ts,tsx}", "./pages/**/*.{ts,tsx}"],
};
```

### Define CSS Variables

In your global CSS file:

```css
:root {
  /* Base colors */
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 262 83% 58%;
  --primary-foreground: 210 40% 98%;
  --primary-glow: 262 83% 58%;

  /* Skill tiers */
  --tier-silver: 0 0% 75%;
  --tier-gold: 45 100% 50%;
  --tier-platinum: 180 50% 70%;
  --tier-diamond: 195 100% 70%;

  /* Learning states */
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

### Design Tokens

#### Tier Colors

```jsx
<Badge className="bg-tier-gold">Gold Tier</Badge>
<Badge className="bg-tier-diamond">Diamond</Badge>
```

#### State Colors

```jsx
<div className="bg-state-locked">Locked</div>
<div className="bg-state-progress">In Progress</div>
<div className="bg-state-completed">Completed</div>
```

#### Animations

```jsx
<div className="animate-glow">Glowing Element</div>
<div className="animate-float">Floating Element</div>
<div className="animate-pulse-glow">Pulsing Glow</div>
```

## Installation

### Installing in New Projects

When creating a new app or package:

```bash
# Install shared configs as dev dependencies
pnpm add -D @levelup/eslint-config @levelup/tailwind-config

# Install peer dependencies
pnpm add -D eslint typescript tailwindcss
```

### Workspace Setup

The monorepo structure:

```
auto-levleup/
├── package.json          # Root package
├── pnpm-workspace.yaml   # Workspace config
├── tsconfig.json         # Base TypeScript config
├── .prettierrc           # Prettier config
├── .prettierignore       # Prettier ignore patterns
├── .gitignore            # Git ignore patterns
├── turbo.json            # Turborepo config
├── apps/                 # Application packages
├── packages/             # Shared packages
│   ├── eslint-config/    # Shared ESLint config
│   └── tailwind-config/  # Shared Tailwind config
└── functions/            # Cloud functions
```

## Maintenance

### Updating Configurations

To update shared configs:

1. Make changes to the config packages
2. Version bump the package
3. Update consuming packages to use new version
4. Test changes across all workspaces

### Adding New Rules

When adding new ESLint rules or Tailwind tokens:

1. Update the respective package
2. Document the changes
3. Ensure backward compatibility
4. Communicate changes to the team

## Scripts

Available at root level:

```bash
# Format all files
pnpm format

# Lint all packages
pnpm lint

# Build all packages
pnpm build

# Run development mode
pnpm dev

# Run tests
pnpm test
```

## Best Practices

1. **Extend, Don't Override**: Prefer extending configs over replacing them
2. **Document Changes**: Update this file when changing configurations
3. **Test Thoroughly**: Test config changes across multiple packages
4. **Version Carefully**: Use semantic versioning for config packages
5. **Communicate Updates**: Notify team when making breaking changes

## Troubleshooting

### ESLint Not Finding Config

Ensure the package is installed and your `.eslintrc.js` has the correct extend
path.

### Tailwind Classes Not Working

1. Check that CSS variables are defined in your global styles
2. Verify content paths in tailwind.config.js include all relevant files
3. Ensure @tailwind directives are in your CSS

### TypeScript Errors After Update

1. Check if your project-specific tsconfig extends the root config
2. Verify all type dependencies are installed
3. Clear build cache: `rm -rf .turbo && pnpm clean`

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Prettier Documentation](https://prettier.io/docs/)
- [ESLint Rules](https://eslint.org/docs/rules/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Turborepo Documentation](https://turbo.build/repo/docs)
