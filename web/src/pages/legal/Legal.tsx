import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTitle } from "../../components/Layout";
import { SITE } from "../../lib/config";

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  useTitle(title);
  return (
    <article className="wrap page prose legal">
      <h1>{title}</h1>
      <p className="muted small">Last updated {SITE.legalUpdated}</p>
      {children}
      <hr />
      <p className="small muted">
        Questions about this page: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
        {" "}{SITE.operator}, {SITE.address}.
      </p>
    </article>
  );
}

const mail = <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>;

export function Terms() {
  return (
    <LegalPage title="Terms of service">
      <p>
        These terms are an agreement between you and {SITE.operator}, a business run by {SITE.owner} as
        proprietor ("we", "us"), covering your use of PatchPing at {SITE.url} (the "Service").
        By creating an account or using the Service you accept these terms. If you use it for an
        organisation, you confirm you can accept them on its behalf.
      </p>

      <h2>1. What the Service does</h2>
      <p>
        PatchPing stores the package names and versions you give it, compares them with public
        vulnerability databases (currently OSV.dev) on a schedule, shows matches in your dashboard and
        can email you about new matches. It does not scan your source code, servers or networks.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must be at least 18, or the age of majority where you live, to create an account.</li>
        <li>Give a valid email address and keep your password secure. You are responsible for activity under your account.</li>
        <li>Tell us promptly at {mail} if you think your account has been accessed without permission.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>use the Service to break any law, or to probe, attack or overload it or the databases it relies on;</li>
        <li>try to access another user's data, or get around rate limits, plan limits or security controls;</li>
        <li>resell, rebrand or offer the Service to others as your own without our written permission;</li>
        <li>upload content that is not package metadata, such as secrets, personal data about others or malicious files.</li>
      </ul>

      <h2>4. Accuracy and no guarantee</h2>
      <p>
        Results depend on third-party advisory data, which can be incomplete, delayed, wrong or withdrawn,
        and on the versions you enter being correct. PatchPing may miss vulnerabilities, report issues
        that don't apply to how you use a package, or suggest a fix version that is not the right one for
        you. The Service is an aid, not a security audit. You remain responsible for evaluating advisories
        and for the security of your software. See the <Link to="/disclaimer">disclaimer</Link>.
      </p>

      <h2>5. Free early access and future plans</h2>
      <p>
        The Service is currently free. We may introduce paid plans. If we do, we will email you at least
        30 days before any change that affects your account, and you will never be charged unless you
        choose a paid plan. Paid plans, when offered, are covered by our{" "}
        <Link to="/refunds">refunds and cancellation policy</Link>.
      </p>

      <h2>6. Availability and changes</h2>
      <p>
        We aim to keep the Service running, but it is provided on an "as is" and "as available" basis and
        may be interrupted for maintenance, provider outages or reasons outside our control. Scheduled
        checks may run late or be skipped. We may change, add or remove features. We will give reasonable
        notice before removing a feature you depend on where we can.
      </p>

      <h2>7. Your data</h2>
      <p>
        You own the data you put into the Service. You let us store and process it only to run the
        Service for you. How we handle it is described in our <Link to="/privacy">privacy policy</Link>.
        You can delete individual apps, or your whole account, at any time from Settings.
      </p>

      <h2>8. Our property</h2>
      <p>
        The Service, its software, design and the PatchPing name and logo belong to {SITE.operator}.
        These terms don't give you any rights to them beyond using the Service as described here.
        Vulnerability data remains subject to the licences of its original sources.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the extent allowed by law, we are not liable for any indirect, incidental, special or
        consequential loss, or for loss of data, profits, revenue or business, or for any security incident
        affecting your systems, arising from your use of or reliance on the Service. Our total liability for
        any claim relating to the Service is limited to the amount you paid us for it in the 12 months
        before the claim, or ₹1,000 if you paid nothing. Nothing in these terms limits liability that
        cannot be limited by law.
      </p>

      <h2>10. Indemnity</h2>
      <p>
        You agree to compensate us for claims and costs arising from your breach of these terms or your
        misuse of the Service.
      </p>

      <h2>11. Suspension and ending</h2>
      <p>
        You can stop using the Service and delete your account at any time. We may suspend or close an
        account that breaks these terms or puts the Service or other users at risk, and will tell you why
        unless the law or security reasons prevent it.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These terms are governed by the laws of India. Courts at Gautam Buddha Nagar, Uttar Pradesh, have
        exclusive jurisdiction over any dispute, after we have first tried to resolve it with you in good
        faith by email.
      </p>

      <h2>13. Changes to these terms</h2>
      <p>
        We may update these terms. If a change is significant we will email you before it takes effect.
        Continuing to use the Service after that means you accept the updated terms.
      </p>
    </LegalPage>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        This policy explains what personal data PatchPing collects, why, and what you can do about it.
        {" "}{SITE.operator} ({SITE.owner}, proprietor) is responsible for your data. We follow India's
        Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> your email address and a securely hashed password, or sign-in links sent to your email.</li>
        <li><strong>Alert settings:</strong> the email you want alerts sent to, whether alerts are on, and your severity threshold.</li>
        <li><strong>Your stack:</strong> the names you give your apps, and package names and versions. When you upload a lockfile it is read in your browser; the file itself is never uploaded.</li>
        <li><strong>Results:</strong> vulnerability matches for your packages and whether you dismissed or fixed them.</li>
        <li><strong>Technical logs:</strong> our hosting providers keep standard request logs (such as IP address and time) for security and debugging, for a limited period.</li>
      </ul>
      <p>We do not use advertising trackers or sell your data. We don't use cookies for tracking; the app stores your sign-in session in your browser's local storage.</p>

      <h2>Why we use it</h2>
      <ul>
        <li>To run the Service: check your packages, show results and send the alerts you asked for.</li>
        <li>To send account emails: confirmations, password resets and important notices about the Service.</li>
        <li>To keep the Service secure and working, and to answer you when you contact us.</li>
      </ul>
      <p>We rely on your consent, given when you create an account, and on the legitimate uses the law allows for running a service you asked for.</p>

      <h2>Who processes it</h2>
      <ul>
        <li><strong>Supabase</strong> hosts our database, sign-in and background jobs, in its Mumbai (ap-south-1) region.</li>
        <li><strong>Resend</strong> delivers our emails.</li>
        <li><strong>Vercel</strong> serves the website.</li>
        <li><strong>Google Fonts</strong> serves the site's typefaces, which means your browser contacts Google when pages load.</li>
        <li><strong>OSV.dev</strong> receives package names and versions to check. It never receives your email or account details.</li>
      </ul>
      <p>Some of these providers may process data outside India, under their own security commitments.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep your data while your account is open. Deleting an app removes its packages and results
        immediately. Deleting your account removes your account and all associated data immediately from
        our live database; backups held by our database provider are overwritten on their normal schedule.
        Scan logs are deleted after 30 days.
      </p>

      <h2>Your rights</h2>
      <p>
        You can access, correct and delete your data yourself from the dashboard and Settings, including
        deleting your whole account. You can also withdraw consent by deleting your account, ask us
        about how your data is processed, or raise a complaint by writing to {mail}. We reply within 30 days.
        If you are not satisfied, you may complain to the Data Protection Board of India.
      </p>

      <h2>Grievance officer</h2>
      <p>{SITE.owner}, {SITE.address}. Email: {mail}.</p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit. Each user's data is isolated by row-level security in the database,
        so one account cannot read another's. No system is perfectly secure; if a breach affects your
        data we will tell you and the authorities as the law requires.
      </p>

      <h2>Children</h2>
      <p>The Service is not meant for anyone under 18, and we don't knowingly collect their data.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a way that matters, we will email you before the change takes effect.</p>
    </LegalPage>
  );
}

export function Refunds() {
  return (
    <LegalPage title="Refunds and cancellation">
      <p>
        PatchPing is free during early access, so there is nothing to refund today. This policy explains
        how paid plans will work once they are offered.
      </p>
      <h2>Cancellation</h2>
      <ul>
        <li>You can cancel a paid plan at any time from Settings or by emailing {mail}.</li>
        <li>Cancelling stops future renewals. You keep paid features until the end of the period you already paid for.</li>
        <li>You can delete your account at any time; deleting it also cancels any plan.</li>
      </ul>
      <h2>Refunds</h2>
      <ul>
        <li>If you are charged in error, or charged twice, we refund the extra amount in full.</li>
        <li>If you cancel within 7 days of your first payment on a plan, you can ask for a full refund.</li>
        <li>Other renewals are not refunded part-way through a period, but you can cancel to stop the next one.</li>
        <li>If we end the Service or remove a paid feature, we refund the unused part of your current period.</li>
      </ul>
      <h2>How refunds are paid</h2>
      <p>
        Approved refunds go back to the original payment method, processed within 5 to 7 working days of
        approval. Your bank or card provider may take a few more days to show it.
      </p>
      <p>To request a refund, email {mail} from your account email with the payment date and amount.</p>
    </LegalPage>
  );
}

export function Disclaimer() {
  return (
    <LegalPage title="Disclaimer">
      <p>
        PatchPing helps you notice publicly disclosed vulnerabilities in the package versions you tell it
        about. It is not a complete security solution, and it does not replace code review, penetration
        testing or professional security advice.
      </p>
      <ul>
        <li><strong>Coverage is limited to public advisories.</strong> Vulnerabilities that are unknown, undisclosed or missing from OSV.dev and its sources will not be reported.</li>
        <li><strong>Results depend on your input.</strong> If the versions you enter don't match what you actually run, results will be wrong.</li>
        <li><strong>Not every match is exploitable.</strong> An advisory may only affect a feature or configuration you don't use. Read the advisory before acting.</li>
        <li><strong>Fix versions are suggestions.</strong> We show the lowest version an advisory lists as fixed. Check release notes and test before upgrading.</li>
        <li><strong>Severity labels come from the source.</strong> Where a source gives no label, we estimate one from the CVSS vector, which can be rough.</li>
        <li><strong>Timing isn't guaranteed.</strong> Checks run about every 6 hours, but may be delayed by outages at us or our providers.</li>
      </ul>
      <p>
        Vulnerability data is provided by <a href="https://osv.dev" rel="noopener">OSV.dev</a> and its upstream
        databases, under their own licences. PatchPing is not affiliated with or endorsed by them, or by
        any package maintainer.
      </p>
    </LegalPage>
  );
}
