import { useEffect, useRef } from "react";

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Full-page radial gradient overlay that follows the mouse cursor.
 * Desktop only — no mouse on mobile, so the element stays hidden.
 * Compositor-only paint (no layout thrashing).
 */
export default function SpotlightCursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (REDUCED_MOTION) return;

    // Only activate on devices with a fine pointer (mouse/trackpad)
    const mq = window.matchMedia("(pointer: fine)");
    if (!mq.matches) return;

    const el = ref.current;
    if (!el) return;

    el.style.opacity = "1";

    const onMove = (e: MouseEvent) => {
      el.style.setProperty("--spot-x", `${e.clientX}px`);
      el.style.setProperty("--spot-y", `${e.clientY}px`);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      ref={ref}
      className="yc-spotlight"
      aria-hidden="true"
    />
  );
}
