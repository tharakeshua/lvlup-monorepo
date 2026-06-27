# V4: Learning Platform & Content Engine — Evolution Plan

## Current State Analysis

### Teacher Web (Space Management)

- **SpaceListPage**: Grid view with search, status tabs
  (All/Draft/Published/Archived), create space button
- **SpaceEditorPage**: Tabs (Settings, Content, Rubric, Agent Config), story
  point DnD reorder, item CRUD, publish/unpublish/archive actions
- **SpaceSettingsPanel**: Title, description, type, subject, labels, access
  type, assessment defaults
- **ItemEditor**: Full editor for all 15 question types + 7 material types with
  type-specific forms
- **StoryPointEditor**: Title, description, type, sections, assessment config,
  difficulty

### Student Web (Learning Experience)

- **SpacesListPage**: Grid of assigned spaces with progress bars
- **SpaceViewerPage**: Story point list with type-specific cards, overall
  progress bar
- **StoryPointViewerPage**: Section sidebar, item cards with question answerers,
  material viewers, chat tutor
- **StoreListPage**: Search + subject filter, shopping cart, space cards with
  enrollment
- **StoreDetailPage**: Hero section, content preview, purchase/enrollment flow
- **DashboardPage**: Summary cards, strengths/weaknesses, recent exams,
  recommendations, my spaces

### Existing Infrastructure

- DnD: @dnd-kit for story point reordering (teacher editor)
- Progress: SpaceProgress with per-item tracking, ProgressBar component
- Store: Consumer store with cart, purchaseSpace callable, listStoreSpaces
  callable
- Status: StatusBadge component, draft→published→archived transitions via
  saveSpace callable
- Types: Comprehensive Space, StoryPoint, UnifiedItem, SpaceProgress types

## Improvement Areas & Implementation

### Phase 2A: Polish Space CRUD & Status Transitions

**Files**: teacher-web SpaceEditorPage, SpaceListPage, SpaceSettingsPanel

1. **Fix publish flow** — SpaceEditorPage calls `publishSpace` but should use
   `saveSpace` callable with `status: 'published'`
2. **Fix archive flow** — SpaceEditorPage calls `archiveSpace` but should use
   `saveSpace` callable with `status: 'archived'`
3. **Fix create flow** — SpaceListPage calls `createSpace` but should use
   `saveSpace` callable
4. **Add store listing fields** — SpaceSettingsPanel needs: price, currency,
   storeDescription, storeThumbnailUrl, publishedToStore toggle
5. **Space stats display** — Show total story points, items, enrolled students
   in SpaceListPage cards
6. **Thumbnail upload** — Add thumbnail upload to SpaceSettingsPanel

### Phase 2B: Improve Store Listing & Discovery UI

**Files**: student-web StoreListPage, StoreDetailPage

1. **Dynamic subject filtering** — Replace hardcoded subjects with dynamic list
   from store data
2. **Add difficulty level display** — Show average difficulty on store cards
3. **Rating/review preview** — Add visual rating display (star icons with count)
4. **Improved empty state** — Better empty state with suggestions
5. **Grid/list view toggle** — Allow switching between grid and list layouts
6. **Sort options** — Add sort by: newest, most popular, price

### Phase 2C: Space Templates & Duplication

**Files**: teacher-web SpaceListPage, new DuplicateSpaceDialog

1. **Duplicate space action** — Add duplicate button on space cards, copies
   space + story points + items
2. **Space templates** — Predefined templates (blank, course, assessment,
   practice) when creating

### Phase 2D: Story Point Navigation & Reordering

**Files**: student-web StoryPointViewerPage, teacher-web SpaceEditorPage

1. **Next/previous navigation** — Add prev/next story point buttons in student
   viewer
2. **Story point progress indicator** — Show completion status in story point
   navigation
3. **Expand items in teacher editor** — Show item count, types, difficulty
   summary when expanded

### Phase 2E: Progress Tracking Visualization

**Files**: student-web SpaceViewerPage, new ProgressOverview component

1. **Enhanced progress bar** — Add milestone markers on progress bar
2. **Story point completion badges** — Visual completion indicators
3. **Points summary card** — Show points earned vs total with breakdown
4. **Resume button** — "Continue where you left off" button that navigates to
   first incomplete item

### Phase 2F: Content Search & Filtering

**Files**: student-web SpaceViewerPage, StoryPointViewerPage

1. **Item type filter** — Filter items by type (question, material, etc.)
2. **Difficulty filter** — Filter by difficulty level
3. **Search within space** — Search items by title/content within a space

## Acceptance Criteria

- [x] All space CRUD uses consolidated `saveSpace` callable (not legacy
      endpoints)
- [x] Store listing has dynamic filtering, sort, and improved UX
- [x] Spaces can be duplicated with all content
- [x] Students can navigate between story points with prev/next
- [x] Progress visualization includes points breakdown and resume functionality
- [x] Content can be searched and filtered within spaces
- [x] `pnpm build` passes with zero errors
- [x] `pnpm lint` passes with zero new errors (pre-existing in untouched files)
