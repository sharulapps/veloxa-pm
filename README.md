# VELOXA — Project Management System

Internal project management PWA for MNSB. Live at https://veloxa-pm.pages.dev

| Path | What |
|---|---|
| `public/` | The website (Cloudflare Pages output dir). Everything here is publicly downloadable. |
| `worker/` | Cloudflare Worker source — **outdated copy**, see `worker/README.md`. Not deployed by Pages. |
| `docs/` | Changelog and old setup notes. |
| `firestore.rules` | Draft Firestore rules (not published). |
| `CLAUDE.md` | Developer notes: stack, conventions, Firestore layout, gotchas. |

**Cloudflare Pages:** build command none, build output directory `public`. Every push to `main` deploys.
