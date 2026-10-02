# VELOXA — Project Management System

Internal project management PWA for Menang Nusantara Sdn Bhd (MNSB), a Malaysian automotive parts manufacturer. Built and maintained by one developer (Sharul). Live at `https://veloxa-pm.pages.dev`.

Main use today: tracking maintenance activities and preventive maintenance (PM) for the M1 plant, with Gantt, OT/budget monitoring and meeting minutes.

## Repo layout

```
public/                 ← the website. Cloudflare Pages output dir. Everything here is publicly downloadable.
  index.html            login (email/password + Google), routes by role
  app.html              main app (~6,000 lines)
  admin.html            admin panel: users, projects, roles table, company settings
  exec.html             executive dashboard (cross-project KPIs, budget, OT, amendment log)
  budget-excel.html     Excel Plan vs Actual module (Pyodide/Python engine), runs inside an iframe in app.html
  veloxa-budget-excel.js  bridge: opens budget-excel.html in a modal, receives postMessage, writes to Firestore
  firebase-config.js    FIREBASE_CONFIG, RESEND_CONFIG.workerUrl, APP_CONFIG fallback
  setup-tool.html       legacy first-time setup generator (Malay UI, old rules) — not used day to day
  manifest.json, sw.js, icon-*.png   PWA assets (NOT wired up — no page links the manifest or registers sw.js)
worker/                 Cloudflare Worker source (OUTDATED copy — see worker/README.md). Not deployed by Pages.
firestore.rules         DRAFT rules (not what's live). Not deployed by Pages.
docs/                   changelog and old setup notes
```

Never put secrets or internal-only docs inside `public/`.

## Stack

- **Frontend:** plain HTML + vanilla JS + inline CSS. No framework, no build step, no bundler.
- **Backend:** Firebase Auth + Firestore (compat SDK v10.12.0 via gstatic CDN). Project `veloxa-pm`, **Spark (free) plan — no PITR, no scheduled backups.** Firestore deletes are unrecoverable.
- **Hosting:** Cloudflare Pages (`public/`).
- **Worker:** `https://veloxa-email-worker.snsgoldresources.workers.dev` — email via Resend (`POST {type: welcome|reset|mom}`), R2 file storage (`/files`, `/upload`, `/delete`, bucket `veloxa`), AI proxy (`/ai`, Gemini `gemini-3.1-flash-lite`, secret `GEMINI_API_KEY`).
- **Libraries (CDN):** SheetJS 0.18.5, jsPDF 2.5.1, html2canvas 1.4.1, Chart.js 4.4.1. budget-excel.html loads Pyodide 0.27.7 from jsdelivr.

## Conventions

- **Vanilla JS only.** Don't introduce React, TypeScript, npm deps or a build step.
- **UI text is English only.** No Malay in labels, toasts, placeholders, confirms, PDF output. Code comments in English. (Exception: Malay keywords used to *detect* Excel column headers in imports must stay.)
- **Keep single-file pages.** Add features inside the relevant `.html`; don't split into modules unless asked.
- Many functions are written on one long line (minified style). Edit with exact string replacement; don't reformat whole functions unless needed.
- After editing, syntax-check every inline `<script>` (extract and run `node --check`). Skip `type="text/python"` and `application/octet-stream` blocks in budget-excel.html.
- `firebase-config.js` declares `const APP_CONFIG`. Other pages must not redeclare it — use the `typeof APP_CONFIG === 'undefined'` guard. At runtime pages merge Firestore `settings/company` into it.
- Flex inputs need `min-width:0; box-sizing:border-box` to shrink properly.

## Key globals (app.html)

- `CPid` current project id, `CP` current project object, `CU` Firebase auth user, `CUD` user profile doc (`.role`, `.name`, `.workspaceId`), `APP_CONFIG`, `tasks` current project's tasks, `projects` visible projects.
- `wsId()` = `CUD.workspaceId || 'default'`. Collection helpers: `taskCol()`, `taskColFor(pid)`, `taskDoc(id)`, `subCol(taskId)`, `subSubCol(taskId, subId)`, `commCol(taskId)`, `chatCol(pid)`, `taskMsgCol(pid, tid)`, `meetCol()`.
- Gantt: `ganttDayW`, `ganttDays`, `ganttZoom` (`week|month|quarter|half|year`), `ganttYear`, `ganttHalf`, `ganttViewStart`, `ganttSubtasksCache`, `ganttSubSubCache`, `expanded` (Set; subtask keys are `taskId/subId`).
- Detail panel state: `detailId` (main task) **or** `currentSubParentId` + `currentSubTaskId` (+ `currentSubSubId` for level 3). When a subtask is open, `detailId` is `null`. Use `curSubRef()` for the open subtask's doc ref.
- admin.html, exec.html hardcode workspace `'default'`.

## Firestore layout

```
workspaces/{ws}/projects/{pid}            members: { uid: role }, color, monthlyBudget, budgetAllocated, budgetUsed
  .monthlyBudget.{year}.{month0}          month0 = 0–11
     .categories.{Name} = {allocated, used}
     .otHrs = {planned, actual, individuals:[{id,name,planned,actual}]}
     .excel / .otExcel                    snapshots from the Excel module
     .otRemarks.{NAME_UPPERCASE} = {text, by, byName, at}
  /tasks/{tid}                            subtaskCount, assignees, externalAssignees, completedAt…
     /subtasks/{sid}                      level 2 (also subtaskCount, progress)
        /subtasks/{ssid}                  level 3 (max depth)
        /comments/{cid}                   subtask comments + Task Chat
     /comments/{cid}
     /amendments/{aid}                    change log (read by exec.html)
  /chat/{mid}/threads/{tid}
  /meetings/{mid}
users/{uid}                               name, email, role, workspaceId, status, plant, dept, empId
  /notifications/{nid}
  /stickyNotes/{nid}
settings/company                          companyName, adminEmail, appName, loginUrl, plants[], otFilePassword
```

## Roles

`users/{uid}.role`: `admin`, `superadmin`, `manager`, `engineer`, `technician`, `ceo`, `director`, `gm`.
Constants: `ADMIN_ROLES = ['admin','superadmin']`, `EXEC_ROLES = ['ceo','director','gm']`.

- Login routing (index.html): exec → `exec.html`, admin → `admin.html`, everyone else → `app.html`.
- Admins see all projects; others only projects they created or are a member of.
- Exec view: exec + admin + manager.
- Budget Excel module and OT remarks: admin / superadmin / manager / engineer.
- Google sign-in auto-creates a `users` doc with role `engineer` for any Google account that isn't registered yet.

## Gotchas (learned the hard way)

- **CPid footgun:** `taskCol()` is scoped to the *currently open* project. Bulk/admin actions on another project must use `taskColFor(pid)`. A past `deleteProj` bug wiped the wrong project's tasks this way.
- **Creating users client-side switches the auth session.** admin.html avoids this with a secondary Firebase app instance (`firebase.initializeApp(FIREBASE_CONFIG, 'secondary_'+Date.now())`). Keep that pattern.
- **Subcollections are not auto-deleted.** Deleting a subtask deletes its `subtasks` children first (`deleteSubtask`). admin.html `deleteProject` only deletes the project doc — tasks are left orphaned.
- **Detail panel handler reset:** the subtask panel rewires Save/Delete to `saveSubDetail`/`deleteSubtask`; `openDetail()` and `closeDetail()` reset them to `saveDetail`/`deleteTask`.
- **Bad dates:** `dueDate < startDate` (usually a mistyped year) used to stretch the Gantt/PDF window. `badDates(item)` excludes them from range calc and flags them (⚠ in Gantt, `(!)` in PDF). Saves reject them.
- **Gantt two-segment bars** (overdue in-progress = blue/green + red; done late = green + orange): the normal segment ends exactly at the end of `dueDate` and the extension starts there — no gap. Same in PDF.
- **Budget writes:** prefer targeted field-path updates (`new firebase.firestore.FieldPath('monthlyBudget', y, m, ...)`). `veloxa-budget-excel.js` rewrites the whole `monthlyBudget`, but it re-reads the doc right before writing and only changes `categories/otHrs/excel/otExcel`, so `otRemarks` survive.
- **settings/company writes must merge** (`set(..., {merge:true})`) or fields like `otFilePassword` get wiped.
- **budget-excel.html:** the Python engine (`<script type="text/python" id="engineSrc">`) raises errors such as `"Password salah atau fail rosak"`, and the JS checks `includes("Password salah")`. Change both together or neither.
- **exec.html budget widget** reads `monthlyBudget[y][m].allocated/used`, but the data lives in `.categories` — monthly figures show 0.
- **Gemini via Worker** can hit `400 FAILED_PRECONDITION` (geo-block on Cloudflare egress). Known open issue.
- **Firestore rules:** live rules reportedly allow any signed-in user. `firestore.rules` is a stricter draft — don't assume it's published.

## Testing

No automated tests. To check changes:
1. `node --check` on each extracted inline script.
2. PDF export changes: run the export function in Node with `jspdf` + stubbed globals (`tasks`, `subCol`, `subSubCol`, `document`, `APP_CONFIG`, `showToast`), render with `pdftoppm`, inspect.
3. Local: `npx serve public` then open `/index.html` (add `localhost` to Firebase Auth authorized domains).
4. Deploy and verify in the browser (login required).

## Deploy

Cloudflare Pages → project `veloxa-pm` → connected to this repo. Build command: none. Build output directory: `public`. Every push to `main` deploys.
