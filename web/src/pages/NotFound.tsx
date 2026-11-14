import { Link } from "react-router-dom";
import { useTitle } from "../components/Layout";

export default function NotFound({ inApp = false }: { inApp?: boolean }) {
  useTitle("Page not found");
  return (
    <div className={inApp ? "notfound" : "wrap page notfound"}>
      <p className="nf-code" aria-hidden="true"><code>404</code></p>
      <h1>No version of this page exists.</h1>
      <p className="lede">The link may be old, or the address may have a typo.</p>
      <div className="cta-row">
        <Link className="btn" to={inApp ? "/app" : "/"}>{inApp ? "Back to your apps" : "Go to the home page"}</Link>
        {!inApp && <Link className="btn btn-ghost" to="/app">Open dashboard</Link>}
      </div>
    </div>
  );
}
