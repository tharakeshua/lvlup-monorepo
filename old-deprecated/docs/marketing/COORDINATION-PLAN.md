# Pamphlet & Brochure — Coordination Plan

## Objective

Create two marketing assets for Auto-LevelUp platform targeting school/college
decision-makers:

1. **Pamphlet (2 pages)** — Brief, powerful messaging for principals/teachers
2. **Brochure (8-12 pages)** — Complete platform guide with stakeholder-specific
   sections

---

## Team Structure

### Team Members

| #   | Role                              | Responsibility                                                                                                                                                                               | Output                                               |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | **LvlUp Spaces Analyst**          | Deep-dive into LvlUp/Spaces features: content types, AI tutor, AI evaluator, adaptive testing, gamification, progress tracking, question types (15 types), materials (7 types), story points | Feature inventory + benefit statements for Spaces    |
| 2   | **AutoGrade Analyst**             | Deep-dive into AutoGrade/Exams features: scanner app, OCR extraction, AI grading, manual override, bulk grading, result analytics, feedback system                                           | Feature inventory + benefit statements for AutoGrade |
| 3   | **Stakeholder Experience Writer** | Map each stakeholder's journey and powers: Teacher, Student, Parent, School Admin. Document what each role can do, their dashboards, their unique value                                      | Stakeholder guides (4 sections)                      |
| 4   | **Marketing Coordinator**         | Synthesize all findings into final pamphlet & brochure. Write compelling copy, design layout, produce printable outputs (HTML/PDF)                                                           | Final pamphlet + brochure files                      |

### Workflow

```
Phase 1: PARALLEL RESEARCH (Analysts work simultaneously)
├── LvlUp Analyst → Spaces feature inventory
├── AutoGrade Analyst → Exams feature inventory
└── Stakeholder Writer → Stakeholder journey maps

Phase 2: SYNTHESIS (Coordinator receives all inputs)
├── Review all analyst outputs
├── Identify key messaging themes
├── Draft pamphlet (2 pages)
└── Draft brochure (8-12 pages)

Phase 3: PRODUCTION (Coordinator produces final assets)
├── Create printable HTML/PDF pamphlet
├── Create printable HTML/PDF brochure
└── Final review and polish
```

---

## Pamphlet Structure (2 Pages)

### Page 1 — The Problem & Solution

- **Header**: Auto-LevelUp tagline + logo placeholder
- **The Problem**: Schools struggle with personalized learning, manual grading
  burden, lack of real-time student insights, no parent visibility
- **The Solution**: AI-powered learning + grading platform
- **Two Pillars**:
  - 🎯 **LvlUp Spaces** — Continuous AI-powered learning
  - 📝 **AutoGrade** — Intelligent exam grading

### Page 2 — Features & Call to Action

- **Key Stats/Numbers**: 15 question types, AI tutor, adaptive difficulty,
  real-time analytics
- **Stakeholder Benefits Grid**: Teacher / Student / Parent / Admin — 3 bullets
  each
- **Trust Signals**: Multi-tenant security, cost transparency, enterprise-grade
- **CTA**: Contact info, demo request, QR code

---

## Brochure Structure (8-12 Pages)

| Page | Section                | Content                                                     |
| ---- | ---------------------- | ----------------------------------------------------------- |
| 1    | Cover                  | Platform name, tagline, visual                              |
| 2    | Problem Statement      | Education challenges in 2026                                |
| 3    | Platform Overview      | Two pillars: LvlUp + AutoGrade                              |
| 4-5  | LvlUp Spaces Deep Dive | Content types, AI features, adaptive learning, gamification |
| 6-7  | AutoGrade Deep Dive    | Scanner, OCR, AI grading, analytics, feedback               |
| 8    | For Teachers           | Powers, dashboard, content creation, grading                |
| 9    | For Students           | Learning journey, AI tutor, achievements, progress          |
| 10   | For Parents            | Monitoring, insights, alerts, engagement                    |
| 11   | For School Admins      | Analytics, user management, cost visibility, multi-tenant   |
| 12   | Getting Started + CTA  | Onboarding steps, pricing model, contact, QR code           |

---

## Design Guidelines

- **Colors**: Use platform's HSL design tokens from tailwind config
- **Typography**: Clean, professional, education-focused
- **Format**: HTML files optimized for print (A4 / Letter)
- **Style**: Modern, clean, data-driven with icons and charts
- **Tone**: Professional yet approachable, benefit-focused, not feature-dumping

---

## Platform Summary (For Analyst Reference)

### Auto-LevelUp = 5 Web Apps + 3 AutoGrade Apps

**Apps**: Student Portal, Teacher Portal, School Admin Portal, Super Admin
Portal, Parent Portal, AutoGrade Admin, AutoGrade Client, AutoGrade Scanner

**Tech**: React 18 + TypeScript + Firebase + Gemini AI + Vite

### LvlUp (Spaces) Key Features

- 15 question types (MCQ, essay, code, audio, image-based, etc.)
- 7 material types (text, PDF, video, interactive, etc.)
- 4 story point types (standard, quiz, timed_test, practice)
- AI Tutor (Socratic method chat)
- AI Evaluator (rubric-based grading)
- Adaptive difficulty
- Gamification (achievements, leaderboards, XP, badges)
- Content marketplace (B2C store)
- Progress tracking with at-risk detection

### AutoGrade (Exams) Key Features

- Mobile scanner app for answer sheets
- OCR question extraction (Gemini Vision)
- AI grading with rubric support (4 modes)
- Manual override with reason tracking
- Bulk grading for entire classes
- Per-question detailed feedback
- Cost tracking per LLM call
- Dead letter queue for failed grading

### Stakeholder Powers

- **Teacher**: Create content, manage classes, grade exams, view analytics,
  rubric presets
- **Student**: Learn, practice, take tests, AI tutor chat, achievements,
  leaderboard
- **Parent**: Monitor progress, compare children, view exam results, get alerts
- **Admin**: Manage users/classes, school-wide analytics, AI cost tracking, data
  export
