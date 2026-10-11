import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TownSimulation } from '../src/town-simulation.ts';
import { visits } from '../src/game.ts';
import {
  partyPetPose,
  partyPlan,
  type PartyPhase,
} from '../src/pet-parties.ts';
import { characterFeeling } from '../src/character-feelings.ts';
import { messagesFor } from '../src/character-voices.ts';
import {
  distance,
  layout,
  segmentDistance,
  localToTown,
} from '../src/town-map.ts';
import { buildableCells, toClinic } from '../src/clinic-build.ts';
import { rescueTrees } from '../src/emergency-map.ts';
import { shadeTrees } from '../src/town-weather.ts';

function birthday(cursor = 0) {
  const s = new TownSimulation(visits, () => 0.5);
  s.emergencies.due = 1e6;
  s.parties.due = 0;
  s.parties.cursor = cursor;
  for (const h of s.households) h.nextCare = 1e6;
  s.update(0.1);
  return s;
}
function until(s: TownSimulation, condition: () => boolean, seconds = 220) {
  for (let i = 0; i < seconds * 10 && !condition(); i++) s.update(0.1);
  assert.ok(condition(), `condition reached by ${s.time.toFixed(1)} seconds`);
}

test('birthday invitations lead real families from their homes through the street entrance, activities and home again', () => {
  const s = birthday();
  const guests = structuredClone(s.parties.active!.guests);
  assert.equal(guests.length, 4);
  assert.equal(new Set(guests.map((g) => g.owner)).size, 4);
  assert.equal(s.events[0].kind, 'birthday-invite');
  const phases = new Set<PartyPhase>();
  const reachedEntrance = new Set<number>();
  for (let i = 0; i < 2300 && s.parties.active; i++) {
    const positions = s.households.map((h) => ({ ...h.position }));
    s.update(0.1);
    if (s.parties.active) phases.add(s.parties.active.phase);
    for (const g of guests) {
      const h = s.households[g.owner];
      assert.ok(
        distance(h.position, positions[h.id]) < 0.29,
        `${h.owner} walks continuously`,
      );
      if (distance(h.position, partyPlan.entrance) < 0.2)
        reachedEntrance.add(h.id);
      assert.equal(h.inClinic, false);
    }
    for (const g of s.parties.active?.guests ?? []) {
      if (g.stage === 'leave')
        for (const p of g.pets)
          assert.ok(
            p.position.z < 11,
            `${p.name} leaves in front of the bench`,
          );
    }
    if (s.parties.active?.guests.every((g) => g.stage === 'settled')) {
      const people = s.parties.active.guests.map(
        (g) => s.households[g.owner].position,
      );
      for (let a = 0; a < people.length; a++)
        for (let b = a + 1; b < people.length; b++)
          assert.ok(
            distance(people[a], people[b]) > 1.5,
            'separate seats, no piling up',
          );
      const pets = s.parties.active.guests.flatMap((g) =>
        g.pets.map((p) => partyPetPose(p, g, s.parties.active!)),
      );
      for (let a = 0; a < pets.length; a++)
        for (let b = a + 1; b < pets.length; b++)
          assert.ok(
            distance(pets[a], pets[b]) > 0.8,
            'each companion keeps a separate play space',
          );
    }
  }
  assert.equal(s.parties.active, undefined);
  assert.deepEqual(
    [...phases],
    ['invitations', 'welcome', 'snacks', 'games', 'farewell'],
  );
  assert.equal(reachedEntrance.size, guests.length);
  assert.equal(s.parties.celebrated.Luna, 1);
  assert.equal(s.events.filter((e) => e.kind === 'birthday').length, 1);
  const returned = new Set<number>();
  until(s, () => {
    guests.forEach((g) => {
      if (s.households[g.owner].routine === 'garden') returned.add(g.owner);
    });
    return returned.size === guests.length;
  });
  until(s, () => Boolean(s.parties.active));
  assert.notEqual(
    s.parties.active!.pet,
    'Luna',
    'birthdays rotate through the pet roster',
  );
});

test('each species enjoys its own snack and party activity, with five individual thought/speech lines', () => {
  const seen = new Set<string>();
  for (const cursor of [0, 4, 15]) {
    const s = birthday(cursor);
    until(s, () => s.parties.active?.phase === 'snacks');
    for (const g of s.parties.active!.guests) {
      const h = s.households[g.owner];
      for (const p of h.pets) {
        seen.add(p.species);
        const feeling = characterFeeling(s, h, p);
        const lines = messagesFor(p.name, feeling.text, feeling.companion);
        assert.equal(new Set(lines).size, 5);
        assert.ok(
          lines.every((line) => !line.includes(`${h.owner},`)),
          'thoughts do not address owners',
        );
      }
    }
    until(s, () => s.parties.active?.phase === 'games');
    for (const g of s.parties.active!.guests)
      for (const p of g.pets) {
        const pose = partyPetPose(p, g, s.parties.active!);
        if (p.species === 'bird') {
          assert.equal(pose.motion, 'Fly');
          assert.ok(pose.y > 1);
        }
        if (p.species === 'goldfish') {
          assert.equal(pose.motion, 'Idle');
          assert.deepEqual({ x: pose.x, z: pose.z }, p.position);
        }
      }
    for (const phase of [
      'invitations',
      'welcome',
      'snacks',
      'games',
      'farewell',
    ] as const) {
      s.parties.active!.phase = phase;
      for (const g of s.parties.active!.guests) {
        const h = s.households[g.owner];
        for (const pet of [undefined, ...h.pets]) {
          const f = characterFeeling(s, h, pet);
          assert.equal(
            new Set(messagesFor(pet?.name ?? h.owner, f.text, f.companion))
              .size,
            5,
          );
        }
      }
    }
  }
  assert.deepEqual([...seen].sort(), [
    'bird',
    'cat',
    'dog',
    'gerbil',
    'goldfish',
    'hamster',
    'rabbit',
  ]);
});

test('birthday progress restores at each stage, rejects corrupt state atomically, and does not double-count celebrations', () => {
  let s = birthday(15);
  const seen = new Set<string>();
  for (let i = 0; i < 2400 && s.parties.active; i++) {
    s.update(0.1);
    const p = s.parties.active;
    if (!p) break;
    const key = `${p.phase}:${p.guests.map((g) => g.stage).join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const saved = s.snapshot(),
      r = new TownSimulation(visits, () => 0.5);
    assert.ok(r.restore(saved), key);
    assert.deepEqual(r.parties.snapshot(), s.parties.snapshot());
    r.clinicOpen = false;
    const before = r.snapshot();
    for (const change of [
      (v: typeof saved) => {
        v.parties.due = Infinity;
      },
      (v: typeof saved) => {
        v.parties.active!.guests[1].owner = v.parties.active!.host;
      },
      (v: typeof saved) => {
        v.parties.active!.guests[0].slot = 3;
      },
      (v: typeof saved) => {
        v.parties.active!.guests[0].pets[0].name = 'Unknown';
      },
      (v: typeof saved) => {
        v.parties.active!.guests[0].pets[0].position.x = NaN;
      },
      (v: typeof saved) => {
        delete (v as Partial<typeof v>).parties;
      },
    ]) {
      const bad = structuredClone(saved);
      change(bad);
      assert.equal(r.restore(bad), false, `${key}: malformed save`);
      assert.deepEqual(r.snapshot(), before);
    }
    s = r;
  }
  assert.equal(s.parties.celebrated.Mochi, 1);
  assert.equal(s.events.filter((e) => e.kind === 'birthday').length, 1);
  assert.equal(s.parties.active, undefined);
  const legacy = new TownSimulation(visits).snapshot();
  delete (legacy as Partial<typeof legacy>).parties;
  const migrated = new TownSimulation(visits);
  assert.ok(migrated.restore(legacy));
  assert.equal(migrated.parties.due, migrated.time + 35);
});

test('care, vaccination and rescue families keep their visits while other pets party; closed games do not advance birthdays', () => {
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic([0, 1, 2]);
  assert.ok(s.requestVisit('Bubbles', 'checkup'));
  const rescue = s.households.find((h) => h.owner === 'Ruby')!;
  assert.ok(
    s.emergencies.start('lost', rescue, s.households, s.time, () => 0.5),
  );
  s.parties.due = 0;
  const care = structuredClone([...s.tickets.values()]);
  s.update(0.1);
  assert.ok(s.parties.active);
  assert.ok(
    s.parties.active.guests.every(
      (g) =>
        !s.households[g.owner].inClinic &&
        s.households[g.owner].ticket === undefined &&
        !s.emergencies.locked(g.owner),
    ),
  );
  assert.deepEqual([...s.tickets.values()], care);
  const snapshot = s.snapshot();
  const loaded = new TownSimulation(visits);
  assert.ok(loaded.restore(JSON.parse(JSON.stringify(snapshot))));
  assert.deepEqual(
    loaded.parties.snapshot(),
    s.parties.snapshot(),
    'reload does not add offline time',
  );
});

test('party hall and moved street trees clear roads, home gardens and the clinic expansion plot', () => {
  const roadClearance = (p: { x: number; z: number }) =>
    Math.min(
      ...layout.roads.flatMap((r) =>
        r.points
          .slice(1)
          .map((b, i) =>
            segmentDistance(
              p,
              { x: r.points[i][0], z: r.points[i][1] },
              { x: b[0], z: b[1] },
            ),
          ),
      ),
    );
  for (const p of [...rescueTrees, ...shadeTrees])
    assert.ok(
      roadClearance(p) > 3.7,
      `tree ${p.x},${p.z} clears asphalt and canopy`,
    );
  for (const x of [partyPlan.bounds.left, partyPlan.bounds.right])
    for (const z of [partyPlan.bounds.front, partyPlan.bounds.back]) {
      const p = { x, z };
      assert.ok(roadClearance(p) > 3.7);
      assert.ok(
        layout.lots.every(
          (h) => Math.abs(x - h.x) > 3.5 || Math.abs(z - h.z) > 3.5,
        ),
      );
    }
  assert.ok(
    buildableCells.every(
      (c) => localToTown(c.x, c.z).z < partyPlan.bounds.front - 3,
    ),
  );
});

test('trees behind the clinic do not reserve buildable land and cleared trees are skipped by new rescues', () => {
  const s = new TownSimulation(visits, () => 0.5);
  const trees = rescueTrees.filter((t) => t.z < 0);
  for (const p of trees) {
    const local = toClinic(p),
      cell = { x: Math.floor(local.x), z: Math.floor(local.z) };
    assert.ok(
      buildableCells.some((c) => c.x === cell.x && c.z === cell.z),
      'former tree exclusion is buildable',
    );
    // A fixture with floor at the tree roots tests the same occupancy used by the director/renderer.
    s.build.state.tiles.push({ ...cell, surface: 'garden' });
  }
  for (let i = 0; i < 10; i++) {
    const h = s.households.find((h) =>
      h.pets.some((p) => p.species === 'bird'),
    )!;
    s.emergencies.active = undefined;
    assert.ok(
      s.emergencies.start('lost', h, s.households, s.time, () => i / 10),
    );
    assert.ok(
      !trees.some((t) => distance(t, s.emergencies.active!.tree) < 0.01),
    );
    assert.ok(
      s.emergencies.active!.pet.route.every(
        (p) =>
          !trees.some((t) => distance(p, { x: t.x + 1, z: t.z + 1 }) < 0.01),
      ),
    );
  }
});

test('a busy clinic does not stop parties for deferred preventive care, while sick pets retain care priority', () => {
  const s = new TownSimulation(visits, () => 0.5);
  s.emergencies.due = 9999;
  s.parties.due = 0;
  for (const h of s.households) {
    assert.ok(
      s.requestVisit(
        h.pets[0].name,
        h.id === 0 ? 'fever' : h.id === 1 ? 'vaccination' : 'checkup',
      ),
    );
    s.tickets.get(h.ticket!)!.status = 'deferred';
    h.retryCareAt = 9999;
    h.routine = 'garden';
    h.route = [];
  }
  s.update(0.1);
  assert.equal(s.parties.active?.host, 1);
  assert.ok(s.parties.active!.guests.every((g) => g.owner !== 0));
  const ticketIds = [...s.tickets.keys()];
  until(s, () => s.parties.active?.phase === 'games');
  const saved = s.snapshot(),
    loaded = new TownSimulation(visits);
  assert.ok(loaded.restore(saved));
  assert.deepEqual(loaded.parties.snapshot(), s.parties.snapshot());
  assert.deepEqual([...loaded.tickets.keys()], ticketIds);
  assert.ok([...loaded.tickets.values()].every((t) => t.status === 'deferred'));
  const invalid = structuredClone(saved);
  invalid.tickets.find((t) => t.id === s.households[1].ticket)!.reason =
    'fever';
  assert.equal(
    loaded.restore(invalid),
    false,
    'a care-needing patient cannot be saved at a birthday',
  );
  assert.deepEqual(loaded.parties.snapshot(), s.parties.snapshot());
});
