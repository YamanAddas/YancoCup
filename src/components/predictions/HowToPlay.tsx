import { Info } from "lucide-react";
import { useI18n } from "../../lib/i18n";

export default function HowToPlay() {
  const { t } = useI18n();

  const rules = [
    { labelKey: "howToPlay.exactScore", points: 10, you: "2-1", result: "2-1" },
    { labelKey: "howToPlay.correctGD", points: 5, you: "3-1", result: "2-0" },
    { labelKey: "howToPlay.correctWinner", points: 3, you: "1-0", result: "3-0" },
    { labelKey: "howToPlay.wrong", points: 0, you: "2-0", result: "0-1" },
  ];

  const bonuses = [
    { labelKey: "howToPlay.upsetBonus", points: "+3", descKey: "howToPlay.upsetDesc" },
    { labelKey: "howToPlay.perfectGroup", points: "+15", descKey: "howToPlay.perfectDesc" },
  ];

  return (
    <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Info size={18} className="text-yc-green" />
        <h3 className="font-heading text-base font-bold">{t("howToPlay.title")}</h3>
      </div>

      <p className="text-yc-text-secondary text-sm mb-4">
        {t("howToPlay.desc")}
      </p>

      <div className="space-y-2 mb-4">
        {rules.map((r) => (
          <div key={r.labelKey} className="flex items-center justify-between text-sm">
            <div>
              <span className="text-yc-text-primary">{t(r.labelKey)}</span>
              <span className="text-yc-text-tertiary ml-2 text-xs">
                ({t("howToPlay.exampleYou", { score: r.you })}, {t("howToPlay.exampleResult", { score: r.result })})
              </span>
            </div>
            <span className="text-yc-green font-mono font-bold">{r.points} pts</span>
          </div>
        ))}
      </div>

      <div className="border-t border-yc-border pt-3 space-y-2">
        <p className="text-yc-text-tertiary text-xs uppercase tracking-widest mb-2">{t("howToPlay.bonuses")}</p>
        {bonuses.map((b) => (
          <div key={b.labelKey} className="flex items-center justify-between text-sm">
            <div>
              <span className="text-yc-text-primary">{t(b.labelKey)}</span>
              <span className="text-yc-text-tertiary ml-2 text-xs">— {t(b.descKey)}</span>
            </div>
            <span className="text-yc-warning font-mono font-bold">{b.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
