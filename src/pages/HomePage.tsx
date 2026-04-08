import GlobeView from "../components/globe/GlobeView";
import Countdown from "../components/layout/Countdown";
import { Trophy } from "lucide-react";

export default function HomePage() {
  return (
    <div>
      {/* Hero: globe + countdown side by side on desktop */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-center">
        <GlobeView />

        <div className="flex flex-col items-center lg:items-start gap-6">
          <div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-2">
              World Cup <span className="text-yc-green">2026</span>
            </h2>
            <p className="text-yc-text-secondary text-sm">
              United States, Mexico &amp; Canada
            </p>
          </div>

          <div>
            <p className="text-yc-text-tertiary text-xs uppercase tracking-widest mb-3">
              Kickoff in
            </p>
            <Countdown />
          </div>

          <a
            href="#/predictions"
            className="inline-flex items-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-6 py-3 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <Trophy size={18} />
            Predict matches with friends
          </a>
        </div>
      </section>

      {/* Today's Matches — placeholder for Session 5 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 border-t border-yc-border">
        <h3 className="font-heading text-xl font-bold mb-4">
          Today&apos;s Matches
        </h3>
        <p className="text-yc-text-tertiary text-sm">
          Match cards will appear here once schedule data is loaded.
        </p>
      </section>
    </div>
  );
}
