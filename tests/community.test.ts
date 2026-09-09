import { callToRoom } from './clinic-helpers.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TownSimulation } from '../src/town-simulation.ts';
import { communityVisit, visits } from '../src/game.ts';
const tick = (s: TownSimulation, seconds: number) => {
  for (let i = 0; i < seconds * 10; i++) s.update(0.1);
};

function community() {
  const s = new TownSimulation(visits, () => 0.5);
  const snapshot = s.snapshot();
  snapshot.catalogueCursor = visits.length;
  assert.equal(s.restore(snapshot), true);
  return s;
}

test('a requested visit travels from its real home, arrives, aborts, completes once, and returns home', () => {
  const s = community();
  assert.equal(s.requestVisit('Maple', 'fever'), true);
  const t = [...s.tickets.values()][0];
  const h = s.households.find((h) => h.owner === 'Isla')!;
  assert.equal(s.queue.length, 0);
  assert.equal(h.routine, 'clinic-gather');
  tick(s, 3);
  assert.equal(h.routine, 'clinic-walk');
  assert.equal(h.inClinic, false);
  const travelling = JSON.parse(JSON.stringify(s.snapshot()));
  const reloaded = community();
  assert.equal(reloaded.restore(travelling), true);
  assert.deepEqual(reloaded.households[h.id].position, h.position);
  tick(s, 45);
  assert.ok(s.queue.includes(t.id));
  assert.equal(h.inClinic, true);
  assert.equal(s.visit(t.id).name, 'Maple');
  assert.equal(s.visit(t.id).diagnosis, 'Fever');
  assert.equal(
    s.requestVisit('Sunny', 'checkup'),
    false,
    'one owner cannot make two journeys at once',
  );
  assert.equal(callToRoom(s, t.id), true);
  assert.equal(s.abortVisit(t.id), true);
  assert.equal(s.queue[0], t.id);
  assert.equal(s.abortVisit(t.id), false);
  assert.equal(callToRoom(s, t.id), true);
  const examReload = community();
  assert.equal(examReload.restore(s.snapshot()), true);
  assert.equal(
    examReload.queue[0],
    t.id,
    'unfinished exam returns to its queue',
  );
  assert.equal(s.completeVisit(t.id), true);
  assert.equal(s.completeVisit(t.id), false);
  assert.equal(h.routine, 'clinic-exit');
  assert.equal(h.inClinic, true);
  tick(s, 8);
  assert.equal(h.routine, 'homeward');
  assert.equal(h.inClinic, false);
  tick(s, 45);
  assert.equal(s.tickets.has(t.id), false);
  assert.ok(s.events.some((e) => e.pet === 'Maple' && e.kind === 'home'));
});

for (const name of ['Luna', 'Milo'])
  test(`${name} road contact creates a matching recoverable fracture and clinic journey`, () => {
    const s = community();
    const state = s.snapshot();
    state.time = 101;
    state.accidentDue = 100;
    // Isolate the forced road contact from the now-earlier automatic rescue scheduler.
    state.emergencies.due = 99999;
    const home = state.households.find(
      (h) => h.owner === visits.find((p) => p.name === name)!.owner,
    )!;
    home.position = { x: 18, z: 3 };
    home.routine = 'walk';
    home.returning = false;
    home.route = [{ x: 18, z: -3 }];
    state.cars[2].x = 19.5;
    assert.equal(s.restore(state), true);
    s.update(0.1);
    assert.ok(s.incident);
    assert.equal(s.incident.phase, 'scene');
    assert.equal(s.cars[2].stopped, true);
    const id = s.incident.ticket;
    assert.equal(s.visit(id).name, name);
    assert.equal(s.visit(id).diagnosis, 'Broken bone');
    assert.equal(s.visit(id).clinical?.fracture, true);
    assert.match(s.visit(id).quote, /car bumped/);
    const restored = community();
    assert.equal(restored.restore(s.snapshot()), true);
    assert.deepEqual(restored.incident, s.incident);
    tick(s, 6);
    assert.equal(s.incident.phase, 'to-clinic');
    tick(s, 45);
    assert.ok(s.queue.includes(id));
    assert.equal(s.incident.phase, 'at-clinic');
    assert.equal(callToRoom(s, id), true);
    assert.equal(s.completeVisit(id), true);
    assert.equal(s.incident.phase, 'recovering');
    tick(s, 45);
    assert.equal(s.incident.phase, 'resolved');
  });

test('full clinic keeps an accident family safely outside until space opens', () => {
  const s = community();
  s.seedClinic([0, 1, 2]);
  s.configureClinic(3, 22);
  const state = s.snapshot();
  state.catalogueCursor = visits.length;
  state.time = 101;
  state.accidentDue = 100;
  // Isolate the forced road contact from the now-earlier automatic rescue scheduler.
  state.emergencies.due = 99999;
  const h = state.households.find((h) => h.owner === 'Grace')!;
  h.position = { x: 18, z: 3 };
  h.routine = 'walk';
  h.route = [{ x: 18, z: -3 }];
  state.cars[2].x = 19.5;
  assert.ok(s.restore(state));
  tick(s, 45);
  const id = s.incident!.ticket;
  assert.equal(s.queue.length, 3);
  assert.equal(s.tickets.get(id)?.status, 'travelling');
  const family = s.households.find((h) => h.ticket === id)!;
  assert.equal(family.routine, 'clinic-wait');
  assert.equal(family.inClinic, false);
  callToRoom(s, 0);
  s.completeVisit(0);
  tick(s, 1);
  assert.equal(
    s.queue.includes(id),
    false,
    'the departing family clears the entrance first',
  );
  for (let i = 0; i < 200 && !s.queue.includes(id); i++) s.update(0.1);
  assert.ok(s.queue.includes(id));
  assert.equal(s.queue.length, 3);
});

test('regular care cycles include vaccines, checkups and fevers without duplicating owners', () => {
  const s = community();
  const seen = new Set<string>();
  for (let n = 0; n < 12000; n++) {
    s.update(0.1);
    for (const id of [...s.queue]) {
      seen.add(s.tickets.get(id)!.reason);
      s.startVisit(id);
      s.completeVisit(id);
    }
    const active = [...s.tickets.values()].map((t) => s.visit(t.id).owner);
    assert.equal(new Set(active).size, active.length);
  }
  for (const reason of ['vaccination', 'checkup', 'fever'])
    assert.ok(seen.has(reason), reason);
});

test('malformed saves do not replace a good town and checkups stay healthy', () => {
  const s = community();
  const before = s.snapshot();
  const broken = s.snapshot();
  broken.households[0].position.x = Infinity;
  assert.equal(s.restore(broken), false);
  assert.deepEqual(s.snapshot(), before);
  const injected = s.snapshot();
  injected.events = [{ pet: '<script>', kind: 'home', at: 0 }];
  assert.equal(s.restore(injected), false);
  for (const pet of visits) {
    const visit = communityVisit(pet, 'checkup');
    assert.equal(visit.purpose, 'checkup');
    assert.equal(visit.alternatives.length, 0);
    assert.equal(visit.checks.length, 2);
    assert.deepEqual(visit.clinical, {});
  }
});

test('ordinary town traffic produces occasional incidents across varied daily schedules', () => {
  let total = 0;
  // Clinic walking times shift when furniture changes. Check several unforced
  // schedules: a quiet twenty minutes is valid, while incidents must stay rare.
  for (const rhythm of [0.3, 0.5, 0.9]) {
    const s = new TownSimulation(visits, () => rhythm);
    s.seedClinic();
    // Isolate ordinary crossing traffic; rescue scheduling has its own coverage.
    s.emergencies.due = 3600;
    const incidents = new Set<number>();
    for (let i = 0; i < 12000; i++) {
      s.update(0.1);
      if (s.incident) incidents.add(s.incident.ticket);
      for (const id of [...s.queue]) {
        s.startVisit(id);
        s.completeVisit(id);
      }
    }
    assert.ok(
      incidents.size <= 6,
      'bounded events in each twenty-minute schedule',
    );
    total += incidents.size;
    const reloaded = new TownSimulation(visits);
    assert.ok(reloaded.restore(JSON.parse(JSON.stringify(s.snapshot()))));
  }
  assert.ok(
    total > 0,
    'ordinary traffic still produces incidents without scripted collisions',
  );
});

test('advertising keeps bringing routine visitors after the introductory cases', () => {
  const due = (interval: number) => {
    const s = community();
    s.configureClinic(4, interval);
    s.requestVisit('Maple', 'checkup');
    const ticket = [...s.tickets.values()][0];
    tick(s, 45);
    callToRoom(s, ticket.id);
    s.completeVisit(ticket.id);
    for (let i = 0; i < 500 && s.tickets.has(ticket.id); i++) s.update(0.1);
    return s.households.find((h) => h.owner === 'Isla')!.nextCare - s.time;
  };
  assert.ok(due(13) < due(22) * 0.65);
});

test('three bird neighbours retain breed identity through supported care and saved journeys', () => {
  for (const name of ['Pico', 'Pepper', 'Melody']) {
    const s = community();
    assert.equal(s.requestVisit(name, 'vaccination'), false);
    assert.equal(s.requestVisit(name, 'accident'), false);
    assert.equal(s.requestVisit(name, 'fever'), true);
    const ticket = [...s.tickets.values()][0];
    const pet = s.visit(ticket.id);
    assert.equal(pet.species, 'bird');
    assert.equal(pet.diagnosis, 'Fever');
    const restored = community();
    assert.ok(restored.restore(s.snapshot()));
    assert.equal(restored.visit(ticket.id).breed, pet.breed);
    tick(restored, 60);
    assert.ok(restored.queue.includes(ticket.id));
    callToRoom(restored, ticket.id);
    assert.ok(restored.abortVisit(ticket.id));
    callToRoom(restored, ticket.id);
    assert.ok(restored.completeVisit(ticket.id));
    tick(restored, 60);
    assert.ok(restored.events.some((e) => e.pet === name && e.kind === 'home'));
  }
});
