# 06 — Marketing, Firebase Cost, Vercel & Railway

## Marketing website (`apps/website`)

**Framework:** Astro 4, `output: 'static'`, MDX  
**Dev port:** Astro default **4321** (no custom port in website config)  
**Hosting:** Firebase Hosting target **`website`** (`firebase.json`)  
**Site config:** name **LvlUp Autograde**, url `https://lvlup.academy`, tagline “AI grading for paper exams”

### Routes (all present)

| Path | File | Purpose |
|------|------|---------|
| `/` | `src/pages/index.astro` | Landing: autograde pipeline, role bands, CTAs |
| `/guides` | `src/pages/guides/index.astro` | Guide index |
| `/guides/admin` | `guides/[slug].astro` + `content/guides/admin.mdx` | Admin manual |
| `/guides/teacher` | same | Teacher manual |
| `/guides/student` | same | Student manual |
| `/guides/parent` | same | Parent manual |

### Portal URLs (`src/config.ts` `APP_URLS`)

| Role | Env override | Default |
|------|--------------|---------|
| Admin | `PUBLIC_ADMIN_URL` | `https://admin.lvlup.academy` |
| Teacher | `PUBLIC_TEACHER_URL` | `https://teacher.lvlup.academy` |
| Student | `PUBLIC_STUDENT_URL` | `https://student.lvlup.academy` |
| Parent | `PUBLIC_PARENT_URL` | `https://parent.lvlup.academy` |

**Super-admin link:** **not present** (intentional — internal portal).

### Marketing gaps (not inventing screens)

| Workstream | Status |
|------------|--------|
| Pricing / plans page | **Not present** (billing fields may exist in tenant model; no public pricing UI) |
| Blog / SEO content | **Not present** beyond guides (Astro collections easy to extend) |
| Demo request / signup funnel | **Not present** as full funnel (would need backend waitlist / `saveTenant`) |
| Cross-role linker | **Present** — only marketing site links portals |

### Marketing journey (user)

1. Land on `/` → understand autograde + role bands  
2. Open `/guides/{role}` for manuals  
3. CTA → corresponding portal URL (prod) or local ports in dev docs  

---

## Firebase Hosting inventory

From `firebase.json` hosting targets:

| Target | App |
|--------|-----|
| `admin-web` | School admin SPA |
| `teacher-web` | Teacher SPA |
| `student-web` | Student SPA |
| `parent-web` | Parent SPA |
| `super-admin` | Platform SPA |
| `website` | Astro marketing |

Project id sampled from env/docs: **`lvlup-ff6fa`**.

### Local app ports (Vite)

| App | Port |
|-----|------|
| super-admin | 4567 |
| admin-web | 4568 |
| teacher-web | 4569 |
| student-web | 4570 |
| parent-web | 4571 |

### Emulator ports (from credentials / tooling docs)

| Service | Port |
|---------|------|
| Emulator UI | 4000 |
| Auth | 9099 |
| Firestore | 8080 |
| Functions | 5001 |
| RTDB | 9000 |

---

## Firebase cost — what typically costs money

> **No Blaze invoice is documented in the repo.** The following is architectural inference from how the code uses Firebase/GCP.

| Surface | How used here | Cost driver |
|---------|---------------|-------------|
| Cloud Functions (5 codebases) | identity · autograde · levelup · analytics · sdk-v1 — asia-south1 | Invocations, GB-sec, cold starts; AI callables heavy |
| Firestore | Authoritative docs; `v2_*` deny-all → callable Admin SDK | Reads/writes (getMe, lists, progress) |
| RTDB | Live projections: leaderboards, badges, grading status, chat | Bandwidth + connections |
| Storage | QP + answer sheets; signed URLs; triggers | GB stored + download; vision reads |
| Auth | Email/password + Google (B2C); claims on switch | MAU tier |
| Hosting | 6 targets | Bandwidth |
| Gemini tokens | Per-tenant Secret Manager keys | Often largest variable — tracked in admin `/ai-usage` |
| Cloud Tasks | Autograde pipeline enqueue | Task ops + Function fan-out |

### Why Firebase-only today (from code)

**Coupled to Firebase:**

- Custom claims = tenancy plane (`syncMembershipClaims`)
- `firestore.rules` + `database.rules` read `auth.token.*`
- `v2_*` deny-all forces Admin SDK callables
- Storage triggers drive exam pipeline
- Firestore triggers: progress, grading, analytics, claims
- `httpsCallable` transport everywhere
- RTDB subscriptions for live UI
- 6 Firebase Hosting sites

**Tradeoffs:** Fast multi-role auth + emulators + tight Admin SDK vs vendor lock, dual legacy+v1 stacks, callable latency, Blaze-class bill surprises on AI + writes.

---

## Railway + Vercel — feasibility notes

`packages/services` is largely transport-agnostic, but Auth custom claims, Firestore rules, Storage triggers, RTDB, and Cloud Tasks are the hard Firebase glue. Dual-write during migration is the main risk.

| Layer | Move to… | Difficulty | Why |
|-------|----------|------------|-----|
| Marketing website (Astro) | Vercel | Easy | Static; separate app |
| 5 React SPAs | Vercel (or keep Hosting) | Easy–Med | Vite builds; `VITE_FIREBASE_*` |
| Callable business logic | Railway (Node/HTTP or tRPC) | Med | Reuse `packages/services` |
| AI gateway | Railway | Med | Re-home Secret Manager or Railway secrets |
| Firebase Auth + claims | Stay OR Clerk/Auth0 | Hard | Every rule trusts `auth.token.*` |
| Firestore data | Postgres (or stay) | Hard | `v2_` deny-all assumes Admin SDK |
| Triggers / Cloud Tasks | Railway workers + queue | Hard | Autograde async pipeline |
| RTDB live projections | SSE/WebSocket / Ably | Med–Hard | Leaderboard, grading, chat |
| Storage uploads | S3/R2 + signed URLs | Med | Replace upload triggers |

### Phased plan

| Phase | Scope | Effort / risk |
|-------|-------|---------------|
| **0** | Frontends on Vercel; backend stays Firebase | Days–1 week · **low** |
| **1** | HTTP façade on Railway over same Firestore; Auth still Firebase | 2–4 weeks · **medium** |
| **2** | Workers off Cloud Functions/Tasks; replace Storage triggers | 4–8 weeks · **high** |
| **3** | Optional leave Auth/Firestore | Months · **very high** |

### Effort tiers

- **Vercel frontends only:** ~3–10 eng-days — best ROI  
- **Railway HTTP + workers:** ~1–3 eng-months — keep Auth + Firestore  
- **Full leave Firebase:** multi-quarter  

### Env / CI on Railway + Vercel

| Concern | Today | On Railway + Vercel |
|---------|-------|---------------------|
| Frontend env | `VITE_FIREBASE_*` per app | Same + `PUBLIC_*` website URLs |
| AI secrets | Secret Manager `tenant-*-gemini` | Railway secrets or GCP SA on Railway |
| Functions deploy | `firebase deploy` codebases | Docker/Nixpacks services entrypoint |
| Emulators | Auth 9099 · Fn 5001 · FS 8080 · RTDB 9000 | Still needed for Phase 0–1 staging |
| CI | Firebase + pnpm filters | Vercel Git + Railway watch |

---

## Credentials pointer

All demo emails, passwords, and school codes: **[`TEST_CREDENTIALS.md`](../../TEST_CREDENTIALS.md)** at repo root. Do not invent additional secrets beyond what that file (and seed scripts) already document.
