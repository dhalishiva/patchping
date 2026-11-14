import { createClient, type Session } from "@supabase/supabase-js";
import { createContext, useContext } from "react";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export type Severity = "critical" | "high" | "moderate" | "low" | "unknown";
export const SEVERITY_ORDER: Severity[] = ["critical", "high", "moderate", "low", "unknown"];
export const severityRank = (s: string) => 5 - Math.max(0, SEVERITY_ORDER.indexOf(s as Severity));

export type App = { id: string; name: string; description: string | null; last_scanned_at: string | null; created_at: string };
export type Component = { id: string; app_id: string; ecosystem: string; name: string; version: string; source: string };
export type Finding = {
  id: string; app_id: string; component_id: string; vuln_id: string; aliases: string[];
  summary: string | null; details: string | null; severity: Severity; fixed_version: string | null;
  reference_url: string | null; published_at: string | null; status: "open" | "dismissed" | "fixed";
  first_seen_at: string;
  components?: { name: string; version: string; ecosystem: string } | null;
};
export type Profile = { id: string; email: string | null; notify_email: string | null; alerts_enabled: boolean; min_severity: string };

export const SessionContext = createContext<{ session: Session | null; loading: boolean }>({ session: null, loading: true });
export const useSession = () => useContext(SessionContext);

/** Call an edge function with the user's token; returns parsed JSON or throws a readable error. */
export async function callFunction<T = any>(name: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
