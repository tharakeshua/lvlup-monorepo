# V5: AutoGrade & AI Pipeline — Cycle 2 Refinement Plan

## Changes

### 1. Override Score Validation in GradingReviewPage

- Validate override scores against min=0 and max=maxMarks bounds
- Show error if out of range

### 2. Bulk Approve Confirmation Dialog

- Add confirmation dialog before bulk approving all questions

### 3. Cost Projection in AIUsagePage

- Add projected month-end cost based on current spending rate
- Add average daily cost metric

### 4. Sort Questions by Review Priority

- Sort questions needing review first in GradingReviewPage
