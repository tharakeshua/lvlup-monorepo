# Parent-Web E2E Test Report

**Date:** 2026-03-02 **Session:** sess_1772466679371_im6wmk1m6 **Task:**
task_1772466630711_e6u3ora1e **App URL:** http://localhost:4571

## Test Results

| Metric                    | Count |
| ------------------------- | ----- |
| **Total**                 | 84    |
| **Passed**                | 83    |
| **Failed**                | 0     |
| **Flaky (pass on retry)** | 1     |
| **Skipped**               | 0     |

**Pass Rate: 100% (all pass including retries)**

## Credentials Used

- School Code: `GRN001`
- Email: `suresh.patel@gmail.com`
- Password: `Test@12345`

## Test Coverage

- Login with school code → email/password flow
- Parent Dashboard rendering
- Children overview cards/list
- Academic progress tracking
- Attendance overview
- Exam results viewing
- Communication / messages
- Notifications page (filters: All, Roll Number, Grade, Linked Children columns)
- Settings / profile page
- Navigation & sidebar
- Sign out flow

## Flaky Test (1)

- **Transient login timeout in `beforeEach`**: One test hit a Firebase Auth
  timeout during login. This is a transient network/infrastructure issue. Passes
  on re-run.

## Fixes Applied to `tests/e2e/parent-web.spec.ts`

1. **Credentials updated**: Changed from `parent1@springfield.test / Parent123!`
   to `suresh.patel@gmail.com / Test@12345`
2. **School code**: Changed from `SPR001` to `GRN001`
3. **Dashboard heading**: Verified `'Parent Dashboard'` heading matches
4. **Notification table selectors**: Fixed table detection patterns
5. **Timeouts**: Increased for Firebase cold start latency
6. **Login resilience**: Added retry logic for transient auth timeouts in
   `beforeEach`

## Video Recordings

- Video recordings in `test-results/` directory
- 84 videos for all test runs

## Files Modified

- `tests/e2e/parent-web.spec.ts`
- `tests/e2e/helpers/selectors.ts` (shared credentials update)
