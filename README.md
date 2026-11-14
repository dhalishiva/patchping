# PatchPing

Vulnerability alerts for the exact package versions your apps run on. A Kriosity product.

Users add apps and their packages (by uploading a lockfile or pasting a list). Every 6 hours the
backend checks each `package@version` against [OSV.dev](https://osv.dev) and emails one digest of
any new matches, with severity and the version that fixes it.

## Layout

```
web/                     React + Vite frontend (marketing site, legal pages, dashboard)
  src/lib/parsers.ts     Lockfile parsers (run in the browser; tested in parsers.test.ts)
supabase/migrations/     Database schema, row-level security, pg_cron schedule
supabase/functions/
  scan/                  Checks components against OSV.dev, stores new findings
  notify/                Emails pending findings via Resend
  account/               Deletes the signed-in user's account
.github/workflows/       Keep-alive ping so the free Supabase project never pauses
```

## How it runs

- **Supabase project:** `vswctqwxvesjripvwsex` (region ap-south-1).
- **Schedule (pg_cron):** `scan` at minute 0 every 6 hours, `notify` at minute 20, log cleanup daily.
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

The `notify` function uses Microsoft Graph when these secrets are set (Supabase → Edge Functions → Secrets),
otherwise Resend, otherwise it leaves findings pending:

| Name | Value |
| --- | --- |
| `MS_TENANT_ID` | Directory (tenant) ID of the Entra app |
| `MS_CLIENT_ID` | Application (client) ID |
| `MS_CLIENT_SECRET` | Client secret value |
| `MS_SENDER` | Mailbox to send from, e.g. `alerts@yourdomain.com` |
| `SITE_URL` | `https://patchping.vercel.app` |

The Entra app needs the Microsoft Graph application permission `Mail.Send` with admin consent.
Edge functions can't use SMTP port 587, which is why alerts go through Graph over HTTPS.

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
