import { Link } from "react-router-dom";
import { useTitle } from "../components/Layout";
import { SITE } from "../lib/config";

export default function About() {
  useTitle("About");
  return (
    <div className="wrap page prose">
      <h1>About PatchPing</h1>
      <p className="lede">
        PatchPing exists because most apps are never checked again after launch. The code keeps running,
        the dependencies stay frozen, and new vulnerabilities get published against those exact versions
        without anyone noticing.
      </p>
      <p>
        Big teams have security tooling for this. Solo founders and small teams usually have a lockfile and
        good intentions. PatchPing is meant to sit in between: you tell it what you run, and it tells you
        when that becomes a problem. Nothing more.
      </p>
      <h2>Who builds it</h2>
      <p>
        PatchPing is built by {SITE.owner}, founder of <a href="https://kriosity.in" rel="noopener">{SITE.operator}</a>,
        based in Noida, India. Shiva has spent six years keeping critical manufacturing systems running,
        where an unpatched component is a real operational risk, and now ships his own products as a solo founder.
        PatchPing is the tool he wanted for his own stack.
      </p>
      <h2>How we think about it</h2>
      <ul>
        <li>Exact matching over guesswork. Results come from public advisory data, not a model's opinion.</li>
        <li>Collect as little as possible. Package names and versions, an email address, nothing else.</li>
        <li>Be honest about limits. If PatchPing can't see something, the product says so.</li>
      </ul>
      <h2>Contact</h2>
      <p>
        Questions, bugs or a missing ecosystem: write to <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
      </p>
      <p><Link className="btn" to="/signup">Try PatchPing</Link></p>
    </div>
  );
}
