import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ClinicBuild,
  buildableCells,
  buildRecipes,
  toClinic,
} from '../src/clinic-build.ts';
import { TownSimulation } from '../src/town-simulation.ts';
import { upgrades, visits } from '../src/game.ts';
import {
  localToTown,
  distance,
  clinicDesk,
  clinicHall,
} from '../src/town-map.ts';
import { ridePose } from '../src/pet-rides.ts';
import { enrichmentPose } from '../src/clinic-enrichment.ts';
import { callToRoom } from './clinic-helpers.ts';
const owned = upgrades.filter((u) => u.id !== 'stock').map((u) => u.id);
const tick = (s: TownSimulation, n: number) => {
  for (let i = 0; i < n * 10; i++) s.update(0.1);
};
const setup = () => {
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic(
    ['Luna', 'Milo', 'Peanut', 'Sunny', 'Hazel', 'Cleo', 'Pip', 'Pico'].map(
      (n) => visits.findIndex((v) => v.name === n),
    ),
  );
  s.configureClinic(8, 22);
  s.configureLeisure(owned);
  tick(s, 25);
  return s;
};

test('legacy clinics migrate exact furniture, floors, active turns and balances without customising', () => {
  const s = setup(),
    old = s.snapshot();
  delete (old as Partial<typeof old>).build;
  const migrated = new TownSimulation(visits);
  assert.ok(migrated.restore(old));
  migrated.configureLeisure(owned);
  assert.equal(migrated.build.customized, false);
  for (const r of buildRecipes)
    assert.deepEqual(
      migrated.build.placement(r.id),
      { x: r.x, z: r.z, rotation: 0 },
      r.id,
    );
  assert.equal(migrated.build.tiles.length, 351);
  assert.equal(migrated.leisure.pets.size, s.leisure.pets.size);
  assert.ok(new TownSimulation(visits).restore(migrated.snapshot()));
});
test('new purchases stay stored, room kits pay for connected floor, and previews never spend or mutate', () => {
  const b = new ClinicBuild(),
    original = b.snapshot();
  b.unlock('expansion');
  b.syncOwned(['expansion']);
  assert.equal(b.placement('seat-5'), undefined);
  assert.equal(b.state.credits, 48);
  assert.deepEqual(b.tiles, original.tiles);
  const before = b.snapshot(),
    revision = b.revision;
  assert.deepEqual(b.floor({ x: -11, z: -4 }, { x: -6, z: 3 }, 'room', 0), {
    error: undefined,
    cost: 0,
  });
  assert.deepEqual(b.snapshot(), before);
  assert.equal(b.revision, revision);
  assert.deepEqual(
    b.floor({ x: -11, z: -4 }, { x: -6, z: 3 }, 'room', 0, [], true),
    { cost: 0 },
  );
  assert.equal(b.state.credits, 0);
  assert.equal(b.tiles.length, original.tiles.length + 48);
  assert.equal(
    b.place('seat-5', { x: -8, z: 2, rotation: Math.PI / 2 }),
    undefined,
  );
  assert.ok(new ClinicBuild().restore(b.snapshot()));
});
test('placement rejects collisions, clinical access, people and missing floor without losing the previous placement', () => {
  const b = new ClinicBuild();
  b.syncOwned(owned);
  const before = b.snapshot();
  for (const p of [
    { x: 3.5, z: -4, rotation: 0 },
    { x: -1.3, z: -1.9, rotation: 0 },
    { x: 20, z: 0, rotation: 0 },
    { x: -15.5, z: -2, rotation: 0 },
  ]) {
    assert.ok(b.place('bench', p));
    assert.deepEqual(b.snapshot(), before);
  }
  assert.match(
    b.place('bench', { x: -8, z: 0, rotation: 0 }, [localToTown(-8, 0)])!,
    /standing/,
  );
  assert.deepEqual(b.snapshot(), before);
});
test('room and garden edits cover the clinic greenspace but never roads, disconnected islands or floor supporting objects', () => {
  const b = new ClinicBuild();
  b.syncOwned(owned);
  assert.ok(buildableCells.length > 700);
  assert.ok(
    b.floor({ x: 5, z: 5 }, { x: 5, z: 5 }, 'garden', 999, [], true).error,
  );
  assert.ok(
    b.floor({ x: -20, z: -40 }, { x: -20, z: -40 }, 'room', 999, [], true)
      .error,
  );
  const before = b.snapshot();
  assert.match(
    b.floor({ x: -17, z: -11 }, { x: -17, z: -11 }, 'erase', 999, [], true)
      .error!,
    /items/,
  );
  assert.deepEqual(b.snapshot(), before);
  assert.ok(
    b.floor({ x: -18, z: -7 }, { x: -18, z: -1 }, 'garden', 999, [], true)
      .error === undefined,
  );
  assert.equal(
    b.tiles.find((t) => t.x === -18 && t.z === -3)?.surface,
    'garden',
  );
});
test('rotated seat approaches and custom routes follow the floor and avoid other furniture', () => {
  const b = new ClinicBuild();
  b.syncOwned(owned);
  assert.equal(
    b.place('seat-5', { x: -8, z: 0, rotation: Math.PI / 2 }),
    undefined,
  );
  const seat = b.stations.find((s) => s.id === 'seat-5')!,
    a = b.approach(seat);
  assert.ok(a.x < seat.x - 1);
  assert.ok(Math.abs(a.z - seat.z) < 0.001);
  const path = b.route(clinicHall, localToTown(seat.x, seat.z));
  assert.ok(path.length > 3);
  for (let i = 1; i < path.length - 2; i++)
    for (let t = 0; t < 1; t += 0.1) {
      const p = toClinic({
        x: path[i - 1].x + (path[i].x - path[i - 1].x) * t,
        z: path[i - 1].z + (path[i].z - path[i - 1].z) * t,
      });
      assert.ok(b.walkable(p), JSON.stringify(p));
    }
  assert.ok(distance(path.at(-1)!, localToTown(seat.x, seat.z)) < 0.01);
});
for (const kind of ['coaster', 'ferris', 'aviary', 'play-tree', 'bird-chimes'])
  test(`moving an occupied ${kind} waits for ground level, unloads safely and releases reservations`, () => {
    const s = setup(),
      pet = [...s.leisure.pets.values()].find(
        (p) =>
          s.visit(p.ticket).species ===
          (['aviary', 'bird-chimes'].includes(kind) ? 'bird' : 'cat'),
      )!;
    const st = s.build.stations.find((st) => st.id === kind)!;
    const pose = ['coaster', 'ferris'].includes(kind)
      ? ridePose(kind, 3)
      : enrichmentPose(kind, 3, s.visit(pet.ticket).species);
    pet.station = kind;
    pet.phase = 'use';
    pet.elapsed = 3;
    pet.remaining = 9;
    pet.position = s.build.stationPoint(st, pose);
    pet.route = [];
    s.leisure.beginMove(kind);
    assert.equal(s.leisure.movingReady(kind, s.households), false);
    assert.equal(pet.phase, 'use');
    let ready = false,
      n = 0;
    for (; n < 500 && !ready; n++) {
      s.leisure.update(0.1, s.households, s.tickets, (id) => s.visit(id));
      ready = s.leisure.movingReady(kind, s.households);
    }
    assert.ok(ready, kind + ' still occupied');
    assert.ok(n >= 85, 'must finish descent');
    assert.equal(s.build.place(kind, undefined), undefined);
    s.leisure.replan(s.households);
    s.leisure.endMove();
    assert.equal(pet.called, false);
    assert.equal(
      s.leisure.stations('pet').some((st) => st.id === kind),
      false,
    );
    const restored = new TownSimulation(visits);
    assert.ok(restored.restore(s.snapshot()));
    callToRoom(s, pet.ticket);
    assert.ok(
      distance(
        s.households.find((h) => h.ticket === pet.ticket)!.position,
        clinicDesk,
      ) > 1,
    );
  });
test('moving every seat gives every waiting owner a separate standing spot and care remains reachable', () => {
  const s = setup();
  for (const r of buildRecipes.filter((r) =>
    r.stations.some((id) => /^(seat|game|puzzle)-/.test(id)),
  )) {
    s.leisure.beginMove(r.id);
    let ready = false;
    for (let i = 0; i < 800 && !ready; i++) {
      s.leisure.update(0.1, s.households, s.tickets, (id) => s.visit(id));
      ready = s.leisure.movingReady(r.id, s.households);
    }
    assert.ok(ready, r.id);
    assert.equal(s.build.place(r.id, undefined), undefined);
    s.leisure.replan(s.households);
    s.leisure.endMove();
  }
  tick(s, 35);
  const owners = [...s.leisure.owners.values()];
  assert.equal(owners.length, 8);
  assert.equal(new Set(owners.map((a) => a.station)).size, 8);
  assert.ok(owners.every((a) => a.phase === 'stand'));
  callToRoom(s, s.queue[0]);
});

test('a relocated ride in new grounds carries its rider with the saved rotation and remains callable', () => {
  const s = setup();
  assert.equal(
    s.build.floor(
      { x: -17, z: -24 },
      { x: -12, z: -20 },
      'garden',
      5000,
      [],
      true,
    ).error,
    undefined,
  );
  s.leisure.beginMove('coaster');
  let ready = false;
  for (let i = 0; i < 500 && !ready; i++) {
    s.leisure.update(0.1, s.households, s.tickets, (id) => s.visit(id));
    ready = s.leisure.movingReady('coaster', s.households);
  }
  assert.ok(ready);
  assert.equal(
    s.build.place('coaster', { x: -14, z: -22, rotation: Math.PI }),
    undefined,
  );
  s.leisure.replan(s.households);
  s.leisure.endMove();
  let rider: import('../src/clinic-leisure.ts').PetActivity | undefined;
  for (let i = 0; i < 5000 && !rider; i++) {
    s.update(0.1);
    rider = [...s.leisure.pets.values()].find(
      (p) => p.station === 'coaster' && p.phase === 'use' && p.elapsed > 2,
    );
  }
  assert.ok(rider);
  const station = s.build.stations.find((st) => st.id === 'coaster')!;
  const expected = s.build.stationPoint(
    station,
    ridePose('coaster', rider.elapsed),
  );
  assert.ok(distance(expected, rider.position) < 0.001);
  const restored = new TownSimulation(visits);
  assert.ok(restored.restore(s.snapshot()));
  assert.deepEqual(restored.build.snapshot(), s.build.snapshot());
  callToRoom(s, rider.ticket);
  s.abortVisit(rider.ticket);
  assert.ok(s.queue.includes(rider.ticket));
  callToRoom(s, rider.ticket);
  assert.ok(s.completeVisit(rider.ticket));
  const family = s.households.find((h) => h.ticket === rider.ticket)!;
  for (let i = 0; i < 1000 && family.inClinic; i++) s.update(0.1);
  assert.equal(
    family.inClinic,
    false,
    'family can leave the rearranged clinic',
  );
});

test('malformed layouts are rejected without replacing a valid build', () => {
  const b = new ClinicBuild();
  b.syncOwned(owned);
  const original = b.snapshot();
  const bad = [
    structuredClone(original),
    structuredClone(original),
    structuredClone(original),
    structuredClone(original),
  ];
  bad[0].items[0].placement!.rotation = 0.7;
  bad[1].tiles.push({ ...bad[1].tiles[0] });
  bad[2].unlocked.push('missing-item');
  bad[3].items = bad[3].items.slice(1);
  for (const value of bad) {
    assert.equal(b.restore(value), false);
    assert.deepEqual(b.snapshot(), original);
  }
});

test('idle build cleanup leaves an ordinary patient recall intact', () => {
  const s = setup(),
    p = [...s.leisure.pets.values()].find((p) => p.phase === 'use')!;
  assert.equal(s.startVisit(p.ticket), false);
  assert.equal(p.called, true);
  s.leisure.endMove();
  assert.equal(p.called, true);
});

test('routes cross legacy partitions only at openings, including between the playroom and annex', () => {
  const b = new ClinicBuild();
  b.syncOwned(owned);
  b.place('plant-0', undefined);
  const from = localToTown(-11.75, -8),
    to = localToTown(-8, -8),
    path = b.route(from, to);
  assert.ok(path.length > 4);
  let previous = from;
  for (const next of path) {
    for (let t = 0; t <= 1; t += 0.1)
      assert.ok(
        b.walkable(
          toClinic({
            x: previous.x + (next.x - previous.x) * t,
            z: previous.z + (next.z - previous.z) * t,
          }),
        ),
      );
    previous = next;
  }
  assert.ok(
    path.some((p) => Math.abs(toClinic(p).z) < 0.8),
    'use the lounge doorway',
  );
  const fresh = new ClinicBuild();
  assert.match(
    fresh.floor({ x: -2, z: -11 }, { x: 0, z: -11 }, 'room', 999, [], true)
      .error!,
    /opening/,
  );
});
