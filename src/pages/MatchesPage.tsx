import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useCompetition } from "../lib/CompetitionProvider";
import { useCompetitionSchedule } from "../hooks/useCompetitionSchedule";
import { useSchedule } from "../hooks/useSchedule";
import { useTeams, useTeamMap } from "../hooks/useTeams";
import { useVenueMap, useVenues } from "../hooks/useVenues";
import { useGroups } from "../hooks/useGroups";
import { useScores } from "../hooks/useScores";
import { useI18n } from "../lib/i18n";
import { usePredictedMatchIds } from "../hooks/usePredictions";
import MatchCard from "../components/match/MatchCard";
import type { Match } from "../types";
import { ChevronLeft, ChevronRight, ChevronDown, Filter, X, Check, Circle } from "lucide-react";
import StateError from "../components/shared/StateError";
import { formatDatePill, getLocale } from "../lib/formatDate";

// ---------------------------------------------------------------------------
// Date navigation pill
// ---------------------------------------------------------------------------

function DatePill({
  date,
  isActive,
  isToday,
  hasLive,
  matchCount,
  onClick,
  pillRef,
  lang,
}: {
  date: string;
  isActive: boolean;
  isToday: boolean;
  hasLive: boolean;
  matchCount: number;
  onClick: () => void;
  pillRef?: React.Ref<HTMLButtonElement>;
  lang?: string;
}) {
  const { day, weekday, month } = formatDatePill(date, lang);

  return (
    <button
      ref={pillRef}
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-center transition-all duration-200 shrink-0 min-w-[56px] relative ${
        isActive
          ? "bg-yc-green/15 text-yc-green border border-[var(--yc-border-accent-bright)] shadow-[0_0_16px_rgba(0,255,136,0.1)]"
          : isToday
            ? "bg-yc-bg-elevated text-yc-text-primary border border-yc-green/20"
            : "bg-yc-bg-surface text-yc-text-secondary border border-yc-border hover:border-yc-border-hover hover:text-yc-text-primary"
      }`}
    >
      <span className="text-[9px] uppercase tracking-wide font-medium opacity-70">{weekday}</span>
      <span className="text-lg font-bold font-mono leading-none">{day}</span>
      <span className="text-[9px] uppercase tracking-wide opacity-60">{month}</span>
      {hasLive && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-yc-green animate-pulse" />
      )}
      {matchCount > 0 && !isActive && (
        <span className="text-[8px] text-yc-text-tertiary mt-0.5">{matchCount}</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Horizontal date strip
// ---------------------------------------------------------------------------

function DateStrip({
  dates,
  activeDate,
  onDateSelect,
  todayDate,
  liveSet,
  matchCountByDate,
  lang,
}: {
  dates: string[];
  activeDate: string;
  onDateSelect: (d: string) => void;
  todayDate: string;
  liveSet: Set<string>;
  matchCountByDate: Map<string, number>;
  lang?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activePillRef = useRef<HTMLButtonElement>(null);

  // Scroll the active pill into view on mount and when active changes
  useEffect(() => {
    const container = scrollRef.current;
    const el = activePillRef.current;
    if (!container || !el) return;
    const cr = container.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    container.scrollBy({ left: er.left - cr.left - cr.width / 2 + er.width / 2, behavior: "smooth" });
  }, [activeDate]);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  return (
    <div className="relative flex items-center gap-1 mb-6">
      <button
        onClick={() => scroll("left")}
        className="shrink-0 p-1.5 rounded-lg text-yc-text-tertiary hover:text-yc-text-primary hover:bg-yc-bg-elevated transition-colors"
      >
        <ChevronLeft size={18} />
      </button>

      <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto scrollbar-none flex-1 py-1">
        {dates.map((date) => (
          <DatePill
            key={date}
            date={date}
            isActive={date === activeDate}
            isToday={date === todayDate}
            hasLive={liveSet.has(date)}
            matchCount={matchCountByDate.get(date) ?? 0}
            onClick={() => onDateSelect(date)}
            pillRef={date === activeDate ? activePillRef : undefined}
            lang={lang}
          />
        ))}
      </div>

      <button
        onClick={() => scroll("right")}
        className="shrink-0 p-1.5 rounded-lg text-yc-text-tertiary hover:text-yc-text-primary hover:bg-yc-bg-elevated transition-colors"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter dropdown (for tournaments)
// ---------------------------------------------------------------------------

function SelectFilter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-yc-text-tertiary text-[10px] uppercase tracking-widest">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-yc-bg-elevated border border-yc-border rounded-lg px-3 py-2 text-sm text-yc-text-primary focus:outline-none focus:border-yc-green-muted transition-colors appearance-none cursor-pointer"
      >
        {children}
      </select>
    </div>
  );
}

const ROUND_KEYS: { value: Match["round"] | ""; labelKey: string }[] = [
  { value: "", labelKey: "matches.allRounds" },
  { value: "group", labelKey: "round.group" },
  { value: "playoff", labelKey: "round.playoff" },
  { value: "round-of-32", labelKey: "round.roundOf32" },
  { value: "round-of-16", labelKey: "round.roundOf16" },
  { value: "quarterfinal", labelKey: "round.quarterfinal" },
  { value: "semifinal", labelKey: "round.semifinal" },
  { value: "third-place", labelKey: "round.thirdPlace" },
  { value: "final", labelKey: "round.final" },
];

// ---------------------------------------------------------------------------
// Tournament matches with date navigation
// ---------------------------------------------------------------------------

function TournamentMatches() {
  const comp = useCompetition();
  const { t, lang, tTeam, tVenue } = useI18n();
  const [showFilters, setShowFilters] = useState(false);
  const [round, setRound] = useState("");
  const [group, setGroup] = useState("");
  const [team, setTeam] = useState("");
  const [venueId, setVenueId] = useState("");

  const groups = useGroups();
  const teams = useTeams();
  const venues = useVenues();
  const teamMap = useTeamMap();
  const venueMap = useVenueMap();
  const { scoreMap, error: scoreError, fetchedAt } = useScores(comp.id);
  const predictedIds = usePredictedMatchIds(comp.id);

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (round) f.round = round;
    if (group) f.group = group;
    if (team) f.team = team;
    if (venueId) f.venueId = venueId;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [round, group, team, venueId]);

  const matches = useSchedule(filters);

  // Group by date
  const matchesByDate = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      const existing = map.get(m.date);
      if (existing) existing.push(m);
      else map.set(m.date, [m]);
    }
    return map;
  }, [matches]);

  const dates = useMemo(() => [...matchesByDate.keys()].sort(), [matchesByDate]);

  const today = new Date().toISOString().slice(0, 10);

  // Find nearest date to today
  const defaultDate = useMemo(() => {
    const future = dates.find((d) => d >= today);
    return future ?? dates[dates.length - 1] ?? today;
  }, [dates, today]);

  const [activeDate, setActiveDate] = useState<string | null>(null);
  const effectiveDate = activeDate ?? defaultDate;

  // Live dates (dates with live matches)
  const liveSet = useMemo(() => {
    const s = new Set<string>();
    for (const [date, dms] of matchesByDate) {
      const score = dms.find((m) => {
        const ls = scoreMap.get(m.id);
        return ls?.status === "IN_PLAY" || ls?.status === "PAUSED";
      });
      if (score) s.add(date);
    }
    return s;
  }, [matchesByDate, scoreMap]);

  const matchCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const [date, dms] of matchesByDate) map.set(date, dms.length);
    return map;
  }, [matchesByDate]);

  // Get matches for the selected date
  const displayMatches = matchesByDate.get(effectiveDate) ?? [];

  const clearFilters = () => {
    setRound("");
    setGroup("");
    setTeam("");
    setVenueId("");
  };

  const hasFilters = round || group || team || venueId;

  return (
    <>
      {/* Score error banner */}
      {scoreError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-yc-warning/10 border border-yc-warning/20 text-yc-warning text-sm">
          {t("matches.scoreError")}
        </div>
      )}

      {/* Sub-header: match count + filter */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-yc-text-secondary text-sm">
          {matches.length} {matches.length === 1 ? t("matches.count", { count: matches.length }) : t("matches.countPlural", { count: matches.length })}
        </p>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all ${
            showFilters || hasFilters
              ? "bg-yc-green/10 text-yc-green border border-[var(--yc-border-accent)]"
              : "text-yc-text-secondary hover:text-yc-text-primary bg-yc-bg-surface border border-yc-border"
          }`}
        >
          <Filter size={14} />
          {t("matches.filterRound")}
          {hasFilters && (
            <button
              onClick={(e) => { e.stopPropagation(); clearFilters(); }}
              className="ms-1 hover:text-white"
            >
              <X size={12} />
            </button>
          )}
        </button>
      </div>

      {/* Collapsible filters */}
      {showFilters && (
        <div className="yc-card p-4 mb-6 animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SelectFilter label={t("matches.filterRound")} value={round} onChange={setRound}>
              {ROUND_KEYS.map((o) => (
                <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
              ))}
            </SelectFilter>
            <SelectFilter label={t("matches.filterGroup")} value={group} onChange={setGroup}>
              <option value="">{t("matches.allGroups")}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{t("match.group", { id: g.id })}</option>
              ))}
            </SelectFilter>
            <SelectFilter label={t("matches.filterTeam")} value={team} onChange={setTeam}>
              <option value="">{t("matches.allTeams")}</option>
              {teams.map((t_) => (
                <option key={t_.id} value={t_.id}>{tTeam(t_.id)}</option>
              ))}
            </SelectFilter>
            <SelectFilter label={t("matches.filterVenue")} value={venueId} onChange={setVenueId}>
              <option value="">{t("matches.allVenues")}</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{tVenue(v.id).name}</option>
              ))}
            </SelectFilter>
          </div>
        </div>
      )}

      {/* Date strip navigation */}
      {dates.length > 0 && (
        <DateStrip
          dates={dates}
          activeDate={effectiveDate}
          onDateSelect={setActiveDate}
          todayDate={today}
          liveSet={liveSet}
          matchCountByDate={matchCountByDate}
          lang={lang}
        />
      )}

      {/* Date header */}
      {effectiveDate && (
        <div className="flex items-center gap-3 mb-4">
          <h3 className="font-heading text-lg font-semibold text-yc-text-primary">
            {new Date(`${effectiveDate}T00:00:00Z`).toLocaleDateString(getLocale(lang), {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "UTC",
            })}
          </h3>
          {effectiveDate === today && (
            <span className="text-[10px] uppercase tracking-widest text-yc-green font-bold bg-yc-green/10 px-2 py-0.5 rounded-full">
              {t("home.todaysMatches")}
            </span>
          )}
          {liveSet.has(effectiveDate) && (
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-yc-green font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-yc-green animate-pulse" />
              {t("match.live")}
            </span>
          )}
        </div>
      )}

      {/* Match cards */}
      {displayMatches.length === 0 ? (
        <div className="yc-card p-8 text-center">
          <p className="text-yc-text-tertiary text-sm">{t("matches.noResults")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...displayMatches].sort((a, b) => a.time.localeCompare(b.time)).map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              teamMap={teamMap}
              venueMap={venueMap}
              liveScore={scoreMap.get(m.id)}
              competitionId={comp.id}
              predicted={predictedIds.has(m.id)}
              fetchedAt={fetchedAt}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Matchday stepper + dropdown
// ---------------------------------------------------------------------------

function MatchdayStepper({
  matchdays,
  selected,
  onSelect,
  mdStatus,
  t,
}: {
  matchdays: number[];
  selected: number;
  onSelect: (md: number) => void;
  mdStatus: (md: number) => string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const idx = matchdays.indexOf(selected);
  const hasPrev = idx > 0;
  const hasNext = idx < matchdays.length - 1;

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Scroll active item into view when dropdown opens
  useEffect(() => {
    if (!open || !listRef.current) return;
    const activeEl = listRef.current.querySelector("[data-active='true']");
    activeEl?.scrollIntoView({ block: "center" });
  }, [open]);

  const currentStatus = mdStatus(selected);

  return (
    <div className="flex items-center justify-center gap-2 mb-6" ref={dropdownRef}>
      {/* Prev button */}
      <button
        onClick={() => { if (hasPrev) onSelect(matchdays[idx - 1]!); }}
        disabled={!hasPrev}
        className="p-2.5 rounded-xl bg-yc-bg-surface border border-yc-border text-yc-text-secondary hover:text-yc-text-primary hover:border-yc-border-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
      >
        <ChevronLeft size={18} />
      </button>

      {/* Center label — opens dropdown */}
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl border transition-all min-w-[180px] justify-center ${
            open
              ? "bg-yc-green/15 text-yc-green border-[var(--yc-border-accent-bright)] shadow-[0_0_16px_rgba(0,255,136,0.1)]"
              : "bg-yc-bg-surface text-yc-text-primary border-yc-border hover:border-yc-border-hover"
          }`}
        >
          {currentStatus === "live" && (
            <span className="w-2 h-2 rounded-full bg-yc-green animate-pulse shrink-0" />
          )}
          <span className="font-heading font-semibold text-sm">
            {t("common.matchday")} {selected}
          </span>
          <span className="text-yc-text-tertiary text-xs font-mono">
            / {matchdays.length}
          </span>
          <ChevronDown size={14} className={`text-yc-text-tertiary transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {/* Dropdown list */}
        {open && (
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-56 max-h-72 overflow-y-auto bg-yc-bg-elevated border border-yc-border rounded-xl shadow-2xl shadow-black/40 z-50 py-1 scrollbar-none animate-fade-in" ref={listRef}>
            {matchdays.map((md) => {
              const status = mdStatus(md);
              const isActive = md === selected;
              return (
                <button
                  key={md}
                  data-active={isActive}
                  onClick={() => {
                    onSelect(md);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "bg-yc-green/10 text-yc-green"
                      : "text-yc-text-secondary hover:bg-yc-bg-surface hover:text-yc-text-primary"
                  }`}
                >
                  {/* Status indicator */}
                  {status === "live" ? (
                    <span className="w-2 h-2 rounded-full bg-yc-green animate-pulse shrink-0" />
                  ) : status === "finished" ? (
                    <Check size={12} className="text-yc-text-tertiary shrink-0" />
                  ) : (
                    <Circle size={8} className="text-yc-text-tertiary/40 shrink-0" />
                  )}

                  <span className={`font-medium flex-1 text-start ${isActive ? "text-yc-green" : ""}`}>
                    {t("common.matchday")} {md}
                  </span>

                  {isActive && (
                    <span className="text-[9px] uppercase tracking-wider text-yc-green font-bold">
                      ●
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Next button */}
      <button
        onClick={() => { if (hasNext) onSelect(matchdays[idx + 1]!); }}
        disabled={!hasNext}
        className="p-2.5 rounded-xl bg-yc-bg-surface border border-yc-border text-yc-text-secondary hover:text-yc-text-primary hover:border-yc-border-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
      >
        <ChevronRight size={18} />
      </button>

      {/* Progress bar */}
      <div className="hidden sm:flex items-center gap-2 ms-3">
        <div className="w-24 h-1.5 rounded-full bg-yc-bg-surface overflow-hidden">
          <div
            className="h-full rounded-full bg-yc-green/60 transition-all duration-300"
            style={{ width: `${((idx + 1) / matchdays.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// League matches with matchday navigation
// ---------------------------------------------------------------------------

function LeagueMatches() {
  const comp = useCompetition();
  const { t, lang } = useI18n();
  const { scoreMap, error: scoreError, fetchedAt } = useScores(comp.id);
  const [selectedMatchday, setSelectedMatchday] = useState<number | undefined>(undefined);
  const { matches, matchdays, loading, error: scheduleError } = useCompetitionSchedule(selectedMatchday);
  const teamMap = useTeamMap();
  const venueMap = useVenueMap();
  const predictedIds = usePredictedMatchIds(comp.id);

  // All matches (unfiltered) for finding the right default matchday
  const { matches: allMatches } = useCompetitionSchedule();

  // Auto-select nearest matchday on first load
  const findNearestMatchday = useCallback(() => {
    if (matchdays.length === 0 || allMatches.length === 0) return undefined;
    const today = new Date().toISOString().slice(0, 10);

    // Find the first matchday with upcoming/live matches
    for (const md of matchdays) {
      const mdMatches = allMatches.filter((m) => m.matchday === md);
      const hasUpcoming = mdMatches.some(
        (m) => m.date >= today || m.status === "IN_PLAY" || m.status === "PAUSED"
      );
      if (hasUpcoming) return md;
    }

    // All matchdays played — return the latest one
    return matchdays[matchdays.length - 1];
  }, [matchdays, allMatches]);

  useEffect(() => {
    if (selectedMatchday !== undefined) return;
    const nearest = findNearestMatchday();
    if (nearest !== undefined) setSelectedMatchday(nearest);
  }, [findNearestMatchday, selectedMatchday]);

  // Group matches by date for display
  const matchesByDate = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of matches) {
      const existing = map.get(m.date);
      if (existing) existing.push(m);
      else map.set(m.date, [m]);
    }
    return map;
  }, [matches]);

  // Matchday status for styling
  const mdStatus = useCallback(
    (md: number) => {
      const mdMatches = allMatches.filter((m) => m.matchday === md);
      if (mdMatches.length === 0) return "future";
      const hasLive = mdMatches.some((m) => m.status === "IN_PLAY" || m.status === "PAUSED");
      if (hasLive) return "live";
      const allFinished = mdMatches.every((m) => m.status === "FINISHED");
      if (allFinished) return "finished";
      const today = new Date().toISOString().slice(0, 10);
      const hasUpcoming = mdMatches.some((m) => m.date >= today);
      if (hasUpcoming) return "upcoming";
      return "finished";
    },
    [allMatches],
  );

  return (
    <>
      {scoreError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-yc-warning/10 border border-yc-warning/20 text-yc-warning text-sm">
          {t("matches.scoreError")}
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-yc-green border-t-transparent animate-spin" />
        </div>
      ) : scheduleError ? (
        <StateError onRetry={() => window.location.reload()} />
      ) : (
        <>
          {/* Matchday stepper + dropdown */}
          {matchdays.length > 0 && selectedMatchday !== undefined && (
            <MatchdayStepper
              matchdays={matchdays}
              selected={selectedMatchday}
              onSelect={setSelectedMatchday}
              mdStatus={mdStatus}
              t={t}
            />
          )}

          {/* Matches grouped by date */}
          {matches.length === 0 ? (
            <div className="yc-card p-8 text-center">
              <p className="text-yc-text-tertiary text-sm">{t("matches.noResults")}</p>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              {[...matchesByDate.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, dateMatches]) => (
                <div key={date}>
                  <h3 className="text-yc-text-secondary text-sm font-medium mb-3 sticky top-14 bg-yc-bg-deep/80 backdrop-blur-sm py-2 z-10 border-b border-yc-border/30">
                    {new Date(`${date}T00:00:00Z`).toLocaleDateString(getLocale(lang), {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...dateMatches].sort((a, b) => a.time.localeCompare(b.time)).map((m) => (
                      <MatchCard
                        key={m.id}
                        match={m}
                        teamMap={teamMap}
                        venueMap={venueMap}
                        liveScore={scoreMap.get(m.id)}
                        competitionId={comp.id}
                        predicted={predictedIds.has(m.id)}
                        fetchedAt={fetchedAt}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function MatchesPage() {
  const comp = useCompetition();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {comp.type === "tournament" && comp.staticSchedule ? (
        <TournamentMatches />
      ) : (
        <LeagueMatches />
      )}
    </div>
  );
}
