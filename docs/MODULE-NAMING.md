# Module naming (Story Point → Module)

## Summary

The product UI now calls a **Module** what was previously labeled **Story
Point**. This pass updates user-facing copy in student-web, teacher-web, and
shared-ui only.

## Dual naming

| Layer                        | Term                                       | Notes                                                         |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| **UI labels**                | Module                                     | Nav, breadcrumbs, empty states, editor labels, toasts         |
| **Routes (canonical links)** | `/spaces/:spaceId/modules/:id`             | New hrefs from `moduleHref()` / updated `storyPointHref()`    |
| **Routes (compat)**          | `/spaces/:spaceId/story-points/:id`        | Still registered; old bookmarks and links work                |
| **Domain types (gradual)**   | `Module`, `ModuleId`, …                    | Type aliases over `StoryPoint`, `StoryPointId`                |
| **Domain/API/Firestore**     | `storyPoint`, `storyPointId`, `StoryPoint` | **Unchanged** — avoids breaking production data and callables |
| **Collections**              | `storyPoints` subcollection                | **Not migrated** in this pass                                 |

## Deferred (intentionally)

- Firestore collection / document field renames
- Cloud Function names and request/response keys (`storyPointId`, etc.)
- Repository and hook names (`useStoryPoints`, `useSaveStoryPoint`, …)
- Mobile apps (mobile-student, mobile-teacher)
- E2E spec descriptions in legacy learner cycle tests (non-blocking)

## Route aliases

**Student web**

- `/spaces/:spaceId/modules/:storyPointId` → module viewer (same as
  `story-points`)
- `/consumer/spaces/:spaceId/modules/:storyPointId` → consumer module viewer

**Teacher web**

- `/spaces/:spaceId/modules/:storyPointId/preview` → test preview (same as
  `story-points/.../preview`)

## Type aliases (`@levelup/domain`)

```ts
export type Module = StoryPoint;
export type ModuleSection = StoryPointSection;
export type ModuleId = StoryPointId;
export const asModuleId = asStoryPointId;
```

Use `Module` in new UI/domain code when the product term matters; keep
`StoryPoint` at storage and API boundaries until a coordinated backend
migration.
