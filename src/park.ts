import plan from './park-layout.json' with { type: 'json' };
import type { Household } from './town-simulation.ts';
import type { Species } from './game.ts';
import { distance, type Point } from './town-map.ts';
import { walkRoute } from './movement.ts';
export const parkPlan = plan;
export function parkSeat(id: number) {
  const bench = plan.benches[Math.floor(id / 2) % plan.benches.length];
  const offset = id % 2 ? 0.44 : -0.44;
  return {
    x: bench.x + Math.cos(bench.facing) * offset,
    z: bench.z - Math.sin(bench.facing) * offset,
    facing: bench.facing,
  };
}
function front(p: Point, facing: number, d = 0.85) {
  return { x: p.x + Math.sin(facing) * d, z: p.z + Math.cos(facing) * d };
}
/** Every route stays on the dry side of the pond and approaches benches from the front. */
export function parkRoute(from: Point, to: Point): Point[] {
  const startZ = Math.max(-14, Math.min(-6, from.z)),
    endZ = Math.max(-14, Math.min(-6, to.z));
  if (from.x < 18 && to.x < 18)
    return [{ x: 17.45, z: startZ }, { x: 17.45, z: endZ }, { ...to }];
  const route: Point[] = [];
  if (from.x < 18) {
    const row = startZ < -10 ? -14 : -6;
    route.push(
      { x: 17.45, z: startZ },
      { x: 17.45, z: row },
      { x: 22, z: row },
    );
  } else route.push({ x: 22, z: startZ });
  if (to.x < 18) {
    const row = endZ < -10 ? -14 : -6;
    route.push({ x: 22, z: row }, { x: 17.45, z: row }, { x: 17.45, z: endZ });
  } else route.push({ x: 22, z: endZ });
  return [...route, { ...to }];
}
export interface ParkPet {
  name: string;
  species: Species;
  position: Point;
  facing: number;
  phase: 'rest' | 'walk' | 'use' | 'return';
  route: Point[];
  station?: string;
  elapsed: number;
  turns: number;
}
export interface ParkVisit {
  owner: number;
  seated: boolean;
  leaving: boolean;
  exiting: boolean;
  route: Point[];
  pets: ParkPet[];
}
export function parkRest(id: number, index: number) {
  const seat = parkSeat(id),
    center = front(seat, seat.facing, 0.8);
  return {
    x: center.x + Math.cos(seat.facing) * (index - 0.5) * 0.42,
    z: center.z - Math.sin(seat.facing) * (index - 0.5) * 0.42,
  };
}
export class Park {
  readonly visits = new Map<number, ParkVisit>();
  enter(h: Household) {
    if (this.visits.has(h.id)) return;
    const seat = parkSeat(h.id),
      approach = front(seat, seat.facing);
    this.visits.set(h.id, {
      owner: h.id,
      seated: false,
      leaving: false,
      exiting: false,
      route: [...parkRoute(h.position, approach), { x: seat.x, z: seat.z }],
      pets: h.pets
        .filter((p) => h.companions.includes(p.name))
        .map((p, i) => ({
          name: p.name,
          species: p.species,
          position: { ...h.position },
          facing: h.facing,
          phase: 'rest',
          route: [],
          elapsed: i * 2,
          turns: 0,
        })),
    });
  }
  recall(id: number) {
    const v = this.visits.get(id);
    if (!v || v.leaving) return;
    v.leaving = true;
    v.pets.forEach((p, i) => {
      const pose = parkPetPose(p);
      p.position = { x: pose.x, z: pose.z };
      p.station = undefined;
      p.phase = 'return';
      p.route = parkRoute(p.position, parkRest(id, i));
    });
  }
  chatting(id: number, time: number) {
    const v = this.visits.get(id),
      other = this.visits.get(id % 2 ? id - 1 : id + 1);
    return Boolean(
      v?.seated &&
      !v.leaving &&
      other?.seated &&
      !other.leaving &&
      (time + Math.floor(id / 2) * 1.7) % 10 < 5,
    );
  }
  status(id: number) {
    const v = this.visits.get(id);
    if (!v) return 'Enjoying the park';
    if (v.leaving) return 'Gathering pets to leave the park';
    if (!v.seated) return 'Finding a park bench';
    const active = v.pets.find((p) => p.station);
    return active
      ? `Relaxing while ${active.name} enjoys the ${plan.stations.find((s) => s.id === active.station)!.label}`
      : 'Resting beside the duck pond';
  }
  update(dt: number, households: Household[]) {
    const occupied = new Set(
      [...this.visits.values()].flatMap((v) =>
        v.pets.flatMap((p) => (p.station ? [p.station] : [])),
      ),
    );
    for (const v of this.visits.values()) {
      const h = households[v.owner],
        seat = parkSeat(v.owner);
      if (v.exiting) {
        h.facing = walkRoute(h.position, v.route, dt, 1.35) ?? h.facing;
        for (const [i, p] of v.pets.entries()) {
          const target = front(h.position, h.facing, -0.35 - i * 0.28);
          walkRoute(p.position, [target], dt, 1.6);
          p.facing = h.facing;
        }
        if (!v.route.length) this.visits.delete(v.owner);
        continue;
      }
      if (!v.seated) {
        h.facing = walkRoute(h.position, v.route, dt, 1.35) ?? h.facing;
        if (!v.route.length) {
          v.seated = true;
          h.facing = seat.facing;
        }
      }
      for (const [i, p] of v.pets.entries()) {
        if (!v.seated && !v.leaving) {
          // Each companion follows into its own resting place as the owner sits.
          const target = front(h.position, h.facing, -0.5 - i * 0.28);
          walkRoute(p.position, [target], dt, 1.6);
          p.facing = h.facing;
          continue;
        }
        if (p.phase === 'walk' || p.phase === 'return') {
          p.facing = walkRoute(p.position, p.route, dt, 1.25) ?? p.facing;
          if (!p.route.length) {
            p.phase = p.station ? 'use' : 'rest';
            p.elapsed = 0;
          }
          continue;
        }
        p.elapsed += dt;
        if (p.phase === 'use' && p.elapsed >= 9) {
          const pose = parkPetPose(p);
          p.position = { x: pose.x, z: pose.z };
          occupied.delete(p.station!);
          p.station = undefined;
          p.phase = 'return';
          p.turns++;
          p.route = parkRoute(p.position, parkRest(h.id, i));
          continue;
        }
        if (p.phase === 'rest' && !v.leaving) {
          const resting = parkRest(h.id, i);
          if (distance(p.position, resting) > 0.03) {
            p.facing = walkRoute(p.position, [resting], dt, 1.25) ?? p.facing;
            continue;
          }
          if (p.elapsed < 4 + i * 1.2 || p.species === 'goldfish') continue;
          const choices = plan.stations.filter((s) =>
            s.species.includes(p.species),
          );
          const ordered = choices.map(
            (_, n) => choices[(n + p.turns) % choices.length],
          );
          const station = ordered.find((s) => !occupied.has(s.id));
          if (station) {
            occupied.add(station.id);
            p.station = station.id;
            p.phase = 'walk';
            p.route = parkRoute(p.position, station);
            p.elapsed = 0;
          }
        }
      }
      if (v.leaving && v.seated && v.pets.every((p) => p.phase === 'rest')) {
        v.seated = false;
        v.exiting = true;
        v.route = [
          front(seat, seat.facing),
          ...parkRoute(h.position, plan.entrance),
        ];
        // The next stage walks out as a family, with no new activity allocation.
        for (const p of v.pets) p.phase = 'return';
      }
    }
  }
  snapshot() {
    return structuredClone([...this.visits.values()]);
  }
  restore(
    value: unknown,
    households: Pick<Household, 'id' | 'pets' | 'companions' | 'routine'>[],
  ) {
    if (value === undefined) return true;
    if (!Array.isArray(value) || value.length > households.length) return false;
    const inside = (p: Point) =>
      p &&
      Number.isFinite(p.x) &&
      Number.isFinite(p.z) &&
      p.x >= 15.5 &&
      p.x <= 27.5 &&
      p.z >= -16 &&
      p.z <= -4;
    const route = (r: Point[]) =>
      Array.isArray(r) && r.length <= 8 && r.every(inside);
    const occupied = new Set<string>(),
      owners = new Set<number>();
    for (const v of value as ParkVisit[]) {
      const h = households[v.owner];
      if (
        !Number.isInteger(v.owner) ||
        v.owner < 0 ||
        !h ||
        (v.exiting && (!v.leaving || v.seated)) ||
        owners.has(v.owner) ||
        !['park', 'clinic-gather'].includes(h.routine) ||
        typeof v.seated !== 'boolean' ||
        typeof v.leaving !== 'boolean' ||
        typeof v.exiting !== 'boolean' ||
        !route(v.route) ||
        !Array.isArray(v.pets) ||
        v.pets.length !== h.companions.length
      )
        return false;
      owners.add(v.owner);
      const names = new Set<string>();
      for (const p of v.pets) {
        const pet = h.pets.find((a) => a.name === p.name),
          station = plan.stations.find((s) => s.id === p.station);
        if (
          !pet ||
          pet.species !== p.species ||
          !h.companions.includes(p.name) ||
          names.has(p.name) ||
          !inside(p.position) ||
          !route(p.route) ||
          !Number.isFinite(p.facing) ||
          !Number.isFinite(p.elapsed) ||
          p.elapsed < 0 ||
          p.elapsed > 10000 ||
          !Number.isInteger(p.turns) ||
          p.turns < 0 ||
          !['rest', 'walk', 'use', 'return'].includes(p.phase)
        )
          return false;
        if (
          p.station &&
          (!station ||
            !station.species.includes(p.species) ||
            occupied.has(p.station) ||
            !['walk', 'use'].includes(p.phase))
        )
          return false;
        if (['walk', 'use'].includes(p.phase) && !station) return false;
        names.add(p.name);
        if (p.station) occupied.add(p.station);
      }
    }
    for (const v of value) this.visits.set(v.owner, structuredClone(v));
    return true;
  }
}
/** Visible movement agrees with the station's geometry. Position stays on the reserved lane. */
export function parkPetPose(p: ParkPet) {
  const out = {
    ...p.position,
    y: 0.2,
    facing: p.facing,
    motion: (p.phase === 'walk' || p.phase === 'return' ? 'Walk' : 'Idle') as
      'Walk' | 'Idle' | 'Play',
    tilt: 0,
  };
  if (p.phase !== 'use') return out;
  const t = p.elapsed,
    s = plan.stations.find((s) => s.id === p.station)!;
  out.motion = 'Play';
  if (s.id === 'fetch' || s.id === 'agility' || s.id === 'tunnel') {
    const offset = Math.sin(t * 1.4) * 0.8;
    out.x = s.x + offset;
    out.facing = Math.cos(t * 1.4) > 0 ? Math.PI / 2 : -Math.PI / 2;
    out.motion = 'Walk';
    if (s.id === 'agility')
      out.y += Math.max(0, 1 - Math.abs(offset) / 0.38) * 0.22;
  } else if (s.id === 'scratch') {
    out.y = 0.38;
    out.tilt = -0.45;
    out.facing = 0;
  } else if (s.id === 'perch') {
    out.y = 0.76;
    out.motion = 'Play';
  } else {
    out.x = s.x + Math.sin(t * 1.5) * 0.42;
    out.y += Math.max(0, Math.sin(t * 3)) * 0.18;
  }
  return out;
}
