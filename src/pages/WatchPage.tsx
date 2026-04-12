import { useState, useMemo } from "react";
import { Tv, Radio, MonitorPlay, ExternalLink, Search } from "lucide-react";
import { useI18n } from "../lib/i18n";
import broadcastersData from "../data/broadcasters.json";

const FLAG_BASE = "https://hatscripts.github.io/circle-flags/flags";

interface Broadcaster {
  name: string;
  type: "tv" | "streaming" | "both";
  url: string;
}

interface CountryBroadcast {
  country: string;
  isoCode: string;
  broadcasters: Broadcaster[];
}

const data = broadcastersData as CountryBroadcast[];

function TypeIcon({ type }: { type: Broadcaster["type"] }) {
  if (type === "tv") return <Tv size={14} className="text-yc-text-tertiary" />;
  if (type === "streaming") return <MonitorPlay size={14} className="text-yc-text-tertiary" />;
  return <Radio size={14} className="text-yc-text-tertiary" />;
}

const TYPE_KEYS: Record<Broadcaster["type"], string> = {
  tv: "watch.tv",
  streaming: "watch.streaming",
  both: "watch.tvStreaming",
};

export default function WatchPage() {
  const [search, setSearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const { t, tCountry } = useI18n();

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (c) =>
        tCountry(c.isoCode).toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.broadcasters.some((b) => b.name.toLowerCase().includes(q)),
    );
  }, [search, tCountry]);

  const selected = useMemo(
    () => data.find((c) => c.isoCode === selectedCountry),
    [selectedCountry],
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-2">
        <Tv size={24} className="text-yc-green" />
        <h2 className="font-heading text-2xl font-bold">{t("watch.title")}</h2>
      </div>
      <p className="text-yc-text-tertiary text-sm mb-6">
        {t("watch.subtitle")}
      </p>

      {/* Search */}
      <div className="relative mb-6">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-yc-text-tertiary pointer-events-none"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedCountry(null);
          }}
          placeholder={t("watch.search")}
          className="w-full bg-yc-bg-elevated border border-yc-border rounded-lg ps-9 pe-4 py-3 text-sm text-yc-text-primary placeholder:text-yc-text-tertiary focus:outline-none focus:border-yc-green-muted transition-colors"
        />
      </div>

      {/* Country grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-8">
        {filtered.map((c) => (
          <button
            key={c.isoCode}
            onClick={() =>
              setSelectedCountry(selectedCountry === c.isoCode ? null : c.isoCode)
            }
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all ${
              selectedCountry === c.isoCode
                ? "bg-yc-green-dark/30 border border-yc-green-muted/50 text-yc-text-primary"
                : "bg-yc-bg-surface border border-yc-border hover:border-yc-border-hover text-yc-text-secondary"
            }`}
          >
            <img
              src={`${FLAG_BASE}/${c.isoCode}.svg`}
              alt={c.country}
              className="w-6 h-6 rounded-full shrink-0"
            />
            <span className="truncate">{tCountry(c.isoCode)}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-yc-text-tertiary text-sm text-center py-8">
          {t("watch.noResults", { query: search })}
        </p>
      )}

      {/* Selected country detail */}
      {selected && (
        <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-4 sm:p-5 animate-in fade-in duration-200">
          <div className="flex items-center gap-3 mb-4">
            <img
              src={`${FLAG_BASE}/${selected.isoCode}.svg`}
              alt={selected.country}
              className="w-10 h-10 rounded-full"
            />
            <h3 className="font-heading text-xl font-bold">{tCountry(selected.isoCode)}</h3>
          </div>

          <div className="space-y-3">
            {selected.broadcasters.map((b) => (
              <a
                key={b.name}
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 px-4 py-3 bg-yc-bg-elevated border border-yc-border rounded-lg hover:border-yc-green-muted/40 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <TypeIcon type={b.type} />
                  <div className="min-w-0">
                    <span className="text-yc-text-primary text-sm font-medium block truncate">
                      {b.name}
                    </span>
                    <span className="text-yc-text-tertiary text-xs">
                      {t(TYPE_KEYS[b.type])}
                    </span>
                  </div>
                </div>
                <ExternalLink
                  size={14}
                  className="text-yc-text-tertiary group-hover:text-yc-green transition-colors shrink-0"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* No selection prompt */}
      {!selected && filtered.length > 0 && (
        <div className="text-center py-8">
          <p className="text-yc-text-tertiary text-sm">
            {t("watch.selectPrompt")}
          </p>
        </div>
      )}

      <p className="mt-8 text-center text-yc-text-tertiary text-xs">
        {t("watch.disclaimer")}
      </p>
    </div>
  );
}
