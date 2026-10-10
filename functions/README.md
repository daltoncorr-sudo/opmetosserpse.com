# Functions

Cloudflare Pages Functions: the site's small server code, at `/api/*`. Plain JavaScript modules, no npm and no build step. Pages finds this folder at the repo root (the project's root directory), beside `docs/`, the output directory.

- `api/health.js`: `GET /api/health` returns `{"ok": true}`. It proves Functions run after the move.

## Bindings (set in the Cloudflare dashboard)
There's no `wrangler.toml` on purpose. Once a Pages project deploys with a Wrangler file that names its output directory, that file becomes the source of truth and the dashboard's binding fields turn read-only; and a D1 binding needs the database's ID, which exists only after D creates the database (developers.cloudflare.com/pages/functions/wrangler-configuration, checked Oct. 10, 2026). So the bindings are set in the dashboard, under the Pages project's Settings, then Bindings:

| Binding | Type | Resource |
| --- | --- | --- |
| `DB` | D1 database | `oo_shop` |
| `FILES` | R2 bucket | `oo-files` |

Encrypted variables (Settings, then Variables and Secrets, type Secret): `RESEND_API_KEY` for email, and later, with P04, the Stripe keys.

A Function reads them from `context.env`: `context.env.DB`, `context.env.FILES`, `context.env.RESEND_API_KEY`.

## Rules
- `docs/_headers` and `docs/_redirects` don't apply to Function responses: each Function sets its own headers.
- Every Function stays on the site. The only outside services a Function may call are Stripe's API and the email sender's (Resend); nothing a browser sees links off opmetosserpse.com.
