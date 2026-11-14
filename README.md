# PatchPing

Vulnerability alerts for the exact package versions your apps run on. A Kriosity product.

Users add apps and their packages (by uploading a lockfile or pasting a list). Every 6 hours the
backend checks each `package@version` against [OSV.dev](https://osv.dev) and emails one digest of
any new matches, with severity and the version that fixes it.

## Layout

```
web/                     React + Vite frontend (marketing site, legal pages, dashboard)
  api/send-alerts.ts     Vercel function: emails new findings via Microsoft 365 SMTP
  src/lib/parsers.ts     Lockfile parsers (run in the browser; tested in parsers.test.ts)
supabase/migrations/     Database schema, row-level security, pg_cron schedule
supabase/functions/
  scan/                  Checks components against OSV.dev, stores new findings
  account/               Deletes the signed-in user's account
.github/workflows/       Keep-alive ping so the free Supabase project never pauses
```

## How it runs

- **Supabase project:** `vswctqwxvesjripvwsex` (region ap-south-1).
- **Schedule (pg_cron):** `scan` at minute 0 every 6 hours, alert emails (`/api/send-alerts` on Vercel) at minute 20, log cleanup daily.
  The scheduler secret is generated inside the database (`public.app_config`, service-role only).
- **Users** can also run a scan on demand (limited to once a minute).
- **Data stored:** email, alert settings, app names, package names and versions, findings. Uploaded files
  are parsed in the browser and never sent.

## Environment

Frontend (`web/.env`, optional, defaults are built in):

```
VITE_SUPABASE_URL=https://vswctqwxvesjripvwsex.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## Sign-in

Passwordless email codes. `signInWithOtp` sends a 6-digit code, `verifyOtp` checks it. The same flow
creates the account (on /signup) or logs in (on /login). Templates are in `supabase/templates/`:

| Supabase template | File | Subject |
| --- | --- | --- |
| Confirm signup | `confirm-signup.html` | `Your PatchPing code` |
| Magic Link | `magic-link.html` | `Your PatchPing sign-in code` |

Auth email is sent through Microsoft 365 SMTP (Supabase → Authentication → Emails → SMTP Settings):
host `smtp.office365.com`, port `587`, username and sender = the full mailbox address.

## Alert emails

`web/api/send-alerts.ts` is a Vercel function that emails each user one digest of new findings through
Microsoft 365 SMTP (`smtp.office365.com:587`, STARTTLS). Supabase pg_cron calls it every 6 hours
(minute 20) with the scheduler secret; anyone else gets 401. It lives on Vercel because Supabase
Edge Functions can't open connections on port 587.

Vercel → Project → Settings → Environment Variables (Production):

| Name | Value |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → `service_role` (or a secret key). Mark as Sensitive. |
| `SMTP_USER` | Full mailbox address, e.g. `alerts@yourdomain.com` |
| `SMTP_PASS` | That mailbox's password. Mark as Sensitive. |
| `MAIL_FROM` | Optional. `PatchPing <alerts@yourdomain.com>` (must be the same mailbox) |
| `SITE_URL` | Optional. Defaults to `https://patchping.vercel.app` |

Redeploy after adding them. Without SMTP credentials, findings stay pending and nothing is lost.

## Develop

```
cd web
npm install
npm run dev      # http://localhost:5173
npm test         # parser tests
npm run build
```

Deploy the frontend from `web/` (Vercel: root directory `web`, framework Vite). `vercel.json`
handles SPA routing and security headers.
