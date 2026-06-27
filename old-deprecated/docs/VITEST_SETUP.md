# Vitest Configuration and CI/CD Setup

This document describes the Vitest test configuration and CI/CD setup for the
Auto LevelUp monorepo.

## Overview

The monorepo uses a shared Vitest configuration that can be extended by
individual packages. This ensures consistency across all packages while allowing
for package-specific customizations.

## Shared Configuration

### Base Config (`vitest.config.base.ts`)

The base configuration provides:

- **Test Environment**: Node.js by default (packages can override to jsdom for
  frontend)
- **Global Test APIs**: Enabled for easier test writing
- **Coverage Provider**: V8 (faster than Istanbul)
- **Coverage Thresholds**: 60% for lines, functions, branches, and statements
- **Coverage Reports**: text, json, html, and lcov formats

### Workspace Config (`vitest.workspace.ts`)

Defines the monorepo structure for Vitest:

- Root level tests
- All packages in `packages/*`
- All apps in `apps/*`
- Cloud functions in `functions/*`

## Using the Configuration

### In a Package

Create a `vitest.config.ts` in your package that extends the base config:

```typescript
import { defineConfig, mergeConfig } from "vitest/config";
import { baseVitestConfig } from "../../vitest.config.base";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      // Package-specific overrides
      environment: "jsdom", // For React components
      setupFiles: ["./src/test/setup.ts"],
      coverage: {
        // Additional excludes specific to this package
        exclude: [
          ...(baseVitestConfig.test?.coverage?.exclude || []),
          "**/custom-exclusion/**",
        ],
      },
    },
  })
);
```

### Running Tests

```bash
# Run all tests in the monorepo
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in a specific package
cd packages/shared-utils
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run tests with UI
pnpm test --ui
```

## CI/CD Pipeline

### GitHub Actions Workflow (`.github/workflows/ci.yml`)

The CI pipeline runs on:

- Push to `main` and `develop` branches
- Pull requests to `main` and `develop` branches

#### Jobs

1. **Lint** (parallel)
   - Runs ESLint across all packages
   - Checks code formatting with Prettier

2. **Type Check** (parallel)
   - Runs TypeScript compiler in all packages
   - Ensures type safety across the monorepo

3. **Build** (parallel)
   - Builds all packages using Turbo
   - Uploads build artifacts for test job

4. **Test** (after build)
   - Downloads build artifacts
   - Runs all tests with coverage
   - Uploads coverage to Codecov
   - Comments PR with coverage report

5. **All Checks Complete**
   - Final verification that all jobs passed
   - Blocks PR merge if any check fails

### Coverage Reporting

Coverage reports are:

- Generated in `./coverage` directory
- Uploaded to Codecov (requires `CODECOV_TOKEN` secret)
- Displayed as PR comments (requires `GITHUB_TOKEN`)

## Pre-commit Hooks

### Husky + lint-staged

The repository uses Husky for Git hooks and lint-staged for running checks on
staged files.

#### Configuration

In `package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{js,jsx,json,md}": ["prettier --write"]
  }
}
```

#### What Runs on Commit

- **TypeScript files**: ESLint fixes + Prettier formatting
- **JavaScript/JSON/Markdown**: Prettier formatting

### Setting Up Git Hooks

When the repository is initialized with Git, run:

```bash
# Initialize git (if not already done)
git init

# Install dependencies (this will run the prepare script)
pnpm install

# Or manually run prepare
pnpm run prepare
```

This will set up the `.husky` directory and pre-commit hook.

## Coverage Thresholds

All packages must maintain:

- **Lines**: 60%
- **Functions**: 60%
- **Branches**: 60%
- **Statements**: 60%

Tests will fail if coverage drops below these thresholds.

### Adjusting Thresholds

To adjust for a specific package, override in its `vitest.config.ts`:

```typescript
export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      coverage: {
        thresholds: {
          lines: 70,
          functions: 70,
          branches: 70,
          statements: 70,
        },
      },
    },
  })
);
```

## Best Practices

1. **Write tests alongside code**: Keep test files close to the code they test
2. **Use descriptive test names**: Follow the pattern "should [expected
   behavior] when [condition]"
3. **Maintain coverage**: Aim for coverage above the minimum thresholds
4. **Mock external dependencies**: Use Vitest's mocking capabilities
5. **Test edge cases**: Don't just test the happy path
6. **Keep tests fast**: Avoid unnecessary timeouts and waits

## Troubleshooting

### Tests failing in CI but passing locally

- Ensure dependencies are up to date: `pnpm install`
- Check for environment-specific issues
- Review CI logs for specific error messages

### Coverage not uploading to Codecov

- Verify `CODECOV_TOKEN` is set in GitHub secrets
- Check that `lcov.info` is being generated
- Review Codecov action logs

### Husky hooks not running

- Ensure `.husky` directory exists
- Check that `prepare` script ran: `pnpm run prepare`
- Verify hook files are executable: `chmod +x .husky/*`

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Turbo Documentation](https://turbo.build/repo/docs)
- [Husky Documentation](https://typicode.github.io/husky/)
- [lint-staged Documentation](https://github.com/okonet/lint-staged)
