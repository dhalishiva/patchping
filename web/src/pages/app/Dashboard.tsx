import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SeverityPill, useTitle } from "../../components/Layout";
import { supabase, timeAgo, SEVERITY_ORDER, type App } from "../../lib/supabase";

type Counts = Record<string, Record<string, number>>;

export default function Dashboard() {
  useTitle("Your apps");
  const navigate = useNavigate();
  const [apps, setApps] = useState<App[] | null>(null);
  const [counts, setCounts] = useState<Counts>({});
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    const [a, f] = await Promise.all([
      supabase.from("apps").select("*").order("created_at"),
      supabase.from("findings").select("app_id, severity").eq("status", "open").limit(10000),
    ]);
    if (a.error) { setError(a.error.message); return; }
    const c: Counts = {};
    for (const r of f.data ?? []) {
      c[r.app_id] ??= {};
      c[r.app_id][r.severity] = (c[r.app_id][r.severity] ?? 0) + 1;
    }
    setApps(a.data as App[]);
    setCounts(c);
  }
  useEffect(() => { load(); }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true); setError("");
    const { data, error } = await supabase.from("apps").insert({ name: name.trim() }).select("id").single();
    setCreating(false);
    if (error) setError(error.message);
    else navigate(`/app/apps/${data.id}`);
  }

  const total = Object.values(counts).reduce((s, c) => s + Object.values(c).reduce((a, b) => a + b, 0), 0);
  const affected = Object.keys(counts).length;

  return (
    <>
      <div className="app-title-row">
        <h1>Your apps</h1>
      </div>

      {apps && apps.length > 0 && (
        <p className={total ? "status-line status-bad" : "status-line status-good"}>
          {total
            ? `${total} open ${total === 1 ? "issue" : "issues"} across ${affected} ${affected === 1 ? "app" : "apps"}.`
            : `All clear across ${apps.length} ${apps.length === 1 ? "app" : "apps"}. Next check within 6 hours.`}
        </p>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}
      {apps === null && !error && <p className="muted">Loading…</p>}

      {apps && apps.length === 0 && (
        <div className="empty">
          <h2>Add the first app you want watched</h2>
          <p className="muted">Name it after the project, like "Billing API" or "Marketing site". Next you'll add its packages.</p>
        </div>
      )}

      {apps && apps.length > 0 && (
        <ul className="app-list">
          {apps.map((a) => {
            const c = counts[a.id] ?? {};
            const open = Object.values(c).reduce((x, y) => x + y, 0);
            return (
              <li key={a.id}>
                <Link to={`/app/apps/${a.id}`} className="app-row">
                  <span className="app-row-name">{a.name}</span>
                  <span className="app-row-sev">
                    {open === 0 ? (
                      <span className="ok-text">{a.last_scanned_at ? "All clear" : "Not checked yet"}</span>
                    ) : (
                      SEVERITY_ORDER.filter((s) => c[s]).map((s) => (
                        <span key={s} className="sev-count"><SeverityPill severity={s} /> {c[s]}</span>
                      ))
                    )}
                  </span>
                  <span className="muted small app-row-time">Checked {timeAgo(a.last_scanned_at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {apps && (
        <form onSubmit={create} className="inline-form">
          <label className="field grow">
            <span>{apps.length ? "Add another app" : "App name"}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Billing API" required />
          </label>
          <button className="btn" disabled={creating}>{creating ? "Adding…" : "Add app"}</button>
        </form>
      )}
    </>
  );
}
