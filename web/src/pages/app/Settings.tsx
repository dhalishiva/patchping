import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTitle } from "../../components/Layout";
import { callFunction, supabase, useSession, type Profile } from "../../lib/supabase";

export default function Settings() {
  useTitle("Settings");
  const { session } = useSession();
  const navigate = useNavigate();
  const [p, setP] = useState<Profile | null>(null);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [pw, setPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  useEffect(() => {
    supabase.from("profiles").select("*").maybeSingle().then(({ data }) => setP(data as Profile));
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!p) return;
    setSaved(""); setError("");
    const { error } = await supabase.from("profiles").update({
      notify_email: p.notify_email?.trim() || null,
      alerts_enabled: p.alerts_enabled,
      min_severity: p.min_severity,
    }).eq("id", p.id);
    if (error) setError(error.message);
    else setSaved("Alert settings saved.");
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg("");
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwMsg(error ? error.message : "Password changed.");
    if (!error) setPw("");
  }

  async function deleteAccount() {
    setDeleting(true); setError("");
    try {
      await callFunction("account", { action: "delete" });
      await supabase.auth.signOut();
      navigate("/", { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  }

  if (!p) return <p className="muted">Loading…</p>;
  const email = session?.user.email ?? "";

  return (
    <div className="settings">
      <h1>Settings</h1>

      <section>
        <h2>Alerts</h2>
        <form onSubmit={save} className="stack">
          <label className="check">
            <input type="checkbox" checked={p.alerts_enabled} onChange={(e) => setP({ ...p, alerts_enabled: e.target.checked })} />
            <span>Email me when a new vulnerability affects my apps</span>
          </label>
          <label className="field">
            <span>Send alerts to</span>
            <input type="email" value={p.notify_email ?? ""} placeholder={email} onChange={(e) => setP({ ...p, notify_email: e.target.value })} />
            <small className="muted">Leave empty to use your account email.</small>
          </label>
          <label className="field">
            <span>Email me about</span>
            <select value={p.min_severity} onChange={(e) => setP({ ...p, min_severity: e.target.value })}>
              <option value="low">All issues</option>
              <option value="moderate">Moderate and above</option>
              <option value="high">High and critical only</option>
              <option value="critical">Critical only</option>
            </select>
            <small className="muted">Everything still shows in your dashboard.</small>
          </label>
          {saved && <p className="form-ok" role="status">{saved}</p>}
          <button className="btn">Save alert settings</button>
        </form>
      </section>

      <section>
        <h2>Password</h2>
        <form onSubmit={changePassword} className="inline-form">
          <label className="field grow">
            <span>New password</span>
            <input type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          </label>
          <button className="btn btn-ghost">Change password</button>
        </form>
        {pwMsg && <p className="small" role="status">{pwMsg}</p>}
      </section>

      <section>
        <h2>Delete account</h2>
        <p className="muted">This permanently deletes your account, apps, packages and results. It can't be undone.</p>
        <label className="field">
          <span>Type <strong>delete</strong> to confirm</span>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <button className="btn btn-danger" disabled={confirm !== "delete" || deleting} onClick={deleteAccount}>
          {deleting ? "Deleting…" : "Delete my account"}
        </button>
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
