# V4: Learning Platform — Cycle 2 Refinement Plan

## Changes

### 1. Debounced Search in StoryPointViewerPage

- Add debounce (300ms) to search input to prevent lag with many items

### 2. Fix Hardcoded Tenant ID in StoreDetailPage

- Replace hardcoded `platform_public` with constant `PLATFORM_PUBLIC_TENANT_ID`

### 3. Completion Status Filter

- Add "Completed/Incomplete/All" filter to StoryPointViewerPage

### 4. Accessibility Improvements

- Add aria-labels to view toggle buttons in StoreListPage
- Add aria-labels to navigation links in SpaceViewerPage

### 5. Improved Error Messages

- Replace generic "Unknown error" with user-friendly messages
