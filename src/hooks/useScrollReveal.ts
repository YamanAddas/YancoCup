import { useRef, useState, useEffect } from "react";

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Returns a ref to attach to a container and a `visible` boolean
 * that turns true once the element enters the viewport.
 * Once revealed, the observer disconnects (reveal only once).
 */
export function useScrollReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(REDUCED_MOTION); // skip animation if reduced motion

  useEffect(() => {
    if (REDUCED_MOTION || !ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}
