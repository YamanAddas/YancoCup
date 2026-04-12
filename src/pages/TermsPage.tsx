import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "../lib/i18n";

export default function TermsPage() {
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
        {t("legal.termsTitle")}
      </h1>
      <p className="text-yc-text-secondary text-sm mb-8">
        {t("legal.lastUpdated")}: April 12, 2026
      </p>

      <div className="space-y-8 text-yc-text-secondary text-sm leading-relaxed">
        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            1. {t("terms.acceptance")}
          </h2>
          <p>
            By accessing or using YancoCup ("the Platform"), you agree to be
            bound by these Terms of Service. If you do not agree to these terms,
            please do not use the Platform. YancoCup is part of the YancoVerse
            ecosystem — a single account grants access to all YancoVerse
            products.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            2. {t("terms.description")}
          </h2>
          <p>
            YancoCup is a <strong className="text-yc-text-primary">free soccer prediction platform</strong> where
            users predict match scores and compete with friends on leaderboards.
            The Platform covers the FIFA World Cup 2026, UEFA Champions League,
            and top European league competitions.
          </p>
          <p className="mt-3">
            <strong className="text-yc-text-primary">YancoCup is NOT a gambling or betting platform.</strong> No
            real money is wagered, won, or lost. Points and rankings are for
            entertainment purposes only and have no monetary value.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            3. {t("terms.accounts")}
          </h2>
          <ul className="list-disc list-inside space-y-2">
            <li>You must be at least 13 years old to create an account.</li>
            <li>
              You are responsible for maintaining the confidentiality of your
              account credentials.
            </li>
            <li>
              One account per person. Multiple accounts may be merged or removed.
            </li>
            <li>
              Your chosen handle must not impersonate others or contain offensive
              content.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            4. {t("terms.predictions")}
          </h2>
          <ul className="list-disc list-inside space-y-2">
            <li>
              Predictions must be submitted before the match kickoff time. Late
              predictions are not accepted.
            </li>
            <li>
              Scoring is calculated automatically based on our published scoring
              system (exact score, correct goal difference, correct result).
            </li>
            <li>
              We reserve the right to adjust scores in case of data errors or
              match result corrections by official governing bodies.
            </li>
            <li>
              Predictions cannot be modified after the match has started.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            5. {t("terms.pools")}
          </h2>
          <ul className="list-disc list-inside space-y-2">
            <li>
              Pools are private groups for competing with friends. Pool creators
              can manage membership.
            </li>
            <li>
              Pool chat messages must comply with our conduct guidelines. No
              harassment, hate speech, or spam.
            </li>
            <li>
              Pool creators may remove members. Removed members lose access to
              pool leaderboards and chat history.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            6. {t("terms.conduct")}
          </h2>
          <p className="mb-3">You agree NOT to:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              Use automated scripts or bots to submit predictions or manipulate
              leaderboards.
            </li>
            <li>
              Attempt to exploit bugs or vulnerabilities in the Platform. Report
              them instead.
            </li>
            <li>
              Post offensive, threatening, or illegal content in pool chats or
              match comments.
            </li>
            <li>
              Impersonate other users, teams, or organizations.
            </li>
            <li>
              Use the Platform for any commercial purpose without our written
              consent.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            7. {t("terms.ip")}
          </h2>
          <ul className="list-disc list-inside space-y-2">
            <li>
              Team logos, competition emblems, and match data are sourced from
              third-party APIs and remain the property of their respective
              owners (FIFA, UEFA, national leagues).
            </li>
            <li>
              The YancoCup name, logo, and design are the property of
              YancoVerse.
            </li>
            <li>
              User-generated content (predictions, comments, chat messages)
              remains yours, but you grant us a license to display it within the
              Platform.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            8. {t("terms.availability")}
          </h2>
          <p>
            YancoCup is provided "as is" without warranties. We aim for high
            availability but cannot guarantee uninterrupted service. Live score
            updates depend on third-party data providers and may experience
            delays. We are not responsible for prediction outcomes affected by
            service interruptions.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            9. {t("terms.termination")}
          </h2>
          <p>
            We may suspend or terminate accounts that violate these terms.
            You may delete your account at any time through your profile
            settings. Upon deletion, your predictions and pool memberships will
            be permanently removed.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            10. {t("terms.changes")}
          </h2>
          <p>
            We may update these terms from time to time. Continued use of the
            Platform after changes constitutes acceptance of the updated terms.
            Significant changes will be announced on the Platform.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-3">
            11. {t("terms.contact")}
          </h2>
          <p>
            Questions about these terms?{" "}
            <NavLink
              to="/contact"
              className="text-yc-green hover:underline"
            >
              Contact us
            </NavLink>.
          </p>
        </section>
      </div>
    </div>
  );
}
