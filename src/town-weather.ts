import { outsideClinic } from './dog-walks.ts';
import { distance, onRoad, layout, type Point } from './town-map.ts';
import { walkRoute } from './movement.ts';
import { rescueTrees } from './emergency-map.ts';
import shadeTrees from './shade-trees.json' with { type: 'json' };
import type { Household } from './town-simulation.ts';
export { shadeTrees };
export const shelterTrees: Point[] = [...rescueTrees, ...shadeTrees];
const catSpot = (p: Point): Point => ({ x: p.x - 0.3, z: p.z + 0.05 });
const ownerSpot = (p: Point): Point => ({ x: p.x + 0.3, z: p.z + 0.85 });
export function shelterPointClear(p: Point) {
  if (onRoad(p) || !outsideClinic(p)) return false;
  return !layout.lots.some((l) => {
    const dx = p.x - l.x,
      dz = p.z - l.z,
      x = dx * Math.cos(l.facing) - dz * Math.sin(l.facing),
      z = dx * Math.sin(l.facing) + dz * Math.cos(l.facing);
    const building = Math.abs(x) < 2.45 && Math.abs(z) < 1.95;
    const fence =
      (Math.abs(Math.abs(x) - 3.4) < 0.2 && Math.abs(z) < 3.5) ||
      (Math.abs(z + 3.3) < 0.2 && Math.abs(x) < 3.5);
    return building || fence;
  });
}
export interface RainShelter {
  household: number;
  pet: string;
  tree: number;
  phase: 'approach' | 'wait' | 'return';
  anchor: Point;
  petAnchor: Point;
  petPosition: Point;
  petRoute: Point[];
  ownerRoute: Point[];
  facing: number;
}
const safe = (a: Point, b: Point) =>
  Array.from({ length: 41 }, (_, i) => ({
    x: a.x + ((b.x - a.x) * i) / 40,
    z: a.z + ((b.z - a.z) * i) / 40,
  })).every(shelterPointClear);
/** Active-time weather with short, reversible family detours. */
export class TownWeather {
  phase: 'sunny' | 'rain' = 'sunny';
  remaining = 75;
  wetness = 0;
  active = new Map<number, RainShelter>();
  attempted = new Set<number>();
  locked(id: number) {
    return this.active.has(id);
  }
  status(id: number) {
    const s = this.active.get(id);
    return s
      ? s.phase === 'return'
        ? 'The shower has passed · continuing the walk'
        : `${s.pet} ${s.phase === 'wait' ? 'is staying dry under a tree' : 'is hurrying under a tree'} · owner following`
      : null;
  }
  update(
    dt: number,
    households: Household[],
    random: () => number,
    blocked: (id: number) => boolean,
  ) {
    this.remaining -= dt;
    if (this.remaining <= 0) {
      this.phase = this.phase === 'sunny' ? 'rain' : 'sunny';
      this.remaining =
        this.phase === 'rain' ? 18 + random() * 8 : 120 + random() * 80;
      this.attempted.clear();
    }
    this.wetness = Math.max(
      0,
      Math.min(1, this.wetness + dt * (this.phase === 'rain' ? 0.22 : -0.08)),
    );
    for (const h of households) {
      let s = this.active.get(h.id);
      if (!s) {
        if (
          this.phase !== 'rain' ||
          blocked(h.id) ||
          (h.ticket !== undefined && h.retryCareAt === undefined) ||
          h.inClinic ||
          h.routine !== 'walk' ||
          onRoad(h.position) ||
          this.attempted.has(h.id)
        )
          continue;
        const pet = h.pets.find(
          (p) => p.species === 'cat' && h.companions.includes(p.name),
        );
        if (!pet) continue;
        const anchor = {
          x: h.position.x - Math.sin(h.facing) * 0.65,
          z: h.position.z - Math.cos(h.facing) * 0.65,
        };
        const tree = shelterTrees
          .map((t, i) => ({ t, i }))
          .filter(
            ({ t, i }) =>
              distance(t, h.position) < 12 &&
              ![...this.active.values()].some((a) => a.tree === i) &&
              safe(h.position, ownerSpot(t)) &&
              safe(anchor, catSpot(t)),
          )
          .sort(
            (a, b) => distance(a.t, h.position) - distance(b.t, h.position),
          )[0];
        if (!tree) continue; // Try again once the family is near a reachable tree.
        this.attempted.add(h.id);
        if (random() >= 0.85) continue;
        s = {
          household: h.id,
          pet: pet.name,
          tree: tree.i,
          phase: 'approach',
          anchor: { ...h.position },
          petAnchor: anchor,
          petPosition: { ...anchor },
          petRoute: [catSpot(tree.t)],
          ownerRoute: [ownerSpot(tree.t)],
          facing: h.facing,
        };
        this.active.set(h.id, s);
      }
      if (this.phase === 'sunny' && s.phase !== 'return') {
        s.phase = 'return';
        s.petRoute = [{ ...s.petAnchor }];
        s.ownerRoute = [{ ...s.anchor }];
      }
      s.facing = walkRoute(s.petPosition, s.petRoute, dt, 2.7) ?? s.facing;
      h.facing = walkRoute(h.position, s.ownerRoute, dt, 1.9) ?? h.facing;
      if (!s.petRoute.length && !s.ownerRoute.length) {
        if (s.phase === 'return') {
          this.active.delete(h.id);
          h.chatCooldown = 5;
        } else {
          s.phase = 'wait';
          h.facing = Math.atan2(
            s.petPosition.x - h.position.x,
            s.petPosition.z - h.position.z,
          );
        }
      }
    }
  }
  snapshot() {
    return {
      phase: this.phase,
      remaining: this.remaining,
      wetness: this.wetness,
      attempted: [...this.attempted],
      active: structuredClone([...this.active.values()]),
    };
  }
  restore(value: unknown, households: Household[]) {
    if (value === undefined) return true;
    try {
      const s = structuredClone(value) as ReturnType<TownWeather['snapshot']>;
      const point = (p: Point) =>
        p &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.z) &&
        Math.abs(p.x) < 100 &&
        Math.abs(p.z) < 100;
      const route = (r: Point[]) =>
        Array.isArray(r) && r.length <= 2 && r.every(point);
      if (
        !['sunny', 'rain'].includes(s.phase) ||
        !Number.isFinite(s.remaining) ||
        s.remaining < 0 ||
        s.remaining > 200 ||
        !Number.isFinite(s.wetness) ||
        s.wetness < 0 ||
        s.wetness > 1 ||
        !Array.isArray(s.attempted) ||
        new Set(s.attempted).size !== s.attempted.length ||
        s.attempted.some((id) => !Number.isInteger(id) || !households[id]) ||
        !Array.isArray(s.active) ||
        s.active.length > households.length ||
        new Set(s.active.map((a) => a.household)).size !== s.active.length ||
        new Set(s.active.map((a) => a.tree)).size !== s.active.length
      )
        return false;
      for (const a of s.active) {
        const h = households[a.household];
        if (
          !h ||
          !Number.isInteger(a.household) ||
          (h.ticket !== undefined && h.retryCareAt === undefined) ||
          h.inClinic ||
          h.routine !== 'walk' ||
          !h.pets.some((p) => p.name === a.pet && p.species === 'cat') ||
          !h.companions.includes(a.pet) ||
          !Number.isInteger(a.tree) ||
          !shelterTrees[a.tree] ||
          !['approach', 'wait', 'return'].includes(a.phase) ||
          !Number.isFinite(a.facing) ||
          ![a.anchor, a.petAnchor, a.petPosition].every(point) ||
          !route(a.petRoute) ||
          !route(a.ownerRoute) ||
          onRoad(a.petPosition) ||
          onRoad(h.position)
        )
          return false;
      }
      Object.assign(this, {
        phase: s.phase,
        remaining: s.remaining,
        wetness: s.wetness,
        attempted: new Set(s.attempted),
        active: new Map(s.active.map((a) => [a.household, a])),
      });
      return true;
    } catch {
      return false;
    }
  }
}
