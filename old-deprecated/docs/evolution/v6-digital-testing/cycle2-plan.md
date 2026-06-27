# V6: Digital Testing — Cycle 2 Refinement Plan

## Changes

### 1. Fix Timer Warning Thresholds

- Remove range checks, use ref flags only for one-time warnings
- Ensure warnings fire at exactly 5min and 1min marks

### 2. Auto-Submit Race Condition Guard

- Add isSubmitting ref to prevent concurrent submissions

### 3. Accessible Status Indicators

- Add icons/symbols to QuestionNavigator status badges (not color-only)

### 4. Jump to Unanswered Button

- Add "Jump to next unanswered" button in QuestionNavigator

### 5. Timer Accessibility

- Reduce aria-live updates to critical thresholds only

### 6. Bloom's Level in Results

- Display bloomsBreakdown in test results view

### 7. Answer Review Summary Before Submit

- Show answer summary counts in submit dialog with breakdown by section
