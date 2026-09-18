import { useEffect, useRef, useState } from "react";

/**
 * Eases a displayed number toward its target, so KPI values count up instead of
 * snapping. Only applied to plain numbers; formatted strings render verbatim.
 */
export function useAnimatedNumber(rawValue: string | number, duration = 700): string {
  const numeric = typeof rawValue === "number" ? rawValue : Number(rawValue);
  const animate = typeof rawValue === "number" || (typeof rawValue === "string" && rawValue.trim() !== "" && !Number.isNaN(numeric));

  const [display, setDisplay] = useState<number>(0);
  const previousRef = useRef<number>(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animate) return;

    const start = previousRef.current;
    const target = numeric;
    if (start === target) {
      setDisplay(target);
      previousRef.current = target;
      return;
    }

    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = start + (target - start) * eased;
      setDisplay(value);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        previousRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      previousRef.current = target;
    };
  }, [numeric, animate, duration]);

  if (!animate) return String(rawValue);

  return String(Math.round(display));
}
