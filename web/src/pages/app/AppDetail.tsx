import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SeverityPill, useTitle } from "../../components/Layout";
import {
  callFunction, severityRank, supabase, timeAgo,
  type App, type Component, type Finding,
} from "../../lib/supabase";
import {
  ECOSYSTEMS, SUPPORTED_FILES, parseDependencyFile, parseManualList,
  type Ecosystem, type ParseResult,
} from "../../lib/parsers";

type Tab = "issues" | "packages" | "add";

export default function AppDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<App | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("issues");
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  useTitle(app?.name ?? "App");

  const load = useCallback(async () => {
    const [a, c, f] = await Promise.all([
      supabase.from("apps").select("*").eq("id", id).maybeSingle(),
      supabase.from("components").select("*").eq("app_id", id).order("name").limit(5000),
      supabase.from("findings").select("*, components(name, version, ecosystem)").eq("app_id", id).limit(5000),
    ]);
    setApp(a.data as App | null);
    setComponents((c.data ?? []) as Component[]);
    setFindings((f.data ?? []) as Finding[]);
    setLoaded(true);
    return (c.data ?? []).length;
  }, [id]);

  useEffect(() => {
    load().then((n) => setTab(n === 0 ? "add" : "issues"));
  }, [load]);

  async function scanNow() {
    setScanning(true); setScanMsg("");
    try {
      const r = await callFunction<{ components_checked: number; new_findings: number }>("scan", { app_id: id });
      await load();
      setScanMsg(r.new_findings
        ? `Checked ${r.components_checked} packages. Found ${r.new_findings} new ${r.new_findings === 1 ? "issue" : "issues"}.`
        : `Checked ${r.components_checked} packages. Nothing new.`);
      setTab("issues");
    } catch (e) {
      setScanMsg((e as Error).message);
    } finally {
      setScanning(false);
    }
  }

  if (!loaded) return <p className="muted">Loading…</p>;
  if (!app) {
    return (
      <div className="empty">
        <h1>App not found</h1>
        <p className="muted">It may have been deleted.</p>
        <Link className="btn" to="/app">Back to your apps</Link>
      </div>
    );
  }

  const open = findings.filter((f) => f.status === "open");

  return (
    <>
      <p className="crumb small"><Link to="/app">Your apps</Link> /</p>
      <div className="app-title-row">
        <h1>{app.name}</h1>
        <button className="btn" onClick={scanNow} disabled={scanning || components.length === 0}>
          {scanning ? "Scanning…" : "Scan now"}
        </button>
      </div>
      <p className="muted small">
        {components.length} {components.length === 1 ? "package" : "packages"} · checked {timeAgo(app.last_scanned_at)} · checked automatically every 6 hours
      </p>
      {scanMsg && <p className="form-ok" role="status">{scanMsg}</p>}

      {components.length > 0 && (
        <p className={open.length ? "status-line status-bad" : "status-line status-good"}>
          {open.length
            ? `${open.length} open ${open.length === 1 ? "issue needs" : "issues need"} a look.`
            : app.last_scanned_at ? "All clear. No known vulnerabilities in these versions." : "Not checked yet. Run a scan to see results now."}
        </p>
      )}

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "issues"} onClick={() => setTab("issues")}>Issues {open.length > 0 && <span className="count">{open.length}</span>}</button>
        <button role="tab" aria-selected={tab === "packages"} onClick={() => setTab("packages")}>Packages <span className="count">{components.length}</span></button>
        <button role="tab" aria-selected={tab === "add"} onClick={() => setTab("add")}>Add packages</button>
      </div>

      {tab === "issues" && <Issues findings={findings} onChange={load} empty={components.length === 0} goAdd={() => setTab("add")} />}
      {tab === "packages" && <Packages components={components} onChange={load} goAdd={() => setTab("add")} />}
      {tab === "add" && (
        <Importer
          appId={id}
          existing={components.length}
          onDone={async (msg) => { await load(); setScanMsg(msg); await scanNow(); }}
        />
      )}

      <AppDanger app={app} onRenamed={load} onDeleted={() => navigate("/app")} />
    </>
  );
}

function Issues({ findings, onChange, empty, goAdd }: { findings: Finding[]; onChange: () => void; empty: boolean; goAdd: () => void }) {
  const [filter, setFilter] = useState<"open" | "dismissed" | "fixed">("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useMemo(
    () => findings.filter((f) => f.status === filter).sort((a, b) =>
      severityRank(b.severity) - severityRank(a.severity) || (a.components?.name ?? "").localeCompare(b.components?.name ?? "")),
    [findings, filter],
  );

  async function setStatus(f: Finding, status: Finding["status"]) {
    await supabase.from("findings").update({ status }).eq("id", f.id);
    onChange();
  }

  if (empty) {
    return (
      <div className="empty">
        <h2>No packages yet</h2>
        <p className="muted">Add this app's lockfile or a list of packages, and we'll check them straight away.</p>
        <button className="btn" onClick={goAdd}>Add packages</button>
      </div>
    );
  }

  const n = (s: string) => findings.filter((f) => f.status === s).length;
  return (
    <>
      <div className="seg" role="group" aria-label="Filter issues">
        {(["open", "dismissed", "fixed"] as const).map((s) => (
          <button key={s} aria-pressed={filter === s} onClick={() => setFilter(s)}>
            {s[0].toUpperCase() + s.slice(1)} ({n(s)})
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="muted pad">{filter === "open" ? "No open issues." : `No ${filter} issues.`}</p>
      ) : (
        <ul className="issue-list">
          {list.map((f) => {
            const cve = f.aliases.find((a) => a.startsWith("CVE-"));
            const expanded = openId === f.id;
            return (
              <li key={f.id} className="issue">
                <div className="issue-main">
                  <SeverityPill severity={f.severity} />
                  <div className="issue-body">
                    <p className="issue-pkg"><code>{f.components?.name}</code> <code className="muted">{f.components?.version}</code></p>
                    <p className="issue-sum">{f.summary ?? f.vuln_id}</p>
                    <p className="small muted">
                      {cve ? `${cve} · ` : ""}{f.vuln_id}
                      {f.fixed_version ? <> · fixed in <code>{f.fixed_version}</code></> : " · no fixed version yet"}
                    </p>
                  </div>
                  <div className="issue-actions">
                    <button className="link-btn" aria-expanded={expanded} onClick={() => setOpenId(expanded ? null : f.id)}>{expanded ? "Hide" : "Details"}</button>
                    {f.status === "open" ? (
                      <>
                        <button className="link-btn" onClick={() => setStatus(f, "fixed")}>Mark fixed</button>
                        <button className="link-btn" onClick={() => setStatus(f, "dismissed")}>Dismiss</button>
                      </>
                    ) : (
                      <button className="link-btn" onClick={() => setStatus(f, "open")}>Reopen</button>
                    )}
                  </div>
                </div>
                {expanded && (
                  <div className="issue-details">
                    {f.details && <p className="pre">{f.details}</p>}
                    <p className="small muted">
                      {f.published_at && <>Published {new Date(f.published_at).toLocaleDateString()} · </>}
                      First seen here {new Date(f.first_seen_at).toLocaleDateString()}
                      {f.aliases.length > 0 && <> · Also known as {f.aliases.join(", ")}</>}
                    </p>
                    {f.reference_url && <a href={f.reference_url} target="_blank" rel="noopener noreferrer">Read the full advisory on OSV.dev</a>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {filter === "open" && list.length > 0 && (
        <p className="small muted">Marking an issue fixed only hides it. To clear it for real, upgrade the package and re-import your lockfile.</p>
      )}
    </>
  );
}

function Packages({ components, onChange, goAdd }: { components: Component[]; onChange: () => void; goAdd: () => void }) {
  const [q, setQ] = useState("");
  const shown = components.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 500);
  async function remove(c: Component) {
    await supabase.from("components").delete().eq("id", c.id);
    onChange();
  }
  if (components.length === 0) {
    return (
      <div className="empty">
        <h2>No packages yet</h2>
        <button className="btn" onClick={goAdd}>Add packages</button>
      </div>
    );
  }
  return (
    <>
      <label className="field">
        <span>Filter packages</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Package name" />
      </label>
      <table className="pkg-table">
        <thead><tr><th>Package</th><th>Version</th><th>Ecosystem</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {shown.map((c) => (
            <tr key={c.id}>
              <td><code>{c.name}</code></td>
              <td><code>{c.version}</code></td>
              <td className="muted">{c.ecosystem}</td>
              <td><button className="link-btn" onClick={() => remove(c)} aria-label={`Remove ${c.name}`}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {shown.length === 500 && <p className="small muted">Showing the first 500. Filter to find others.</p>}
    </>
  );
}

function Importer({ appId, existing, onDone }: { appId: string; existing: number; onDone: (msg: string) => Promise<void> }) {
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [eco, setEco] = useState<Ecosystem>("npm");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function readFile(file: File) {
    setError("");
    if (file.size > 15 * 1024 * 1024) { setError("That file is over 15 MB. Is it the right one?"); return; }
    setFileName(file.name);
    setResult(parseDependencyFile(file.name, await file.text()));
  }
  function onDrop(e: DragEvent) {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) readFile(f);
  }

  async function save(replace: boolean) {
    if (!result?.deps.length) return;
    setSaving(true); setError("");
    try {
      if (replace) {
        const { error } = await supabase.from("components").delete().eq("app_id", appId);
        if (error) throw error;
      }
      const source = mode === "file" ? fileName.slice(0, 60) : "manual";
      const rows = result.deps.map((d) => ({ app_id: appId, ecosystem: d.ecosystem, name: d.name, version: d.version, source }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from("components")
          .upsert(rows.slice(i, i + 500), { onConflict: "app_id,ecosystem,name,version", ignoreDuplicates: true });
        if (error) throw error;
      }
      const n = rows.length;
      setResult(null); setText(""); setFileName("");
      await onDone(`Saved ${n} ${n === 1 ? "package" : "packages"}. Checking them now…`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="importer">
      <div className="seg" role="group" aria-label="How to add packages">
        <button aria-pressed={mode === "file"} onClick={() => { setMode("file"); setResult(null); }}>Upload a file</button>
        <button aria-pressed={mode === "paste"} onClick={() => { setMode("paste"); setResult(null); }}>Paste a list</button>
      </div>

      {mode === "file" ? (
        <div
          className={drag ? "drop dragging" : "drop"}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
        >
          <p><strong>Drop a lockfile here</strong> or <button className="link-btn" onClick={() => input.current?.click()}>choose a file</button></p>
          <p className="small muted">{SUPPORTED_FILES.join(", ")}</p>
          <p className="small muted">The file is read in your browser. Only package names and versions are saved.</p>
          <input ref={input} type="file" hidden onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
        </div>
      ) : (
        <div className="stack">
          <label className="field">
            <span>Ecosystem</span>
            <select value={eco} onChange={(e) => setEco(e.target.value as Ecosystem)}>
              {ECOSYSTEMS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Packages, one per line</span>
            <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={"react@18.3.1\n@supabase/supabase-js@2.45.0\nexpress@4.19.2"} />
            <small className="muted">Use name@version. For Python you can also write name==version.</small>
          </label>
          <button className="btn btn-ghost" onClick={() => setResult(parseManualList(text, eco))} disabled={!text.trim()}>Check list</button>
        </div>
      )}

      {result && (
        <div className="preview">
          <p><strong>{result.deps.length} {result.deps.length === 1 ? "package" : "packages"}</strong> found{fileName && mode === "file" ? ` in ${fileName}` : ""}.</p>
          {result.warnings.map((w) => <p key={w} className="form-warn">{w}</p>)}
          {result.deps.length > 0 && (
            <>
              <p className="small muted preview-sample">
                {result.deps.slice(0, 6).map((d) => `${d.name}@${d.version}`).join(", ")}{result.deps.length > 6 ? ", …" : ""}
              </p>
              <div className="cta-row">
                {existing > 0 && (
                  <button className="btn" onClick={() => save(true)} disabled={saving}>
                    {saving ? "Saving…" : `Replace all ${existing} packages`}
                  </button>
                )}
                <button className={existing > 0 ? "btn btn-ghost" : "btn"} onClick={() => save(false)} disabled={saving}>
                  {saving ? "Saving…" : existing > 0 ? "Add to existing" : `Save ${result.deps.length} packages and scan`}
                </button>
              </div>
              {existing > 0 && <p className="small muted">Replacing also clears this app's dismissed and fixed history. Use it after you upgrade.</p>}
            </>
          )}
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

function AppDanger({ app, onRenamed, onDeleted }: { app: App; onRenamed: () => void; onDeleted: () => void }) {
  const [name, setName] = useState(app.name);
  const [confirming, setConfirming] = useState(false);
  async function rename() {
    if (!name.trim() || name === app.name) return;
    await supabase.from("apps").update({ name: name.trim() }).eq("id", app.id);
    onRenamed();
  }
  async function del() {
    await supabase.from("apps").delete().eq("id", app.id);
    onDeleted();
  }
  return (
    <details className="app-settings">
      <summary>App settings</summary>
      <div className="inline-form">
        <label className="field grow">
          <span>App name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        <button className="btn btn-ghost" onClick={rename}>Rename</button>
      </div>
      {confirming ? (
        <p>
          Delete {app.name} and all its packages and results?{" "}
          <button className="btn btn-danger btn-small" onClick={del}>Delete app</button>{" "}
          <button className="link-btn" onClick={() => setConfirming(false)}>Keep it</button>
        </p>
      ) : (
        <button className="link-btn danger-text" onClick={() => setConfirming(true)}>Delete this app</button>
      )}
    </details>
  );
}
