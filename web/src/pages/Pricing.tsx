import { Link } from "react-router-dom";
import { useTitle } from "../components/Layout";

const FAQ: [string, string][] = [
  ["Will it stay free?", "Early access is free. When paid plans arrive, accounts will get at least 30 days' notice by email, and nothing is ever charged without you choosing a plan."],
  ["Where does the vulnerability data come from?", "OSV.dev, an open database run by Google that collects advisories from GitHub, PyPI, Go, RustSec, Packagist, RubyGems and others."],
  ["Do you need access to my GitHub?", "No. You upload a lockfile or type versions. The file is read in your browser and only package names and versions are stored."],
  ["How fast will I hear about a new issue?", "Within about 6 hours of it appearing in OSV.dev, which usually picks up new advisories within hours of publication."],
  ["Can I check right now instead of waiting?", "Yes. Every app has a Scan now button, so you see results the moment you add your stack."],
];

export default function Pricing() {
  useTitle("Pricing");
  return (
    <div className="wrap page">
      <h1>Pricing</h1>
      <p className="lede">One plan while we're in early access, and it's free.</p>

      <div className="plan">
        <div className="plan-head">
          <h2>Early access</h2>
          <p className="plan-price">₹0 <span className="muted small">per month</span></p>
        </div>
        <ul className="plain-list">
          <li>Up to 25 apps</li>
          <li>Up to 5,000 packages per app</li>
          <li>Checks every 6 hours, plus on-demand scans</li>
          <li>Email digests with severity and fix versions</li>
          <li>10 ecosystems: npm, PyPI, Go, crates.io, Packagist, RubyGems, Maven, NuGet, Pub, Hex</li>
        </ul>
        <Link className="btn" to="/signup">Create free account</Link>
      </div>

      <h2 className="section-h">Questions</h2>
      <dl className="faq">
        {FAQ.map(([q, a]) => (
          <div key={q}><dt>{q}</dt><dd>{a}</dd></div>
        ))}
      </dl>
    </div>
  );
}
