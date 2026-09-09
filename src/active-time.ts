/** Preserve short active-frame delays in small physics steps, without offline catch-up. */
export function advanceActiveTime(elapsed: number, step: (dt: number) => void) {
  if (!Number.isFinite(elapsed)) return;
  let remaining = Math.min(Math.max(elapsed, 0), 0.5);
  while (remaining > 0.000001) {
    const dt = Math.min(remaining, 0.05);
    step(dt);
    remaining -= dt;
  }
}
