import { TownWeather } from './town-weather.ts';
import { ClinicEntrance, clinicStreetRoute } from './clinic-entrance.ts';
import { DogWalks } from './dog-walks.ts';
import { Emergencies, type RescueCare } from './emergencies.ts';
import { Park } from './park.ts';
import {
  communityVisit,
  type Visit,
  type VisitReason,
  type UpgradeId,
} from './game.ts';

import {
  layout,
  garden,
  routeBetween,
  clinicDoor,
  clinicHall,
  clinicDesk,
  clinicSeats,
  carRoutes,
  onRoad,
  localToTown,
} from './town-map.ts';
import { walkRoute } from './movement.ts';
import { ClinicEscort } from './clinic-escort.ts';
import { ClinicLeisure, interiorRoute } from './clinic-leisure.ts';
export type Point = { x: number; z: number };
export type Routine =
  | 'garden'
  | 'gather'
  | 'walk'
  | 'park'
  | 'chat'
  | 'clinic-gather'
  | 'clinic-walk'
  | 'clinic-wait'
  | 'clinic-enter'
  | 'clinic-exit'
  | 'homeward'
  | 'incident';
export interface VisitTicket {
  id: number;
  pet: string;
  reason: VisitReason;
  status: 'travelling' | 'waiting' | 'examining' | 'returning' | 'deferred';
  origin: Point;
  createdAt: number;
}
export interface TownEvent {
  pet: string;
  kind: VisitReason | 'arrived' | 'home' | 'deferred';
  at: number;
}
export interface RoadIncident {
  ticket: number;
  car: number;
  origin: Point;
  phase: 'scene' | 'to-clinic' | 'at-clinic' | 'recovering' | 'resolved';
}
export interface Household {
  id: number;
  lot: number;
  seat: number;
  owner: string;
  pets: Visit[];
  kind: 'House' | 'Flat';
  home: Point;
  label: string;
  position: Point;
  routine: Routine;
  remaining: number;
  route: Point[];
  returning: boolean;
  chatCooldown: number;
  facing: number;
  inClinic: boolean;
  ticket?: number;
  nextCare: number;
  retryCareAt?: number;
  busyUntil?: number;
  careCycle: number;
  nextPet: number;
  companions: string[];
}
export interface Car extends Point {
  direction: number;
  stopped: boolean;
  facing?: number;
}
const point = (x: number, z: number): Point => ({ x, z });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

/** Pure active-time simulation. Home identity comes from the patient roster. */
export class TownSimulation {
  readonly households: Household[] = [];
  emergencies = new Emergencies();
  weather = new TownWeather();
  dogWalks = new DogWalks();
  park = new Park();
  leisure = new ClinicLeisure();
  escort = new ClinicEscort();
  configureLeisure(ids: UpgradeId[]) {
    this.leisure.configure(ids);
  }
  readonly cars: Car[] = [
    { x: -24, z: -1, direction: 1, stopped: false },
    { x: 4, z: -1, direction: 1, stopped: false },
    { x: 24, z: 1, direction: -1, stopped: false },
    { x: -4, z: 1, direction: -1, stopped: false },
  ];
  time = 0;
  revision = 0;
  clinicOpen = false;
  queue: number[] = [];
  readonly tickets = new Map<number, VisitTicket>();
  events: TownEvent[] = [];
  incident?: RoadIncident;
  private roster: Visit[];
  private nextTicket = 0;
  private catalogueCursor = 0;
  private arrivalRemaining = 5;
  private accidentDue = 100;
  entrance = new ClinicEntrance();
  private capacity = 4;
  private arrivalInterval = 22;
  private random: () => number;
  constructor(roster: Visit[], random: () => number = Math.random) {
    this.random = random;
    this.roster = roster;
    for (const visit of roster) {
      let house = this.households.find((h) => h.owner === visit.owner);
      if (!house) {
        const id = this.households.length;
        const lot = layout.lots.find((l) => l.owners.includes(visit.owner));
        if (!lot) throw new Error(`No home for ${visit.owner}`);
        const home = point(lot.x, lot.z);
        house = {
          id,
          lot: lot.id,
          seat: 0,
          owner: visit.owner,
          pets: [],
          kind: lot.kind as 'House' | 'Flat',
          home,
          label: '',
          position: garden(lot),
          routine: 'garden',
          remaining: 4 + id * 3 + this.random() * 9,
          route: [],
          returning: false,
          chatCooldown: 0,
          facing: 0,
          inClinic: false,
          nextCare: 100 + id * 15,
          careCycle: id % 3,
          nextPet: 0,
          companions: [],
        };
        this.households.push(house);
      }
      if (!house.pets.some((p) => p.name === visit.name))
        house.pets.push(visit);
    }
    for (const h of this.households) {
      const names = [h.owner, ...h.pets.map((p) => p.name)];
      h.label = `${names.slice(0, -1).join(', ')} and ${names.at(-1)}'s ${h.kind}`;
    }
  }
  status(h: Household) {
    const shelter = this.weather.status(h.id);
    if (shelter) return shelter;
    const dogBreak = this.dogWalks.status(h.id);
    if (dogBreak) return dogBreak;
    const emergency = this.emergencies.status(h.id);
    if (emergency) return emergency;
    if (h.busyUntil !== undefined && this.time < h.busyUntil)
      return 'The clinic is busy · we will come back later';
    if (h.routine === 'clinic-exit')
      return 'Leaving Louise’s clinic · heading home';
    if (h.routine === 'clinic-enter') return 'Walking in from the street';
    if (h.inClinic) return 'At Louise’s clinic';
    if (h.routine === 'park') return this.park.status(h.id);
    return {
      'clinic-gather': 'Getting ready for a vet visit',
      'clinic-walk': 'On the way to Louise’s clinic',
      'clinic-wait': 'Waiting safely outside the clinic',
      'clinic-enter': 'Walking in from the street',
      'clinic-exit': 'Leaving Louise’s clinic',
      homeward: 'Heading home after care',
      incident: 'A little road accident · help is on the way',
      garden: 'At home · pets in the garden',
      gather: 'Gathering pets for a walk',
      walk: h.returning ? 'Walking home' : 'Walking to the park',
      park: 'Enjoying the park',
      chat: 'Chatting with a neighbour',
    }[h.routine];
  }
  private outingPets(h: Household) {
    const t = this.tickets.get(h.ticket!);
    const resting =
      t?.status === 'deferred' && !['checkup', 'vaccination'].includes(t.reason)
        ? [
            t.pet,
            ...this.emergencies.pending
              .filter((c) => c.household === h.id)
              .map((c) => c.pet),
          ]
        : [];
    return h.pets.filter((p) => !resting.includes(p.name)).map((p) => p.name);
  }
  private leave(h: Household) {
    h.companions = this.outingPets(h);
    h.returning = false;
    h.route = routeBetween(h.position, layout.nodes[layout.park]);
    h.routine = 'walk';
  }
  private goHome(h: Household) {
    h.returning = true;
    h.route = routeBetween(h.position, garden(layout.lots[h.lot]));
    h.routine = 'walk';
  }
  configureClinic(capacity: number, arrivalInterval: number) {
    this.capacity = capacity;
    this.arrivalInterval = arrivalInterval;
    this.clinicOpen = true;
  }
  seedClinic(indices = [0, 1, 2]) {
    this.clinicOpen = true;
    for (const index of indices) {
      const pet = this.roster[index];
      const h = this.households.find((h) => h.owner === pet.owner)!;
      const ticket = this.newTicket(h, pet, 'authored');
      ticket.status = 'waiting';
      h.inClinic = true;
      h.routine = 'clinic-wait';
      h.seat = this.queue.length;
      h.position = { ...clinicSeats[h.seat] };
      const vet = localToTown(-1.3, -2.75);
      h.facing = Math.atan2(vet.x - h.position.x, vet.z - h.position.z);
      this.queue.push(ticket.id);
    }
    this.catalogueCursor = Math.max(0, ...indices.map((i) => i + 1));
  }
  visit(id: number) {
    const ticket = this.tickets.get(id);
    if (!ticket) throw new Error(`Missing community visit ${id}`);
    return communityVisit(
      this.roster.find((p) => p.name === ticket.pet)!,
      ticket.reason,
    );
  }
  private record(pet: string, kind: TownEvent['kind']) {
    this.events.push({ pet, kind, at: this.time });
    this.events = this.events.slice(-24);
    this.revision++;
  }
  eventText(event: TownEvent) {
    const action = {
      authored: 'needs a little care',
      vaccination: 'is due for a vaccination',
      checkup: 'has a regular checkup',
      fever: 'felt warm at home and needs a fever check',
      accident: 'was bumped by a car at the crossing; everyone is safe',
      rescue: 'is safe after a rescue and needs a care check',
      'paw-adventure': 'has a sore paw after an adventure',
      'post-fire': 'is safe after a fire and needs a smoke and skin check',
      arrived: 'has arrived at Louise’s office',
      home: 'is safely home after care',
      deferred: 'will visit later because the clinic is busy',
    }[event.kind];
    return `${event.pet} ${action}.`;
  }
  private newTicket(h: Household, pet: Visit, reason: VisitReason) {
    const ticket: VisitTicket = {
      id: this.nextTicket++,
      pet: pet.name,
      reason,
      status: 'travelling',
      origin: { ...h.position },
      createdAt: this.time,
    };
    this.tickets.set(ticket.id, ticket);
    h.ticket = ticket.id;
    if (!h.companions.includes(pet.name)) h.companions.push(pet.name);
    this.record(pet.name, reason);
    return ticket;
  }
  private get incomingCare() {
    return [...this.tickets.values()].filter((t) =>
      ['travelling', 'waiting', 'examining'].includes(t.status),
    ).length;
  }
  requestVisit(petName: string, reason: VisitReason) {
    if (this.incomingCare >= this.capacity) return false;
    const pet = this.roster.find((p) => p.name === petName);
    const h = this.households.find((h) => h.owner === pet?.owner);
    if (
      !pet ||
      !h ||
      this.emergencies.locked(h.id) ||
      this.dogWalks.locked(h.id) ||
      this.weather.locked(h.id) ||
      h.ticket !== undefined ||
      h.inClinic ||
      (h.routine !== 'garden' &&
        !(
          reason === 'authored' &&
          ['walk', 'park', 'chat', 'gather'].includes(h.routine)
        ))
    )
      return false;
    if (
      pet.species === 'goldfish' &&
      ['vaccination', 'fever', 'accident'].includes(reason)
    )
      return false;
    if (pet.species === 'bird' && reason === 'vaccination') return false;
    if (reason === 'accident') return false; // Road incidents require actual traffic contact.
    this.newTicket(h, pet, reason);
    h.routine = 'clinic-gather';
    this.park.recall(h.id);
    h.remaining = 2;
    h.route = [];
    return true;
  }
  inviteNext() {
    if (this.catalogueCursor < this.roster.length) {
      const pet = this.roster[this.catalogueCursor];
      if (!this.requestVisit(pet.name, 'authored')) return false;
      this.catalogueCursor++;
      return true;
    }
    const h = this.households.find(
      (h) => h.ticket === undefined && h.routine === 'garden',
    );
    return h
      ? this.requestVisit(h.pets[h.nextPet++ % h.pets.length].name, 'checkup')
      : false;
  }
  private clinicRoute(h: Household) {
    h.route = this.entrance.approach(h);
    h.routine = 'clinic-walk';
  }
  private homeRoute(h: Household) {
    this.leisure.release(h);
    h.route = [...interiorRoute(h.position, clinicHall), { ...clinicDoor }];
    h.routine = 'clinic-exit';
    h.returning = true;
    h.inClinic = true;
  }
  cancelCall(id: number) {
    if (this.escort.ticket === id) this.escort.finish();
    this.leisure.cancelRecall(id, this.households);
  }
  startVisit(id: number) {
    const t = this.tickets.get(id);
    if (!t || t.status !== 'waiting' || !this.queue.includes(id)) return false;
    const h = this.households.find((h) => h.ticket === id)!;
    if (this.escort.ticket === id) {
      if (!this.escort.atTable(id) || !this.escort.ownerAtTable(h))
        return false;
      t.status = 'examining';
      this.queue = this.queue.filter((i) => i !== id);
      const a = this.leisure.owners.get(h.id);
      if (a) a.phase = 'in-room';
      this.leisure.pets.delete(id);
      this.revision++;
      return true;
    }
    if (
      this.escort.phase !== 'idle' ||
      h.routine !== 'clinic-wait' ||
      !h.inClinic ||
      !this.leisure.recall(id, h)
    )
      return false;
    this.escort.start(id, h);
    const a = this.leisure.owners.get(h.id);
    if (a) a.phase = 'escort';
    return false;
  }
  abortVisit(id: number) {
    const t = this.tickets.get(id);
    if (!t || t.status !== 'examining') return false;
    t.status = 'waiting';
    this.cancelCall(id);
    this.queue.unshift(id);
    this.revision++;
    return true;
  }
  completeVisit(id: number) {
    const t = this.tickets.get(id);
    if (!t || t.status !== 'examining') return false;
    this.escort.finish();
    t.status = 'returning';
    const h = this.households.find((h) => h.ticket === id)!;
    const next = this.emergencies.pending.find((c) => c.household === h.id);
    if (next) {
      this.emergencies.pending = this.emergencies.pending.filter(
        (c) => c !== next,
      );
      this.leisure.release(h);
      this.tickets.delete(id);
      const newVisit = this.newTicket(
        h,
        h.pets.find((p) => p.name === next.pet)!,
        next.reason,
      );
      newVisit.status = 'waiting';
      this.queue.push(newVisit.id);
      h.routine = 'clinic-enter';
      h.route = interiorRoute(h.position, clinicDesk);
    } else this.homeRoute(h);
    if (this.incident?.ticket === id) this.incident.phase = 'recovering';
    this.revision++;
    return true;
  }
  private admit(h: Household) {
    this.entrance.arrive(h.id);
    if (this.entrance.waiting[0] !== h.id) return;
    if (
      this.households.some(
        (other) =>
          other !== h &&
          (['clinic-enter', 'clinic-exit'].includes(other.routine) ||
            (other.routine === 'homeward' &&
              other.returning &&
              distance(other.position, clinicDoor) < 1.5) ||
            this.leisure.owners.get(other.id)?.phase === 'desk'),
      )
    )
      return;
    const occupied = [...this.tickets.values()].filter((t) =>
      ['waiting', 'examining'].includes(t.status),
    ).length;
    if (occupied >= this.capacity) return;
    const t = this.tickets.get(h.ticket!)!;
    t.status = 'waiting';
    h.inClinic = true;
    const occupiedSeats = this.households
      .filter((other) => other !== h && other.inClinic)
      .map((other) => other.seat);
    h.seat = clinicSeats.findIndex((_, i) => !occupiedSeats.includes(i));
    if (h.seat < 0) h.seat = 0;
    h.routine = 'clinic-enter';
    h.route = [
      ...this.entrance.entry(h),
      { ...clinicHall },
      ...interiorRoute(clinicHall, clinicDesk),
    ];
    this.entrance.release(h.id);
    this.queue.push(t.id);
    if (this.incident?.ticket === t.id) this.incident.phase = 'at-clinic';
    this.record(t.pet, 'arrived');
  }
  private deferVisit(h: Household) {
    const t = this.tickets.get(h.ticket!)!;
    t.status = 'deferred';
    h.retryCareAt = this.time + 180 + h.id * 3 + this.random() * 66;
    h.busyUntil = this.time + 12;
    this.entrance.release(h.id);
    // Keep the original patient, reason and any companion rescue care. No
    // treatment/reward has happened; only their place outside is released.
    const destination = ['checkup', 'vaccination'].includes(t.reason)
      ? layout.nodes[layout.park]
      : garden(layout.lots[h.lot]);
    h.returning = !['checkup', 'vaccination'].includes(t.reason);
    h.route = [
      { x: h.position.x, z: -2.55 },
      ...clinicStreetRoute({ x: h.position.x, z: -2.55 }, destination),
    ];
    h.routine = 'walk';
    this.record(t.pet, 'deferred');
  }
  private retryVisits() {
    // Oldest due first. A full clinic does not send deferred families back to
    // the pavement; they continue their day until a place can be reserved.
    for (const h of [...this.households].sort(
      (a, b) => (a.retryCareAt ?? Infinity) - (b.retryCareAt ?? Infinity),
    )) {
      if (this.incomingCare >= this.capacity) break;
      if (
        h.retryCareAt === undefined ||
        this.time < h.retryCareAt ||
        h.routine !== 'garden' ||
        this.emergencies.locked(h.id)
      )
        continue;
      const t = this.tickets.get(h.ticket!)!;
      t.status = 'travelling';
      h.retryCareAt = undefined;
      h.busyUntil = undefined;
      h.companions = [
        ...new Set([
          t.pet,
          ...h.companions,
          ...this.emergencies.pending
            .filter((c) => c.household === h.id)
            .map((c) => c.pet),
        ]),
      ];
      h.routine = 'clinic-gather';
      h.remaining = 2;
      h.route = [];
      this.revision++;
    }
  }
  private arriveHome(h: Household) {
    const t = this.tickets.get(h.ticket!);
    if (t) {
      this.record(t.pet, 'home');
      this.tickets.delete(t.id);
    }
    if (this.incident && this.incident.ticket === h.ticket)
      this.incident.phase = 'resolved';
    h.ticket = undefined;
    h.companions = [];
    h.routine = 'garden';
    h.inClinic = false;
    h.remaining = 8 + this.random() * 12;
    h.nextCare =
      this.time + (70 + this.random() * 100) * (this.arrivalInterval / 22);
  }
  private rescueCare(care: RescueCare[], legacy?: number) {
    for (const id of new Set(care.map((c) => c.household))) {
      const h = this.households[id],
        cases = care.filter((c) => c.household === id),
        first = cases[0];
      h.companions = cases.map((c) => c.pet);
      if (legacy === undefined)
        this.newTicket(
          h,
          h.pets.find((p) => p.name === first.pet)!,
          first.reason,
        );
      else if (this.incident) this.incident.phase = 'to-clinic';
      this.emergencies.pending.push(...cases.slice(1));
      this.clinicRoute(h);
    }
    this.revision++;
  }
  private tryAccident() {
    if (
      this.emergencies.active ||
      this.time < this.accidentDue ||
      (this.incident && this.incident.phase !== 'resolved')
    )
      return;
    for (const h of this.households) {
      if (
        h.ticket !== undefined ||
        h.routine !== 'walk' ||
        this.weather.locked(h.id) ||
        h.returning ||
        h.position.x !== 18 ||
        Math.abs(h.position.z) < 2.8
      )
        continue;
      const pet = h.pets.find((p) => ['dog', 'cat'].includes(p.species));
      const carIndex = this.cars.findIndex(
        (c) =>
          (18 - c.x) * c.direction >= 0.5 &&
          (18 - c.x) * c.direction <= 1.7 &&
          Math.sign(c.z) === Math.sign(h.position.z),
      );
      if (!pet || carIndex < 0) continue;
      const car = this.cars[carIndex];
      const ticket = this.newTicket(h, pet, 'accident');
      const origin = point(18, car.z);
      ticket.origin = { ...origin };
      this.incident = {
        ticket: ticket.id,
        car: carIndex,
        origin,
        phase: 'scene',
      };
      h.routine = 'incident';
      h.remaining = 5;
      h.route = [];
      this.accidentDue = this.time + 180 + this.random() * 180;
      return;
    }
  }
  snapshot() {
    return {
      activityPace: 1,
      version: 2,
      emergencies: this.emergencies.snapshot(),
      entrance: this.entrance.snapshot(),
      weather: this.weather.snapshot(),
      leisure: this.leisure.snapshot(),
      escort: this.escort.snapshot(),
      time: this.time,
      nextTicket: this.nextTicket,
      catalogueCursor: this.catalogueCursor,
      arrivalRemaining: this.arrivalRemaining,
      accidentDue: this.accidentDue,
      queue: [...this.queue],
      tickets: [...this.tickets.values()].map((t) => ({
        ...t,
        origin: { ...t.origin },
      })),
      events: this.events.map((e) => ({ ...e })),
      incident: this.incident
        ? { ...this.incident, origin: { ...this.incident.origin } }
        : undefined,
      cars: this.cars.map((c) => ({ ...c })),
      park: this.park.snapshot(),
      dogWalks: this.dogWalks.snapshot(),
      households: this.households.map((h) => ({
        owner: h.owner,
        seat: h.seat,
        position: { ...h.position },
        routine: h.routine,
        remaining: h.remaining,
        route: h.route.map((p) => ({ ...p })),
        returning: h.returning,
        chatCooldown: h.chatCooldown,
        facing: h.facing,
        inClinic: h.inClinic,
        ticket: h.ticket,
        nextCare: h.nextCare,
        retryCareAt: h.retryCareAt,
        busyUntil: h.busyUntil,
        careCycle: h.careCycle,
        nextPet: h.nextPet,
        companions: [...h.companions],
      })),
    };
  }
  restore(value: unknown): boolean {
    // Validate a complete snapshot before applying any of it. User-controlled save
    // text never becomes clinical prose or household identity.
    try {
      if (!value || typeof value !== 'object') return false;
      let data = value as ReturnType<TownSimulation['snapshot']>;
      // The first Hookville map had eight households. Keep their visits and
      // rewards, move indoor families to the real seats, then add new neighbours.
      if (
        data.version === 1 &&
        Array.isArray(data.households) &&
        data.households.length === 8
      ) {
        const old = data;
        const expanded = this.snapshot();
        let seat = 0;
        for (let i = 0; i < 8; i++) {
          const h = old.households[i];
          expanded.households[i] = {
            ...h,
            seat: h.inClinic ? seat++ % clinicSeats.length : 0,
          };
          if (h.inClinic) {
            expanded.households[i].position = {
              ...clinicSeats[expanded.households[i].seat],
            };
            expanded.households[i].route = [];
          }
        }
        data = { ...old, version: 2, households: expanded.households };
      }
      const number = (n: unknown, min = 0, max = 1e9): n is number =>
        typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
      const integer = (n: unknown, max = 1e9): n is number =>
        number(n, 0, max) && Number.isInteger(n);
      const validPoint = (p: Point) =>
        p && number(p.x, -48, 48) && number(p.z, -44, 44);
      const reasons = [
        'authored',
        'vaccination',
        'checkup',
        'fever',
        'accident',
        'rescue',
        'paw-adventure',
        'post-fire',
      ];
      const routines = [
        'garden',
        'gather',
        'walk',
        'park',
        'chat',
        'clinic-gather',
        'clinic-walk',
        'clinic-wait',
        'clinic-enter',
        'clinic-exit',
        'homeward',
        'incident',
      ];
      if (
        data.version !== 2 ||
        !number(data.time) ||
        !integer(data.nextTicket) ||
        !integer(data.catalogueCursor, this.roster.length) ||
        !number(data.arrivalRemaining, -1, 300) ||
        !number(data.accidentDue) ||
        !Array.isArray(data.households) ||
        data.households.length !== this.households.length ||
        !Array.isArray(data.cars) ||
        data.cars.length !== this.cars.length ||
        !Array.isArray(data.queue) ||
        data.queue.length > this.households.length ||
        !Array.isArray(data.tickets) ||
        data.tickets.length > this.households.length ||
        !Array.isArray(data.events) ||
        data.events.length > 24
      )
        return false;
      const tickets = new Map<number, VisitTicket>();
      const owners = new Set<string>();
      for (const t of data.tickets) {
        const pet = this.roster.find((p) => p.name === t.pet);
        if (
          !pet ||
          !integer(t.id) ||
          t.id >= data.nextTicket ||
          tickets.has(t.id) ||
          owners.has(pet.owner) ||
          !reasons.includes(t.reason) ||
          ![
            'travelling',
            'waiting',
            'examining',
            'returning',
            'deferred',
          ].includes(t.status) ||
          !validPoint(t.origin) ||
          !number(t.createdAt, 0, data.time) ||
          (t.reason === 'accident' && !['dog', 'cat'].includes(pet.species)) ||
          (pet.species === 'goldfish' &&
            ['vaccination', 'fever'].includes(t.reason)) ||
          (pet.species === 'bird' && t.reason === 'vaccination')
        )
          return false;
        owners.add(pet.owner);
        tickets.set(t.id, { ...t, origin: { ...t.origin } });
      }
      if (
        new Set(data.queue).size !== data.queue.length ||
        data.queue.some((id) => tickets.get(id)?.status !== 'waiting') ||
        [...tickets.values()].some(
          (t) => t.status === 'waiting' && !data.queue.includes(t.id),
        )
      )
        return false;
      for (const [i, h] of data.households.entries()) {
        if (
          h.owner !== this.households[i].owner ||
          !integer(h.seat, clinicSeats.length - 1) ||
          !validPoint(h.position) ||
          !routines.includes(h.routine) ||
          !number(h.remaining, -1, 300) ||
          !Array.isArray(h.route) ||
          h.route.length > 256 ||
          !h.route.every(validPoint) ||
          typeof h.returning !== 'boolean' ||
          typeof h.inClinic !== 'boolean' ||
          !number(h.chatCooldown, 0, 60) ||
          !number(h.facing, -Math.PI * 2, Math.PI * 2) ||
          !number(h.nextCare) ||
          (h.retryCareAt !== undefined && !number(h.retryCareAt)) ||
          (h.busyUntil !== undefined && !number(h.busyUntil)) ||
          !integer(h.careCycle) ||
          !integer(h.nextPet) ||
          !Array.isArray(h.companions) ||
          new Set(h.companions).size !== h.companions.length ||
          h.companions.some(
            (name) => !this.households[i].pets.some((p) => p.name === name),
          )
        )
          return false;
        const t = h.ticket === undefined ? undefined : tickets.get(h.ticket);
        if (
          (h.ticket !== undefined &&
            (!t || !this.households[i].pets.some((p) => p.name === t.pet))) ||
          (t?.status === 'deferred') !== (h.retryCareAt !== undefined) ||
          (t?.status === 'deferred' &&
            !['garden', 'gather', 'walk', 'park', 'chat'].includes(
              h.routine,
            )) ||
          h.inClinic !==
            Boolean(
              t &&
              (['waiting', 'examining'].includes(t.status) ||
                h.routine === 'clinic-exit'),
            ) ||
          (t?.status === 'returning' &&
            !['homeward', 'clinic-exit'].includes(h.routine)) ||
          (!t && h.routine.startsWith('clinic')) ||
          (!t && ['homeward', 'incident'].includes(h.routine))
        )
          return false;
      }
      if (
        [...tickets.values()].some(
          (t) => !data.households.some((h) => h.ticket === t.id),
        )
      )
        return false;
      if (
        !data.cars.every(
          (c) =>
            validPoint(c) &&
            [-1, 1].includes(c.direction) &&
            typeof c.stopped === 'boolean' &&
            (c.facing === undefined || number(c.facing, -Math.PI, Math.PI)),
        )
      )
        return false;
      if (
        !data.events.every(
          (e) =>
            this.roster.some((p) => p.name === e.pet) &&
            [...reasons, 'arrived', 'home', 'deferred'].includes(e.kind) &&
            number(e.at, 0, data.time),
        )
      )
        return false;
      if (
        data.incident &&
        (!validPoint(data.incident.origin) ||
          !integer(data.incident.car, this.cars.length - 1) ||
          ![
            'scene',
            'to-clinic',
            'at-clinic',
            'recovering',
            'resolved',
          ].includes(data.incident.phase) ||
          (data.incident.phase !== 'resolved' &&
            tickets.get(data.incident.ticket)?.reason !== 'accident'))
      )
        return false;
      if (
        data.households.some(
          (h) =>
            h.routine === 'incident' &&
            (!data.incident ||
              data.incident.ticket !== h.ticket ||
              data.incident.phase !== 'scene'),
        )
      )
        return false;
      const leisure = new ClinicLeisure();
      if (!leisure.restore(data.leisure, data.households, tickets))
        return false;
      const escort = new ClinicEscort();
      if (!escort.restore(data.escort)) return false;
      const park = new Park();
      if (
        !park.restore(
          data.park,
          data.households.map((h, i) => ({ ...this.households[i], ...h })),
        )
      )
        return false;
      const emergencies = new Emergencies();
      if (
        !emergencies.restore(
          data.emergencies,
          data.households.map((h, i) => ({ ...this.households[i], ...h })),
          tickets,
        )
      )
        return false;
      const dogWalks = new DogWalks();
      if (
        !dogWalks.restore(
          data.dogWalks,
          data.households.map((h, i) => ({ ...this.households[i], ...h })),
        )
      )
        return false;
      if ([...dogWalks.active.keys()].some((id) => emergencies.locked(id)))
        return false;
      const entrance = new ClinicEntrance();
      if (
        !entrance.restore(
          data.entrance,
          data.households.map((h, i) => ({ ...this.households[i], ...h })),
        )
      )
        return false;
      const weather = new TownWeather();
      if (
        !weather.restore(
          data.weather,
          data.households.map((h, i) => ({ ...this.households[i], ...h })),
        ) ||
        [...weather.active.keys()].some(
          (id) => dogWalks.locked(id) || emergencies.locked(id),
        )
      )
        return false;
      this.weather = weather;
      this.entrance = entrance;
      this.dogWalks = dogWalks;
      this.emergencies = emergencies;
      this.park = park;
      this.escort = escort;
      this.leisure = leisure;
      this.time = data.time;
      this.nextTicket = data.nextTicket;
      this.catalogueCursor = data.catalogueCursor;
      this.arrivalRemaining = data.arrivalRemaining;
      this.accidentDue = data.accidentDue;
      this.tickets.clear();
      for (const [id, t] of tickets) this.tickets.set(id, t);
      this.queue = [...data.queue];
      // A reload restarts an unfinished examination, never its rewards.
      for (const t of this.tickets.values())
        if (t.status === 'examining') {
          t.status = 'waiting';
          this.queue.unshift(t.id);
        }
      data.households.forEach((h, i) =>
        Object.assign(
          this.households[i],
          { retryCareAt: undefined, busyUntil: undefined },
          h,
          {
            position: { ...h.position },
            route: h.route.map((p) => ({ ...p })),
            companions: [...h.companions],
          },
        ),
      );
      data.cars.forEach((c, i) => Object.assign(this.cars[i], c));
      this.events = data.events.map((e) => ({ ...e }));
      this.incident = data.incident
        ? { ...data.incident, origin: { ...data.incident.origin } }
        : undefined;
      if (data.entrance === undefined) {
        for (const h of [...this.households].sort(
          (a, b) => (a.ticket ?? Infinity) - (b.ticket ?? Infinity),
        )) {
          if (
            !h.inClinic &&
            h.ticket !== undefined &&
            ['clinic-walk', 'clinic-wait'].includes(h.routine)
          ) {
            if (h.routine === 'clinic-wait') this.entrance.arrive(h.id);
            this.clinicRoute(h); // Existing piles walk apart; no patient or position is discarded.
          }
        }
      }
      if (data.activityPace === undefined) {
        this.emergencies.due = Math.min(this.emergencies.due, this.time + 35);
        for (const [id, due] of this.dogWalks.due)
          this.dogWalks.due.set(id, Math.min(due, this.time + 90));
        for (const h of this.households) {
          if (this.emergencies.locked(h.id) || this.dogWalks.locked(h.id))
            continue;
          if (h.routine === 'garden') h.remaining = Math.min(h.remaining, 20);
          if (h.routine === 'park') h.remaining = Math.min(h.remaining, 55);
          h.chatCooldown = Math.min(h.chatCooldown, 14);
        }
      }
      this.clinicOpen = true;
      this.revision++;
      return true;
    } catch {
      return false;
    }
  }
  update(dt: number) {
    // Keep long pauses from teleporting residents across an entire route.
    const step = Math.min(Math.max(dt, 0), 0.1);
    this.time += step;
    this.emergencies.update(
      step,
      this.time,
      this.households,
      this.cars,
      this.random,
      (care, legacy) => this.rescueCare(care, legacy),
      this.incident,
      this.tickets,
    );
    if (this.clinicOpen) {
      this.retryVisits();
      this.arrivalRemaining = Math.max(0, this.arrivalRemaining - step);
      if (
        this.arrivalRemaining <= 0 &&
        this.catalogueCursor < this.roster.length
      ) {
        if (this.inviteNext()) this.arrivalRemaining = this.arrivalInterval;
      }
      if (this.catalogueCursor >= this.roster.length)
        for (const h of this.households) {
          if (
            h.ticket === undefined &&
            h.routine === 'garden' &&
            this.time >= h.nextCare
          ) {
            const pet = h.pets[h.nextPet++ % h.pets.length];
            const reason =
              pet.species === 'goldfish'
                ? 'checkup'
                : pet.species === 'bird'
                  ? (['checkup', 'fever'] as const)[h.careCycle++ % 2]
                  : (['vaccination', 'checkup', 'fever'] as const)[
                      h.careCycle++ % 3
                    ];
            this.requestVisit(pet.name, reason);
          }
        }
      this.tryAccident();
    }
    this.weather.update(
      step,
      this.households,
      this.random,
      (id) => this.emergencies.locked(id) || this.dogWalks.locked(id),
    );
    this.dogWalks.update(
      step,
      this.time,
      this.households,
      this.random,
      (id) => this.emergencies.locked(id) || this.weather.locked(id),
    );
    this.park.update(step, this.households);
    for (const h of this.households) {
      if (
        this.emergencies.locked(h.id) ||
        this.dogWalks.locked(h.id) ||
        this.weather.locked(h.id)
      )
        continue;
      if (h.inClinic && !['clinic-enter', 'clinic-exit'].includes(h.routine))
        continue;
      h.chatCooldown = Math.max(0, h.chatCooldown - step);
      if (h.routine === 'clinic-wait') {
        this.admit(h);
        if (!h.inClinic) {
          h.remaining = Math.max(0, h.remaining - step);
          if (h.remaining <= 0) this.deferVisit(h);
        }
        continue;
      }
      if (h.routine === 'incident') {
        h.remaining -= step;
        const site = this.incident!.origin;
        const origin = point(site.x + 0.7, site.z + Math.sign(site.z) * 0.7);
        const d = distance(h.position, origin);
        if (d > 0.1) {
          h.facing = Math.atan2(
            origin.x - h.position.x,
            origin.z - h.position.z,
          );
          h.position.x +=
            ((origin.x - h.position.x) / d) * Math.min(d, step * 1.5);
          h.position.z +=
            ((origin.z - h.position.z) / d) * Math.min(d, step * 1.5);
        }
        if (h.remaining <= 0) {
          this.incident!.phase = 'to-clinic';
          this.clinicRoute(h);
        }
        continue;
      }
      if (h.routine === 'park') {
        if (!this.park.visits.has(h.id)) {
          if (h.remaining <= 0) {
            this.goHome(h);
            continue;
          }
          this.park.enter(h);
        }
        h.remaining = Math.max(0, h.remaining - step);
        if (h.remaining <= 0) this.park.recall(h.id);
        continue;
      }
      if (h.routine === 'clinic-gather') {
        if (this.park.visits.has(h.id)) continue;
        h.remaining -= step;
        if (h.remaining <= 0) this.clinicRoute(h);
        continue;
      }
      if (
        ![
          'walk',
          'clinic-walk',
          'homeward',
          'clinic-enter',
          'clinic-exit',
        ].includes(h.routine)
      ) {
        h.remaining -= step;
        if (h.remaining > 0) continue;
        if (h.routine === 'garden') {
          h.companions = this.outingPets(h);
          h.routine = 'gather';
          h.remaining = 3;
        } else if (h.routine === 'gather') this.leave(h);
        else if (h.routine === 'chat') h.routine = 'walk';
        continue;
      }
      const target = h.route[0];
      if (!target) {
        if (h.routine === 'clinic-enter') {
          h.routine = 'clinic-wait';
          this.leisure.checkIn(h);
          const vet = localToTown(-1.3, -2.75);
          h.facing = Math.atan2(vet.x - h.position.x, vet.z - h.position.z);
          continue;
        }
        if (h.routine === 'clinic-exit') {
          h.inClinic = false;
          h.routine = 'homeward';
          h.route = clinicStreetRoute(clinicDoor, garden(layout.lots[h.lot]));
          this.revision++;
          continue;
        }
        if (h.routine === 'clinic-walk') {
          h.routine = 'clinic-wait';
          h.remaining = 60 + (h.id % 5) * 4 + this.random() * 12;
          h.facing = -Math.PI / 2;
          this.admit(h);
          continue;
        }
        if (h.routine === 'homeward') {
          this.arriveHome(h);
          continue;
        }
        h.routine = h.returning ? 'garden' : 'park';
        if (h.returning) h.companions = [];
        h.remaining = h.returning
          ? 8 + this.random() * 12
          : 35 + (h.id % 5) * 2.5 + this.random() * 10;
        if (!h.returning) this.park.enter(h);
        continue;
      }
      const speed = h.routine === 'walk' ? 1.65 : h.inClinic ? 1.4 : 2.8;
      let remaining = step;
      while (h.route.length && remaining > 1e-8) {
        const target = h.route[0];
        const crossing = layout.crossings.some(
          ([a, b]) =>
            (distance(h.position, layout.nodes[a]) < 0.06 &&
              distance(target, layout.nodes[b]) < 0.06) ||
            (distance(h.position, layout.nodes[b]) < 0.06 &&
              distance(target, layout.nodes[a]) < 0.06),
        );
        if (
          crossing &&
          this.cars.some(
            (car) =>
              !car.stopped &&
              distance(car, h.position) < 3 &&
              !(
                this.incident?.phase === 'to-clinic' &&
                this.incident.ticket === h.ticket
              ),
          )
        )
          break;
        const travel = Math.min(
          remaining,
          distance(h.position, target) / speed,
        );
        const edge = [target];
        h.facing = walkRoute(h.position, edge, travel, speed) ?? h.facing;
        remaining -= travel;
        if (!edge.length) h.route.shift();
        else break;
      }
    }
    this.leisure.update(step, this.households, this.tickets, (id) =>
      this.visit(id),
    );
    this.escort.update(step, this.households);
    for (const a of this.households) {
      if (
        this.emergencies.locked(a.id) ||
        this.dogWalks.locked(a.id) ||
        this.weather.locked(a.id) ||
        a.inClinic ||
        a.routine !== 'walk' ||
        a.chatCooldown ||
        Math.abs(a.position.z) < 2.8
      )
        continue;
      const b = this.households.find(
        (b) =>
          !this.emergencies.locked(b.id) &&
          !this.dogWalks.locked(b.id) &&
          !this.weather.locked(b.id) &&
          b.id > a.id &&
          !b.inClinic &&
          b.routine === 'walk' &&
          b.chatCooldown === 0 &&
          distance(a.position, b.position) < 2,
      );
      if (b)
        for (const h of [a, b]) {
          h.routine = 'chat';
          h.remaining = 4;
          h.chatCooldown = 14;
        }
    }
    for (const [carIndex, car] of this.cars.entries()) {
      car.stopped = this.households.some((h) => {
        if (h.inClinic || !onRoad(h.position)) return false;
        const facing = car.facing ?? (car.direction * Math.PI) / 2;
        const dx = h.position.x - car.x,
          dz = h.position.z - car.z;
        return (
          dx * Math.sin(facing) + dz * Math.cos(facing) > 0 &&
          Math.abs(dx * Math.cos(facing) - dz * Math.sin(facing)) < 2.1 &&
          distance(car, h.position) < 4
        );
      });
      car.stopped ||= Boolean(
        this.incident?.car === carIndex &&
        (this.incident.phase === 'scene' ||
          (this.incident.phase === 'to-clinic' &&
            this.households.some(
              (h) =>
                h.ticket === this.incident!.ticket &&
                Math.abs(h.position.z) < 2.8,
            ))),
      );
      car.stopped ||= this.emergencies.active?.car === carIndex;
      const rescue = this.emergencies.active;
      if (
        rescue &&
        ['dispatch', 'return'].includes(rescue.phase) &&
        rescue.engine.route.length
      )
        car.stopped ||= distance(car, rescue.engine) < 4.5;
      if (!car.stopped) {
        const route = carRoutes[carIndex];
        // Locate the forward segment, including after restoring a saved car.
        let best = Infinity,
          next = route[0];
        route.forEach((a, i) => {
          const b = route[(i + 1) % route.length],
            dx = b.x - a.x,
            dz = b.z - a.z;
          const projection =
            ((car.x - a.x) * dx + (car.z - a.z) * dz) / (dx * dx + dz * dz);
          const t = Math.max(0, Math.min(1, projection));
          const score =
            Math.hypot(car.x - a.x - dx * t, car.z - a.z - dz * t) +
            (projection >= 0.999 ? 0.01 : 0);
          if (score < best) {
            best = score;
            next = b;
          }
        });
        const d = distance(car, next),
          move = Math.min(d, step * 3.2);
        if (d > 0.0001) {
          car.facing = Math.atan2(next.x - car.x, next.z - car.z);
          car.x += ((next.x - car.x) / d) * move;
          car.z += ((next.z - car.z) / d) * move;
        }
      }
    }
  }
}
