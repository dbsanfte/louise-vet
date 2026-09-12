import { ClinicBuild, toClinic, type BuildStation } from './clinic-build.ts';
import { walkRoute } from './movement.ts';
import plan from './clinic-layout.json' with { type: 'json' };
import type { UpgradeId, Visit } from './game.ts';
import type { Household, VisitTicket } from './town-simulation.ts';
import {
  localToTown,
  layout,
  distance,
  clinicDesk,
  clinicHall,
  clinicDoor,
  type Point,
} from './town-map.ts';
import { ridePose, isCabinRide } from './pet-rides.ts';
import {
  enrichmentPose,
  isEnrichment,
  finishAtGround,
} from './clinic-enrichment.ts';
export { plan as clinicPlan };
export type Station = BuildStation;
export type OwnerActivity = {
  household: number;
  station: string;
  phase:
    | 'walk'
    | 'stand'
    | 'sit'
    | 'read'
    | 'game'
    | 'wait'
    | 'check-in'
    | 'desk'
    | 'ready'
    | 'escort'
    | 'in-room';
  route: Point[];
  remaining: number;
};
export type PetActivity = {
  ticket: number;
  station: string;
  phase: 'walk' | 'queue' | 'board' | 'use' | 'return' | 'rest';
  position: Point;
  facing: number;
  route: Point[];
  remaining: number;
  joined: number;
  turns: number;
  called: boolean;
  elapsed: number;
};
export const townToLocal = (p: Point): Point => ({
  x: (p.z - layout.clinic.z) / layout.clinic.scale,
  z: (layout.clinic.x - p.x) / layout.clinic.scale,
});
/** Reserved seats are reached from the open side; room trips share clear aisles. */
export function interiorRoute(from: Point, to: Point): Point[] {
  const a = townToLocal(from),
    b = townToLocal(to);
  const approach = (p: Point) => {
    const seat = plan.stations.find(
      (s) =>
        s.audience === 'owner' &&
        s.kind !== 'standing' &&
        Math.hypot(p.x - s.x, p.z - s.z) < 0.25,
    );
    if (!seat) return p;
    return seat.kind === 'game'
      ? { x: seat.x, z: seat.z + 1.05 }
      : {
          x: seat.x + Math.sin(seat.facing) * 1.05,
          z: seat.z + Math.cos(seat.facing) * 1.05,
        };
  };
  const aa = approach(a),
    bb = approach(b);
  const aisle = (p: Point) => {
    if (p.x < -11 && p.z < -3)
      return [
        { x: -11.55, z: p.z },
        { x: -11.55, z: 0 },
      ];
    if (p.x >= -11 && p.x < -5 && p.z < -4)
      return [
        { x: -8, z: p.z },
        { x: -8, z: -3.5 },
        { x: -5.7, z: -3.5 },
        { x: -5.7, z: 0 },
      ];
    if (p.z < -4)
      return [
        { x: 3.5, z: p.z },
        { x: 3.5, z: -4 },
        { x: 3.5, z: 0 },
      ];
    return [{ x: p.x, z: 0 }];
  };
  // Stay within a wing when both ends share its side aisle.
  const sameAnnex =
    a.x >= -11 && a.x < -5 && a.z < -4 && b.x >= -11 && b.x < -5 && b.z < -4;
  const samePlay = a.x < -11 && b.x < -11 && a.z < -3 && b.z < -3;
  const points = samePlay
    ? [aa, { x: -11.55, z: aa.z }, { x: -11.55, z: bb.z }, bb, b]
    : sameAnnex
      ? [aa, { x: -8, z: aa.z }, { x: -8, z: bb.z }, bb, b]
      : [aa, ...aisle(aa), ...aisle(bb).reverse(), bb, b];
  return points
    .map((p) => localToTown(p.x, p.z))
    .filter((p, i, all) => distance(i ? all[i - 1] : from, p) > 0.02);
}
const at = (s: Station) => {
  const pose = isCabinRide(s.kind)
    ? ridePose(s.kind, 0)
    : isEnrichment(s.kind)
      ? enrichmentPose(s.kind, 0, '')
      : undefined;
  return localToTown(
    s.x + (pose?.x ?? (s.kind === 'carousel' ? 0.55 : 0)),
    s.z + (pose?.z ?? (s.kind === 'scratch' ? 0.55 : 0)),
  );
};
const queueSpot = (s: Station, index: number) =>
  s.queueX !== undefined && s.queueZ !== undefined
    ? localToTown(s.queueX, s.queueZ - index * 0.45)
    : isCabinRide(s.kind)
      ? localToTown(-11.9, s.z + 0.65 - index * 0.45)
      : localToTown(
          s.x + (s.x < -14 ? 0.7 : -0.7),
          Math.sign(s.z) * (1.35 - index * 0.5),
        );
export const clinicPetRest = (
  h: Pick<Household, 'position' | 'facing'>,
  index = 0,
) => {
  const seat = plan.stations.find(
    (s) =>
      s.audience === 'owner' &&
      s.kind !== 'standing' &&
      distance(h.position, localToTown(s.x, s.z)) < 0.2,
  );
  if (seat)
    return seat.kind === 'game'
      ? localToTown(seat.x, seat.z + 1.15 + index * 0.7)
      : localToTown(seat.x, seat.z - 1.15 - index * 0.7);
  return {
    x: h.position.x + Math.cos(h.facing) * 0.42,
    z: h.position.z - Math.sin(h.facing) * 0.42,
  };
};
const advance = walkRoute;

export class ClinicLeisure {
  readonly build: ClinicBuild;
  constructor(build = new ClinicBuild()) {
    this.build = build;
  }
  private unavailable = new Set<string>();
  private movedPets = new Set<number>();
  route(from: Point, to: Point) {
    return this.build.customized
      ? this.build.route(from, to)
      : interiorRoute(from, to);
  }
  station(id: string) {
    return this.build.stations.find((s) => s.id === id);
  }
  private at(s: Station) {
    if (!this.build.customized) return at(s);
    const pose = isCabinRide(s.kind)
      ? ridePose(s.kind, 0)
      : isEnrichment(s.kind)
        ? enrichmentPose(s.kind, 0, '')
        : undefined;
    return this.build.stationPoint(s, {
      x: pose?.x ?? (s.kind === 'carousel' ? 0.55 : 0),
      z: pose?.z ?? (s.kind === 'scratch' ? 0.55 : 0),
    });
  }
  rest(h: Pick<Household, 'position' | 'facing'>, index = 0) {
    if (!this.build.customized) return clinicPetRest(h, index);
    const p = toClinic(h.position),
      s = this.build.stations.find(
        (s) => s.audience === 'owner' && Math.hypot(s.x - p.x, s.z - p.z) < 0.3,
      );
    const spot = s
      ? this.build.approach(s)
      : {
          x: p.x + Math.cos(h.facing) * (0.65 + index * 0.7),
          z: p.z - Math.sin(h.facing) * (0.65 + index * 0.7),
        };
    const safe = this.build.safe({ x: spot.x + index * 0.55, z: spot.z });
    return localToTown(safe.x, safe.z);
  }
  private queueSpot(s: Station, index: number) {
    return this.build.customized
      ? this.build.queue(s, index)
      : queueSpot(s, index);
  }
  beginMove(id: string) {
    for (const s of this.build.recipe(id).stations) this.unavailable.add(s);
  }
  endMove() {
    this.unavailable.clear();
    for (const id of this.movedPets) {
      const p = this.pets.get(id);
      if (p) p.called = false;
    }
    this.movedPets.clear();
  }
  movingReady(id: string, households: Household[]) {
    const stations = this.build.recipe(id).stations;
    for (const p of this.pets.values())
      if (stations.includes(p.station)) {
        this.movedPets.add(p.ticket);
        p.called = true;
        if (p.phase === 'use' && finishAtGround(p.station)) return false;
        const h = households.find((h) => h.ticket === p.ticket)!;
        p.station = '';
        p.phase = 'return';
        p.route = this.route(p.position, this.rest(h));
      }
    return (
      !households.some(
        (h) =>
          h.inClinic && this.build.insideItem(id, toClinic(h.position), 0.2),
      ) &&
      ![...this.pets.values()].some((p) =>
        this.build.insideItem(id, toClinic(p.position), 0.15),
      )
    );
  }
  replan(households: Household[]) {
    for (const h of households) {
      if (h.inClinic && h.routine === 'clinic-enter')
        h.route = this.route(h.position, clinicDesk);
      if (h.inClinic && h.routine === 'clinic-exit')
        h.route = [...this.route(h.position, clinicHall), { ...clinicDoor }];
      const a = this.owners.get(h.id);
      if (a && a.phase === 'walk') {
        const s = this.station(a.station);
        a.route = this.route(h.position, s ? this.at(s) : clinicDesk);
      }
    }
    for (const p of this.pets.values()) {
      const h = households.find((h) => h.ticket === p.ticket);
      if (!h) continue;
      if (p.phase === 'return') p.route = this.route(p.position, this.rest(h));
      else if (p.phase === 'walk') {
        const s = this.station(p.station);
        if (s) p.route = this.route(p.position, this.queueSpot(s, 0));
      }
    }
  }
  readonly owners = new Map<number, OwnerActivity>();
  readonly pets = new Map<number, PetActivity>();
  private owned: UpgradeId[] = [];
  private serial = 0;
  configure(owned: UpgradeId[]) {
    this.owned = [...owned];
    this.build.syncOwned(owned);
  }
  available(s: Station | undefined) {
    return Boolean(
      s &&
      !this.unavailable.has(s.id) &&
      (!s.upgrade || this.owned.includes(s.upgrade as UpgradeId)),
    );
  }
  stations(audience: 'owner' | 'pet') {
    return this.build.stations.filter(
      (s) => s.audience === audience && this.available(s),
    );
  }
  snapshot() {
    return {
      version: 1,
      serial: this.serial,
      owners: [...this.owners.values()].map((a) => ({
        ...a,
        route: a.route.map((p) => ({ ...p })),
      })),
      pets: [...this.pets.values()].map((p) => ({
        ...p,
        position: { ...p.position },
        route: p.route.map((p) => ({ ...p })),
      })),
    };
  }
  restore(
    value: unknown,
    households: Pick<Household, 'inClinic'>[],
    tickets: Map<number, VisitTicket>,
  ) {
    const definitions = this.build.customized
      ? this.build.stations
      : [...this.build.stations, ...plan.stations];
    if (value === undefined) {
      this.owners.clear();
      this.pets.clear();
      return true;
    }
    try {
      const s = value as ReturnType<ClinicLeisure['snapshot']>;
      const num = (n: number, max = 1e9) =>
        Number.isFinite(n) && n >= 0 && n <= max;
      const point = (p: Point) =>
        p &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.z) &&
        p.x >= -36 &&
        p.x <= 18 &&
        p.z >= -26 &&
        p.z <= -2;
      const route = (r: Point[]) =>
        Array.isArray(r) && r.length <= 512 && r.every(point);
      if (
        s.version !== 1 ||
        !num(s.serial) ||
        !Array.isArray(s.owners) ||
        !Array.isArray(s.pets) ||
        s.owners.length > 18 ||
        s.pets.length > 18
      )
        return false;
      if (
        new Set(s.owners.map((a) => a.household)).size !== s.owners.length ||
        new Set(s.pets.map((p) => p.ticket)).size !== s.pets.length ||
        new Set(s.owners.map((a) => a.station)).size !== s.owners.length
      )
        return false;
      for (const a of s.owners)
        if (
          !households[a.household]?.inClinic ||
          !definitions.some(
            (st) => st.audience === 'owner' && st.id === a.station,
          ) ||
          ![
            'walk',
            'sit',
            'stand',
            'read',
            'game',
            'wait',
            'check-in',
            'desk',
            'ready',
            'escort',
            'in-room',
          ].includes(a.phase) ||
          !route(a.route) ||
          !num(a.remaining, 120)
        )
          return false;
      for (const p of s.pets)
        if (
          tickets.get(p.ticket)?.status !== 'waiting' ||
          !['walk', 'queue', 'board', 'use', 'return', 'rest'].includes(
            p.phase,
          ) ||
          ['walk', 'queue', 'board', 'use'].includes(p.phase) !==
            Boolean(p.station) ||
          !point(p.position) ||
          !route(p.route) ||
          !num(p.remaining, 120) ||
          !num(p.elapsed, 60) ||
          !num(p.joined) ||
          !num(p.turns) ||
          typeof p.called !== 'boolean' ||
          !Number.isFinite(p.facing) ||
          (p.station !== '' &&
            !definitions.some(
              (st) => st.audience === 'pet' && st.id === p.station,
            ))
        )
          return false;
      for (const station of definitions.filter((st) => st.audience === 'pet')) {
        const line = s.pets.filter((p) => p.station === station.id);
        if (
          line.filter((p) => ['board', 'use'].includes(p.phase)).length > 1 ||
          line.filter((p) => ['walk', 'queue'].includes(p.phase)).length > 3
        )
          return false;
      }
      this.owners.clear();
      this.pets.clear();
      this.serial = s.serial;
      s.owners.forEach((a) =>
        this.owners.set(a.household, {
          ...a,
          route: a.route.map((p) => ({ ...p })),
        }),
      );
      s.pets.forEach((p) =>
        this.pets.set(p.ticket, {
          ...p,
          called: false,
          position: { ...p.position },
          route: p.route.map((p) => ({ ...p })),
        }),
      );
      // The enlarged garden moves these two smaller stations away from the
      // pavement. Old saves retain their turn, at the station's current spot.
      for (const p of this.pets.values()) {
        if (this.build.customized || !['wheel', 'toys'].includes(p.station))
          continue;
        const station = definitions.find((s) => s.id === p.station)!;
        if (p.phase === 'use') p.position = this.at(station);
        if (p.phase === 'board') p.route = [this.at(station)];
      }
      for (const [id, a] of this.owners)
        if (['wait', 'desk', 'ready', 'escort', 'in-room'].includes(a.phase))
          this.owners.delete(id);
      return true;
    } catch {
      return false;
    }
  }
  checkIn(h: Household) {
    this.chooseOwner(h);
    const a = this.owners.get(h.id);
    if (a) {
      a.phase = 'check-in';
      a.remaining = 1.5;
    }
  }
  recall(id: number, h: Household) {
    let a = this.owners.get(h.id);
    if (!a) {
      this.chooseOwner(h);
      a = this.owners.get(h.id);
    }
    if (!a || a.phase === 'check-in') return false;
    if (a.phase === 'ready') {
      this.pets.delete(id);
      return true;
    }
    if (a.phase === 'desk') return false;
    const p = this.pets.get(id);
    if (
      p &&
      (!['rest'].includes(p.phase) || distance(p.position, this.rest(h)) > 0.08)
    ) {
      if (!p.called) {
        p.called = true;
        // A raised cabin finishes its gentle lap before returning to the owner.
        if (!(p.phase === 'use' && finishAtGround(p.station))) {
          p.station = '';
          p.phase = 'return';
          p.route = this.route(p.position, this.rest(h));
        }
      }
      a.phase = 'wait';
      a.route = [];
      return false;
    }
    if (p) p.called = true;
    a.phase = 'desk';
    a.route = this.route(h.position, clinicDesk);
    if (distance(h.position, clinicDesk) < 0.08) {
      a.phase = 'ready';
      a.route = [];
      this.pets.delete(id);
      return true;
    }
    return false;
  }
  cancelRecall(id: number, households: Household[]) {
    const p = this.pets.get(id);
    if (p) p.called = false;
    const h = households.find((h) => h.ticket === id);
    if (
      h &&
      ['wait', 'desk', 'ready', 'escort', 'in-room'].includes(
        this.owners.get(h.id)?.phase ?? '',
      )
    )
      this.owners.delete(h.id);
  }
  release(h: Household) {
    this.owners.delete(h.id);
    if (h.ticket !== undefined) this.pets.delete(h.ticket);
  }
  canPlay(visit: Visit) {
    return (
      visit.species !== 'goldfish' &&
      !visit.clinical?.fracture &&
      !visit.clinical?.fever &&
      visit.clinical?.skin !== 'burn'
    );
  }
  private chooseOwner(h: Household) {
    const current = this.owners.get(h.id);
    const occupied = new Set(
      [...this.owners.values()]
        .filter((a) => a.household !== h.id)
        .map((a) => a.station),
    );
    const free = this.stations('owner').filter((s) => !occupied.has(s.id));
    const seats = free.filter((s) => s.kind !== 'standing');
    const choices = seats.length ? seats : free;
    const candidates = choices.filter((s) => s.id !== current?.station);
    const station = (candidates.length ? candidates : choices)[
      (h.id + this.serial++) %
        Math.max(1, (candidates.length ? candidates : choices).length)
    ];
    if (!station) return;
    this.owners.set(h.id, {
      household: h.id,
      station: station.id,
      phase: 'walk',
      route: this.route(h.position, this.at(station)),
      remaining: 12 + (h.id % 4) * 3,
    });
  }
  update(
    dt: number,
    households: Household[],
    tickets: Map<number, VisitTicket>,
    visitFor: (id: number) => Visit,
  ) {
    for (const [id, a] of this.owners) {
      const h = households[id];
      if (
        !h?.inClinic ||
        h.routine !== 'clinic-wait' ||
        !this.available(this.build.stations.find((s) => s.id === a.station)!)
      )
        this.owners.delete(id);
    }
    for (const [id] of this.pets) {
      const h = households.find((h) => h.ticket === id);
      if (
        !h?.inClinic ||
        h.routine !== 'clinic-wait' ||
        tickets.get(id)?.status !== 'waiting'
      )
        this.pets.delete(id);
    }
    for (const h of households) {
      if (!h.inClinic || h.routine !== 'clinic-wait') continue;
      if (!this.owners.has(h.id)) this.chooseOwner(h);
      let a = this.owners.get(h.id);
      if (a) {
        if (a.phase === 'check-in') {
          a.remaining = Math.max(0, a.remaining - dt);
          if (!a.remaining) a.phase = 'walk';
        } else if (a.phase === 'desk') {
          h.facing = advance(h.position, a.route, dt, 1.15) ?? h.facing;
          if (!a.route.length) {
            a.phase = 'ready';
            h.facing = Math.PI + layout.clinic.rotation;
          }
        } else if (a.phase === 'walk') {
          h.facing = advance(h.position, a.route, dt, 1.15) ?? h.facing;
          if (!a.route.length) {
            const station = this.build.stations.find(
              (s) => s.id === a!.station,
            )!;
            h.facing = station.facing + layout.clinic.rotation;
            a.phase =
              station.kind === 'standing'
                ? 'stand'
                : station.kind === 'game'
                  ? 'game'
                  : Boolean(this.build.placement('books'))
                    ? 'read'
                    : 'sit';
          }
        } else if (['sit', 'read', 'stand'].includes(a.phase)) {
          const station = this.build.stations.find((s) => s.id === a!.station)!;
          if (station.kind === 'standing') {
            const taken = new Set(
              [...this.owners.values()].map((o) => o.station),
            );
            if (
              this.stations('owner').some(
                (s) => s.kind !== 'standing' && !taken.has(s.id),
              )
            )
              this.chooseOwner(h);
          } else {
            h.facing = station.facing + layout.clinic.rotation;
            a.phase = Boolean(this.build.placement('books')) ? 'read' : 'sit';
          }
        }
      }
      const id = h.ticket!;
      if (tickets.get(id)?.status !== 'waiting') continue;
      let p = this.pets.get(id);
      if (
        p?.station &&
        (!this.station(p.station) ||
          (!this.available(this.station(p.station)) &&
            !(p.phase === 'use' && finishAtGround(p.station))))
      ) {
        p.station = '';
        p.phase = 'return';
        p.route = this.route(p.position, this.rest(h));
      }
      if (!p) {
        p = {
          ticket: id,
          station: '',
          phase: 'rest',
          position: this.rest(h),
          facing: h.facing,
          route: [],
          remaining: 3 + (h.id % 4),
          joined: 0,
          turns: 0,
          called: false,
          elapsed: 0,
        };
        this.pets.set(id, p);
      }
      if (a && ['desk', 'ready', 'escort', 'in-room'].includes(a.phase)) {
        p.facing = advance(p.position, [this.rest(h)], dt, 1.6) ?? h.facing;
        p.phase = 'rest';
        p.route = [];
        p.called = true;
        continue;
      }
      if (['walk', 'board', 'return'].includes(p.phase)) {
        p.facing = advance(p.position, p.route, dt, 1.6) ?? p.facing;
        if (!p.route.length) {
          if (p.phase === 'walk') p.phase = 'queue';
          else if (p.phase === 'board') {
            p.phase = 'use';
            p.elapsed = 0;
            p.remaining = this.build.stations.find(
              (s) => s.id === p!.station,
            )!.seconds!;
          } else {
            p.phase = 'rest';
            p.remaining = 7;
          }
        }
      } else if (p.phase === 'use') {
        p.remaining = Math.max(0, p.remaining - dt);
        p.elapsed += dt;
        const station = this.build.stations.find((s) => s.id === p!.station)!;
        if (station.kind === 'carousel') {
          const angle = p.elapsed * 0.65;
          Object.assign(
            p.position,
            this.build.stationPoint(station, {
              x: Math.cos(angle) * 0.55,
              z: Math.sin(angle) * 0.55,
            }),
          );
          p.facing =
            -angle +
            Math.PI / 2 +
            layout.clinic.rotation +
            this.build.stationRotation(station);
        }
        if (isCabinRide(station.kind)) {
          const pose = ridePose(station.kind, p.elapsed);
          Object.assign(
            p.position,
            this.build.stationPoint(station, { x: pose.x, z: pose.z }),
          );
          p.facing =
            pose.facing +
            layout.clinic.rotation +
            this.build.stationRotation(station);
        }
        if (isEnrichment(station.kind)) {
          const pose = enrichmentPose(
            station.kind,
            p.elapsed,
            visitFor(id).species,
          );
          Object.assign(
            p.position,
            this.build.stationPoint(station, { x: pose.x, z: pose.z }),
          );
          p.facing =
            pose.facing +
            layout.clinic.rotation +
            this.build.stationRotation(station);
        }
        if (!p.remaining) {
          p.turns++;
          p.station = '';
          p.phase = 'return';
          p.route = this.route(p.position, this.rest(h));
        }
      } else if (p.phase === 'rest') {
        const target = this.rest(h);
        if (distance(p.position, target) > 0.5) {
          p.phase = 'return';
          p.route = this.route(p.position, target);
          continue;
        }
        if (distance(p.position, target) > 0.05)
          p.facing = advance(p.position, [target], dt, 1.6) ?? p.facing;
        p.remaining = Math.max(0, p.remaining - dt);
        if (!p.called && !p.remaining && this.canPlay(visitFor(id))) {
          const choices = this.stations('pet').filter(
            (s) =>
              s.species?.includes(visitFor(id).species) &&
              [...this.pets.values()].filter(
                (other) =>
                  other.station === s.id &&
                  ['walk', 'queue'].includes(other.phase),
              ).length < 3,
          );
          const station =
            choices[(h.id + p.turns) % Math.max(1, choices.length)];
          if (station) {
            p.station = station.id;
            p.joined = this.serial++;
            p.phase = 'walk';
            const line = [...this.pets.values()].filter(
              (other) => other !== p && other.station === station.id,
            ).length;
            const q = this.queueSpot(station, Math.min(line, 2));
            p.route = this.route(p.position, q);
          }
        }
      }
    }
    for (const station of this.stations('pet')) {
      const line = [...this.pets.values()]
        .filter((p) => p.station === station.id)
        .sort((a, b) => a.joined - b.joined);
      line
        .filter((p) => ['walk', 'queue'].includes(p.phase))
        .forEach((p, index) => {
          const spot = this.queueSpot(station, index);
          if (
            p.phase === 'walk' &&
            p.route.length &&
            distance(p.route.at(-1)!, spot) > 0.05
          )
            p.route = this.route(p.position, spot);
          if (p.phase === 'queue' && distance(p.position, spot) > 0.05) {
            p.phase = 'walk';
            p.route = this.route(p.position, spot);
          }
        });
      if (line.some((p) => ['use', 'board'].includes(p.phase))) continue;
      const first = line[0];
      if (first?.phase === 'queue') {
        first.phase = 'board';
        first.route = [this.at(station)];
        first.facing = station.facing + layout.clinic.rotation;
      }
    }
  }
  summary() {
    return this.stations('pet').map((s) => {
      const all = [...this.pets.values()].filter((p) => p.station === s.id);
      return {
        id: s.id,
        using: all.find((p) => ['use', 'board'].includes(p.phase))?.ticket,
        queued: all.filter((p) => ['walk', 'queue'].includes(p.phase)).length,
      };
    });
  }
}
