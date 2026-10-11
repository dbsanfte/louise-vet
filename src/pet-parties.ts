import plan from './party-layout.json' with { type: 'json' };
import type { Household } from './town-simulation.ts';
import type { Species, Visit } from './game.ts';
import {
  distance,
  garden,
  layout,
  routeBetween,
  type Point,
} from './town-map.ts';
import { walkRoute } from './movement.ts';

export const partyPlan = plan;
export type PartyPhase =
  'invitations' | 'welcome' | 'snacks' | 'games' | 'farewell';
export type PartyPet = {
  name: string;
  species: Species;
  position: Point;
  facing: number;
};
export type PartyGuest = {
  owner: number;
  slot: number;
  stage: 'gather' | 'travel' | 'arrive' | 'settled' | 'leave' | 'gone';
  route: Point[];
  pets: PartyPet[];
};
export type BirthdayParty = {
  pet: string;
  host: number;
  phase: PartyPhase;
  elapsed: number;
  guests: PartyGuest[];
};
export type PartyEvent = 'birthday-invite' | 'birthday' | 'party-home';

export function partySpot(slot: number, index: number): Point {
  return { x: plan.seats[slot].x, z: 8 + index * 1.6 };
}
export function partyPetPose(
  p: PartyPet,
  guest: PartyGuest,
  party: BirthdayParty,
) {
  const moving = guest.stage !== 'settled';
  const playing = !moving && party.phase === 'games';
  const bird = p.species === 'bird',
    fish = p.species === 'goldfish';
  const phase = party.elapsed * 2.2 + guest.slot + guest.pets.indexOf(p);
  const playRadius =
    0.24 *
    Math.min(1, party.elapsed / 1.5, Math.max(0, (30 - party.elapsed) / 1.5));
  return {
    ...p.position,
    y: fish ? 0.3 : bird ? (moving || playing ? 1.1 : 0.55) : 0.2,
    facing: !moving && party.phase === 'snacks' ? -0.74 : p.facing,
    motion: (bird && (moving || playing)
      ? 'Fly'
      : fish
        ? 'Idle'
        : moving
          ? 'Walk'
          : playing
            ? 'Play'
            : 'Idle') as 'Fly' | 'Idle' | 'Walk' | 'Play',
    // Each pet has its own little play mat; no shared centre to pile onto.
    ...(playing && !fish
      ? {
          x: p.position.x + Math.sin(phase) * playRadius,
          z: p.position.z + Math.cos(phase) * playRadius,
          facing: Math.PI / 2 - phase,
        }
      : {}),
  };
}

/** Birthdays use the active town clock, never wall time or a pet's clinical age. */
export class PetParties {
  due = 35;
  cursor = 0;
  celebrated: Record<string, number> = {};
  active?: BirthdayParty;

  guest(id: number) {
    return this.active?.guests.find(
      (g) => g.owner === id && g.stage !== 'gone',
    );
  }
  description() {
    const p = this.active;
    if (!p)
      return 'Pet Party Hall · birthdays, bubbles and games with friends.';
    const activity: Record<PartyPhase, string> = {
      invitations: 'Friends are on their way',
      welcome: 'A birthday cheer',
      snacks: 'Pet-safe snack time',
      games: 'Bubbles and party games',
      farewell: 'Saying goodbye',
    };
    return `${p.pet}’s birthday · ${activity[p.phase]}.`;
  }
  status(id: number) {
    const g = this.guest(id),
      p = this.active;
    if (!g || !p) return undefined;
    return ['gather', 'travel', 'arrive'].includes(g.stage)
      ? `Going to ${p.pet}’s birthday at the Pet Party Hall`
      : g.stage === 'leave'
        ? 'Saying goodbye to party friends'
        : this.description();
  }
  arrive(h: Household) {
    const g = this.guest(h.id);
    if (!g || g.stage !== 'travel') return;
    g.stage = 'arrive';
    h.routine = 'party';
    const seat = plan.seats[g.slot];
    // Enter along the front aisle, then pass beside the activity mats to the seat.
    g.route = [
      { x: seat.x + 0.6, z: 5.8 },
      { x: seat.x + 0.6, z: 10.6 },
      { ...seat },
    ];
    g.pets.forEach((p, i) => {
      p.position = { x: h.position.x, z: h.position.z - 0.3 - i * 0.4 };
    });
  }
  update(
    dt: number,
    time: number,
    households: Household[],
    roster: Visit[],
    locked: (id: number) => boolean,
    emit: (pet: string, kind: PartyEvent) => void,
    careReady: (h: Household) => boolean = (h) => h.ticket === undefined,
  ) {
    if (!this.active) {
      if (time < this.due) return;
      const available = households.filter(
        (h) =>
          !h.inClinic &&
          careReady(h) &&
          !locked(h.id) &&
          ['garden', 'gather'].includes(h.routine),
      );
      if (available.length < 2) {
        this.due = time + 12;
        return;
      }
      const ordered = roster.map(
        (_, i) => roster[(this.cursor + i) % roster.length],
      );
      // A pet whose earlier turn fell during care keeps priority next time.
      ordered.sort(
        (a, b) =>
          (this.celebrated[a.name] ?? 0) - (this.celebrated[b.name] ?? 0),
      );
      const pet = ordered.find((p) =>
        available.some((h) => h.owner === p.owner),
      )!;
      const host = available.find((h) => h.owner === pet.owner)!;
      // Rotate the guest list as well as the birthday child; at most four families leave town routines.
      const friends = available
        .filter((h) => h !== host)
        .sort(
          (a, b) =>
            ((a.id - host.id + households.length) % households.length) -
            ((b.id - host.id + households.length) % households.length),
        )
        .slice(0, 3);
      this.cursor = (roster.indexOf(pet) + 1) % roster.length;
      this.active = {
        pet: pet.name,
        host: host.id,
        phase: 'invitations',
        elapsed: 0,
        guests: [host, ...friends].map((h, slot) => {
          h.routine = 'party-gather';
          h.remaining = 3 + slot * 1.8;
          h.companions = h.pets.map((p) => p.name);
          h.returning = false;
          h.route = [];
          return {
            owner: h.id,
            slot,
            stage: 'gather',
            route: [],
            pets: h.pets.map((p) => ({
              name: p.name,
              species: p.species,
              position: { ...h.position },
              facing: h.facing,
            })),
          };
        }),
      };
      emit(pet.name, 'birthday-invite');
    }
    const party = this.active;
    party.elapsed += dt;
    for (const g of party.guests) {
      const h = households[g.owner];
      if (g.stage === 'gone' || g.stage === 'travel') continue;
      if (g.stage === 'gather') {
        h.remaining -= dt;
        if (h.remaining <= 0) {
          g.stage = 'travel';
          h.routine = 'party-walk';
          h.route = [
            ...routeBetween(h.position, plan.street),
            { x: -20, z: 3 },
            { ...plan.entrance },
          ];
        }
        continue;
      }
      const walkingOut = g.stage === 'leave';
      const before = { ...h.position };
      h.facing = walkRoute(h.position, g.route, dt, 1.35) ?? h.facing;
      if (g.stage === 'arrive' && !g.route.length) {
        const ready = g.pets.every(
          (p, i) => distance(p.position, partySpot(g.slot, i)) < 0.04,
        );
        if (ready) {
          g.stage = 'settled';
          h.facing = Math.PI;
        }
      }
      for (const [i, p] of g.pets.entries()) {
        const target = walkingOut
          ? h.position.z > 10.1
            ? { x: plan.seats[g.slot].x + 0.6, z: 10.1 - i * 0.45 }
            : {
                x: before.x - Math.sin(h.facing) * (0.35 + i * 0.35),
                z: before.z - Math.cos(h.facing) * (0.35 + i * 0.35),
              }
          : partySpot(g.slot, i);
        // Gather in front of the bench before following; never aim behind its backrest.
        // Fish are carried in their bowls when travelling and remain in them on their mats.
        p.facing = walkRoute(p.position, [target], dt, 1.6) ?? p.facing;
      }
      if (
        walkingOut &&
        !g.route.length &&
        g.pets.every((p) => distance(p.position, h.position) < 1.1)
      ) {
        g.stage = 'gone';
        h.routine = 'walk';
        h.returning = true;
        h.route = [
          { x: -20, z: 3 },
          { ...plan.street },
          ...routeBetween(plan.street, garden(layout.lots[h.lot])),
        ];
        h.chatCooldown = 14;
      }
    }
    const durations: Record<PartyPhase, number> = {
      invitations: 120,
      welcome: 10,
      snacks: 16,
      games: 30,
      farewell: 6,
    };
    if (
      (party.phase === 'invitations' &&
        party.guests.every((g) => g.stage === 'settled')) ||
      (party.phase !== 'farewell' && party.elapsed >= durations[party.phase])
    ) {
      const phases: PartyPhase[] = [
        'invitations',
        'welcome',
        'snacks',
        'games',
        'farewell',
      ];
      party.phase = phases[phases.indexOf(party.phase) + 1];
      party.elapsed = 0;
      if (party.phase === 'welcome') {
        this.celebrated[party.pet] = (this.celebrated[party.pet] ?? 0) + 1;
        emit(party.pet, 'birthday');
      }
    }
    if (party.phase === 'farewell' && party.elapsed >= 6) {
      for (const g of party.guests) {
        if (g.stage !== 'settled') continue;
        const seat = plan.seats[g.slot];
        // Leave in staggered families, using the same clear aisle as the arrival.
        if (party.elapsed < 6 + g.slot * 2) continue;
        g.stage = 'leave';
        g.route = [
          { x: seat.x + 0.6, z: 10.6 },
          { x: seat.x + 0.6, z: 5.8 },
          { ...plan.entrance },
        ];
      }
      if (party.guests.every((g) => g.stage === 'gone')) {
        emit(party.pet, 'party-home');
        this.active = undefined;
        this.due = time + 90;
      }
    }
  }
  snapshot() {
    return structuredClone({
      version: 1,
      due: this.due,
      cursor: this.cursor,
      celebrated: this.celebrated,
      active: this.active,
    });
  }
  restore(
    value: unknown,
    households: Household[],
    roster: Visit[],
    time: number,
    careReady: (h: Household) => boolean = (h) => h.ticket === undefined,
  ) {
    const partyFamilies = households.filter((h) =>
      h.routine.startsWith('party'),
    );
    if (value === undefined) {
      this.due = time + 35;
      return partyFamilies.length === 0;
    }
    try {
      const s = value as ReturnType<PetParties['snapshot']>;
      const number = (n: unknown, max = 1e9): n is number =>
        typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
      const integer = (n: unknown, max: number): n is number =>
        number(n, max) && Number.isInteger(n);
      const inside = (p: Point) =>
        p &&
        Number.isFinite(p.x) &&
        Number.isFinite(p.z) &&
        p.x >= -24 &&
        p.x <= -16 &&
        p.z >= 3.5 &&
        p.z <= 12.5;
      if (
        !s ||
        s.version !== 1 ||
        !number(s.due) ||
        !integer(s.cursor, roster.length - 1) ||
        !s.celebrated ||
        Array.isArray(s.celebrated) ||
        typeof s.celebrated !== 'object' ||
        Object.entries(s.celebrated).some(
          ([name, n]) =>
            !roster.some((p) => p.name === name) || !integer(n, 1e6),
        )
      )
        return false;
      const p = s.active;
      if (p) {
        if (
          !integer(p.host, households.length - 1) ||
          !households[p.host].pets.some((a) => a.name === p.pet) ||
          !['invitations', 'welcome', 'snacks', 'games', 'farewell'].includes(
            p.phase,
          ) ||
          !number(p.elapsed, 10000) ||
          !Array.isArray(p.guests) ||
          p.guests.length < 2 ||
          p.guests.length > 4 ||
          p.guests[0].owner !== p.host
        )
          return false;
        const ids = new Set<number>();
        for (const [slot, g] of p.guests.entries()) {
          const h = households[g.owner];
          if (
            !integer(g.owner, households.length - 1) ||
            ids.has(g.owner) ||
            g.slot !== slot ||
            ![
              'gather',
              'travel',
              'arrive',
              'settled',
              'leave',
              'gone',
            ].includes(g.stage) ||
            !Array.isArray(g.route) ||
            g.route.length > 3 ||
            !g.route.every(inside) ||
            !Array.isArray(g.pets) ||
            g.pets.length !== h.pets.length
          )
            return false;
          ids.add(g.owner);
          const expected =
            g.stage === 'gather'
              ? 'party-gather'
              : g.stage === 'travel'
                ? 'party-walk'
                : 'party';
          if (
            g.stage !== 'gone' &&
            (h.routine !== expected ||
              h.inClinic ||
              !careReady(h) ||
              h.companions.length !== h.pets.length ||
              h.pets.some((p) => !h.companions.includes(p.name)))
          )
            return false;
          if (g.stage === 'gone' && h.routine.startsWith('party')) return false;
          if (
            ['arrive', 'settled', 'leave'].includes(g.stage) &&
            !inside(h.position)
          )
            return false;
          for (const [i, pet] of g.pets.entries()) {
            if (
              pet.name !== h.pets[i].name ||
              pet.species !== h.pets[i].species ||
              !Number.isFinite(pet.facing) ||
              !pet.position ||
              !Number.isFinite(pet.position.x) ||
              !Number.isFinite(pet.position.z) ||
              Math.abs(pet.position.x) > 48 ||
              Math.abs(pet.position.z) > 44 ||
              (['arrive', 'settled', 'leave'].includes(g.stage) &&
                !inside(pet.position))
            )
              return false;
          }
          if (
            g.stage === 'settled' &&
            (g.route.length ||
              distance(h.position, plan.seats[slot]) > 0.05 ||
              g.pets.some(
                (pet, i) => distance(pet.position, partySpot(slot, i)) > 0.05,
              ))
          )
            return false;
        }
        if (partyFamilies.some((h) => !ids.has(h.id))) return false;
        if (p.phase !== 'invitations' && !(s.celebrated[p.pet] > 0))
          return false;
      } else if (partyFamilies.length) return false;
      this.due = s.due;
      this.cursor = s.cursor;
      this.celebrated = structuredClone(s.celebrated);
      this.active = structuredClone(p);
      return true;
    } catch {
      return false;
    }
  }
}
