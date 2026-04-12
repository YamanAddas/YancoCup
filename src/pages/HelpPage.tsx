import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  Trophy,
  Users,
  Target,
  Shield,
  Globe,
  MessageCircle,
} from "lucide-react";
import { useI18n } from "../lib/i18n";

interface FAQItem {
  q: string;
  a: string;
}

function Accordion({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: FAQItem[];
}) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section>
      <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h2>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="rounded-lg border border-yc-border bg-yc-bg-surface overflow-hidden transition-colors hover:border-yc-border-hover"
          >
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-yc-text-primary"
            >
              {item.q}
              <ChevronDown
                size={16}
                className={`text-yc-text-tertiary shrink-0 ml-2 transition-transform ${
                  open === i ? "rotate-180" : ""
                }`}
              />
            </button>
            {open === i && (
              <div className="px-4 pb-4 text-sm text-yc-text-secondary leading-relaxed">
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HelpPage() {
  const { t } = useI18n();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const gettingStarted: FAQItem[] = [
    {
      q: t("help.whatIsQ"),
      a: t("help.whatIsA"),
    },
    {
      q: t("help.freeQ"),
      a: t("help.freeA"),
    },
    {
      q: t("help.accountQ"),
      a: t("help.accountA"),
    },
    {
      q: t("help.competitionsQ"),
      a: t("help.competitionsA"),
    },
  ];

  const predictions: FAQItem[] = [
    {
      q: t("help.howPredictQ"),
      a: t("help.howPredictA"),
    },
    {
      q: t("help.deadlineQ"),
      a: t("help.deadlineA"),
    },
    {
      q: t("help.changeQ"),
      a: t("help.changeA"),
    },
    {
      q: t("help.jokerQ"),
      a: t("help.jokerA"),
    },
  ];

  const scoring: FAQItem[] = [
    {
      q: t("help.scoringQ"),
      a: t("help.scoringA"),
    },
    {
      q: t("help.knockoutQ"),
      a: t("help.knockoutA"),
    },
    {
      q: t("help.streakQ"),
      a: t("help.streakA"),
    },
  ];

  const pools: FAQItem[] = [
    {
      q: t("help.poolQ"),
      a: t("help.poolA"),
    },
    {
      q: t("help.joinPoolQ"),
      a: t("help.joinPoolA"),
    },
    {
      q: t("help.poolLimitQ"),
      a: t("help.poolLimitA"),
    },
  ];

  const accountSecurity: FAQItem[] = [
    {
      q: t("help.deleteAccountQ"),
      a: t("help.deleteAccountA"),
    },
    {
      q: t("help.languageQ"),
      a: t("help.languageA"),
    },
    {
      q: t("help.dataQ"),
      a: t("help.dataA"),
    },
  ];

  const troubleshooting: FAQItem[] = [
    {
      q: t("help.scoresDelayQ"),
      a: t("help.scoresDelayA"),
    },
    {
      q: t("help.notLoadingQ"),
      a: t("help.notLoadingA"),
    },
    {
      q: t("help.bugQ"),
      a: t("help.bugA"),
    },
  ];

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
        {t("help.title")}
      </h1>
      <p className="text-yc-text-secondary text-sm mb-8">
        {t("help.subtitle")}
      </p>

      <div className="space-y-10">
        <Accordion
          title={t("help.gettingStarted")}
          icon={<Globe size={20} className="text-yc-green" />}
          items={gettingStarted}
        />
        <Accordion
          title={t("help.predictions")}
          icon={<Target size={20} className="text-yc-green" />}
          items={predictions}
        />
        <Accordion
          title={t("help.scoring")}
          icon={<Trophy size={20} className="text-yc-green" />}
          items={scoring}
        />
        <Accordion
          title={t("help.pools")}
          icon={<Users size={20} className="text-yc-green" />}
          items={pools}
        />
        <Accordion
          title={t("help.accountSecurity")}
          icon={<Shield size={20} className="text-yc-green" />}
          items={accountSecurity}
        />
        <Accordion
          title={t("help.troubleshooting")}
          icon={<MessageCircle size={20} className="text-yc-green" />}
          items={troubleshooting}
        />

        <section className="rounded-lg border border-yc-border-accent bg-yc-bg-surface p-4 sm:p-5 text-center">
          <h2 className="font-heading text-lg font-semibold text-yc-text-primary mb-2">
            {t("help.stillNeedHelp")}
          </h2>
          <p className="text-yc-text-secondary text-sm mb-4">
            {t("help.stillNeedHelpDesc")}
          </p>
          <NavLink
            to="/contact"
            className="inline-flex items-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-6 py-3 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all text-sm"
          >
            <MessageCircle size={16} />
            {t("help.contactUs")}
          </NavLink>
        </section>
      </div>
    </div>
  );
}
