import { Trophy } from "lucide-react";
import Countdown from "../layout/Countdown";
import { useI18n } from "../../lib/i18n";
import GroupStagePhase from "./GroupStagePhase";
import KnockoutsPhase from "./KnockoutsPhase";

const WC_KICKOFF = new Date("2026-06-11T16:00:00Z");
const WC_GROUP_STAGE_END = new Date("2026-06-28T00:00:00Z");
const WC_FINAL = new Date("2026-07-19T20:00:00Z");

type Phase = "pre-kickoff" | "group-stage" | "knockouts" | "post-final";

function getCurrentPhase(now: Date = new Date()): Phase {
  if (now < WC_KICKOFF) return "pre-kickoff";
  if (now < WC_GROUP_STAGE_END) return "group-stage";
  if (now < WC_FINAL) return "knockouts";
  return "post-final";
}

/** Allow ?phase=group-stage|knockouts|post-final|pre-kickoff to preview future
 *  phases pre-launch. Honored only when explicitly set — no production impact. */
function getPhaseOverride(): Phase | null {
  if (typeof window === "undefined") return null;
  // HashRouter: real query lives in window.location.hash like "#/?phase=group-stage"
  // window.location.search may be empty; check both.
  const hashQs = window.location.hash.includes("?")
    ? window.location.hash.split("?")[1]
    : "";
  const searchQs = window.location.search.replace(/^\?/, "");
  const params = new URLSearchParams(`${searchQs}&${hashQs}`);
  const v = params.get("phase");
  if (v === "pre-kickoff" || v === "group-stage" || v === "knockouts" || v === "post-final") {
    return v;
  }
  return null;
}

function PreKickoffPhase() {
  const { t } = useI18n();
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="flex flex-col items-center text-center gap-6 sm:gap-8">
        <img
          src="https://crests.football-data.org/wm26.png"
          alt="FIFA World Cup 2026"
          className="h-28 sm:h-36 w-auto drop-shadow-[0_0_30px_rgba(0,255,136,0.3)]"
        />
        <p className="text-yc-text-secondary text-base sm:text-lg max-w-xl">
          {t("home.subtitle")}
        </p>
        <div className="yc-card yc-animated-border p-5 rounded-xl w-full max-w-lg">
          <p className="text-yc-text-tertiary text-xs uppercase tracking-widest mb-3">
            {t("home.kickoffIn")}
          </p>
          <Countdown />
        </div>
        <a
          href="#/WC/bracket"
          className="yc-animated-border inline-flex items-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-8 py-4 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,255,136,0.2)]"
        >
          <Trophy size={20} />
          {t("home.buildBracket")}
        </a>
      </div>
    </section>
  );
}

export default function PhaseHero() {
  const phase = getPhaseOverride() ?? getCurrentPhase();
  switch (phase) {
    case "group-stage":
      return <GroupStagePhase />;
    case "knockouts":
      return <KnockoutsPhase />;
    case "post-final":
      // Post-final still scaffolds to pre-kickoff. Recap mode in a later session.
      return <PreKickoffPhase />;
    case "pre-kickoff":
    default:
      return <PreKickoffPhase />;
  }
}
