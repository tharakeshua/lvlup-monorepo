# Flaky Test Quarantine Tracker

Tests listed here have been identified as flaky (intermittent failures) and are
being tracked for investigation. Tests that fail >3 times in 7 days are
quarantined here.

## Quarantine Process

1. **Detection**: CI's flaky-test-monitor job identifies tests that pass on
   retry
2. **Tracking**: Tests failing >3 times in 7 days are added to this file
3. **Quarantine**: Quarantined tests run in CI but do not block merges (soft
   failures)
4. **Resolution**: Weekly review to fix root cause or remove test
5. **Release**: Once fixed and stable for 7 days, test is removed from
   quarantine

## Active Quarantine

| Test Name | File | First Seen | Failure Count | Status | Notes                                |
| --------- | ---- | ---------- | ------------- | ------ | ------------------------------------ |
| _(none)_  | —    | —          | —             | —      | No flaky tests currently quarantined |

## Resolved

| Test Name | File | Quarantined | Resolved | Root Cause |
| --------- | ---- | ----------- | -------- | ---------- |
| _(none)_  | —    | —           | —        | —          |

## How to Tag a Flaky Test

Add `@flaky` tag to the test title for tracking:

```typescript
// Playwright E2E
test('@flaky Student dashboard loads after login', async ({ page }) => { ... });

// Vitest unit/integration
it('@flaky should update leaderboard on concurrent submissions', async () => { ... });
```

## Monitoring

- **CI Job**: `flaky-test-monitor` runs after every E2E suite
- **Report**: Flaky test summary posted as PR comment
- **Artifacts**: Test results with retry data stored for 7 days
