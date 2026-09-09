import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TownSimulation } from '../src/town-simulation.ts';
import { communityVisit, visits } from '../src/game.ts';
import { distance } from '../src/town-map.ts';
import {
  rescueTrees,
  rescuePerch,
  stations,
  emergencyDrive,
} from '../src/emergency-map.ts';
import { callToRoom } from './clinic-helpers.ts';
import type { RescueKind, RescuePhase } from '../src/emergencies.ts';

function fixture(name: string, kind: RescueKind, random = () => 0.5) {
  const s = new TownSimulation(visits, random);
  const h = s.households.find((h) => h.pets.some((p) => p.name === name))!;
  for (const f of s.households) {
    f.remaining = 290;
    f.nextCare = 9999;
  }
  assert.ok(s.emergencies.start(kind, h, s.households, s.time, random));
  if (kind === 'lost') s.emergencies.active!.pets = [name];
  return s;
}
function step(s: TownSimulation) {
  for (const h of s.households) if (h.routine === 'garden') h.remaining = 290;
  s.update(0.1);
}
function until(s: TownSimulation, ready: () => boolean, seconds = 400) {
  for (let i = 0; i < seconds * 10 && !ready(); i++) step(s);
  assert.ok(ready(), `Timed out at ${s.emergencies.active?.phase}`);
}

for (const name of ['Pico', 'Milo', 'Luna'])
  test(`${name}: lost search, reunion, saved phases and real care journey`, () => {
    const s = fixture(name, 'lost');
    const e = s.emergencies.active!,
      home = { ...e.owner };
    const phases = new Set<RescuePhase>();
    let maxHeight = 0;
    for (let i = 0; i < 4000 && s.emergencies.active; i++) {
      step(s);
      const current = s.emergencies.active;
      if (!current) break;
      if (current.phase === 'wander')
        assert.equal(
          distance(current.owner, home),
          0,
          'owner waits until pet out of sight',
        );
      if (current.phase === 'descend') {
        assert.ok(
          Math.abs(current.pet.y - current.firefighter.y - 0.85) < 0.01,
        );
      }
      maxHeight = Math.max(maxHeight, current.firefighter.y);
      if (!phases.has(current.phase)) {
        phases.add(current.phase);
        const reload = new TownSimulation(visits);
        assert.ok(reload.restore(s.snapshot()), `restore ${current.phase}`);
        assert.deepEqual(
          reload.emergencies.snapshot(),
          s.emergencies.snapshot(),
        );
      }
    }
    assert.equal(s.emergencies.active, undefined);
    assert.equal(s.emergencies.completed, 1);
    for (const phase of ['wander', 'report', 'search', 'handover', 'return'])
      assert.ok(phases.has(phase as RescuePhase), phase);
    if (name !== 'Luna') {
      for (const phase of [
        'dispatch',
        'unload',
        'ladder',
        'climb',
        'rescue',
        'descend',
      ])
        assert.ok(phases.has(phase as RescuePhase), phase);
      assert.ok(maxHeight > 2);
    }
    assert.equal(s.tickets.size, 1);
    const ticket = [...s.tickets.values()][0];
    assert.equal(ticket.pet, name);
    assert.equal(ticket.reason, 'rescue');
    until(s, () => s.queue.includes(ticket.id));
    callToRoom(s, ticket.id);
    assert.ok(s.abortVisit(ticket.id));
    callToRoom(s, ticket.id);
    assert.ok(s.completeVisit(ticket.id));
    assert.equal(s.completeVisit(ticket.id), false);
    until(s, () => !s.tickets.has(ticket.id));
  });

test('cats encounter a real dog before climbing the nearest tree and can jump while awaiting help', () => {
  const s = fixture('Milo', 'lost');
  until(s, () => s.emergencies.active!.chased);
  const e = s.emergencies.active!;
  assert.ok(
    s.households[e.chaser!].pets.some(
      (p) => p.name === e.chaserPet && p.species === 'dog',
    ),
  );
  assert.ok(distance(e.chase!, e.pet) < 4.5);
  assert.equal(
    distance(e.tree, e.pet),
    Math.min(...rescueTrees.map((t) => distance(t, e.pet))),
  );
  until(s, () => e.trapped);
  e.jumpAt = 0;
  s.emergencies.update(
    0.1,
    s.time,
    s.households,
    s.cars,
    () => 0,
    () => assert.fail('not handed over yet'),
  );
  assert.equal(e.injury, 'accident');
  assert.equal(e.trapped, false);
  assert.equal(e.pet.y, 0.2);
  until(s, () => e.delivered);
  assert.equal(s.visit([...s.tickets.keys()][0]).clinical?.fracture, true);
});

test('birds flap between several real trees before waiting for their ladder rescue', () => {
  const s = fixture('Pico', 'lost');
  const e = s.emergencies.active!;
  const perches = new Set<string>();
  until(s, () => {
    if (!e.pet.route.length) perches.add(`${e.pet.x},${e.pet.z}`);
    return e.phase === 'dispatch';
  });
  assert.ok(perches.size >= 2);
  assert.ok(rescueTrees.some((t) => distance(rescuePerch(t), e.pet) < 0.01));
  assert.ok(e.trapped);
});

test('road contact stops the actual driver until owner collection, then resumes traffic', () => {
  const s = fixture('Luna', 'lost', () => 0.2);
  const e = s.emergencies.active!;
  e.pet.x = s.cars[0].x;
  e.pet.z = s.cars[0].z;
  e.pet.route = [{ x: e.pet.x + 3, z: e.pet.z }];
  step(s);
  assert.equal(e.kind, 'road');
  assert.equal(e.car, 0);
  const car = { ...s.cars[0] };
  until(s, () => e.phase === 'collect');
  assert.equal(s.cars[0].x, car.x);
  assert.equal(s.cars[0].stopped, true);
  assert.equal(s.tickets.size, 0);
  until(s, () => e.phase === 'driver-return');
  assert.ok(e.delivered);
  assert.equal(s.cars[0].stopped, true);
  assert.equal(s.visit([...s.tickets.keys()][0]).diagnosis, 'Broken bone');
  until(s, () => e.car === undefined);
  until(s, () => distance(s.cars[0], car) > 1);
});

for (const name of ['Milo', 'Luna', 'Clover'])
  test(`${name}: house fire clears completely and every resident pet receives separate care`, () => {
    const s = fixture(name, 'fire');
    const e = s.emergencies.active!,
      victims = [...e.pets];
    assert.ok(victims.length >= 1);
    let lastFire = 1;
    const seen = new Set<string>();
    until(s, () => {
      if (e.phase === 'extinguish') {
        assert.ok(e.fire <= lastFire);
        lastFire = e.fire;
      }
      if (['enter-house', 'exit-house', 'handover', 'return'].includes(e.phase))
        assert.equal(e.fire, 0);
      if (!seen.has(e.phase)) {
        seen.add(e.phase);
        assert.ok(new TownSimulation(visits).restore(s.snapshot()), e.phase);
      }
      return !s.emergencies.active;
    });
    assert.equal(e.rescued, victims.length);
    assert.equal(e.fire, 0);
    assert.ok(seen.has('exit-house'));
    const treated: string[] = [];
    for (let i = 0; i < 4000 && treated.length < victims.length; i++) {
      step(s);
      for (const id of [...s.queue]) {
        const ticket = s.tickets.get(id)!;
        assert.equal(ticket.reason, 'post-fire');
        callToRoom(s, id);
        if (!treated.length) {
          assert.ok(s.abortVisit(id));
          assert.ok(new TownSimulation(visits).restore(s.snapshot()));
          callToRoom(s, id);
        }
        treated.push(ticket.pet);
        assert.ok(s.completeVisit(id));
        assert.equal(s.completeVisit(id), false);
        assert.ok(
          new TownSimulation(visits).restore(s.snapshot()),
          'between sibling appointments',
        );
      }
    }
    assert.deepEqual(treated.sort(), victims.sort());
    assert.equal(s.emergencies.pending.length, 0);
  });

test('emergency scheduling occurs naturally, one story at a time, across town rhythms', () => {
  const kinds = new Set<string>();
  let completed = 0;
  for (let seed = 1; seed <= 6; seed++) {
    let state = seed;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const s = new TownSimulation(visits, random);
    let firstStory = Infinity;
    for (let i = 0; i < 9000; i++) {
      s.update(0.1);
      if (s.emergencies.active) {
        firstStory = Math.min(firstStory, s.time);
        kinds.add(s.emergencies.active.kind);
      }
      for (const id of [...s.queue]) {
        if (s.startVisit(id)) s.completeVisit(id);
      }
    }
    assert.ok(
      firstStory <= 90,
      `first story at ${firstStory}s for seed ${seed}`,
    );
    completed += s.emergencies.completed;
    assert.ok(new TownSimulation(visits).restore(s.snapshot()));
  }
  assert.ok(kinds.has('lost'));
  assert.ok(kinds.has('fire'));
  assert.ok(
    completed >= 18,
    `at least three completed stories per 15 minutes on average: ${completed}`,
  );
});

test('old saves migrate, invalid rescue saves fail atomically, routes connect both services', () => {
  const s = fixture('Luna', 'fire');
  const before = s.snapshot();
  for (const mutate of [
    (v: typeof before) => {
      v.emergencies.active!.fire = 2;
    },
    (v: typeof before) => {
      v.emergencies.active!.firefighter.route = [{ x: Infinity, z: 0 }];
    },
    (v: typeof before) => {
      v.emergencies.active!.pets = ['not a resident'];
    },
    (v: typeof before) => {
      v.emergencies.active!.families = [0, 0];
    },
  ]) {
    const broken = structuredClone(before);
    mutate(broken);
    assert.equal(s.restore(broken), false);
    assert.deepEqual(s.snapshot(), before);
  }
  const legacy = structuredClone(before) as Partial<typeof before>;
  delete legacy.emergencies;
  const migrated = new TownSimulation(visits);
  assert.ok(migrated.restore(legacy));
  assert.equal(migrated.emergencies.active, undefined);
  for (const p of [
    ...rescueTrees,
    ...s.households.map((h) => h.home),
    stations.police.door,
  ])
    assert.ok(emergencyDrive(stations.fire.door, p).length);
});

test('rescue care is species appropriate, with fish water checks and gentle smoke/burn care', () => {
  for (const pet of visits) {
    const visit = communityVisit(pet, 'post-fire');
    assert.equal(visit.checks.length, 2);
    if (pet.species === 'goldfish') {
      assert.equal(visit.treatment, 'water-care');
      assert.ok(visit.checks.some((c) => c.tool === 'water-test'));
    } else {
      assert.equal(visit.treatment, 'cooling');
      assert.equal(visit.clinical?.skin, 'burn');
      assert.ok(visit.checks.some((c) => c.tool === 'listen'));
    }
  }
});

test('resuming a mid-rescue save completes exactly one handover and follows the responders home', () => {
  for (const [name, kind, phase] of [
    ['Pico', 'lost', 'descend'],
    ['Luna', 'fire', 'exit-house'],
  ] as const) {
    const s = fixture(name, kind);
    until(s, () => s.emergencies.active?.phase === phase);
    const resumed = new TownSimulation(visits, () => 0.5);
    assert.ok(resumed.restore(s.snapshot()));
    const pets = [...resumed.emergencies.active!.pets];
    until(resumed, () => resumed.emergencies.active?.phase === 'return');
    const e = resumed.emergencies.active!;
    assert.equal(
      resumed.emergencies.focus(resumed.households),
      e.engine.route.length ? e.engine : e.police,
    );
    const again = new TownSimulation(visits, () => 0.5);
    assert.ok(again.restore(resumed.snapshot()));
    until(again, () => !again.emergencies.active);
    assert.equal(again.emergencies.completed, 1);
    assert.equal(
      [...again.tickets.values()].filter(
        (t) => pets.includes(t.pet) && t.reason === e.injury,
      ).length + again.emergencies.pending.length,
      pets.length,
    );
  }
});

test('an accident patient waiting for care does not silence other households rescue stories', () => {
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic([0, 1, 2]);
  const incident = {
    ticket: 0,
    car: 0,
    origin: { x: 18, z: 1 },
    phase: 'at-clinic' as const,
  };
  s.emergencies.update(
    0.1,
    40,
    s.households,
    s.cars,
    () => 0.5,
    () => assert.fail('a new story must play before handover'),
    incident,
    s.tickets,
  );
  assert.ok(s.emergencies.active);
  assert.notEqual(
    s.emergencies.active.household,
    s.households.find((h) => h.ticket === 0)!.id,
  );
  assert.equal(incident.phase, 'at-clinic');
  const story = s.emergencies.active;
  s.emergencies.update(
    0.1,
    300,
    s.households,
    s.cars,
    () => 0.5,
    () => {},
    incident,
    s.tickets,
  );
  assert.equal(
    s.emergencies.active,
    story,
    'an active rescue cannot be replaced by an overdue event',
  );
});

test('old saves get shorter quiet periods once, while current timers and active stories are preserved', () => {
  const s = new TownSimulation(visits, () => 0.5);
  const current = s.snapshot();
  current.emergencies.due = 400;
  current.households[0].remaining = 200;
  const old: Partial<typeof current> = structuredClone(current);
  delete old.activityPace;
  const resumed = new TownSimulation(visits);
  assert.ok(resumed.restore(old));
  assert.equal(resumed.emergencies.due, 35);
  assert.equal(resumed.households[0].remaining, 20);
  assert.ok(resumed.restore(current));
  assert.equal(
    resumed.emergencies.due,
    400,
    'new saves retain their exact timer',
  );
  const live = fixture('Pico', 'lost').snapshot();
  const legacyLive: Partial<typeof live> = structuredClone(live);
  delete legacyLive.activityPace;
  assert.ok(resumed.restore(legacyLive));
  assert.deepEqual(resumed.emergencies.active, live.emergencies.active);
});

test('nearby lost cats can be collected immediately instead of evading capture for three minutes', () => {
  const s = fixture('Mochi', 'lost');
  const e = s.emergencies.active!;
  Object.assign(e, {
    phase: 'search',
    age: 20,
    elapsed: 0,
    chased: false,
    chase: undefined,
  });
  Object.assign(e.pet, { x: 0, z: -3, route: [{ x: 6, z: -3 }] });
  Object.assign(e.police, { x: -1, z: -3, route: [{ x: 0, z: -3 }] });
  Object.assign(e.owner, { x: -2, z: -3, route: [] });
  step(s);
  assert.equal(e.phase, 'handover');
  assert.equal(e.pet.route.length, 0);
  until(s, () => e.delivered, 15);
  assert.ok(distance(e.owner, e.pet) < 1);
  assert.equal(
    [...s.tickets.values()].filter((t) => t.pet === 'Mochi').length,
    1,
  );
});

test('a recalled dog waits in place across reloads while the search party catches up', () => {
  const s = fixture('Luna', 'lost');
  const e = s.emergencies.active!;
  Object.assign(e, { phase: 'search', age: 50, elapsed: 0 });
  Object.assign(e.pet, { x: 0, z: -3, route: [{ x: 8, z: -3 }] });
  Object.assign(e.police, { x: -5, z: -3, route: [{ x: 0, z: -3 }] });
  Object.assign(e.owner, { x: -6, z: -3, route: [] });
  step(s);
  assert.equal(e.recalled, true);
  const snapshot = s.snapshot();
  for (const legacy of [false, true]) {
    const save = structuredClone(snapshot);
    if (legacy) delete save.emergencies.active!.recalled;
    const resumed = new TownSimulation(visits, () => 0.5);
    assert.ok(resumed.restore(save));
    const dog = resumed.emergencies.active!;
    const spot = { x: dog.pet.x, z: dog.pet.z };
    until(resumed, () => dog.delivered, 25);
    assert.equal(distance(spot, dog.pet), 0);
    assert.ok(distance(dog.owner, dog.pet) < 1);
    assert.equal(resumed.tickets.size, 1);
  }
});
