import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { SITE } from "../lib/config";
import { supabase, useSession } from "../lib/supabase";

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · PatchPing` : "PatchPing — know when your stack needs a patch";
  }, [title]);
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function SiteLayout() {
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  return (
    <>
      <ScrollTop />
      <a className="skip" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="wrap header-row">
          <Link to="/" aria-label="PatchPing home"><Logo /></Link>
          <button className="menu-btn" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen((o) => !o)}>
            {open ? "Close" : "Menu"}
          </button>
          <nav id="site-nav" className={open ? "site-nav open" : "site-nav"}>
            <Link to="/#how">How it works</Link>
            <NavLink to="/pricing">Pricing</NavLink>
            <NavLink to="/about">About</NavLink>
            {session ? (
              <Link className="btn btn-small" to="/app">Open dashboard</Link>
            ) : (
              <>
                <NavLink to="/login">Log in</NavLink>
                <Link className="btn btn-small" to="/signup">Start free</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main"><Outlet /></main>
      <SiteFooter />
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          <Logo />
          <p className="muted small footer-note">
            Vulnerability alerts for the exact versions you ship. A {SITE.operator} product, made in Noida.
          </p>
        </div>
        <nav aria-label="Product">
          <h2 className="footer-h">Product</h2>
          <Link to="/#how">How it works</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/signup">Create account</Link>
          <Link to="/login">Log in</Link>
        </nav>
        <nav aria-label="Company">
          <h2 className="footer-h">Company</h2>
          <Link to="/about">About</Link>
          <a href={`mailto:${SITE.contactEmail}`}>Contact</a>
          <a href="https://kriosity.in" rel="noopener">Kriosity</a>
        </nav>
        <nav aria-label="Legal">
          <h2 className="footer-h">Legal</h2>
          <Link to="/terms">Terms of service</Link>
          <Link to="/privacy">Privacy policy</Link>
          <Link to="/refunds">Refunds and cancellation</Link>
          <Link to="/disclaimer">Disclaimer</Link>
        </nav>
      </div>
      <div className="wrap footer-base small muted">
        <span>© {new Date().getFullYear()} {SITE.operator}. All rights reserved.</span>
        <span>Vulnerability data from <a href="https://osv.dev" rel="noopener">OSV.dev</a>.</span>
      </div>
    </footer>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const location = useLocation();
  if (loading) return <div className="center-pad muted">Loading…</div>;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function AppLayout() {
  const { session } = useSession();
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    navigate("/");
  }
  return (
    <RequireAuth>
      <ScrollTop />
      <a className="skip" href="#main">Skip to content</a>
      <header className="app-header">
        <div className="wrap header-row">
          <Link to="/app" aria-label="Dashboard"><Logo /></Link>
          <nav className="app-nav">
            <NavLink to="/app" end>Apps</NavLink>
            <NavLink to="/app/settings">Settings</NavLink>
            <span className="muted small hide-sm">{session?.user.email}</span>
            <button className="link-btn" onClick={signOut}>Log out</button>
          </nav>
        </div>
      </header>
      <main id="main" className="wrap app-main"><Outlet /></main>
      <footer className="wrap app-footer small muted">
        <Link to="/terms">Terms</Link> <Link to="/privacy">Privacy</Link> <a href={`mailto:${SITE.contactEmail}`}>Help</a>
      </footer>
    </RequireAuth>
  );
}

export function SeverityPill({ severity }: { severity: string }) {
  return <span className={`sev sev-${severity}`}>{severity === "unknown" ? "Unrated" : severity[0].toUpperCase() + severity.slice(1)}</span>;
}
