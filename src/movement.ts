import type { Point } from './town-map.ts';
/** Consume the whole distance budget, including across short waypoint segments. */
export function walkRoute(
  position: Point,
  route: Point[],
  dt: number,
  speed: number,
) {
  let remaining = Math.max(0, dt) * speed,
    facing: number | undefined;
  while (route.length) {
    const next = route[0],
      dx = next.x - position.x,
      dz = next.z - position.z,
      distance = Math.hypot(dx, dz);
    if (distance < 1e-8) {
      route.shift();
      continue;
    }
    if (remaining <= 1e-8) break;
    facing = Math.atan2(dx, dz);
    const step = Math.min(remaining, distance);
    position.x += (dx / distance) * step;
    position.z += (dz / distance) * step;
    remaining -= step;
    if (step === distance) {
      Object.assign(position, next);
      route.shift();
    }
  }
  return facing;
}
/** Turn along the shortest angle; never spin almost a full circle at ±pi. */
export function turnToward(current: number, target: number, dt: number) {
  const delta = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  );
  return current + delta * (1 - Math.exp(-Math.max(0, dt) * 12));
}
