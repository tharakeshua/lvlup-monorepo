# Design Spec Manifest — for the Orchestration Planner

> All per-screen design specs are COMPLETE and verified (Lyceum-conformant,
> FOUNDATION §7 11-point template, 0 raw-hex leaks). **115 screen specs + 5
> INDEX files**, ~34,500 lines, across 5 feature areas. These are the source of
> truth for prototyping into Claude Design. The sequencing question is resolved:
> **specs are ready now — no need to wait.**

**Foundation (read first, governs everything):**
`docs/rebuild-spec/design/00-FOUNDATION.md`

| Area                               | Screens | INDEX                     |
| ---------------------------------- | ------: | ------------------------- |
| spaces (content authoring)         |      25 | `design/spaces/INDEX.md`  |
| exams (AutoGrade)                  |      16 | `design/exams/INDEX.md`   |
| admin (tenant-admin + super-admin) |      31 | `design/admin/INDEX.md`   |
| student (learner, B2B + B2C)       |      27 | `design/student/INDEX.md` |
| teacher (class ops)                |      17 | `design/teacher/INDEX.md` |
| **Total**                          | **115** |                           |

Per-area file lists are in each `INDEX.md`. Every spec ends with a §11
ready-to-paste Claude-design prompt.

---

## Area → App mapping (specs are grouped by FEATURE; apps regroup them)

The user wants designs grouped by **app** ("each app one design"). The specs are
grouped by feature area, so each app pulls screens from one or more areas.
Proposed mapping (planner to confirm with user):

| App (target)                       | Pulls specs from                                                                                                                                                                                                                                                     | Notes                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **web-super-admin**                | admin/ (12 super-admin screens: platform-overview, tenant-provisioning, tenant-detail, super-admin-billing, cross-tenant-global-users, platform-analytics, feature-flags, global-presets, llm-usage, system-health, super-admin-settings, super-admin-announcements) | platform control plane                       |
| **web-admin**                      | admin/ (19 tenant-admin screens)                                                                                                                                                                                                                                     | tenant operations                            |
| **web-teacher**                    | teacher/ (17) + spaces/ (25 authoring) + exams/ (16 grading)                                                                                                                                                                                                         | the heaviest app — authoring + grading + ops |
| **web-student**                    | student/ (B2B learner subset)                                                                                                                                                                                                                                        |                                              |
| **web-parent**                     | ⚠️ see GAP 1                                                                                                                                                                                                                                                         |                                              |
| **mobile-family** (student+parent) | student/ + parent screens, with each spec's §10 web↔mobile divergence                                                                                                                                                                                                | adapts web screens                           |
| **mobile-staff** (teacher+admin)   | teacher/ + admin/ + grading, mobile-adapted                                                                                                                                                                                                                          | review/monitor focus                         |
| **mobile-scanner**                 | ⚠️ see GAP 2                                                                                                                                                                                                                                                         |                                              |

---

## ⚠️ Coverage gaps to resolve in the plan

1. **parent-web has no dedicated screen specs.** The 5 areas were
   spaces/exams/admin/student/teacher — parent was not one. Only
   `admin/parent-linking.md` (admin-side) exists. The parent app's own screens
   (child progress, released exam results, announcements, multi-child switcher)
   need a spec set — either a new "parent" area session or derived from
   student-progress + admin-announcements views.

2. **mobile-scanner native flow is not spec'd as screens.**
   `exams/answer-sheet-upload.md` is the _web_ upload. The native scanner
   journey (login → select exam → select student → camera capture w/ guide frame
   → on-device compress → offline-durable upload queue → submit) needs its own
   mobile screen specs.

3. **Mobile in general** currently lives as the §10 "web↔mobile divergence" note
   inside each web spec rather than dedicated mobile screen designs. The plan
   must decide: derive mobile prototypes from those notes, or generate dedicated
   mobile specs first.

The planner should fold gaps 1–2 (and decide gap 3) into the orchestration plan
so the final Claude Design output covers all 8 apps end-to-end, not just the 5
web areas already spec'd.
