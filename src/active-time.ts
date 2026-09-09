/** Preserve short active-frame delays in small physics steps, without offline catch-up. */
export function advanceActiveTime(elapsed: number, step: (dt: number) => void) {
  if (!Number.isFinite(elapsed)) return;
  // A busy software-rendered frame can take several seconds. Preserve that
  // active time; only treat longer interruptions as pauses, not slow walking.
  let remaining = Math.max(elapsed > 5 ? 0.5 : elapsed, 0);
  while (remaining > 0.000001) {
    const dt = Math.min(remaining, 0.05);
    step(dt);
    remaining -= dt;
  }
}
