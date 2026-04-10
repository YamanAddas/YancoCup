import { X, Landmark, Users } from "lucide-react";
import { useI18n } from "../../lib/i18n";

const FLAG_CODES: Record<string, string> = {
  USA: "us",
  Mexico: "mx",
  Canada: "ca",
};

interface CityPopupProps {
  city: {
    city: string;
    country: string;
    venue: string;
    capacity: number;
  };
  onClose: () => void;
}

export default function CityPopup({ city, onClose }: CityPopupProps) {
  const { t } = useI18n();
  const flagCode = FLAG_CODES[city.country] ?? "xx";

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[var(--yc-bg-glass)] backdrop-blur-xl border border-yc-border rounded-xl p-5 min-w-[240px] max-w-[calc(100vw-2rem)] shadow-[0_0_30px_var(--yc-green-glow)] transition-all duration-300">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-yc-text-tertiary hover:text-yc-text-primary transition-colors"
      >
        <X size={16} />
      </button>

      <div className="flex items-center gap-3 mb-3">
        <img
          src={`https://hatscripts.github.io/circle-flags/flags/${flagCode}.svg`}
          alt={city.country}
          className="w-8 h-8 rounded-full"
        />
        <div>
          <h3 className="font-heading text-lg font-bold text-yc-text-primary leading-tight">
            {city.city}
          </h3>
          <span className="text-yc-text-secondary text-sm">{city.country}</span>
        </div>
      </div>

      <div className="border-t border-yc-border pt-3 space-y-2">
        <div className="flex items-center gap-2">
          <Landmark size={14} className="text-yc-green shrink-0" />
          <p className="text-yc-text-primary text-sm font-medium">
            {city.venue}
          </p>
        </div>
        <div className="flex items-center gap-2 text-yc-text-secondary text-sm">
          <Users size={14} className="shrink-0" />
          <span>{t("globe.seats", { count: city.capacity.toLocaleString() })}</span>
        </div>
      </div>
    </div>
  );
}
