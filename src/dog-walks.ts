import clinicPlan from './clinic-layout.json' with { type: 'json' };
import { layout } from './town-map.ts';
import { distance, onRoad, type Point } from './town-map.ts';
import { walkRoute } from './movement.ts';
import streetDetails from './street-details.json' with { type: 'json' };
import type { Household } from './town-simulation.ts';
export { streetDetails };
export const outsideClinic = (p: Point) => {
  if (p.x > -30 && p.x < -12 && p.z > -21 && p.z < -2.5) return false;
  const x = (p.z - layout.clinic.z) / layout.clinic.scale,
    z = (layout.clinic.x - p.x) / layout.clinic.scale;
  return !clinicPlan.rooms.some(
    (r) =>
      x >= r.x - r.width / 2 &&
      x <= r.x + r.width / 2 &&
      z >= r.z - r.depth / 2 &&
      z <= r.z + r.depth / 2,
  );
};
export interface DogBreak {
  household: number;
  pet: string;
  kind: 'poo' | 'sniff' | 'wee';
  phase: 'approach' | 'sniff' | 'toilet' | 'collect' | 'return';
  elapsed: number;
  anchor: Point;
  spot: Point;
  petPosition: Point;
  petAnchor: Point;
  petRoute: Point[];
  ownerRoute: Point[];
  facing: number;
  litter: boolean;
  site?: string;
}
/** Small outdoor pauses own the family only until everyone is ready to walk on. */
export class DogWalks {
  active = new Map<number, DogBreak>();
  due = new Map<number, number>();
  locked(id: number) {
    return this.active.has(id);
  }
  status(id: number) {
    const b = this.active.get(id);
    if (!b) return null;
    return b.phase === 'collect'
      ? `Picking up after ${b.pet}`
      : b.phase === 'return'
        ? 'Ready to carry on walking'
        : b.kind === 'poo' || (b.kind === 'wee' && b.phase === 'toilet')
          ? `${b.pet} is taking a toilet break`
          : `${b.pet} is sniffing a ${b.site?.startsWith('hydrant') ? 'fire hydrant' : 'lamppost'}`;
  }
  start(
    h: Household,
    pet: string,
    kind: DogBreak['kind'],
    spot: Point,
    site?: string,
  ) {
    const dog = h.pets.find((p) => p.name === pet);
    if (
      this.locked(h.id) ||
      h.inClinic ||
      h.ticket !== undefined ||
      h.routine !== 'walk' ||
      !h.companions.includes(pet) ||
      dog?.species !== 'dog' ||
      (kind === 'wee' && dog.sex !== 'male') ||
      onRoad(h.position) ||
      onRoad(spot) ||
      distance(h.position, spot) > 2 ||
      [...this.active.values()].some(
        (b) => (site && b.site === site) || distance(b.spot, spot) < 1,
      ) ||
      !outsideClinic(h.position) ||
      !outsideClinic(spot)
    )
      return false;
    if (
      kind !== 'poo' &&
      !streetDetails.some((s) => s.id === site && distance(s, spot) < 1)
    )
      return false;
    const start = {
      x: h.position.x - Math.sin(h.facing) * 0.5,
      z: h.position.z - Math.cos(h.facing) * 0.5,
    };
    // A crossing may have just finished: keep the whole short detour on land.
    const safeSegment = (a: Point, b: Point) =>
      Array.from({ length: 9 }, (_, i) => ({
        x: a.x + ((b.x - a.x) * i) / 8,
        z: a.z + ((b.z - a.z) * i) / 8,
      })).every((p) => !onRoad(p) && outsideClinic(p));
    if (!safeSegment(start, spot) || !safeSegment(h.position, spot))
      return false;
    this.active.set(h.id, {
      household: h.id,
      pet,
      kind,
      phase: 'approach',
      elapsed: 0,
      anchor: { ...h.position },
      spot: { ...spot },
      petPosition: { ...start },
      petAnchor: { ...start },
      petRoute: [{ ...spot }],
      ownerRoute: [],
      facing: h.facing,
      litter: false,
      site,
    });
    return true;
  }
  update(
    dt: number,
    time: number,
    households: Household[],
    random: () => number,
    blocked: (id: number) => boolean,
  ) {
    for (const h of households) {
      let b = this.active.get(h.id);
      if (!b) {
        if (
          blocked(h.id) ||
          h.inClinic ||
          h.ticket !== undefined ||
          h.routine !== 'walk' ||
          onRoad(h.position) ||
          !outsideClinic(h.position) ||
          time < (this.due.get(h.id) ?? 15 + h.id * 3)
        )
          continue;
        const dogs = h.pets.filter(
          (p) => p.species === 'dog' && h.companions.includes(p.name),
        );
        if (!dogs.length) continue;
        const site = streetDetails.find(
          (s) =>
            distance(s, h.position) < 1.8 &&
            ![...this.active.values()].some((b) => b.site === s.id),
        );
        // Passing an interesting smell invites a stop; ordinary toilet breaks are rarer.
        if (random() >= dt * (site ? 1.1 : 0.035)) continue;
        const dog = dogs[Math.floor(random() * dogs.length)];
        const poo = !site || random() < 0.15;
        if (!poo && !site) continue;
        let spot = {
          x: h.position.x + Math.sin(h.facing) * 0.45,
          z: h.position.z + Math.cos(h.facing) * 0.45,
        };
        if (site) {
          const d = Math.max(0.01, distance(site, h.position));
          spot = {
            x: site.x + ((h.position.x - site.x) / d) * 0.45,
            z: site.z + ((h.position.z - site.z) / d) * 0.45,
          };
        }
        if (
          this.start(
            h,
            dog.name,
            poo
              ? 'poo'
              : dog.sex === 'male' && random() < 0.35
                ? 'wee'
                : 'sniff',
            spot,
            site?.id,
          )
        )
          this.due.set(h.id, time + 45 + random() * 45);
        continue;
      }
      b.elapsed += dt;
      b.facing = walkRoute(b.petPosition, b.petRoute, dt, 1.5) ?? b.facing;
      if (b.ownerRoute.length)
        h.facing = walkRoute(h.position, b.ownerRoute, dt, 1.5) ?? h.facing;
      const phase = (p: DogBreak['phase']) => {
        b!.phase = p;
        b!.elapsed = 0;
      };
      if (b.phase === 'approach' && !b.petRoute.length) {
        phase('sniff');
        const site = streetDetails.find((s) => s.id === b.site);
        if (site) b.facing = Math.atan2(site.x - b.spot.x, site.z - b.spot.z);
      } else if (b.phase === 'sniff' && b.elapsed > 1.7) {
        if (b.kind === 'sniff') phase('return');
        else {
          phase('toilet');
          if (b.kind === 'wee') b.facing -= Math.PI / 2;
        }
      } else if (b.phase === 'toilet') {
        if (b.kind === 'poo' && b.elapsed > 0.8) b.litter = true;
        if (b.elapsed > 2.4) {
          if (b.kind === 'poo') {
            phase('collect');
            const d = distance(b.anchor, b.spot);
            const offset = Math.min(1, 0.65 / Math.max(0.01, d));
            b.ownerRoute = [
              {
                x: b.spot.x + (b.anchor.x - b.spot.x) * offset,
                z: b.spot.z + (b.anchor.z - b.spot.z) * offset,
              },
            ];
          } else phase('return');
        }
      } else if (b.phase === 'collect') {
        if (!b.ownerRoute.length)
          h.facing = Math.atan2(
            b.spot.x - h.position.x,
            b.spot.z - h.position.z,
          );
        if (b.ownerRoute.length) b.elapsed = 0;
        else if (b.elapsed > 1.4) {
          b.litter = false;
          phase('return');
        }
      }
      if (b.phase === 'return') {
        if (b.elapsed === 0) {
          b.ownerRoute = [{ ...b.anchor }];
          b.petRoute = [{ ...b.petAnchor }];
        }
        if (!b.ownerRoute.length && !b.petRoute.length && b.elapsed > 0.4) {
          this.active.delete(h.id);
          this.due.set(h.id, time + 45 + random() * 45);
        }
      }
    }
  }
  snapshot() {
    return structuredClone({
      active: [...this.active.values()],
      due: [...this.due.entries()],
    });
  }
  restore(value: unknown, households: Household[]) {
    if (value === undefined) return true;
    try {
      const s = structuredClone(value) as ReturnType<DogWalks['snapshot']>;
      const point = (p: Point) =>
        p &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.z) &&
        Math.abs(p.x) < 80 &&
        Math.abs(p.z) < 80;
      if (
        !Array.isArray(s.active) ||
        s.active.length > households.length ||
        !Array.isArray(s.due) ||
        s.due.length > households.length ||
        new Set(s.active.map((b) => b.household)).size !== s.active.length ||
        new Set(s.due.map((d) => d[0])).size !== s.due.length
      )
        return false;
      for (const [id, time] of s.due)
        if (
          !Number.isInteger(id) ||
          !households[id] ||
          !Number.isFinite(time) ||
          time < 0
        )
          return false;
      for (const b of s.active) {
        const h = households[b.household],
          dog = h?.pets.find((p) => p.name === b.pet);
        if (
          !h ||
          h.inClinic ||
          h.ticket !== undefined ||
          h.routine !== 'walk' ||
          !h.companions.includes(b.pet) ||
          dog?.species !== 'dog' ||
          !['poo', 'wee', 'sniff'].includes(b.kind) ||
          (b.kind === 'wee' && dog.sex !== 'male') ||
          !['approach', 'sniff', 'toilet', 'collect', 'return'].includes(
            b.phase,
          ) ||
          !Number.isFinite(b.elapsed) ||
          b.elapsed < 0 ||
          !Number.isFinite(b.facing) ||
          typeof b.litter !== 'boolean' ||
          (b.litter && b.kind !== 'poo') ||
          ![b.anchor, b.spot, b.petPosition, b.petAnchor].every(point) ||
          distance(b.anchor, b.spot) > 2 ||
          ![h.position, b.anchor, b.spot].every(
            (p) => outsideClinic(p) && !onRoad(p),
          ) ||
          ![b.petRoute, b.ownerRoute].every(
            (r) =>
              Array.isArray(r) &&
              r.length < 4 &&
              r.every((p) => point(p) && distance(p, b.anchor) < 3),
          ) ||
          (b.kind !== 'poo' &&
            !streetDetails.some(
              (s) => s.id === b.site && distance(s, b.spot) < 1,
            ))
        )
          return false;
      }
      this.active = new Map(s.active.map((b) => [b.household, b]));
      this.due = new Map(s.due);
      return true;
    } catch {
      return false;
    }
  }
}
