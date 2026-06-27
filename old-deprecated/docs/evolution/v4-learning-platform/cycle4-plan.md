# V4 Learning Platform & Content Engine — Cycle 4 Plan

## Current State: ~88% (post Cycle 3)

### Completed in Previous Cycles

- Full space CRUD with draft/published/archived transitions
- Store listing with search/filter/sort, enrollment, cart, checkout
- Space duplication via `useDuplicateSpace` hook
- Space templates (blank, course, assessment, practice)
- Story point + item drag-and-drop reordering (@dnd-kit)
- All 15 question types + 7 material types
- Progress tracking at all levels with animated progress bars
- Resume-where-you-left-off with navigation
- Search/filtering (debounced) on all list pages
- Completion status filter on StoryPointViewerPage
- Breadcrumb navigation on all pages
- Rating & review system (SpaceReviewSection)
- ContentVersion type defined (no implementation yet)
- Error & empty states on all major pages
- CelebrationBurst confetti on 100% space completion
- Question bank (CRUD, import from bank into story points)
- Rubric presets, Agent config panel
- Points summary, story point completion badges

### Identified Gaps

#### Critical Bugs

1. **Status transition bug** — `ALLOWED_TRANSITIONS` in `save-space.ts` only
   defines `draft→published` and `published→archived`. The SpaceEditorPage has
   "Unpublish" (`published→draft`) and "Restore to Draft" (`archived→draft`)
   buttons that call `saveSpace({status: "draft"})`, but these transitions are
   rejected by the backend. Users cannot unpublish or restore spaces.

2. **Story point deletion bypasses auth** —
   `SpaceEditorPage.handleDeleteStoryPoint` directly deletes the Firestore doc
   via client SDK, bypassing auth checks and stats decrements. Should use a
   callable or extend `saveStoryPoint` with `data.deleted` support (like
   `saveItem`).

#### Feature Gaps

3. **Content versioning** — `ContentVersion` type exists but no backend
   implementation (no version creation on save, no version history callable, no
   UI).
4. **Rich text editing** — All content/description fields are plain text. No
   rich text editor component.
5. **Media attachments** — No file/image upload for item content or materials.

---

## Cycle 4 Tasks

### Bug Fixes

#### B1: Fix Status Transition Regression [S] — HIGH PRIORITY

**Files**: `functions/levelup/src/callable/save-space.ts` **What**: Add
`published → draft` and `archived → draft` to `ALLOWED_TRANSITIONS`. Reset
`publishedAt`/`archivedAt` when transitioning back to draft. If
`publishedToStore`, remove store listing doc when unpublishing. **Acceptance**:

- Teacher can unpublish a published space (returns to draft)
- Teacher can restore an archived space to draft
- Store listing removed if space was listed on store
- `pnpm build` passes

#### B2: Add Story Point Deletion to `saveStoryPoint` Callable [S]

**Files**: `functions/levelup/src/callable/save-story-point.ts` **What**:
Support `data.deleted = true` flag (same pattern as `saveItem`). Delete all
items within the story point, decrement space stats (`stats.totalStoryPoints`),
and delete the story point doc. Update `SpaceEditorPage.handleDeleteStoryPoint`
to use the callable. **Acceptance**:

- Story point deletion goes through callable with auth checks
- Space `stats.totalStoryPoints` correctly decremented
- Items within deleted story point also deleted with stats decremented
- SpaceEditorPage uses callable instead of direct Firestore delete

### Feature Tasks

#### F1: Content Versioning Implementation [M]

**Files**:

- `functions/levelup/src/callable/save-space.ts` — Write version on
  publish/archive
- `functions/levelup/src/callable/save-item.ts` — Write version on item
  create/update
- `functions/levelup/src/callable/save-story-point.ts` — Write version on SP
  create/update
- `packages/shared-services/src/levelup/content-callables.ts` — Add
  `callListVersions`
- `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` — Add version history
  panel

**What**: Write `ContentVersion` docs on content mutations (create, update,
publish, archive). Add a `listVersions` callable that returns paginated version
history. Add a "Version History" tab or panel in the space editor showing a
timeline of changes.

**Acceptance**:

- Version docs written on space publish, archive, and content edits
- Teacher can view version history in the space editor
- History shows who changed what and when

#### F2: Rich Text Editor for Content [M]

**Files**:

- `packages/shared-ui/src/components/editor/RichTextEditor.tsx` (new)
- `apps/teacher-web/src/components/spaces/ItemEditor.tsx` — Use RichTextEditor
  for content
- `apps/student-web/src/components/materials/MaterialViewer.tsx` — Render rich
  HTML
- `package.json` — Add `@tiptap/react`, `@tiptap/starter-kit`,
  `@tiptap/extension-*`

**What**: Add a TipTap-based rich text editor component to shared-ui. Integrate
into ItemEditor for text material content and question prompts. Render HTML in
MaterialViewer on student side. Support: bold, italic, headings, lists, code
blocks, links, images (inline URL).

**Acceptance**:

- Teachers can create/edit rich text content in items
- Students see rendered rich text with formatting preserved
- Backward-compatible: plain text items still render correctly
- Build passes with zero errors

#### F3: Media Attachment Upload for Items [M]

**Files**:

- `packages/shared-services/src/storage/index.ts` — Add `uploadItemMedia` helper
- `apps/teacher-web/src/components/spaces/ItemEditor.tsx` — Add media upload
  section
- `packages/shared-types/src/content/item.ts` — Add `attachments` field to
  UnifiedItem
- `apps/student-web/src/components/materials/MaterialViewer.tsx` — Render
  attachments

**What**: Allow teachers to upload images, PDFs, and audio files when editing
items. Store in Firebase Storage at
`tenants/{tenantId}/spaces/{spaceId}/items/{itemId}/attachments/`. Add an
`attachments` array to UnifiedItem type with `{id, fileName, url, type, size}`.
Render on student side with appropriate viewers.

**Acceptance**:

- Teachers can upload and remove file attachments on items
- Attachments visible to students in material viewer
- File size limit enforced (10MB per file)
- Supported types: image/_, application/pdf, audio/_

### Quality Tasks

#### Q1: Auto-Save for Item Editing [S]

**Files**: `apps/teacher-web/src/components/spaces/ItemEditor.tsx` **What**: Add
debounced auto-save (2s after last edit) to the ItemEditor sheet. Show save
status indicator ("Saving...", "Saved", "Unsaved changes"). Prevent closing
sheet with unsaved changes (confirmation dialog). **Acceptance**:

- Item changes auto-save after 2s idle
- Save status clearly visible to teacher
- Closing with unsaved changes shows confirmation

#### Q2: Teacher Content Preview Mode [S]

**Files**: `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` **What**: Add
a "Preview" button in the space editor header that opens a read-only
student-like view of the space content. Uses the same rendering components as
student-web (QuestionAnswerer, MaterialViewer) but in preview mode.
**Acceptance**:

- Teacher can preview how content looks to students
- Preview opens in a modal/sheet with student layout
- Works for all item types

### UX Polish Tasks

#### U1: Keyboard Shortcuts in Space Editor [S]

**Files**: `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` **What**: Add
keyboard shortcuts: `Ctrl/Cmd+S` to save current item, `Ctrl/Cmd+Enter` to close
editor sheet, `Ctrl/Cmd+N` to add new item, `Escape` to cancel. Show shortcut
hints in tooltips. **Acceptance**:

- Keyboard shortcuts work in the space editor
- Shortcuts don't conflict with browser defaults
- Hints visible in button tooltips

#### U2: Bulk Item Operations [S]

**Files**: `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` **What**: Add
checkbox selection for items within expanded story points. Allow bulk delete and
bulk move to another story point. Confirm destructive actions with
ConfirmDialog. **Acceptance**:

- Teachers can select multiple items via checkboxes
- Bulk delete with confirmation dialog
- Bulk move to different story point via dropdown selector

---

## Implementation Order

| Order | Task                            | Size | Priority | Deps   |
| ----- | ------------------------------- | ---- | -------- | ------ |
| 1     | B1: Fix status transitions      | S    | HIGH     | —      |
| 2     | B2: Story point delete callable | S    | HIGH     | —      |
| 3     | F1: Content versioning          | M    | MEDIUM   | B1, B2 |
| 4     | F2: Rich text editor            | M    | MEDIUM   | —      |
| 5     | F3: Media attachments           | M    | MEDIUM   | —      |
| 6     | Q1: Auto-save                   | S    | MEDIUM   | F2     |
| 7     | Q2: Content preview             | S    | LOW      | F2     |
| 8     | U1: Keyboard shortcuts          | S    | LOW      | —      |
| 9     | U2: Bulk operations             | S    | LOW      | —      |

**Parallel tracks**: B1+B2 can run in parallel. F2+F3 can run in parallel after
bugs are fixed. Q1 depends on F2 (auto-save should work with rich text). U1+U2
are independent polish tasks.

## Target Completion: ~96%

After Cycle 4, remaining items for 100% would be:

- Content import/export (CSV, SCORM)
- Offline caching for student content
- Real-time collaborative editing
- Advanced analytics dashboards for content engagement
