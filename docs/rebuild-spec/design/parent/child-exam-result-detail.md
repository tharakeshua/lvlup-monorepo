# Parent · Child Exam Result Detail

> Design language: Lyceum (Modern Scholarly). Per-screen spec following
> 00-FOUNDATION §7.

## Purpose & user

Lets a **parent** (Anita Sharma) read the full, released result for ONE exam
taken by ONE of her children (e.g. _Midterm — Data Structures_, Aarav). Parents
get structured, per-question feedback — score, rubric, strengths/weaknesses,
mistake classification, grader confidence — so they can support their child.
They are **observers**: read-only, no grading actions, and the **answer key is
never shown**.

## Entry / route

- Route: `#/children/:childId/results/:examId` (canonical sample:
  `#/children/aarav/results/ex_midterm`).
- Entered from the child's results list (`#/children/aarav/results`) or an
  alert/notification. Back link returns to that list.
- Also rendered inside a **right Drawer** in the SPA — so the body is a **single
  column** that holds at ~560px width.

## Layout (text wireframe)

```
[← Back to Aarav's results]
┌──────────────────────────────────────────────────┐
│ Midterm — Data Structures        [GradePill B+]   │
│ Aarav Sharma · DSA · Released Jun 12              │
│ Overall  [████████████░░░] 82%  · 41/50          │
│ [Download PDF]                                     │
├──────────────────────────────────────────────────┤
│ ⓘ Answer key is not shown to parents.            │
├──────────────────────────────────────────────────┤
│ Q1  Multiple choice · 6/6   [Correct]            │
│   Prompt …                                        │
│   Your child's answer: …                          │
│   [██████] 6/6                                    │
│   RubricBreakdown (criteria · score/max)          │
│   Strengths: chip chip   To improve: chip         │
│   [No mistake]  ·  ConfidenceBadge High           │
├──────────────────────────────────────────────────┤
│ Q2 … Q3 … Q4  (same QuestionCard shape)          │
└──────────────────────────────────────────────────┘
```

## Components used (from CORE-API)

`GradePill`, `ProgressBar`, `RubricBreakdown`, `ConfidenceBadge`, `Badge`,
`Chip`, `Button`, `Icon`, `ContentRenderer` (math prompts), `Skeleton`,
`EmptyState`, `Alert`. Shell = `ParentShell` (sidebar + topbar,
`active="results"`).

## States

- **Loading:** header skeleton (title + grade chip + bar) and 3 question
  skeleton rows.
- **Empty:** exam exists but no released result yet → `EmptyState` "Results not
  released yet" (parents only ever see released data).
- **Error:** result fetch failed → `Alert variant="error"` with Retry; grade is
  safe on the server.
- **Success:** full per-question list with rubric, chips, confidence (default
  render below).

## Interactions & flows

- Back link → `go('#/children/aarav/results')`.
- Download PDF → emits the released report (no answer key); prototype is a
  `go`/no-op CTA.
- Per-question cards are static read panels (no expand-to-key, no override
  controls — those are teacher-only).
- Low-confidence AI grades show an inline "A teacher reviews low-confidence
  items" note (no parent action).

## Domain rules

- **Released-only:** screen is reachable only for results with
  `released === true`; scores/grades are server-derived.
- **Answer key hidden:** never render the correct answer for any question — a
  persistent note states this. Parents see the child's answer + grader
  feedback + rubric scores only.
- **Server-authoritative:** all marks, grade, mistake-classification and
  confidence come from the server; the UI never computes or lets a parent edit
  them.
- No streak/XP gamification here — this is a calm reporting surface.

## A11y

- Overall score `ProgressBar` + per-question bars carry `aria-label` with
  score/max and percent.
- Every status colour is paired with an **icon + text label** (Correct / Partial
  / Review badges, confidence label, mistake badge) — never colour alone.
- Back link and Download are real focusable buttons with visible focus rings;
  single-column order is logical for screen readers and works inside the Drawer.
- Question list uses a real heading per question; the "answer key not shown"
  note is plain readable text, not decorative.
