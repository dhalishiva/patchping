import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTitle } from "../components/Layout";
import { supabase, useSession } from "../lib/supabase";

function Field(props: { label: string; type?: string; value: string; onChange: (v: string) => void; autoComplete?: string; hint?: string; minLength?: number }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        required
        minLength={props.minLength}
        autoComplete={props.autoComplete}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.hint && <small className="muted">{props.hint}</small>}
    </label>
  );
}

function friendly(msg: string) {
  if (/invalid login/i.test(msg)) return "That email and password don't match. Check them, or reset your password.";
  if (/not confirmed/i.test(msg)) return "Confirm your email first. Check your inbox for the link we sent.";
  if (/rate limit|too many/i.test(msg)) return "Too many attempts. Wait a minute and try again.";
  if (/already registered/i.test(msg)) return "An account with this email already exists. Log in instead.";
  return msg;
}

export function Login() {
  useTitle("Log in");
  const { session } = useSession();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (session) return <Navigate to={from} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setNotice("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(friendly(error.message));
    else navigate(from, { replace: true });
  }

  async function magicLink() {
    if (!email) { setError("Enter your email first, then ask for a link."); return; }
    setBusy(true); setError(""); setNotice("");
    const { error } = await supabase.auth.signInWithOtp({
      email, options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/app` },
    });
    setBusy(false);
    if (error) setError(friendly(error.message));
    else setNotice(`Sign-in link sent to ${email}. It works once and expires in an hour.`);
  }

  return (
    <div className="auth wrap">
      <h1>Log in</h1>
      <form onSubmit={submit} className="stack">
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-ok" role="status">{notice}</p>}
        <button className="btn" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
        <button type="button" className="btn btn-ghost" onClick={magicLink} disabled={busy}>Email me a sign-in link</button>
      </form>
      <p className="small muted auth-alt">
        <Link to="/forgot-password">Forgot password?</Link> · New here? <Link to="/signup">Create an account</Link>
      </p>
    </div>
  );
}

export function Signup() {
  useTitle("Create account");
  const { session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");

  if (session) return <Navigate to="/app" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!agree) { setError("Accept the terms and privacy policy to continue."); return; }
    setBusy(true); setError("");
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    setBusy(false);
    if (error) setError(friendly(error.message));
    else if (!data.session) setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="auth wrap">
        <h1>Check your email</h1>
        <p className="lede">We sent a confirmation link to <strong>{sentTo}</strong>. Open it to finish creating your account.</p>
        <p className="small muted">No email after a few minutes? Check spam, or <button className="link-btn" onClick={() => setSentTo("")}>try again</button>.</p>
      </div>
    );
  }

  return (
    <div className="auth wrap">
      <h1>Create your account</h1>
      <p className="muted">Free during early access. You'll add your first app right after.</p>
      <form onSubmit={submit} className="stack">
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" hint="Alerts go here. You can change it later." />
        <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} hint="At least 8 characters." />
        <label className="check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>I agree to the <Link to="/terms">terms of service</Link> and <Link to="/privacy">privacy policy</Link>.</span>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
      </form>
      <p className="small muted auth-alt">Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}

export function ForgotPassword() {
  useTitle("Reset password");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) setError(friendly(error.message));
    else setDone(true);
  }

  return (
    <div className="auth wrap">
      <h1>Reset your password</h1>
      {done ? (
        <p className="lede">If an account exists for <strong>{email}</strong>, a reset link is on its way.</p>
      ) : (
        <form onSubmit={submit} className="stack">
          <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
        </form>
      )}
      <p className="small muted auth-alt"><Link to="/login">Back to log in</Link></p>
    </div>
  );
}

export function ResetPassword() {
  useTitle("Choose a new password");
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(friendly(error.message));
    else navigate("/app", { replace: true });
  }

  if (!loading && !session && !ready) {
    return (
      <div className="auth wrap">
        <h1>This reset link has expired</h1>
        <p className="lede">Reset links work once and expire after an hour.</p>
        <Link className="btn" to="/forgot-password">Send a new link</Link>
      </div>
    );
  }

  return (
    <div className="auth wrap">
      <h1>Choose a new password</h1>
      <form onSubmit={submit} className="stack">
        <Field label="New password" type="password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} hint="At least 8 characters." />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
      </form>
    </div>
  );
}
