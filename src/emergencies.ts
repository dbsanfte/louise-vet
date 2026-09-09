import {
  distance,
  garden,
  layout,
  routeBetween,
  onRoad,
  type Point,
} from './town-map.ts';
import { walkRoute } from './movement.ts';
import {
  stations,
  rescueTrees,
  nearestTree,
  rescuePerch,
  emergencyDrive,
} from './emergency-map.ts';
import type {
  Household,
  Car,
  RoadIncident,
  VisitTicket,
} from './town-simulation.ts';
import type { VisitReason } from './game.ts';
export type RescueKind = 'lost' | 'fire' | 'road';
export type RescuePhase =
  | 'wander'
  | 'report'
  | 'search'
  | 'dispatch'
  | 'unload'
  | 'ladder'
  | 'climb'
  | 'rescue'
  | 'descend'
  | 'extinguish'
  | 'enter-house'
  | 'exit-house'
  | 'handover'
  | 'return'
  | 'driver-out'
  | 'summon'
  | 'collect'
  | 'driver-return';
export interface RescueActor extends Point {
  y: number;
  facing: number;
  route: Point[];
}
export interface RescueEvent {
  kind: RescueKind;
  phase: RescuePhase;
  household: number;
  families: number[];
  pets: string[];
  pet: RescueActor;
  owner: RescueActor;
  police: RescueActor;
  engine: RescueActor;
  firefighter: RescueActor;
  partner?: RescueActor;
  driver: RescueActor;
  tree: Point;
  elapsed: number;
  age: number;
  notice: number;
  hop: number;
  jumpAt: number;
  trapped: boolean;
  injury: VisitReason;
  chaser?: number;
  chaserPet?: string;
  chase?: RescueActor;
  chased: boolean;
  recalled?: boolean;
  car?: number;
  legacyTicket?: number;
  fire: number;
  rescued: number;
  delivered: boolean;
}
export interface RescueCare {
  household: number;
  pet: string;
  reason: VisitReason;
}
const actor = (p: Point): RescueActor => ({
  ...p,
  y: 0.2,
  facing: 0,
  route: [],
});
const phases: RescuePhase[] = [
  'wander',
  'report',
  'search',
  'dispatch',
  'unload',
  'ladder',
  'climb',
  'rescue',
  'descend',
  'extinguish',
  'enter-house',
  'exit-house',
  'handover',
  'return',
  'driver-out',
  'summon',
  'collect',
  'driver-return',
];
const move = (a: RescueActor, dt: number, speed = 2.3) => {
  a.facing = walkRoute(a, a.route, dt, speed) ?? a.facing;
  return !a.route.length;
};
const go = (a: RescueActor, p: Point, fromEngine = false) => {
  // A crew member dismounts onto the rescue side of the road. Selecting the
  // opposite pavement from a road centre would send them around an entire loop.
  if (fromEngine && distance(a, p) > 4 && (onRoad(a) || onRoad(p))) {
    const dx = (p.x - a.x) / distance(a, p),
      dz = (p.z - a.z) / distance(a, p);
    const start = onRoad(a) ? { x: a.x + dx * 3.2, z: a.z + dz * 3.2 } : a;
    const end = onRoad(p) ? { x: p.x - dx * 3.2, z: p.z - dz * 3.2 } : p;
    a.route = [
      { x: start.x, z: start.z },
      ...routeBetween(start, end),
      { x: p.x, z: p.z },
    ];
  } else a.route = routeBetween(a, p);
  // Replanning from between graph nodes must keep forward progress instead of
  // repeatedly walking back to the nearest node behind the officer.
  while (a.route.length > 1) {
    const first = a.route[0],
      next = a.route[1],
      dx = next.x - first.x,
      dz = next.z - first.z;
    const length = dx * dx + dz * dz;
    if (length < 0.0001) {
      a.route.shift();
      continue;
    }
    const along = ((a.x - first.x) * dx + (a.z - first.z) * dz) / length;
    if (
      along < 0 ||
      along > 1 ||
      Math.hypot(a.x - first.x - dx * along, a.z - first.z - dz * along) > 0.35
    )
      break;
    a.route.shift();
  }
};
export class Emergencies {
  active?: RescueEvent;
  due = 35;
  pending: RescueCare[] = [];
  completed = 0;
  private phase(e: RescueEvent, p: RescuePhase) {
    e.phase = p;
    e.elapsed = 0;
    if (p === 'handover') {
      if (e.trapped)
        e.firefighter.route = [{ x: e.owner.x + 0.4, z: e.owner.z + 0.2 }];
      else if (e.kind === 'lost')
        e.owner.route = [{ x: e.pet.x + 0.6, z: e.pet.z + 0.6 }];
    }
  }
  locked(id: number) {
    const e = this.active;
    return Boolean(
      e && ((!e.delivered && e.families.includes(id)) || e.chaser === id),
    );
  }
  status(id: number) {
    const e = this.active;
    if (!e || !e.families.includes(id) || e.delivered) return null;
    return this.description();
  }
  description() {
    const e = this.active;
    if (!e) return 'Police and firefighters are ready to help.';
    return {
      wander: `${e.pets[0]} is running away! Their owner is trying to catch up.`,
      report: 'The owner is heading to the police station for help.',
      search: e.recalled
        ? `${e.pets[0]} is waiting for their owner to catch up.`
        : 'The officer is guiding the owner to their pet.',
      dispatch: 'The fire engine is on its way.',
      unload: 'Firefighters are getting out of the engine.',
      ladder: 'The firefighter is setting up the ladder.',
      climb: 'Climbing carefully to the pet.',
      rescue: 'A safe pair of hands for our little friend.',
      descend: 'Bringing the pet safely down the ladder.',
      extinguish: 'Firefighters are putting the house fire out.',
      'enter-house': 'A firefighter is checking inside for pets.',
      'exit-house': 'Another little friend is being carried outside.',
      handover: 'Safe again! Louise will give everyone the care they need.',
      return: 'The emergency team is returning to its stations.',
      'driver-out': 'The driver has stopped and is getting out to help.',
      summon: 'The driver is fetching the pet’s owner.',
      collect: 'The owner is collecting their pet for Louise.',
      'driver-return':
        'The owner has their pet. The driver is returning to the car.',
    }[e.phase];
  }
  focus(households: Household[]): Point | null {
    const e = this.active;
    if (!e) return null;
    if (
      e.phase === 'dispatch' ||
      (e.phase === 'return' && e.engine.route.length)
    )
      return e.engine;
    if (e.phase === 'return' || e.phase === 'search') return e.police;
    if (['report', 'collect'].includes(e.phase)) return e.owner;
    if (['driver-out', 'summon', 'driver-return'].includes(e.phase))
      return e.driver;
    if (e.kind === 'fire') {
      const home = households[e.household].home;
      return {
        x: home.x * 0.8 + e.engine.x * 0.2,
        z: home.z * 0.8 + e.engine.z * 0.2,
      };
    }
    return e.pet;
  }
  start(
    kind: RescueKind,
    h: Household,
    households: Household[],
    time: number,
    random: () => number,
    car?: number,
    legacyTicket?: number,
    origin?: Point,
  ) {
    if (
      this.active ||
      h.inClinic ||
      (!legacyTicket && legacyTicket !== 0 && h.ticket !== undefined)
    )
      return false;
    const eligible = h.pets.filter((p) =>
      ['dog', 'cat', 'bird'].includes(p.species),
    );
    if (kind === 'lost' && !eligible.length) return false;
    const families =
      kind === 'fire' ? households.filter((f) => f.lot === h.lot) : [h];
    if (
      kind === 'fire' &&
      families.some(
        (f) => f.inClinic || f.ticket !== undefined || f.routine !== 'garden',
      )
    )
      return false;
    const pet =
      kind === 'lost'
        ? eligible[Math.floor(random() * eligible.length) % eligible.length]
        : h.pets[0];
    const pos = origin ?? garden(layout.lots[h.lot]);
    this.active = {
      kind,
      phase:
        kind === 'lost'
          ? 'wander'
          : kind === 'fire'
            ? 'dispatch'
            : 'driver-out',
      household: h.id,
      families: families.map((f) => f.id),
      pets:
        kind === 'fire'
          ? families.flatMap((f) => f.pets.map((p) => p.name))
          : [pet.name],
      pet: actor(pos),
      owner: actor(h.position),
      police: actor(stations.police.door),
      engine: actor(stations.fire.door),
      firefighter: actor(stations.fire.door),
      partner: kind === 'fire' ? actor(stations.fire.door) : undefined,
      driver: actor(pos),
      tree: nearestTree(pos),
      elapsed: 0,
      age: 0,
      notice: 4 + random() * 4,
      hop: 0,
      jumpAt: 40 + random() * 30,
      trapped: false,
      injury:
        kind === 'fire' ? 'post-fire' : kind === 'road' ? 'accident' : 'rescue',
      car,
      legacyTicket,
      fire: kind === 'fire' ? 1 : 0,
      rescued: 0,
      delivered: false,
      chased: false,
    };
    const e = this.active;
    if (kind === 'lost') {
      const destination = rescueTrees[(h.id + 2) % rescueTrees.length];
      if (pet.species === 'bird') e.pet.route = [rescuePerch(destination)];
      else go(e.pet, destination);
    }
    if (kind === 'fire') {
      e.tree = { ...h.home };
      e.engine.route = emergencyDrive(e.engine, h.home);
      for (const [i, f] of families.entries()) {
        f.position = garden(layout.lots[f.lot], i * 1.5, 4.2);
        f.route = [];
        f.routine = 'garden';
      }
      e.owner = actor(h.position);
    }
    this.due = time + 100 + random() * 60;
    return true;
  }
  private collision(e: RescueEvent, cars: Car[], random: () => number) {
    if (e.car !== undefined || e.trapped || e.pet.y > 0.5) return;
    const car = cars.findIndex((c) => distance(c, e.pet) < 1.1);
    if (car < 0 || random() > 0.65) return;
    e.kind = 'road';
    e.police.route = [];
    e.car = car;
    e.injury = 'accident';
    e.pet.route = [];
    e.driver = actor(cars[car]);
    this.phase(e, 'driver-out');
  }
  update(
    dt: number,
    time: number,
    households: Household[],
    cars: Car[],
    random: () => number,
    deliver: (care: RescueCare[], legacy?: number) => void,
    incident?: RoadIncident,
    tickets?: Map<number, VisitTicket>,
  ) {
    if (!this.active && incident?.phase === 'scene') {
      const h = households.find((h) => h.ticket === incident.ticket)!;
      if (h) {
        this.start(
          'road',
          h,
          households,
          time,
          random,
          incident.car,
          incident.ticket,
          incident.origin,
        );
        this.active!.pets = [tickets!.get(incident.ticket)!.pet];
        this.active!.driver = actor(cars[incident.car]);
      }
    }
    if (!this.active && time >= this.due && incident?.phase !== 'scene') {
      const atHome = households.filter(
        (h) => h.ticket === undefined && !h.inClinic && h.routine === 'garden',
      );
      const lost = atHome.filter((h) =>
        h.pets.some((p) => ['dog', 'cat', 'bird'].includes(p.species)),
      );
      const fire = atHome.filter((h) =>
        households
          .filter((f) => f.lot === h.lot)
          .every((f) => atHome.includes(f)),
      );
      if (lost.length || fire.length) {
        const kind =
          !lost.length || (fire.length > 0 && random() < 0.3) ? 'fire' : 'lost';
        const choices = kind === 'fire' ? fire : lost;
        const h =
          choices[Math.floor(random() * choices.length) % choices.length];
        this.start(kind, h, households, time, random);
      }
    }

    const e = this.active;
    if (!e) return;
    e.elapsed += dt;
    e.age += dt;
    const h = households[e.household],
      pet = h.pets.find((p) => p.name === e.pets[0])!;
    if (
      !e.delivered &&
      e.kind === 'lost' &&
      ['wander', 'report', 'search'].includes(e.phase)
    ) {
      // Once a ground pet hears the nearby search party it waits to be collected.
      // Do not interrupt a cat's run to its rescue tree, or stop in the road.
      if (
        e.phase === 'search' &&
        pet.species !== 'bird' &&
        !e.chase &&
        !onRoad(e.pet) &&
        distance(e.police, e.pet) < 6
      ) {
        e.recalled = true;
        e.pet.route = [];
        e.pet.facing = Math.atan2(e.police.x - e.pet.x, e.police.z - e.pet.z);
      }
      if (!e.trapped && !e.recalled && e.injury !== 'accident') {
        if (pet.species === 'bird') {
          e.pet.y = 2.8;
          if (move(e.pet, dt, e.phase === 'wander' ? 4.8 : 3.2)) {
            e.hop += dt;
            if (e.hop > 7 && e.age < 120) {
              e.hop = 0;
              const other = rescueTrees.filter((t) => distance(t, e.pet) > 2);
              e.pet.route = [
                {
                  ...rescuePerch(
                    other[Math.floor(random() * other.length) % other.length],
                  ),
                },
              ];
            }
          }
          e.tree = nearestTree(e.pet);
        } else {
          move(e.pet, dt, e.phase === 'wander' ? 4.2 : e.chase ? 3.2 : 1.8);
          if (!e.pet.route.length && !e.chase) {
            // Keep fleeing away from the owner instead of circling the same
            // nearby tree forever when a short first leg cannot open a gap.
            const choices =
              e.phase === 'wander'
                ? rescueTrees.filter((t) => distance(t, e.owner) > 20)
                : rescueTrees;
            const dest =
              choices[Math.floor(random() * choices.length) % choices.length];
            go(e.pet, dest);
          }
          if (pet.species === 'cat' && !e.chased) {
            const dogHome = households.find(
              (f) =>
                f.id !== h.id &&
                f.ticket === undefined &&
                f.routine === 'garden' &&
                f.pets.some((p) => p.species === 'dog') &&
                distance(f.position, e.pet) < 4,
            );
            if (dogHome) {
              e.chaser = dogHome.id;
              e.chaserPet = dogHome.pets.find((p) => p.species === 'dog')!.name;
              e.chase = actor(dogHome.position);
              e.chased = true;
              e.tree = nearestTree(e.pet);
              go(e.pet, rescuePerch(e.tree));
              if (random() < 0.25) e.injury = 'paw-adventure';
            } else if (e.age > 16 && !e.chased && e.hop === 0) {
              const dogs = households.filter(
                (f) =>
                  f.id !== h.id &&
                  f.ticket === undefined &&
                  f.routine === 'garden' &&
                  f.pets.some((p) => p.species === 'dog'),
              );
              if (dogs.length) {
                go(e.pet, garden(layout.lots[dogs[0].lot]));
                e.hop = 1;
              }
            }
          }
          this.collision(e, cars, random);
          if (e.chase) {
            e.chase.route = [{ ...e.pet }];
            move(e.chase, dt, 2.8);
            if (distance(e.pet, rescuePerch(e.tree)) < 0.15) {
              e.trapped = true;
              e.pet.route = [];
              e.pet.y = 0.2;
              e.hop = 0;
            }
          }
        }
      } else if (e.trapped) {
        e.pet.y = Math.min(2.8, e.pet.y + dt * 1.4);
        e.hop += dt;
        if (pet.species === 'cat' && e.hop > e.jumpAt && random() < dt * 0.08) {
          e.trapped = false;
          e.pet.y = 0.2;
          e.injury = 'accident';
          e.pet.route = [];
          e.jumpAt = 999999;
          this.phase(e, 'search');
        }
      }
      if (e.phase === 'wander') {
        // Chase on the connected paths, then seek help once the faster pet
        // pulls out of sight. A pet already up a tree also needs responders.
        if (
          (distance(e.pet, e.owner) > 12 && e.age > e.notice) ||
          e.trapped ||
          (pet.species === 'bird' &&
            !e.pet.route.length &&
            distance(e.pet, e.owner) < 2)
        ) {
          this.phase(e, 'report');
          go(e.owner, stations.police.door);
        } else {
          if (!e.owner.route.length || e.elapsed >= 1) {
            go(e.owner, e.pet);
            e.elapsed = 0;
          }
          move(e.owner, dt, 2.8);
        }
      }
    }
    if (
      e.trapped &&
      pet.species === 'cat' &&
      ['dispatch', 'unload', 'ladder'].includes(e.phase)
    ) {
      e.pet.y = Math.min(2.8, e.pet.y + dt * 1.4);
      e.hop += dt;
      if (e.hop > e.jumpAt && random() < dt * 0.08) {
        e.trapped = false;
        e.pet.y = 0.2;
        e.injury = 'accident';
        e.pet.route = [];
        // Stop the rescue at its current location; the team will return after collection.
        e.engine.route = [];
        e.firefighter.route = [];
        this.phase(e, 'handover');
      }
    }
    if (e.partner && !['dispatch', 'return'].includes(e.phase))
      move(e.partner, dt);
    if (e.phase === 'dispatch') {
      if (e.partner) {
        e.partner.x = e.engine.x;
        e.partner.z = e.engine.z;
      }
      e.firefighter.x = e.engine.x;
      e.firefighter.z = e.engine.z;
    }
    if (e.phase === 'report' && move(e.owner, dt)) {
      this.phase(e, 'search');
      go(e.police, e.pet);
    } else if (e.phase === 'search') {
      if (
        e.elapsed > 2 &&
        (!e.police.route.length ||
          distance(e.police.route[e.police.route.length - 1], e.pet) > 4)
      ) {
        e.elapsed = 0;
        go(e.police, e.pet);
      }
      move(e.police, dt, 2.8);
      e.owner.route = [{ x: e.police.x + 0.65, z: e.police.z + 0.65 }];
      move(e.owner, dt, 2.8);
      if (distance(e.police, e.pet) < 1.7) {
        if ((pet.species === 'bird' && !e.pet.route.length) || e.trapped) {
          e.trapped = true;
          e.pet.route = [];
          e.tree = nearestTree(e.pet);
          e.engine.route = emergencyDrive(e.engine, e.tree);
          this.phase(e, 'dispatch');
        } else if (
          pet.species !== 'bird' &&
          (!e.chase || e.injury === 'accident')
        ) {
          e.pet.route = [];
          this.phase(e, 'handover');
        }
      }
    } else if (e.phase === 'dispatch' && move(e.engine, dt, 5.8)) {
      e.firefighter = actor(e.engine);
      this.phase(e, 'unload');
    } else if (e.phase === 'unload' && e.elapsed > 2) {
      if (e.partner) {
        e.partner = actor(e.engine);
        go(e.partner, garden(layout.lots[h.lot], -1, 4), true);
      }
      go(
        e.firefighter,
        e.kind === 'fire'
          ? garden(layout.lots[h.lot], 1, 4)
          : { x: e.tree.x + 1.55, z: e.tree.z + 1.65 },
        true,
      );
      this.phase(e, e.kind === 'fire' ? 'extinguish' : 'ladder');
    } else if (
      e.phase === 'ladder' &&
      move(e.firefighter, dt) &&
      e.elapsed > 4
    ) {
      e.firefighter.facing = Math.atan2(-0.55, -0.65);
      this.phase(e, 'climb');
    } else if (e.phase === 'climb') {
      const climb = Math.min(1, e.elapsed / 5);
      e.firefighter.x = e.tree.x + 1 + 0.55 * (1 - climb);
      e.firefighter.z = e.tree.z + 1 + 0.65 * (1 - climb);
      e.firefighter.y = 0.2 + climb * 1.9;
      if (e.elapsed >= 5) this.phase(e, 'rescue');
    } else if (e.phase === 'rescue' && e.elapsed > 2) {
      e.pet.x = e.firefighter.x + Math.sin(e.firefighter.facing) * 0.3;
      e.pet.z = e.firefighter.z + Math.cos(e.firefighter.facing) * 0.3;
      e.pet.y = e.firefighter.y + 0.85;
      this.phase(e, 'descend');
    } else if (e.phase === 'descend') {
      const descent = Math.min(1, e.elapsed / 5);
      e.firefighter.x = e.tree.x + 1 + 0.55 * descent;
      e.firefighter.z = e.tree.z + 1 + 0.65 * descent;
      e.firefighter.y = 2.1 - descent * 1.9;
      e.pet.x = e.firefighter.x + Math.sin(e.firefighter.facing) * 0.3;
      e.pet.z = e.firefighter.z + Math.cos(e.firefighter.facing) * 0.3;
      e.pet.y = e.firefighter.y + 0.85;
      if (e.elapsed >= 5) this.phase(e, 'handover');
    } else if (e.phase === 'extinguish') {
      move(e.firefighter, dt);
      if (!e.partner?.route.length) e.fire = Math.max(0, e.fire - dt / 18);
      if (e.fire === 0) {
        go(e.firefighter, h.home);
        this.phase(e, 'enter-house');
      }
    } else if (
      e.phase === 'enter-house' &&
      move(e.firefighter, dt) &&
      e.elapsed > 3
    ) {
      e.rescued++;
      go(e.firefighter, { x: e.owner.x + 1, z: e.owner.z });
      this.phase(e, 'exit-house');
    } else if (e.phase === 'exit-house' && move(e.firefighter, dt)) {
      if (e.rescued < e.pets.length) {
        go(e.firefighter, h.home);
        this.phase(e, 'enter-house');
      } else this.phase(e, 'handover');
    } else if (e.phase === 'driver-out' && e.elapsed > 2) {
      go(e.driver, e.owner);
      this.phase(e, 'summon');
    } else if (e.phase === 'summon' && move(e.driver, dt)) {
      go(e.owner, { x: e.pet.x + 0.7, z: e.pet.z + 0.7 });
      e.driver.route = [{ x: e.driver.x + 0.8, z: e.driver.z }];
      this.phase(e, 'collect');
    } else if (e.phase === 'collect') {
      move(e.driver, dt);
      if (move(e.owner, dt)) {
        this.handoff(e, households, deliver);
        go(e.driver, cars[e.car!]);
        this.phase(e, 'driver-return');
      }
    } else if (e.phase === 'driver-return' && move(e.driver, dt)) {
      e.car = undefined;
      this.returnTeam(e);
    } else if (e.phase === 'handover') {
      const ownerReady = move(e.owner, dt),
        rescueReady = move(e.firefighter, dt);
      if (e.trapped) {
        e.pet.x = e.firefighter.x + Math.sin(e.firefighter.facing) * 0.3;
        e.pet.z = e.firefighter.z + Math.cos(e.firefighter.facing) * 0.3;
        e.pet.y = e.firefighter.y + 0.85;
      }
      if (e.elapsed > 3 && ownerReady && rescueReady) {
        this.handoff(e, households, deliver);
        this.returnTeam(e);
      }
    } else if (e.phase === 'return') {
      const officerHome = move(e.police, dt);
      const boarded = move(e.firefighter, dt);
      const partnerBoarded = !e.partner || move(e.partner, dt);
      const truckHome =
        boarded && partnerBoarded ? move(e.engine, dt, 4.8) : false;
      if (boarded) {
        e.firefighter.x = e.engine.x;
        e.firefighter.z = e.engine.z;
      }
      if (partnerBoarded && e.partner) {
        e.partner.x = e.engine.x;
        e.partner.z = e.engine.z;
      }
      if (e.chase) move(e.chase, dt);
      if (officerHome && truckHome && (!e.chase || !e.chase.route.length)) {
        this.completed++;
        this.due = Math.max(this.due, time + 20);
        this.active = undefined;
      }
    }
    if (!e.delivered) {
      h.position = { x: e.owner.x, z: e.owner.z };
      h.facing = e.owner.facing;
    }
  }
  private handoff(
    e: RescueEvent,
    households: Household[],
    deliver: (care: RescueCare[], legacy?: number) => void,
  ) {
    if (e.delivered) return;
    e.delivered = true;
    const care = e.pets.map((pet) => ({
      household: households.find((h) => h.pets.some((p) => p.name === pet))!.id,
      pet,
      reason: e.injury,
    }));
    deliver(care, e.legacyTicket);
    if (e.chase && e.chaser !== undefined)
      go(e.chase, garden(layout.lots[households[e.chaser].lot]));
  }
  private returnTeam(e: RescueEvent) {
    if (distance(e.police, stations.police.door) > 0.1)
      go(e.police, stations.police.door);
    e.engine.route =
      distance(e.engine, stations.fire.door) > 0.1
        ? [
            ...emergencyDrive(e.engine, stations.fire.door),
            { ...stations.fire.door },
          ]
        : [];
    if (distance(e.firefighter, e.engine) > 0.1)
      go(e.firefighter, e.engine, true);
    if (e.partner) go(e.partner, e.engine, true);
    this.phase(e, 'return');
  }
  snapshot() {
    return JSON.parse(
      JSON.stringify({
        active: this.active,
        due: this.due,
        pending: this.pending,
        completed: this.completed,
      }),
    ) as {
      active?: RescueEvent;
      due: number;
      pending: RescueCare[];
      completed: number;
    };
  }
  restore(
    value: unknown,
    households: Household[],
    tickets: Map<number, VisitTicket>,
  ) {
    if (value === undefined) return true;
    try {
      const s = JSON.parse(JSON.stringify(value)) as ReturnType<
        Emergencies['snapshot']
      >;
      const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
      const point = (p: Point) =>
        p && num(p.x) && num(p.z) && Math.abs(p.x) < 80 && Math.abs(p.z) < 80;
      const actorOK = (a: RescueActor) =>
        point(a) &&
        num(a.y) &&
        a.y >= 0 &&
        a.y < 5 &&
        num(a.facing) &&
        Array.isArray(a.route) &&
        a.route.length < 500 &&
        a.route.every(point);
      const careOK = (c: RescueCare) =>
        Number.isInteger(c.household) &&
        households[c.household]?.pets.some((p) => p.name === c.pet) &&
        ['rescue', 'paw-adventure', 'post-fire', 'accident'].includes(c.reason);
      if (
        !num(s.due) ||
        s.due < 0 ||
        !Number.isInteger(s.completed) ||
        s.completed < 0 ||
        !Array.isArray(s.pending) ||
        s.pending.length > 40 ||
        !s.pending.every(careOK) ||
        !s.pending.every(
          (c) =>
            tickets.has(households[c.household].ticket!) &&
            tickets.get(households[c.household].ticket!)?.status !==
              'returning',
        ) ||
        new Set(s.pending.map((c) => c.household + ':' + c.pet)).size !==
          s.pending.length
      )
        return false;
      const e = s.active;
      if (e) {
        if (
          !['lost', 'fire', 'road'].includes(e.kind) ||
          !phases.includes(e.phase) ||
          (['driver-out', 'summon', 'collect', 'driver-return'].includes(
            e.phase,
          ) &&
            (e.kind !== 'road' || e.car === undefined)) ||
          (['extinguish', 'enter-house', 'exit-house'].includes(e.phase) &&
            e.kind !== 'fire') ||
          !households[e.household] ||
          !Array.isArray(e.families) ||
          !e.families.every((i) => Number.isInteger(i) && households[i]) ||
          new Set(e.families).size !== e.families.length ||
          !Array.isArray(e.pets) ||
          !e.pets.length ||
          new Set(e.pets).size !== e.pets.length ||
          !e.families.includes(e.household) ||
          e.pets.length > 40 ||
          !e.pets.every((p) =>
            e.families.some((i) =>
              households[i].pets.some((v) => v.name === p),
            ),
          ) ||
          ![e.pet, e.owner, e.police, e.engine, e.firefighter, e.driver].every(
            actorOK,
          ) ||
          !point(e.tree) ||
          ![
            e.elapsed,
            e.age,
            e.notice,
            e.hop,
            e.jumpAt,
            e.fire,
            e.rescued,
          ].every((v) => num(v) && v >= 0) ||
          e.fire > 1 ||
          !Number.isInteger(e.rescued) ||
          e.rescued > e.pets.length ||
          typeof e.delivered !== 'boolean' ||
          typeof e.trapped !== 'boolean' ||
          typeof e.chased !== 'boolean' ||
          (e.recalled !== undefined && typeof e.recalled !== 'boolean') ||
          (e.chase && !actorOK(e.chase)) ||
          (e.partner && !actorOK(e.partner)) ||
          (e.chaser !== undefined &&
            (!Number.isInteger(e.chaser) ||
              !households[e.chaser]?.pets.some(
                (p) => p.name === e.chaserPet && p.species === 'dog',
              ) ||
              !e.chase)) ||
          (e.car !== undefined &&
            (!Number.isInteger(e.car) || e.car < 0 || e.car > 3)) ||
          (e.legacyTicket !== undefined &&
            !e.delivered &&
            !tickets.has(e.legacyTicket)) ||
          !careOK({ household: e.household, pet: e.pets[0], reason: e.injury })
        )
          return false;
      }
      if (e?.kind === 'fire' && !e.partner) {
        e.partner = actor(e.engine);
        if (!['dispatch', 'return'].includes(e.phase))
          go(
            e.partner,
            garden(layout.lots[households[e.household].lot], -1, 4),
            true,
          );
      }
      this.active = s.active;
      this.due = s.due;
      this.pending = s.pending;
      this.completed = s.completed;
      return true;
    } catch {
      return false;
    }
  }
}
