// PatchPing notifier: emails each user one digest of new, un-notified findings.
// Called by pg_cron (x-cron-secret). Sends through Microsoft Graph (preferred) or Resend,
// whichever is configured; if neither is, findings stay pending so nothing is lost.
//
// Microsoft Graph secrets: MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_SENDER (mailbox address)
// Resend secrets:          RESEND_API_KEY, MAIL_FROM
import { adminClient, corsHeaders, isCron, json } from "../_shared/common.ts";

const RANK: Record<string, number> = { unknown: 1, low: 1, moderate: 2, high: 3, critical: 4 };
const COLOR: Record<string, string> = {
  critical: "#b42318", high: "#c4320a", moderate: "#b54708", low: "#475467", unknown: "#475467",
};

type Row = {
  id: string; user_id: string; vuln_id: string; aliases: string[]; summary: string | null;
  severity: string; fixed_version: string | null; reference_url: string | null;
  components: { name: string; version: string; ecosystem: string } | null;
  apps: { id: string; name: string } | null;
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function renderEmail(rows: Row[], site: string) {
  const byApp = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r.apps?.name ?? "Your app";
    byApp.set(k, [...(byApp.get(k) ?? []), r]);
  }
  const sections = [...byApp.entries()].map(([app, list]) => {
    list.sort((a, b) => (RANK[b.severity] ?? 0) - (RANK[a.severity] ?? 0));
    const items = list.map((r) => {
      const cve = r.aliases.find((a) => a.startsWith("CVE-"));
      const pkg = r.components ? `${r.components.name}@${r.components.version}` : "";
      return `<tr><td style="padding:12px 0;border-top:1px solid #eaecf0">
        <span style="display:inline-block;font:600 11px/1 system-ui;text-transform:uppercase;letter-spacing:.04em;color:#fff;background:${COLOR[r.severity] ?? "#475467"};padding:4px 6px;border-radius:4px">${esc(r.severity)}</span>
        <strong style="font:600 14px system-ui;color:#101828;margin-left:6px">${esc(pkg)}</strong>
        <div style="font:14px/1.5 system-ui;color:#344054;margin-top:6px">${esc(r.summary ?? r.vuln_id)}</div>
        <div style="font:13px system-ui;color:#667085;margin-top:4px">${esc(cve ?? r.vuln_id)}${r.fixed_version ? ` · Fix: upgrade to <strong>${esc(r.fixed_version)}</strong>` : " · No fixed version published yet"}${r.reference_url ? ` · <a href="${esc(r.reference_url)}" style="color:#0e7a5f">Details</a>` : ""}</div>
      </td></tr>`;
    }).join("");
    return `<h2 style="font:600 16px system-ui;color:#101828;margin:24px 0 4px">${esc(app)}</h2><table width="100%" cellspacing="0" cellpadding="0">${items}</table>`;
  }).join("");

  const n = rows.length;
  const subject = `PatchPing: ${n} new ${n === 1 ? "vulnerability" : "vulnerabilities"} in your stack`;
  const html = `<!doctype html><html><body style="margin:0;background:#f9fafb;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #eaecf0;border-radius:12px;padding:28px">
    <div style="font:700 18px system-ui;color:#0e7a5f">PatchPing</div>
    <h1 style="font:600 20px system-ui;color:#101828;margin:16px 0 4px">${n} new ${n === 1 ? "vulnerability affects" : "vulnerabilities affect"} your apps</h1>
    <p style="font:14px/1.5 system-ui;color:#475467;margin:0">Found in our latest scan of the exact versions you track.</p>
    ${sections}
    <p style="margin:28px 0 0"><a href="${site}/app" style="display:inline-block;background:#0e7a5f;color:#fff;font:600 14px system-ui;text-decoration:none;padding:10px 16px;border-radius:8px">Open dashboard</a></p>
    <p style="font:12px/1.5 system-ui;color:#98a2b3;margin-top:28px">You get this because alerts are on for your PatchPing account. Change it in <a href="${site}/app/settings" style="color:#98a2b3">settings</a>. Data from OSV.dev; always verify before acting.</p>
  </div></body></html>`;
  const text = `${subject}\n\n` + rows.map((r) =>
    `[${r.severity.toUpperCase()}] ${r.apps?.name ?? ""} - ${r.components?.name}@${r.components?.version}: ${r.summary ?? r.vuln_id}` +
    `${r.fixed_version ? ` (fix: ${r.fixed_version})` : ""} ${r.reference_url ?? ""}`
  ).join("\n") + `\n\nDashboard: ${site}/app`;
  return { subject, html, text };
}

type Mail = { to: string; subject: string; html: string; text: string };
type Sender = (m: Mail) => Promise<{ ok: boolean; detail?: string }>;

let graphToken: { value: string; exp: number } | null = null;

function graphSender(): Sender | null {
  const tenant = Deno.env.get("MS_TENANT_ID"), clientId = Deno.env.get("MS_CLIENT_ID");
  const secret = Deno.env.get("MS_CLIENT_SECRET"), mailbox = Deno.env.get("MS_SENDER");
  if (!tenant || !clientId || !secret || !mailbox) return null;
  return async ({ to, subject, html }) => {
    if (!graphToken || graphToken.exp < Date.now() + 60_000) {
      const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId, client_secret: secret,
          scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials",
        }),
      });
      const j = await res.json();
      if (!res.ok) return { ok: false, detail: `token ${res.status} ${j.error ?? ""}` };
      graphToken = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
    }
    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${graphToken.value}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: { subject, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: to } }] },
        saveToSentItems: false,
      }),
    });
    return res.status === 202 ? { ok: true } : { ok: false, detail: `graph ${res.status} ${await res.text()}` };
  };
}

function resendSender(): Sender | null {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return null;
  const from = Deno.env.get("MAIL_FROM") ?? "PatchPing <onboarding@resend.dev>";
  return async ({ to, subject, html, text }) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    return res.ok ? { ok: true } : { ok: false, detail: `resend ${res.status} ${await res.text()}` };
  };
}

async function markNotified(admin: ReturnType<typeof adminClient>, ids: string[], at: string) {
  for (let i = 0; i < ids.length; i += 150) {
    await admin.from("findings").update({ notified_at: at }).in("id", ids.slice(i, i + 150));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = adminClient();
  if (!(await isCron(req, admin))) return json({ error: "Unauthorized" }, 401);

  const send = graphSender() ?? resendSender();
  if (!send) return json({ ok: true, skipped: "No email provider configured; findings stay pending" });
  const site = (Deno.env.get("SITE_URL") ?? "https://patchping.kriosity.in").replace(/\/$/, "");

  const { data: pending, error } = await admin
    .from("findings")
    .select("id, user_id, vuln_id, aliases, summary, severity, fixed_version, reference_url, components(name, version, ecosystem), apps(id, name)")
    .is("notified_at", null)
    .eq("status", "open")
    .limit(5000);
  if (error) return json({ ok: false, error: error.message }, 500);
  if (!pending?.length) return json({ ok: true, sent: 0 });

  const byUser = new Map<string, Row[]>();
  for (const r of pending as unknown as Row[]) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, notify_email, alerts_enabled, min_severity")
    .in("id", [...byUser.keys()]);

  let sent = 0, failed = 0;
  for (const p of profiles ?? []) {
    const rows = byUser.get(p.id) ?? [];
    const threshold = RANK[p.min_severity] ?? 1;
    const toSend = rows.filter((r) => (RANK[r.severity] ?? 1) >= threshold);
    const to = p.notify_email || p.email;
    const now = new Date().toISOString();

    if (!p.alerts_enabled || !to || toSend.length === 0) {
      // Nothing to email: mark as handled so they do not pile up.
      await markNotified(admin, rows.map((r) => r.id), now);
      continue;
    }

    const { subject, html, text } = renderEmail(toSend, site);
    const result = await send({ to, subject, html, text });
    if (result.ok) {
      sent++;
      await markNotified(admin, rows.map((r) => r.id), now);
    } else {
      failed++;
      console.error("send failed", p.id, result.detail);
    }
    await new Promise((r) => setTimeout(r, 500)); // stay under provider rate limits
  }
  return json({ ok: true, sent, failed });
});
