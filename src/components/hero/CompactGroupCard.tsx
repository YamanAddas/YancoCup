import { Link } from "react-router-dom";
import { useI18n } from "../../lib/i18n";
import TeamCrest from "../match/TeamCrest";
import type { Team } from "../../types";
import type { MiniStandingEntry } from "../../lib/bracketResolver";

interface CompactGroupCardProps {
  groupId: string;
  teams: Team[];
  /** Sorted standings from computeGroupStandings — keyed by team id. Empty pre-tournament. */
  standings?: MiniStandingEntry[];
}

/**
 * Compact group card for the group-stage hero. Shows 4 teams stacked with
 * points, played count, and qualifier highlighting (top 2 = direct R32 spot,
 * 3rd = best-third candidate, 4th = eliminated).
 *
 * Pre-tournament fallback: render `group.teams` order with 0 points.
 */
export default function CompactGroupCard({
  groupId,
  teams,
  standings,
}: CompactGroupCardProps) {
  const { t, tTeam } = useI18n();

  // Build a id → standing lookup
  const standingMap = new Map<string, MiniStandingEntry>();
  if (standings) {
    for (const s of standings) standingMap.set(s.tla, s);
  }

  // Sorted display order: prefer standings sort, fall back to data file order
  const ordered = standings && standings.length === teams.length
    ? standings
        .map((s) => teams.find((t) => t.id === s.tla))
        .filter((t): t is Team => Boolean(t))
    : teams;

  return (
    <Link
      to={`/WC/groups#group-${groupId}`}
      className="yc-card rounded-xl p-3 block transition-all hover:border-yc-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yc-green-muted/50"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 rounded bg-yc-green/15 flex items-center justify-center text-yc-green text-[11px] font-bold font-mono">
          {groupId}
        </span>
        <span className="text-xs font-semibold text-yc-text-secondary uppercase tracking-wider">
          {t("match.group", { id: groupId })}
        </span>
      </div>

      <ul className="space-y-1">
        {ordered.map((team, i) => {
          const s = standingMap.get(team.id);
          const tone =
            i < 2
              ? "text-yc-text-primary"
              : i === 2
                ? "text-yc-text-secondary"
                : "text-yc-text-tertiary";
          const indicator =
            i < 2
              ? "bg-yc-green"
              : i === 2
                ? "bg-yc-warning/60"
                : "bg-transparent";

          return (
            <li
              key={team.id}
              className="flex items-center gap-2 text-[11px]"
            >
              <span className={`w-0.5 h-3 rounded-full shrink-0 ${indicator}`} />
              <span className="font-mono text-yc-text-tertiary w-3 text-end">
                {i + 1}
              </span>
              <TeamCrest
                tla={team.fifaCode}
                isoCode={team.isoCode}
                size="xs"
              />
              <span className={`flex-1 truncate font-medium ${tone}`}>
                {tTeam(team.id)}
              </span>
              <span className="font-mono text-[10px] text-yc-text-tertiary tabular-nums">
                {s?.played ?? 0}
              </span>
              <span
                className={`font-mono font-bold tabular-nums w-5 text-end ${
                  s && s.points > 0 ? "text-yc-green" : "text-yc-text-tertiary"
                }`}
              >
                {s?.points ?? 0}
              </span>
            </li>
          );
        })}
      </ul>
    </Link>
  );
}
