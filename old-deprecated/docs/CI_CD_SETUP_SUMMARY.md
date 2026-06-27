# CI/CD Setup Summary

## Overview

This document summarizes the Vitest configuration and CI/CD setup completed for
the Auto LevelUp monorepo.

## What Was Installed

### Root Dependencies

```json
{
  "devDependencies": {
    "vitest": "^4.0.18",
    "@vitest/ui": "^4.0.18",
    "@vitest/coverage-v8": "^4.0.18",
    "husky": "^9.1.7",
    "lint-staged": "^16.2.7"
  }
}
```

## Files Created

### 1. Vitest Configuration

#### `vitest.config.base.ts`

- Base configuration for all packages
- Node environment by default
- Coverage thresholds set to 60%
- V8 coverage provider
- Excludes common files from coverage

#### `vitest.workspace.ts`

- Workspace configuration for monorepo
- Includes all packages, apps, and functions
- Enables running tests across entire monorepo

### 2. Git Hooks

#### `.husky/pre-commit`

- Runs `lint-staged` before each commit
- Automatically fixes linting issues
- Formats code with Prettier

#### `package.json` lint-staged config

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{js,jsx,json,md}": ["prettier --write"]
  }
}
```

### 3. GitHub Actions

#### `.github/workflows/ci.yml`

- **Triggers**: Push/PR to main/develop branches
- **Jobs**:
  1. Lint (ESLint + Prettier)
  2. Type Check (TypeScript)
  3. Build (Turbo build)
  4. Test (Vitest with coverage)
- **Features**:
  - Parallel job execution
  - Build artifact caching
  - Coverage upload to Codecov
  - PR comments with coverage changes

#### `.github/workflows/README.md`

- Documentation for the CI workflow
- Setup instructions
- Troubleshooting guide

### 4. Documentation

#### `docs/VITEST_SETUP.md`

- Complete guide to Vitest setup
- How to extend base config
- Coverage reporting
- CI/CD pipeline details
- Pre-commit hooks
- Best practices

#### `docs/TESTING_GUIDE.md`

- Quick reference for writing tests
- Common patterns and examples
- React component testing
- Mocking guide
- Troubleshooting

## Updated Files

### `package.json`

- Added `test:coverage` script
- Added `prepare` script for Husky
- Added `lint-staged` configuration

## How to Use

### Initial Setup (When Git is Initialized)

```bash
# Initialize git repository (if not already done)
git init

# Install dependencies (will run prepare script and setup Husky)
pnpm install
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm test --watch

# Run tests with UI
pnpm test --ui
```

### Extending Configuration in Packages

Create `vitest.config.ts` in your package:

```typescript
import { defineConfig, mergeConfig } from "vitest/config";
import { baseVitestConfig } from "../../vitest.config.base";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    test: {
      environment: "jsdom", // For React testing
      setupFiles: ["./src/test/setup.ts"],
    },
  })
);
```

## GitHub Setup Required

### Repository Secrets

For full CI/CD functionality, add these secrets in GitHub repository settings:

1. **CODECOV_TOKEN** (optional but recommended)
   - Sign up at https://codecov.io
   - Add your repository
   - Copy the token
   - Add to GitHub repo secrets

### Branch Protection Rules

Recommended settings for `main` branch:

- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- Required checks:
  - Lint
  - Type Check
  - Build
  - Test
- ✅ Require linear history
- ✅ Include administrators

## Coverage Thresholds

All packages must maintain minimum 60% coverage:

- Lines: 60%
- Functions: 60%
- Branches: 60%
- Statements: 60%

Tests will fail if coverage drops below these thresholds.

## Next Steps

1. **Initialize Git Repository** (if not done)

   ```bash
   git init
   git add .
   git commit -m "Initial commit with CI/CD setup"
   ```

2. **Add Codecov Integration** (optional)
   - Sign up at https://codecov.io
   - Add repository
   - Add `CODECOV_TOKEN` to GitHub secrets

3. **Configure Branch Protection**
   - Go to GitHub repository settings
   - Add branch protection rules for `main`
   - Require status checks

4. **Start Writing Tests**
   - Follow examples in `docs/TESTING_GUIDE.md`
   - Aim for coverage above 60%
   - Run tests locally before pushing

5. **Monitor CI/CD**
   - Check GitHub Actions tab after push
   - Review coverage reports
   - Address any failing tests

## Maintenance

### Updating Coverage Thresholds

Edit `vitest.config.base.ts`:

```typescript
thresholds: {
  lines: 70,    // Increased from 60
  functions: 70,
  branches: 70,
  statements: 70,
}
```

### Adding New Test Scripts

Add to root `package.json`:

```json
{
  "scripts": {
    "test:integration": "turbo run test:integration",
    "test:e2e": "turbo run test:e2e"
  }
}
```

### Updating CI Workflow

Edit `.github/workflows/ci.yml` to:

- Add new jobs
- Change Node.js version
- Adjust triggers
- Add environment variables

## Troubleshooting

### Husky not working

```bash
pnpm run prepare
chmod +x .husky/*
```

### Tests failing in CI but passing locally

- Check Node.js version matches
- Verify dependencies are in package.json
- Check for environment-specific issues

### Coverage not uploading

- Verify CODECOV_TOKEN is set
- Check that lcov.info is being generated
- Review Codecov action logs

## Support

For issues or questions:

1. Check documentation in `docs/` directory
2. Review GitHub Actions logs
3. Check Vitest documentation: https://vitest.dev/
4. Review workflow file comments

## Summary

✅ Shared Vitest configuration created  
✅ Coverage thresholds set to 60%  
✅ Husky + lint-staged configured  
✅ GitHub Actions CI/CD workflow created  
✅ Comprehensive documentation provided

The monorepo is now set up with:

- Consistent testing across all packages
- Automated code quality checks
- Continuous integration pipeline
- Pre-commit hooks for code quality
