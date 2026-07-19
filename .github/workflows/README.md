# GitHub Actions Workflows

## CI Workflow

The main CI workflow (`ci.yml`) runs comprehensive checks on all pull requests
and pushes to main/develop branches.

### Workflow Steps

1. **Lint**: Code quality checks using ESLint and Prettier
2. **Type Check**: TypeScript type checking across all packages
3. **Build**: Build all packages and apps
4. **Test**: Run tests with coverage reporting

### Required Secrets

- `CODECOV_TOKEN`: Token for uploading coverage to Codecov (optional but
  recommended)
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

### Workflow Features

- **Concurrency Control**: Cancels in-progress runs when new commits are pushed
- **Parallel Execution**: Lint, typecheck, and build run in parallel for faster
  feedback
- **Artifact Caching**: Build artifacts are cached between jobs
- **Coverage Reporting**:
  - Uploads to Codecov
  - Comments on PRs with coverage changes
- **Status Checks**: All jobs must pass for PR to be mergeable

### Local Testing

Before pushing, you can run the same checks locally:

```bash
# Install dependencies
pnpm install

# Run linter
pnpm run lint

# Run type check
pnpm exec turbo run typecheck

# Run build
pnpm run build

# Run tests with coverage
pnpm run test:coverage
```

### Customization

To customize the workflow:

1. Edit `.github/workflows/ci.yml`
2. Add additional jobs or steps as needed
3. Update branch triggers if using different branch names
4. Adjust Node.js version in `setup-node` action if needed

### Troubleshooting

**Workflow not triggering:**

- Check that the branch name matches the trigger configuration
- Verify GitHub Actions is enabled for the repository

**Tests failing in CI but passing locally:**

- Check Node.js version matches
- Verify all dependencies are in package.json (not globally installed)
- Review environment variables and secrets

**Coverage upload failing:**

- Verify CODECOV_TOKEN is set in repository secrets
- Check Codecov service status
- Review action logs for specific errors
