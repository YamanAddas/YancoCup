import { Info } from "lucide-react";

const rules = [
  { label: "Exact score", points: 10, example: "You: 2-1, Result: 2-1" },
  { label: "Correct result + goal difference", points: 5, example: "You: 3-1, Result: 2-0" },
  { label: "Correct result only", points: 3, example: "You: 2-0, Result: 1-0" },
  { label: "Wrong", points: 0, example: "You: 2-0, Result: 0-1" },
];

const bonuses = [
  { label: "Upset bonus", points: "+3", desc: "Lower-ranked team wins and you predicted it" },
  { label: "Perfect group stage", points: "+15", desc: "All 3 group matches exact" },
];

export default function HowToPlay() {
  return (
    <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Info size={18} className="text-yc-green" />
        <h3 className="font-heading text-base font-bold">How to Play</h3>
      </div>

      <p className="text-yc-text-secondary text-sm mb-4">
        Predict the final score of each match before kickoff. Points are awarded based on accuracy.
      </p>

      <div className="space-y-2 mb-4">
        {rules.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-sm">
            <div>
              <span className="text-yc-text-primary">{r.label}</span>
              <span className="text-yc-text-tertiary ml-2 text-xs">({r.example})</span>
            </div>
            <span className="text-yc-green font-mono font-bold">{r.points} pts</span>
          </div>
        ))}
      </div>

      <div className="border-t border-yc-border pt-3 space-y-2">
        <p className="text-yc-text-tertiary text-xs uppercase tracking-widest mb-2">Bonuses</p>
        {bonuses.map((b) => (
          <div key={b.label} className="flex items-center justify-between text-sm">
            <div>
              <span className="text-yc-text-primary">{b.label}</span>
              <span className="text-yc-text-tertiary ml-2 text-xs">— {b.desc}</span>
            </div>
            <span className="text-yc-warning font-mono font-bold">{b.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
