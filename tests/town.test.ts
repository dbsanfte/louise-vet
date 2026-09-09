import { callToRoom } from './clinic-helpers.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TownSimulation } from '../src/town-simulation.ts';
import { visits, examine } from '../src/game.ts';
import {
  layout,
  garden,
  segmentDistance,
  routeBetween,
  clinicDoor,
} from '../src/town-map.ts';
import { clinicalProfile } from '../src/clinical.ts';

test('every customer and pet belongs to one named household, including shared owners', () => {
  const sim = new TownSimulation(visits, () => 0.5);
  assert.equal(sim.households.length, new Set(visits.map((v) => v.owner)).size);
  for (const v of visits) {
    const homes = sim.households.filter((h) =>
      h.pets.some((p) => p.name === v.name),
    );
    assert.equal(homes.length, 1);
    assert.equal(homes[0].owner, v.owner);
    assert.ok(homes[0].label.includes(v.name));
  }
  assert.ok(sim.households.some((h) => h.kind === 'Flat'));
  assert.equal(
    new Set(sim.households.map((h) => `${h.home.x}:${h.home.z}`)).size,
    16,
    'sixteen distinct addresses, with flats shared by separate households',
  );
});

test('routines reach park, chat, and home; pedestrians cross only at the crossing', () => {
  const sim = new TownSimulation(visits, () => 0.5);
  const states = new Set<string>();
  let returned = false;
  for (let n = 0; n < 6000; n++) {
    sim.update(0.1);
    for (const h of sim.households) {
      states.add(h.routine);
      if (h.routine === 'walk' && !sim.weather.locked(h.id)) {
        const lot = layout.lots[h.lot];
        const onPavement = layout.edges.some(
          ([a, b]) =>
            segmentDistance(h.position, layout.nodes[a], layout.nodes[b]) <
            0.05,
        );
        const onGardenPath =
          segmentDistance(h.position, garden(lot), layout.nodes[lot.gate]) <
          0.05;
        assert.ok(
          onPavement || onGardenPath,
          `${h.owner} stays on the connected paths`,
        );
      }
      returned ||= h.returning && h.routine === 'garden';
    }
  }
  for (const state of ['garden', 'gather', 'walk', 'park', 'chat'])
    assert.ok(states.has(state), state);
  assert.ok(returned, 'residents return home without losing their route');
});

test('traffic yields to an occupied crossing and resumes afterwards', () => {
  const sim = new TownSimulation(visits, () => 0.5);
  const h = sim.households[0];
  h.position = { x: 18, z: 0 };
  h.routine = 'chat';
  h.remaining = 10;
  const car = sim.cars[0];
  car.x = 15;
  sim.update(0.1);
  assert.equal(car.stopped, true);
  assert.equal(car.x, 15);
  h.position = { x: 18, z: 3 };
  sim.update(0.1);
  assert.equal(car.stopped, false);
  assert.ok(car.x > 15);
});

test('clinic families leave ambient routines and resume safely when released', () => {
  const sim = new TownSimulation(visits, () => 0.5);
  sim.seedClinic([0]);
  const h = sim.households.find((h) => h.owner === 'Amelia')!;
  assert.equal(h.inClinic, true);
  for (let n = 0; n < 100; n++) sim.update(0.1);
  assert.equal(h.routine, 'clinic-wait');
  assert.ok(sim.leisure.owners.has(h.id), 'waiting owners can use their seats');
  callToRoom(sim, 0);
  sim.completeVisit(0);
  assert.equal(h.inClinic, true);
  assert.equal(h.routine, 'clinic-exit');
  for (let n = 0; n < 80; n++) sim.update(0.1);
  assert.equal(h.inClinic, false);
  assert.equal(h.routine, 'homeward');
});

test('thermometer reveals fever only at the coat and normal pets read comfortable', () => {
  const maple = visits.find((v) => v.name === 'Maple')!;
  assert.equal(clinicalProfile(maple).temperature, 'Fever');
  assert.equal(examine(maple, 'thermometer', 'paw').kind, 'guidance');
  assert.match(examine(maple, 'thermometer', 'coat').text, /Fever/);
  assert.equal(clinicalProfile(visits[0]).temperature, 'Comfortable');
  assert.match(examine(visits[0], 'thermometer', 'coat').text, /no fever/);
});

test('every distinct home reaches the clinic and park through a winding connected network', () => {
  const sim = new TownSimulation(visits, () => 0.5);
  assert.equal(sim.households.length, 18);
  assert.equal(new Set(layout.lots.map((l) => l.asset)).size, 16);
  assert.ok(layout.roads.length >= 3);
  for (const r of layout.roads.slice(1))
    assert.ok(
      Math.max(...r.points.map((p) => p[1])) -
        Math.min(...r.points.map((p) => p[1])) >
        20,
    );
  for (const lot of layout.lots) {
    for (const destination of [clinicDoor, layout.nodes[layout.park]]) {
      const route = routeBetween(garden(lot), destination);
      assert.deepEqual(route.at(-1), destination);
      assert.ok(route.length > 2);
    }
  }
  for (const lot of layout.lots.filter((l) => l.owners.length > 1))
    assert.equal(lot.kind, 'Flat');
});

test('clinic entrance and exit preserve position and survive reload mid-doorway', () => {
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic([]);
  s.requestVisit('Luna', 'checkup');
  const h = s.households[0];
  let previous = { ...h.position };
  let entered = false;
  for (let i = 0; i < 600; i++) {
    s.update(0.1);
    assert.ok(
      Math.hypot(h.position.x - previous.x, h.position.z - previous.z) <= 0.281,
    );
    previous = { ...h.position };
    if (h.routine === 'clinic-enter') {
      entered = true;
      break;
    }
  }
  assert.ok(entered);
  const id = h.ticket!;
  const reload = new TownSimulation(visits);
  assert.ok(reload.restore(s.snapshot()));
  assert.deepEqual(reload.households[0].position, h.position);
  for (let i = 0; i < 80; i++) s.update(0.1);
  assert.ok(callToRoom(s, id));
  previous = { ...h.position };
  assert.ok(s.completeVisit(id));
  assert.deepEqual(h.position, previous);
  assert.equal(h.routine, 'clinic-exit');
  assert.ok(reload.restore(s.snapshot()));
  for (let i = 0; i < 600 && s.tickets.has(id); i++) {
    s.update(0.1);
    assert.ok(
      Math.hypot(h.position.x - previous.x, h.position.z - previous.z) <= 0.281,
    );
    previous = { ...h.position };
  }
  assert.equal(s.tickets.has(id), false);
  assert.deepEqual(h.position, garden(layout.lots[h.lot]));
});

test('the eight-household save migrates without losing its queue or completed return', () => {
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic();
  const old = s.snapshot();
  old.version = 1;
  old.households = old.households.slice(0, 8);
  old.households.forEach((h) => {
    if (h.inClinic) h.position = { x: -24, z: -4.3 };
  });
  const loaded = new TownSimulation(visits);
  assert.ok(loaded.restore(old));
  assert.deepEqual(loaded.queue, s.queue);
  assert.equal(loaded.households.length, 18);
  assert.equal(loaded.visit(0).name, 'Luna');
  assert.ok(loaded.restore(JSON.parse(JSON.stringify(loaded.snapshot()))));
});

test('outer-road families never deadlock with yielding traffic on clinic and home journeys', () => {
  for (const owner of [
    'Ava',
    'Oscar',
    'Mia',
    'Ethan',
    'Ruby',
    'Archie',
    'Lily',
    'Theo',
    'Zara',
    'Max',
  ]) {
    const s = new TownSimulation(visits, () => 0.5),
      state = s.snapshot();
    state.catalogueCursor = visits.length;
    state.households.forEach((h) => (h.nextCare = 900));
    assert.ok(s.restore(state));
    const h = s.households.find((h) => h.owner === owner)!;
    assert.ok(s.requestVisit(h.pets[0].name, 'checkup'));
    for (let i = 0; i < 1200 && !h.inClinic; i++) s.update(0.1);
    assert.ok(h.inClinic, `${owner} reaches the clinic through real traffic`);
    const id = h.ticket!;
    callToRoom(s, id);
    s.completeVisit(id);
    for (let i = 0; i < 1200 && s.tickets.has(id); i++) s.update(0.1);
    assert.equal(s.tickets.has(id), false, `${owner} gets home again`);
  }
});
