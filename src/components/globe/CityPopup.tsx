import { X, MapPin, Users } from "lucide-react";

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
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[var(--yc-bg-glass)] backdrop-blur-xl border border-yc-border rounded-xl p-5 min-w-[280px] shadow-[0_0_30px_var(--yc-green-glow)]">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-yc-text-tertiary hover:text-yc-text-primary transition-colors"
      >
        <X size={16} />
      </button>

      <h3 className="font-heading text-lg font-bold text-yc-text-primary mb-1">
        {city.city}
      </h3>

      <div className="flex items-center gap-1.5 text-yc-text-secondary text-sm mb-3">
        <MapPin size={14} className="text-yc-green" />
        <span>{city.country}</span>
      </div>

      <div className="border-t border-yc-border pt-3 space-y-2">
        <p className="text-yc-text-primary text-sm font-medium">
          {city.venue}
        </p>
        <div className="flex items-center gap-1.5 text-yc-text-secondary text-sm">
          <Users size={14} />
          <span>{city.capacity.toLocaleString()} seats</span>
        </div>
      </div>
    </div>
  );
}
