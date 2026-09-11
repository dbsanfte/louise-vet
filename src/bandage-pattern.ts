export type TracePoint = { x: number; y: number };

// Three gently sloping coils, with a checkpoint at each side of the paw.
// Normalized coordinates are shared by pointer/keyboard tracing and the picture.
export const bandagePattern: readonly TracePoint[] = Array.from(
  { length: 97 },
  (_, i) => {
    const angle = (i / 96) * Math.PI * 6;
    return {
      x: 0.5 - 0.34 * Math.cos(angle),
      y: 0.13 + 0.74 * (i / 96),
    };
  },
);
export const bandageEnd = bandagePattern.length - 1;
const lengths = [0];
for (let i = 1; i <= bandageEnd; i++) {
  const a = bandagePattern[i - 1],
    b = bandagePattern[i];
  lengths.push(lengths[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
}
export function bandageFraction(progress: number) {
  const i = Math.min(Math.floor(progress), bandageEnd - 1);
  return (
    (lengths[i] + (lengths[i + 1] - lengths[i]) * (progress - i)) /
    lengths[bandageEnd]
  );
}
export function bandagePoint(progress: number): TracePoint {
  const i = Math.min(Math.floor(progress), bandageEnd - 1);
  const a = bandagePattern[i],
    b = bandagePattern[i + 1];
  const t = progress - i;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Project onto the nearby ribbon only: another coil cannot steal progress. */
export function projectBandage(point: TracePoint, progress: number) {
  let distance = Infinity,
    next = progress;
  for (
    let i = Math.max(0, Math.floor(progress) - 4);
    i < Math.min(bandageEnd, Math.floor(progress) + 8);
    i++
  ) {
    const a = bandagePattern[i],
      b = bandagePattern[i + 1];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy),
      ),
    );
    const d = Math.hypot(point.x - a.x - dx * t, point.y - a.y - dy * t);
    if (d < distance) {
      distance = d;
      next = i + t;
    }
  }
  return { distance, progress: Math.max(progress, next) };
}
