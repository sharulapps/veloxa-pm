# Cloudflare Worker — `veloxa-email-worker`

Deployed at `https://veloxa-email-worker.snsgoldresources.workers.dev`.

## ⚠️ This copy is OUTDATED

`worker.js` here only handles email (`POST` with `type: welcome | reset | mom`).
The deployed Worker also serves endpoints that `public/app.html` calls:

| Endpoint | Used by |
|---|---|
| `GET /files?projectId=…` | Docs tab — list files (R2 bucket `veloxa`) |
| `POST /upload` | Docs tab — upload |
| `POST /delete` | Docs tab — delete |
| `POST /ai` | My Buddy AI Sidekick (Gemini) |

**Do not deploy this file as-is** — it would break Docs and AI.
Replace it with the live code first: Cloudflare Dashboard → Workers & Pages →
`veloxa-email-worker` → Edit code → copy everything into `worker.js`.

## Secrets / variables (set in Cloudflare, never commit)

- `RESEND_API_KEY` — Resend API key
- `FROM_DOMAIN` — sender domain (pending verification)
- `GEMINI_API_KEY` — used by `/ai`
- R2 binding for bucket `veloxa`

## Deploy (optional, once the file is current)

```bash
npx wrangler deploy worker/worker.js --name veloxa-email-worker
```
