# Auto LevelUp — Firebase Hosting Deployment URLs

**Project:** `lvlup-ff6fa` **Deployed:** 2026-03-10

## App URLs

| App                        | URL                                     | Firebase Site ID          |
| -------------------------- | --------------------------------------- | ------------------------- |
| **Website (Landing Page)** | https://lvlup-ff6fa-website.web.app     | `lvlup-ff6fa-website`     |
| **Super Admin Dashboard**  | https://lvlup-ff6fa-super-admin.web.app | `lvlup-ff6fa-super-admin` |
| **Admin Dashboard**        | https://lvlup-ff6fa-admin.web.app       | `lvlup-ff6fa-admin`       |
| **Teacher Portal**         | https://lvlup-ff6fa-teacher.web.app     | `lvlup-ff6fa-teacher`     |
| **Student Portal**         | https://lvlup-ff6fa-student.web.app     | `lvlup-ff6fa-student`     |
| **Parent Portal**          | https://lvlup-ff6fa-parent.web.app      | `lvlup-ff6fa-parent`      |

## Alternate Domains

Each site also has a `.firebaseapp.com` domain:

| App         | Alternate URL                                   |
| ----------- | ----------------------------------------------- |
| Website     | https://lvlup-ff6fa-website.firebaseapp.com     |
| Super Admin | https://lvlup-ff6fa-super-admin.firebaseapp.com |
| Admin       | https://lvlup-ff6fa-admin.firebaseapp.com       |
| Teacher     | https://lvlup-ff6fa-teacher.firebaseapp.com     |
| Student     | https://lvlup-ff6fa-student.firebaseapp.com     |
| Parent      | https://lvlup-ff6fa-parent.firebaseapp.com      |

## Deploy Targets

Firebase deploy targets are configured in `.firebaserc`:

| Target Name   | Site ID                   |
| ------------- | ------------------------- |
| `admin-web`   | `lvlup-ff6fa-admin`       |
| `parent-web`  | `lvlup-ff6fa-parent`      |
| `student-web` | `lvlup-ff6fa-student`     |
| `super-admin` | `lvlup-ff6fa-super-admin` |
| `teacher-web` | `lvlup-ff6fa-teacher`     |
| `website`     | `lvlup-ff6fa-website`     |

## Deployment Commands

```bash
# Deploy all sites
firebase deploy --only hosting

# Deploy a specific site
firebase deploy --only hosting:admin-web
firebase deploy --only hosting:student-web
firebase deploy --only hosting:teacher-web
firebase deploy --only hosting:parent-web
firebase deploy --only hosting:super-admin
firebase deploy --only hosting:website

# Build and deploy
pnpm run build && firebase deploy --only hosting
```

## Firebase Console

- **Project Console:**
  https://console.firebase.google.com/project/lvlup-ff6fa/overview
- **Hosting Dashboard:**
  https://console.firebase.google.com/project/lvlup-ff6fa/hosting

## Notes

- All apps use SPA rewrites (`**` → `/index.html`) except the website (Astro
  static site)
- Static assets (JS, CSS) have
  `Cache-Control: public, max-age=31536000, immutable` for optimal caching
- Apps are built with Vite (React) except the website which uses Astro
- Firebase Auth authorized domains may need to be updated in the Firebase
  Console to include the new hosting domains for login to work
