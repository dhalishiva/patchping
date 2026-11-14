import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTitle } from "../components/Layout";

const LOCK_LINES: { name: string; version: string; hit?: boolean }[] = [
  { name: "react", version: "18.3.1" },
  { name: "@supabase/supabase-js", version: "2.45.0" },
  { name: "react-router-dom", version: "7.1.1" },
  { name: "axios", version: "0.21.0", hit: true },
  { name: "zod", version: "3.23.8" },
];

function ScanDemo() {
  return (
    <figure className="scan" aria-label="Example: PatchPing checking a lockfile and flagging axios 0.21.0">
      <div className="scan-bar">
        <span className="scan-file">package-lock.json</span>
        <span className="scan-meta">checked every 6 h</span>
      </div>
      <ol className="scan-lines">
        {LOCK_LINES.map((l, i) => (
          <li key={l.name} className={l.hit ? "scan-line hit" : "scan-line"} style={{ ["--i" as string]: i }}>
            <code className="pkg">{l.name}</code>
            <code className="ver">{l.version}</code>
            <span className="state">{l.hit ? "1 new issue" : "clear"}</span>
          </li>
        ))}
      </ol>
      <div className="ping-card" role="note">
        <div className="ping-head">
          <span className="sev sev-moderate">Moderate</span>
          <code>axios 0.21.0</code>
        </div>
        <p>Server-side request forgery (GHSA-4w2v-q235-vp99)</p>
        <p className="ping-fix">Fixed in <code>0.21.1</code>. Emailed to you at the next check.</p>
      </div>
      <div className="scan-sweep" aria-hidden="true" />
    </figure>
  );
}

const FILES: [string, string][] = [
  ["JavaScript, TypeScript, Deno", "package-lock.json, yarn.lock, pnpm-lock.yaml, package.json, deno.json"],
  ["Python", "requirements.txt (pinned with ==)"],
  ["Go", "go.mod"],
  ["Rust", "Cargo.lock"],
  ["PHP", "composer.lock"],
  ["Ruby", "Gemfile.lock"],
  ["Java, .NET, Dart, Elixir", "add packages by hand: Maven, NuGet, Pub, Hex"],
];

export default function Home() {
  useTitle("");
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  return (
    <>
      <section className="hero wrap">
        <div className="hero-copy">
          <h1>Know the day your stack needs a patch.</h1>
          <p className="lede">
            Tell PatchPing the exact package versions your apps run on. It checks them against public
            vulnerability databases every 6 hours and emails you only when something new affects you,
            with the version that fixes it.
          </p>
          <div className="cta-row">
            <Link className="btn" to="/signup">Start free</Link>
            <a className="btn btn-ghost" href="#how">See how it works</a>
          </div>
          <p className="small muted">Free during early access. No repo access, no card.</p>
        </div>
        <ScanDemo />
      </section>

      <section id="how" className="band">
        <div className="wrap">
          <h2 className="section-h">How it works</h2>
          <ol className="steps">
            <li>
              <h3>Add your stack</h3>
              <p>Drop in a lockfile or paste a list like <code>react@18.3.1</code>. The file is read in your browser; only package names and versions are saved.</p>
            </li>
            <li>
              <h3>We check every 6 hours</h3>
              <p>Each version is matched against <a href="https://osv.dev" rel="noopener">OSV.dev</a>, which pulls in GitHub, PyPI, Go, RustSec and other advisory databases. Matching is exact, not guessed.</p>
            </li>
            <li>
              <h3>You get one email</h3>
              <p>When a new advisory hits a version you run, you get a single digest per check: what is affected, how serious it is and what to upgrade to. Quiet days send nothing.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="wrap split">
        <div>
          <h2 className="section-h">Files it reads</h2>
          <p className="muted">Lockfiles give the best results because they list exact versions, including the packages your packages pull in.</p>
        </div>
        <table className="file-table">
          <tbody>
            {FILES.map(([lang, files]) => (
              <tr key={lang}><th scope="row">{lang}</th><td>{files}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="wrap split">
        <div>
          <h2 className="section-h">Built to stay quiet</h2>
          <p className="muted">An alert you learn to ignore is worse than none. So PatchPing keeps the signal narrow.</p>
        </div>
        <ul className="plain-list">
          <li><strong>Only new matches.</strong> Each issue is emailed once. Re-scans never repeat it.</li>
          <li><strong>Your threshold.</strong> Choose to hear about everything, or only high and critical.</li>
          <li><strong>Dismiss what doesn't apply.</strong> If an advisory covers a feature you don't use, dismiss it and it stays dismissed.</li>
          <li><strong>No code access.</strong> We never see your repository, source or secrets. Just names and versions.</li>
        </ul>
      </section>

      <section className="wrap split">
        <div>
          <h2 className="section-h">What it doesn't do</h2>
          <p className="muted">Worth knowing before you rely on it.</p>
        </div>
        <ul className="plain-list">
          <li>It doesn't scan your own code for bugs. It watches the packages you depend on.</li>
          <li>It can only report issues that have been publicly disclosed in an advisory database.</li>
          <li>Runtimes and servers themselves (Node.js, Postgres, nginx) aren't covered yet.</li>
          <li>It tells you what to upgrade. You still review and ship the fix.</li>
        </ul>
      </section>

      <section className="closing">
        <div className="wrap closing-inner">
          <h2>Add your first app in about a minute.</h2>
          <Link className="btn btn-light" to="/signup">Start free</Link>
        </div>
      </section>
    </>
  );
}
