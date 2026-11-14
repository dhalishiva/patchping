import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTitle } from "../components/Layout";
import { supabase, useSession } from "../lib/supabase";

// Passwordless sign-in: the user enters their email, gets a 6-digit code, types it in.
// The same flow creates the account (signup) or signs in (login).

function friendly(msg: string, mode: "login" | "signup") {
  if (/signups not allowed|user not found/i.test(msg)) {
    return mode === "login" ? "There's no account with this email yet. Create one instead." : msg;
  }
  if (/expired|invalid/i.test(msg) && /token|otp|code/i.test(msg)) return "That code is wrong or has expired. Check the latest email, or send a new code.";
  if (/rate limit|too many|security purposes/i.test(msg)) return "Too many attempts. Wait a minute, then send a new code.";
  if (/error sending|smtp|mail/i.test(msg)) return "We couldn't send the email just now. Try again in a minute.";
  return msg;
}

function EmailCodeAuth({ mode }: { mode: "login" | "signup" }) {
  const { session } = useSession();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/app";
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeInput.current?.focus();
  }, [step]);

  if (session) return <Navigate to={from} replace />;

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    if (mode === "signup" && !agree) { setError("Accept the terms and privacy policy to continue."); return; }
    setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: mode === "signup", emailRedirectTo: `${window.location.origin}/app` },
    });
    setBusy(false);
    if (error) { setError(friendly(error.message, mode)); return; }
    setStep("code"); setCode(""); setCooldown(60);
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setError(friendly(error.message, mode));
    else navigate(from, { replace: true });
  }

  if (step === "code") {
    return (
      <div className="auth wrap">
        <h1>Check your email</h1>
        <p className="lede">We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.</p>
        <form onSubmit={verify} className="stack">
          <label className="field">
            <span>Code</span>
            <input
              ref={codeInput}
              className="code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              required
              aria-describedby="code-hint"
            />
            <small id="code-hint" className="muted">No email? Check spam or junk, then send a new code.</small>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn" disabled={busy || code.length < 6}>{busy ? "Checking…" : mode === "signup" ? "Create account" : "Log in"}</button>
        </form>
        <p className="small muted auth-alt">
          <button className="link-btn" onClick={() => sendCode()} disabled={busy || cooldown > 0}>
            {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
          </button>
          {" · "}
          <button className="link-btn" onClick={() => { setStep("email"); setError(""); }}>Use a different email</button>
        </p>
      </div>
    );
  }

  return (
    <div className="auth wrap">
      <h1>{mode === "signup" ? "Create your account" : "Log in"}</h1>
      <p className="muted">
        {mode === "signup"
          ? "Free during early access. No password needed: we'll email you a code."
          : "We'll email you a 6-digit code. No password needed."}
      </p>
      <form onSubmit={sendCode} className="stack">
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          {mode === "signup" && <small className="muted">Alerts go here. You can change it later.</small>}
        </label>
        {mode === "signup" && (
          <label className="check">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>I agree to the <Link to="/terms">terms of service</Link> and <Link to="/privacy">privacy policy</Link>.</span>
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}{" "}
            {mode === "login" && /no account/i.test(error) && <Link to="/signup">Create an account</Link>}
          </p>
        )}
        <button className="btn" disabled={busy}>{busy ? "Sending code…" : "Email me a code"}</button>
      </form>
      <p className="small muted auth-alt">
        {mode === "signup"
          ? <>Already have an account? <Link to="/login">Log in</Link></>
          : <>New here? <Link to="/signup">Create an account</Link></>}
      </p>
    </div>
  );
}

export function Login() {
  useTitle("Log in");
  return <EmailCodeAuth mode="login" />;
}

export function Signup() {
  useTitle("Create account");
  return <EmailCodeAuth mode="signup" />;
}
