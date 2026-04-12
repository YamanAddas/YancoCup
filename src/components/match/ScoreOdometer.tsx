import { useEffect, useRef, useState } from "react";

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Single-digit rolling column.
 * Digits 0-9 stacked vertically; `translateY` scrolls to the active digit.
 */
function DigitColumn({ digit, delay }: { digit: number; delay: number }) {
  const [animated, setAnimated] = useState(false);
  const prevDigit = useRef(digit);

  useEffect(() => {
    if (digit !== prevDigit.current) {
      setAnimated(true);
      prevDigit.current = digit;
    }
  }, [digit]);

  return (
    <span
      className="inline-block overflow-hidden"
      style={{ height: "1em", lineHeight: "1em" }}
    >
      <span
        className={animated && !REDUCED_MOTION ? "yc-digit-roll" : ""}
        style={{
          display: "block",
          transform: `translateY(${-digit}em)`,
          transition: REDUCED_MOTION
            ? "none"
            : `transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`,
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <span
            key={d}
            className="block"
            style={{ height: "1em", lineHeight: "1em" }}
            aria-hidden={d !== digit}
          >
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

interface ScoreOdometerProps {
  value: number;
  className?: string;
}

/**
 * Renders a number as rolling odometer digits.
 * Each digit column scrolls independently with staggered timing.
 */
export default function ScoreOdometer({ value, className }: ScoreOdometerProps) {
  const digits = String(Math.max(0, value)).split("").map(Number);

  return (
    <span className={className} aria-label={String(value)}>
      {digits.map((d, i) => (
        <DigitColumn key={i} digit={d} delay={i * 80} />
      ))}
    </span>
  );
}
