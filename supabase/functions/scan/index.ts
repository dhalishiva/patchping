// PatchPing scanner.
// - Called by pg_cron every 6 hours with the x-cron-secret header: scans every component.
// - Called by a signed-in user (Authorization: Bearer <jwt>) with optional { app_id }: scans their components.
// Vulnerability data comes from OSV.dev (free, no key). Matching is exact, done by OSV.
import { adminClient, corsHeaders, isCron, json, userFromRequest } from "../_shared/common.ts";

const OSV_BATCH = "https://api.osv.dev/v1/querybatch";
const OSV_VULN = "https://api.osv.dev/v1/vulns/";
const BATCH_SIZE = 500;
const DETAIL_CONCURRENCY = 8;

type Component = { id: string; app_id: string; user_id: string; ecosystem: string; name: string; version: string };
type OsvVuln = {
  id: string;
  summary?: string;
  details?: string;
  aliases?: string[];
  published?: string;
  withdrawn?: string;
  severity?: { type: string; score: string }[];
  database_specific?: { severity?: string };
  affected?: {
    package?: { ecosystem?: string; name?: string };
    ranges?: { type: string; events: Record<string, string>[] }[];
    ecosystem_specific?: { severity?: string };
    database_specific?: { severity?: string };
  }[];
};

const keyOf = (c: { ecosystem: string; name: string; version: string }) =>
  `${c.ecosystem}\u0000${c.name}\u0000${c.version}`;

function normSeverity(s?: string): string | null {
  if (!s) return null;
  const v = s.toLowerCase();
  if (v.startsWith("crit")) return "critical";
  if (v.startsWith("high")) return "high";
  if (v.startsWith("mod") || v.startsWith("med")) return "moderate";
  if (v.startsWith("low")) return "low";
  return null;
}

/** Rough severity from a CVSS v3 vector when no label is given. */
function severityFromCvss(vector?: string): string | null {
  if (!vector || !vector.startsWith("CVSS:3")) return null;
  const m = Object.fromEntries(vector.split("/").slice(1).map((p) => p.split(":")));
  const impact = ["C", "I", "A"].filter((k) => m[k] === "H").length;
  const network = m.AV === "N";
  const easy = m.AC === "L" && (m.PR === "N" || m.PR === "L");
  if (impact >= 2 && network && easy && m.PR === "N") return "critical";
  if (impact >= 1 && network) return "high";
  if (impact >= 1 || ["C", "I", "A"].some((k) => m[k] === "L")) return "moderate";
  return "low";
}

function cmpVersion(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(/[.\-+]/);
  const pb = b.replace(/^v/, "").split(/[.\-+]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? "0", y = pb[i] ?? "0";
    const nx = Number(x), ny = Number(y);
    if (!Number.isNaN(nx) && !Number.isNaN(ny)) {
      if (nx !== ny) return nx - ny;
    } else if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

function describe(v: OsvVuln, c: Component) {
  const affected = (v.affected ?? []).filter(
    (a) => a.package?.name === c.name && (a.package?.ecosystem ?? "").split(":")[0] === c.ecosystem,
  );
  const fixes = affected.flatMap((a) => (a.ranges ?? []).flatMap((r) => r.events.map((e) => e.fixed).filter(Boolean))) as string[];
  const above = fixes.filter((f) => cmpVersion(f, c.version) > 0).sort(cmpVersion);
  const vector = v.severity?.find((s) => s.type.startsWith("CVSS_V3"))?.score ?? v.severity?.[0]?.score;
  const severity =
    normSeverity(v.database_specific?.severity) ??
    normSeverity(affected[0]?.ecosystem_specific?.severity) ??
    normSeverity(affected[0]?.database_specific?.severity) ??
    severityFromCvss(vector) ??
    "unknown";
  return {
    vuln_id: v.id,
    aliases: v.aliases ?? [],
    summary: (v.summary ?? v.details ?? "").slice(0, 500) || null,
    details: (v.details ?? "").slice(0, 4000) || null,
    severity,
    cvss_vector: vector ?? null,
    fixed_version: above[0] ?? fixes[0] ?? null,
    reference_url: `https://osv.dev/vulnerability/${encodeURIComponent(v.id)}`,
    published_at: v.published ?? null,
  };
}

async function fetchJson(url: string, init?: RequestInit, tries = 3): Promise<any> {
  for (let i = 0; ; i++) {
    const res = await fetch(url, init);
    if (res.ok) return res.json();
    if (i >= tries - 1 || (res.status < 500 && res.status !== 429)) {
      throw new Error(`${url} -> HTTP ${res.status}`);
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** i));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = adminClient();
  const cron = await isCron(req, admin);
  const user = cron ? null : await userFromRequest(req, admin);
  if (!cron && !user) return json({ error: "Unauthorized" }, 401);

  let appId: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.app_id === "string") appId = body.app_id;
  } catch { /* empty body is fine */ }

  if (user) {
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin
      .from("scan_runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("started_at", since);
    if ((count ?? 0) > 0) return json({ ok: false, error: "Please wait a minute between manual scans." }, 429);
  }

  const { data: run } = await admin
    .from("scan_runs")
    .insert({ trigger: cron ? "cron" : "user", user_id: user?.id ?? null })
    .select("id")
    .single();

  try {
    // 1. Load components (paged; PostgREST caps rows per request).
    const components: Component[] = [];
    for (let from = 0; ; from += 1000) {
      let q = admin.from("components").select("id, app_id, user_id, ecosystem, name, version").range(from, from + 999);
      if (user) q = q.eq("user_id", user.id);
      if (appId) q = q.eq("app_id", appId);
      const { data, error } = await q;
      if (error) throw error;
      components.push(...(data as Component[]));
      if (!data || data.length < 1000) break;
    }

    // 2. Ask OSV which vulnerabilities affect each unique package@version.
    const unique = [...new Map(components.map((c) => [keyOf(c), c])).values()];
    const vulnsByKey = new Map<string, string[]>();
    for (let i = 0; i < unique.length; i += BATCH_SIZE) {
      const chunk = unique.slice(i, i + BATCH_SIZE);
      const res = await fetchJson(OSV_BATCH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries: chunk.map((c) => ({ package: { ecosystem: c.ecosystem, name: c.name }, version: c.version })),
        }),
      });
      (res.results ?? []).forEach((r: { vulns?: { id: string }[] }, idx: number) => {
        vulnsByKey.set(keyOf(chunk[idx]), (r.vulns ?? []).map((v) => v.id));
      });
    }

    // 3. Work out which (component, vuln) pairs are new.
    const existing = new Set<string>();
    const compIds = components.map((c) => c.id);
    for (let i = 0; i < compIds.length; i += 150) {
      const { data, error } = await admin
        .from("findings")
        .select("component_id, vuln_id")
        .in("component_id", compIds.slice(i, i + 150));
      if (error) throw error;
      for (const f of data ?? []) existing.add(`${f.component_id}|${f.vuln_id}`);
    }
    const pairs: { c: Component; vulnId: string }[] = [];
    for (const c of components) {
      for (const vulnId of vulnsByKey.get(keyOf(c)) ?? []) {
        if (!existing.has(`${c.id}|${vulnId}`)) pairs.push({ c, vulnId });
      }
    }

    // 4. Fetch details only for vulnerabilities we have not recorded yet.
    const needed = [...new Set(pairs.map((p) => p.vulnId))];
    const details = new Map<string, OsvVuln>();
    for (let i = 0; i < needed.length; i += DETAIL_CONCURRENCY) {
      await Promise.all(
        needed.slice(i, i + DETAIL_CONCURRENCY).map(async (id) => {
          try {
            details.set(id, await fetchJson(OSV_VULN + encodeURIComponent(id)));
          } catch (e) {
            console.error("detail fetch failed", id, e);
          }
        }),
      );
    }

    // 5. Insert new findings. User-triggered scans are "seen" already, so no email for them.
    const now = new Date().toISOString();
    const rows = pairs
      .filter((p) => details.has(p.vulnId) && !details.get(p.vulnId)!.withdrawn)
      .map((p) => ({
        user_id: p.c.user_id,
        app_id: p.c.app_id,
        component_id: p.c.id,
        ...describe(details.get(p.vulnId)!, p.c),
        notified_at: cron ? null : now,
      }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin
        .from("findings")
        .upsert(rows.slice(i, i + 500), { onConflict: "component_id,vuln_id", ignoreDuplicates: true });
      if (error) throw error;
    }

    // 6. Stamp scanned apps.
    const appIds = [...new Set(components.map((c) => c.app_id))];
    for (let i = 0; i < appIds.length; i += 300) {
      await admin.from("apps").update({ last_scanned_at: now }).in("id", appIds.slice(i, i + 300));
    }

    const summary = { components_checked: components.length, unique_packages: unique.length, new_findings: rows.length };
    if (run) {
      await admin.from("scan_runs").update({
        finished_at: new Date().toISOString(),
        components_checked: components.length,
        new_findings: rows.length,
      }).eq("id", run.id);
    }
    return json({ ok: true, ...summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("scan failed", message);
    if (run) await admin.from("scan_runs").update({ finished_at: new Date().toISOString(), error: message }).eq("id", run.id);
    return json({ ok: false, error: "Scan failed. Please try again shortly." }, 500);
  }
});
