import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "../lib/i18n";

export default function PrivacyPage() {
  const { t } = useI18n();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <NavLink
        to="/"
        className="inline-flex items-center gap-1.5 text-yc-text-secondary hover:text-yc-text-primary text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        {t("nav.home")}
      </NavLink>

      <h1 className="font-heading text-3xl font-bold mb-2">
        {t("legal.privacyTitle")}
      </h1>
      <p className="text-yc-text-secondary text-sm mb-8">
        {t("legal.lastUpdated")}: April 12, 2026
      </p>

      <div className="space-y-8 text-yc-text-secondary text-sm leading-relaxed">
        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            1. {t("privacy.overview")}
          </h2>
          <p>
            YancoCup ("we", "us", "the Platform") is committed to protecting
            your privacy. This policy explains what data we collect, how we use
            it, and your rights. YancoCup is part of the YancoVerse ecosystem
            and shares authentication infrastructure with other YancoVerse
            products.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            2. {t("privacy.dataCollected")}
          </h2>
          <h3 className="font-semibold text-yc-text-primary mt-4 mb-2">
            {t("privacy.accountData")}
          </h3>
          <ul className="list-disc list-inside space-y-2">
            <li>Email address (for authentication)</li>
            <li>Display name / handle (chosen by you)</li>
            <li>Password (hashed, never stored in plain text)</li>
          </ul>

          <h3 className="font-semibold text-yc-text-primary mt-4 mb-2">
            {t("privacy.activityData")}
          </h3>
          <ul className="list-disc list-inside space-y-2">
            <li>Match predictions and scores</li>
            <li>Pool memberships and chat messages</li>
            <li>Match comments</li>
            <li>Followed teams and language preference</li>
            <li>Badge and streak progress</li>
          </ul>

          <h3 className="font-semibold text-yc-text-primary mt-4 mb-2">
            {t("privacy.technicalData")}
          </h3>
          <ul className="list-disc list-inside space-y-2">
            <li>Browser type and version</li>
            <li>Device type (mobile/desktop)</li>
            <li>Anonymous usage analytics (page views, feature usage)</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            3. {t("privacy.howUsed")}
          </h2>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong className="text-yc-text-primary">Authentication:</strong>{" "}
              To create and manage your account across YancoVerse products.
            </li>
            <li>
              <strong className="text-yc-text-primary">Predictions & scoring:</strong>{" "}
              To calculate your points, update leaderboards, and display your
              prediction history.
            </li>
            <li>
              <strong className="text-yc-text-primary">Pools:</strong>{" "}
              To enable private group competitions and pool chat.
            </li>
            <li>
              <strong className="text-yc-text-primary">Personalization:</strong>{" "}
              To show your followed teams, preferred language, and relevant
              matches.
            </li>
            <li>
              <strong className="text-yc-text-primary">Analytics:</strong>{" "}
              To understand how the Platform is used and improve the experience.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            4. {t("privacy.thirdParty")}
          </h2>
          <div className="rounded-lg border border-yc-border bg-yc-bg-surface p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-yc-text-primary font-medium">Supabase</p>
                <p className="text-xs">Authentication, database, realtime</p>
              </div>
            </div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-yc-text-primary font-medium">Cloudflare</p>
                <p className="text-xs">CDN, Workers (API proxy), analytics</p>
              </div>
            </div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-yc-text-primary font-medium">Sentry</p>
                <p className="text-xs">Error tracking (no personal data sent)</p>
              </div>
            </div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-yc-text-primary font-medium">GitHub Pages</p>
                <p className="text-xs">Static site hosting</p>
              </div>
            </div>
          </div>
          <p className="mt-3">
            We do not sell, rent, or share your personal data with advertisers
            or data brokers. Third-party services are used only for Platform
            operation.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            5. {t("privacy.storage")}
          </h2>
          <ul className="list-disc list-inside space-y-2">
            <li>
              Account and prediction data is stored in Supabase (hosted on AWS)
              with Row Level Security enabled.
            </li>
            <li>
              Passwords are hashed using bcrypt — we never see or store your
              plain text password.
            </li>
            <li>
              Local storage is used for your language preference and session
              token only.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            6. {t("privacy.cookies")}
          </h2>
          <p>
            YancoCup does not use tracking cookies. We use{" "}
            <code className="text-xs bg-yc-bg-elevated px-1.5 py-0.5 rounded">
              localStorage
            </code>{" "}
            for your language preference (
            <code className="text-xs bg-yc-bg-elevated px-1.5 py-0.5 rounded">
              yc_lang
            </code>
            ) and Supabase session management. No third-party advertising
            cookies are present on the Platform.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            7. {t("privacy.rights")}
          </h2>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong className="text-yc-text-primary">Access:</strong> View
              your data through your profile page.
            </li>
            <li>
              <strong className="text-yc-text-primary">Correction:</strong>{" "}
              Update your handle and email from your profile settings.
            </li>
            <li>
              <strong className="text-yc-text-primary">Deletion:</strong>{" "}
              Request full account deletion — all predictions, pool
              memberships, and personal data will be permanently removed.
            </li>
            <li>
              <strong className="text-yc-text-primary">Export:</strong> You may
              request an export of your prediction data.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            8. {t("privacy.children")}
          </h2>
          <p>
            YancoCup is not directed at children under 13. We do not knowingly
            collect personal data from children under 13. If you believe a child
            has provided us with personal data, please contact us.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            9. {t("privacy.changes")}
          </h2>
          <p>
            We may update this privacy policy from time to time. Changes will be
            posted on this page with an updated "Last Updated" date.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            10. {t("terms.contact")}
          </h2>
          <p>
            For privacy-related questions or data requests, reach out via our{" "}
            <a
              href="https://github.com/yamanaddas/YancoCup/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yc-green hover:underline"
            >
              GitHub repository
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
