# V4 Learning Platform & Content Engine — Cycle 4 Changelog

## Summary

Cycle 4 fixes critical bugs in status transitions and story point deletion, adds
content versioning with version history UI, introduces a TipTap-based rich text
editor, implements media attachment uploads, adds auto-save with save status
indicators, provides teacher content preview, keyboard shortcuts, and bulk item
operations.

**Completion: ~88% → ~96%**

---

## Bug Fixes

### B1: Fix Status Transition Regression

**Files changed:**

- `functions/levelup/src/callable/save-space.ts`

**Changes:**

- Added `published → draft` and `archived → draft` to `ALLOWED_TRANSITIONS`
- Added unpublish/restore logic that resets `publishedAt`/`archivedAt` to null
- When unpublishing a store-listed space, the store listing doc
  (`platform_public`) is deleted and `publishedToStore` reset to false

### B2: Story Point Deletion via Callable

**Files changed:**

- `functions/levelup/src/callable/save-story-point.ts` — Added `data.deleted`
  flag support
- `packages/shared-types/src/schemas/callable-schemas.ts` — Added `deleted` to
  SaveStoryPointRequestSchema
- `packages/shared-types/src/callable-types.ts` — Added `deleted` to
  SaveStoryPointRequest type
- `packages/shared-hooks/src/queries/useStoryPoints.ts` — Added
  `useDeleteStoryPoint` hook
- `packages/shared-hooks/src/queries/index.ts` — Exported `useDeleteStoryPoint`
- `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` — Replaced direct
  Firestore delete with callable

**Changes:**

- Story point deletion now goes through `saveStoryPoint` callable with
  `data.deleted = true`
- Server-side: deletes all items within the story point (including answer keys),
  then the story point doc
- Space stats (`totalStoryPoints`, `totalItems`) correctly decremented
- Frontend uses `useDeleteStoryPoint` hook instead of direct Firestore SDK calls

---

## Feature Tasks

### F1: Content Versioning Implementation

**Files changed:**

- `functions/levelup/src/utils/content-version.ts` (new) — `writeContentVersion`
  helper
- `functions/levelup/src/callable/save-space.ts` — Writes version on publish,
  archive, unpublish, and field updates
- `functions/levelup/src/callable/save-item.ts` — Writes version on create and
  update
- `functions/levelup/src/callable/save-story-point.ts` — Writes version on
  create and update
- `functions/levelup/src/callable/list-versions.ts` (new) — Paginated
  `listVersions` callable
- `functions/levelup/src/index.ts` — Exported `listVersions`
- `packages/shared-services/src/levelup/content-callables.ts` — Added
  `callListVersions`, `ListVersionsRequest`, `ListVersionsResponse`,
  `ContentVersionEntry` types
- `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` — Added "History" tab
  with timeline UI

**Changes:**

- `ContentVersion` documents written to
  `tenants/{tenantId}/spaces/{spaceId}/versions/` on all content mutations
- Version tracking includes: entity type, change type, summary, author,
  timestamp
- `listVersions` callable supports filtering by entity type/ID with cursor-based
  pagination
- Teacher-facing "History" tab shows a timeline with change summaries, badges,
  and timestamps
- All version writes are fire-and-forget to avoid blocking the main mutation

### F2: Rich Text Editor for Content

**Files changed:**

- `packages/shared-ui/package.json` — Added TipTap dependencies
- `packages/shared-ui/src/components/editor/RichTextEditor.tsx` (new)
- `packages/shared-ui/src/index.ts` — Exported `RichTextEditor`,
  `RichTextViewer`
- `apps/teacher-web/src/components/spaces/ItemEditor.tsx` — Replaced Textarea
  with RichTextEditor
- `apps/student-web/src/components/materials/MaterialViewer.tsx` — Added HTML
  detection and rendering

**Changes:**

- TipTap-based rich text editor with toolbar: bold, italic, strikethrough, code,
  headings (1-3), lists, blockquote, code block, horizontal rule, links, images
  (URL), undo/redo
- `RichTextViewer` component for read-only rendering with backward compatibility
  (plain text fallback)
- Student-side `TextMaterial` detects HTML content and renders with
  `dangerouslySetInnerHTML`
- Existing plain text items render correctly (backward compatible)

### F3: Media Attachment Upload for Items

**Files changed:**

- `packages/shared-types/src/content/item.ts` — Added `ItemAttachment` interface
  and `attachments` field to `UnifiedItem`
- `packages/shared-types/src/content/index.ts` — Exported `ItemAttachment`
- `packages/shared-types/src/callable-types.ts` — Added `attachments` to
  `SaveItemRequest`
- `packages/shared-types/src/schemas/callable-schemas.ts` — Added `attachments`
  array to SaveItemRequestSchema
- `functions/levelup/src/callable/save-item.ts` — Added `attachments` to
  `UPDATABLE_FIELDS`
- `packages/shared-services/src/storage/index.ts` — Added `uploadItemMedia`,
  `deleteItemMedia` helpers
- `apps/teacher-web/src/components/spaces/ItemEditor.tsx` — Added media upload
  section
- `apps/student-web/src/components/materials/MaterialViewer.tsx` — Added
  `AttachmentList` renderer
- `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx` — Passes
  `tenantId`/`spaceId` to ItemEditor, includes `attachments` in save data

**Changes:**

- Teachers can upload images, PDFs, and audio files (max 10MB per file)
- Files stored at
  `tenants/{tenantId}/spaces/{spaceId}/items/{itemId}/attachments/`
- Attachments displayed in ItemEditor with type icons and remove buttons
- Student-side: images render inline, audio with player, PDFs as download links

---

## Quality Tasks

### Q1: Auto-Save for Item Editing

**Files changed:**

- `apps/teacher-web/src/components/spaces/ItemEditor.tsx`

**Changes:**

- Debounced auto-save: triggers 2 seconds after last edit
- Save status indicator: "Saved" (green), "Saving..." (yellow), "Unsaved
  changes" (orange) shown in header
- Tracked state changes for title, content, difficulty, payload, and attachments
- Close confirmation dialog when unsaved changes exist
- Manual save button clears auto-save timer and updates status immediately

### Q2: Teacher Content Preview Mode

**Files changed:**

- `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx`

**Changes:**

- "Preview" button in space editor header opens a full-width dialog
- Shows all story points and their items in read-only student-like layout
- Renders rich text content, item titles, type badges, and attachment references
- Uses `RichTextViewer` for HTML content rendering

---

## UX Polish Tasks

### U1: Keyboard Shortcuts in Space Editor

**Files changed:**

- `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx`

**Changes:**

- `Ctrl/Cmd+Enter`: Close item editor sheet
- `Ctrl/Cmd+N`: Add new story point (when no editor is open)
- `Escape`: Cancel current editing (close item editor or story point editor)
- Shortcut hints added to button tooltips (e.g., "Add Story Point (Ctrl+N)")

### U2: Bulk Item Operations

**Files changed:**

- `apps/teacher-web/src/pages/spaces/SpaceEditorPage.tsx`

**Changes:**

- Checkbox selection on each item row within expanded story points
- Selection count indicator with bulk action bar
- Bulk delete: deletes all selected items with confirmation dialog
- Bulk move: dropdown to move selected items to a different story point
- Clear selection button to deselect all

---

## Dependencies Added

- `@tiptap/react` ^2.11.5
- `@tiptap/starter-kit` ^2.11.5
- `@tiptap/extension-link` ^2.11.5
- `@tiptap/extension-image` ^2.11.5
- `@tiptap/extension-code-block-lowlight` ^2.11.5
- `@tiptap/extension-placeholder` ^2.11.5
- `@tiptap/pm` ^2.11.5

## Build Status

All 13 turbo tasks pass successfully. Zero TypeScript errors.
