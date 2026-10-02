# Changelog

## 2026-09-30

**Gantt / Timeline**
- New zoom levels: **Half Year** (H1/H2) and **Year** (Jan–Dec). Month-block header with week ticks; period fits the screen width.
- Year selector (+ H1/H2 selector in Half Year). Other zooms jump to 1 Jan of the selected year. Today button returns to the current year.
- End-date label beside every bar in Half Year / Year (red when overdue).
- Zoom choice remembered per browser (`localStorage: veloxa_gantt_zoom`).
- Two-segment bars (green + orange/red) now join with no gap — app and PDF.
- `dueDate < startDate` items no longer stretch the timeline; flagged ⚠ and rejected on save.

**Subtasks**
- Third level: **sub-subtasks** (`tasks/{t}/subtasks/{s}/subtasks/{ss}`), with expand/collapse in Gantt and progress roll-up (sub-subtask → subtask → task).
- Gantt bar height by level: 28 / 18 / 11 px.
- Subtask panel: editable assignees (members + external), comments and Task Chat now work.
- Fixed: saving a subtask overwrote its assignee with the Add Task modal's dropdown value.
- Fixed: Save button stayed wired to the subtask handler after opening a main task.
- Deleting a subtask also deletes its sub-subtasks.

**PDF export**
- Includes all subtasks and sub-subtasks (indented, smaller bars), regardless of expand state.
- Adaptive date ticks (switch to month labels on long ranges).

**Budget / OT**
- OT overshoot remarks per person per month (`monthlyBudget.{y}.{m}.otRemarks.{NAME}`), saved with a targeted field-path write.

**UI**
- All UI text converted to English (labels, toasts, confirms, PDF, notifications).

## 2026-10-02

- Repo created. Site files moved into `public/` (Cloudflare Pages output dir) so `CLAUDE.md`, `worker/`, `docs/` and `firestore.rules` are not published.
- English UI: `admin.html`, `exec.html`, `index.html`, `budget-excel.html` (UI only — the embedded Python engine is unchanged), `veloxa-budget-excel.js`, `manifest.json`.
- admin.html: Users table column "Project" relabelled "Plant" (it shows `u.plant`).
- admin.html: Save Settings now merges into `settings/company` instead of overwriting it (previously wiped fields such as `otFilePassword`).
- `firestore.rules`: draft with the paths the app now uses (sub-subtasks, subtask comments, amendments, notifications, sticky notes, settings). Not published.
