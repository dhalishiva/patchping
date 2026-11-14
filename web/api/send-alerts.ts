/// <reference types="node" />
// PatchPing alert sender (Vercel function).
// Supabase pg_cron calls POST /api/send-alerts every 6 hours with the x-cron-secret header.
// It emails each user one digest of new findings through Microsoft 365 SMTP
// (smtp.office365.com:587, STARTTLS). This lives on Vercel because Supabase Edge
// Functions cannot open connections on port 587.
//
// Vercel environment variables:
//   SUPABASE_SERVICE_ROLE_KEY  (required) Supabase → Project Settings → API keys → service_role / secret
//   SMTP_USER                  (required) full mailbox address, e.g. alerts@yourdomain.com
//   SMTP_PASS                  (required) that mailbox's password
//   MAIL_FROM                  (optional) defaults to "PatchPing <SMTP_USER>"
//   SITE_URL                   (optional) defaults to https://patchping.vercel.app
//   SUPABASE_URL               (optional) defaults to the PatchPing project URL
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const RANK: Record<string, number> = { unknown: 1, low: 1, moderate: 2, high: 3, critical: 4 };
const COLOR: Record<string, string> = {
  critical: "#7a1c0a", high: "#e4572e", moderate: "#a15c07", low: "#5b6577", unknown: "#5b6577",
};
const MAX_EMAILS_PER_RUN = 100; // Exchange Online allows 30 messages/minute per mailbox
const GAP_MS = 2100;

type Row = {
  id: string; user_id: string; vuln_id: string; aliases: string[]; summary: string | null;
  severity: string; fixed_version: string | null; reference_url: string | null;
  components: { name: string; version: string; ecosystem: string } | null;
  apps: { id: string; name: string } | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function renderEmail(rows: Row[], site: string) {
  const byApp = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r.apps?.name ?? "Your app";
    byApp.set(k, [...(byApp.get(k) ?? []), r]);
  }
  const font = "font-family:'Segoe UI',Arial,Helvetica,sans-serif;";
  const sections = [...byApp.entries()].map(([app, list]) => {
    list.sort((a, b) => (RANK[b.severity] ?? 0) - (RANK[a.severity] ?? 0));
    const items = list.map((r) => {
      const cve = r.aliases.find((a) => a.startsWith("CVE-"));
      const pkg = r.components ? `${r.components.name} ${r.components.version}` : "";
      const label = r.severity === "unknown" ? "Unrated" : r.severity[0].toUpperCase() + r.severity.slice(1);
      return `<tr><td style="padding:14px 0;border-top:1px solid #d9dee5;${font}">
        <span style="display:inline-block;font-size:12px;font-weight:600;color:#fff;background:${COLOR[r.severity] ?? "#5b6577"};padding:3px 7px;border-radius:4px">${label}</span>
        <span style="font-family:Consolas,'Courier New',monospace;font-size:14px;font-weight:600;color:#14213d;margin-left:6px">${esc(pkg)}</span>
        <div style="font-size:14px;line-height:1.5;color:#2b3a5c;margin-top:6px">${esc(r.summary ?? r.vuln_id)}</div>
        <div style="font-size:13px;line-height:1.5;color:#5b6577;margin-top:4px">${esc(cve ?? r.vuln_id)}${
          r.fixed_version ? ` &middot; Fix: upgrade to <strong>${esc(r.fixed_version)}</strong>` : " &middot; No fixed version published yet"
        }${r.reference_url ? ` &middot; <a href="${esc(r.reference_url)}" style="color:#14213d">Advisory</a>` : ""}</div>
      </td></tr>`;
    }).join("");
    return `<h2 style="${font}font-size:16px;font-weight:600;color:#14213d;margin:24px 0 4px">${esc(app)}</h2>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${items}</table>`;
  }).join("");

  const n = rows.length;
  const subject = `PatchPing: ${n} new ${n === 1 ? "vulnerability" : "vulnerabilities"} in your stack`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f3f5f7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f5f7"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#fff;border:1px solid #d9dee5;border-radius:12px"><tr><td style="padding:28px 32px;${font}">
  <div style="font-size:18px;font-weight:700;color:#14213d">PatchPing</div>
  <h1 style="font-size:20px;font-weight:600;color:#14213d;margin:16px 0 4px">${n} new ${n === 1 ? "vulnerability affects" : "vulnerabilities affect"} your apps</h1>
  <p style="font-size:14px;line-height:1.5;color:#2b3a5c;margin:0">Found in our latest check of the exact versions you track.</p>
  ${sections}
  <p style="margin:28px 0 0"><a href="${site}/app" style="display:inline-block;background:#14213d;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:11px 18px;border-radius:6px">Open dashboard</a></p>
  <p style="font-size:12px;line-height:1.6;color:#5b6577;margin:28px 0 0">You get this because alerts are on for your PatchPing account. Change it in <a href="${site}/app/settings" style="color:#5b6577">settings</a>. Vulnerability data from OSV.dev; review each advisory before acting.</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `${subject}\n\n` + rows.map((r) =>
    `[${r.severity.toUpperCase()}] ${r.apps?.name ?? ""}: ${r.components?.name} ${r.components?.version} - ${r.summary ?? r.vuln_id}` +
    `${r.fixed_version ? ` (fix: upgrade to ${r.fixed_version})` : ""} ${r.reference_url ?? ""}`
  ).join("\n") + `\n\nDashboard: ${site}/app\nChange alert settings: ${site}/app/settings`;
  return { subject, html, text };
}

export async function POST(request: Request): Promise<Response> {
  const supabaseUrl = process.env.SUPABASE_URL ?? "https://vswctqwxvesjripvwsex.supabase.co";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  if (!serviceKey) return json({ error: "Not configured" }, 503);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Only the Supabase scheduler may call this: compare against the secret stored in the database.
  const { data: cfg } = await admin.from("app_config").select("value").eq("key", "cron_secret").maybeSingle();
  const got = request.headers.get("x-cron-secret") ?? "";
  if (!cfg?.value || !safeEqual(cfg.value, got)) return json({ error: "Unauthorized" }, 401);

  if (!user || !pass) return json({ ok: true, skipped: "SMTP_USER / SMTP_PASS not set; findings stay pending" });

  const site = (process.env.SITE_URL ?? "https://patchping.vercel.app").replace(/\/$/, "");
  const from = process.env.MAIL_FROM ?? `PatchPing <${user}>`;
  const transport = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    tls: { minVersion: "TLSv1.2" },
  });

  try {
    await transport.verify();
  } catch (e) {
    console.error("smtp login failed", (e as Error).message);
    return json({ ok: false, error: `SMTP login failed: ${(e as Error).message}` }, 502);
  }

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

  const markNotified = async (ids: string[]) => {
    const at = new Date().toISOString();
    for (let i = 0; i < ids.length; i += 150) {
      await admin.from("findings").update({ notified_at: at }).in("id", ids.slice(i, i + 150));
    }
  };

  let sent = 0, failed = 0, deferred = 0;
  for (const p of profiles ?? []) {
    const rows = byUser.get(p.id) ?? [];
    const threshold = RANK[p.min_severity] ?? 1;
    const toSend = rows.filter((r) => (RANK[r.severity] ?? 1) >= threshold);
    const to = p.notify_email || p.email;

    if (!p.alerts_enabled || !to || toSend.length === 0) {
      await markNotified(rows.map((r) => r.id)); // nothing to email; don't let them pile up
      continue;
    }
    if (sent + failed >= MAX_EMAILS_PER_RUN) { deferred++; continue; } // picked up next run

    const { subject, html, text } = renderEmail(toSend, site);
    try {
      await transport.sendMail({ from, to, subject, html, text });
      sent++;
      await markNotified(rows.map((r) => r.id));
    } catch (e) {
      failed++;
      console.error("send failed", p.id, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, GAP_MS));
  }
  transport.close();
  return json({ ok: true, sent, failed, deferred });
}
