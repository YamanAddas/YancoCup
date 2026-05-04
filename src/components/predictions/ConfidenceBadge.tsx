import { Star } from "lucide-react";
import { useI18n } from "../../lib/i18n";

const TIER_KEYS = ["wild", "risky", "sure"] as const;

interface ConfidenceBadgeProps {
  /** 1 = Wild Guess, 2 = Risky Call, 3 = Sure Thing. Null hides the badge. */
  level: 1 | 2 | 3 | null | undefined;
  /** Star icon size in pixels. Default 10. */
  size?: number;
}

/**
 * Read-only confidence indicator — three small stars filled to match the
 * user's chosen level. Hidden when no confidence is set.
 */
export default function ConfidenceBadge({
  level,
  size = 10,
}: ConfidenceBadgeProps) {
  const { t } = useI18n();
  if (level == null) return null;
  const label = t(`predictions.confidence.${TIER_KEYS[level - 1]}`);
  return (
    <span
      className="inline-flex items-center gap-px shrink-0"
      title={label}
      aria-label={label}
    >
      {[1, 2, 3].map((i) => (
        <Star
          key={i}
          size={size}
          strokeWidth={2}
          className={
            i <= level
              ? "text-yc-warning fill-yc-warning"
              : "text-yc-text-tertiary"
          }
        />
      ))}
    </span>
  );
}
