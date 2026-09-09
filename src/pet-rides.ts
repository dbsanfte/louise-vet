/** Shared local-space ride poses: the car/cabin and its pet use the same track. */
export function ridePose(kind: string, elapsed: number) {
  const angle = Math.min(Math.max(elapsed / 12, 0), 1) * Math.PI * 2;
  if (kind === 'coaster')
    return {
      x: Math.cos(angle) * 2,
      z: Math.sin(angle) * 1.4,
      y: 0.28 + 0.5 * (1 - Math.cos(angle)),
      facing: Math.atan2(-2 * Math.sin(angle), 1.4 * Math.cos(angle)),
    };
  return {
    x: Math.sin(angle) * 1.65,
    z: 0,
    y: 2 - Math.cos(angle) * 1.65,
    facing: 0,
  };
}
export const isCabinRide = (kind: string) =>
  kind === 'coaster' || kind === 'ferris';
