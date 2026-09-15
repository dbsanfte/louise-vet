import { extraAmusements } from '../src/extra-amusements.ts';
import { clinicPrefabs, prefabCandidates } from '../src/clinic-prefabs.ts';
import { floorRectangle, edgeCentre, wallKey } from '../src/clinic-spaces.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ClinicBuild,
  type BuildItem,
  buildableCells,
  buildRecipes,
  toClinic,
} from '../src/clinic-build.ts';
import { TownSimulation } from '../src/town-simulation.ts';
import { upgrades, visits, loadProgress, purchase } from '../src/game.ts';
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
  for (const r of buildRecipes.filter(
    (r) => !extraAmusements.some((a) => a.id === r.id),
  ))
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
test('unused room entries track shared credits through building and reload without granting legacy rooms twice', () => {
  const b = new ClinicBuild();
  b.syncOwned(['expansion']);
  assert.deepEqual(b.unusedRoomKits, []);
  b.buy('pet-room');
  b.buy('sun-courtyard');
  const allowances = () =>
    b.unusedRoomKits.map(({ id, credits }) => [id, credits]);
  assert.deepEqual(allowances(), [
    ['pet-room', 84],
    ['sun-courtyard', 48],
  ]);
  const before = b.snapshot();
  // A preview cannot consume allowance; committed flooring can use either kit.
  const from = { x: -17, z: -5 },
    to = { x: -12, z: 1 };
  assert.equal(b.floor(from, to, 'garden', 0).error, undefined);
  assert.deepEqual(b.snapshot(), before);
  assert.deepEqual(b.floor(from, to, 'garden', 0, [], true), { cost: 0 });
  assert.deepEqual(allowances(), [
    ['pet-room', 42],
    ['sun-courtyard', 48],
  ]);
  assert.deepEqual(
    b.floor({ x: -17, z: -12 }, { x: -12, z: -6 }, 'garden', 0, [], true),
    { cost: 0 },
  );
  assert.deepEqual(allowances(), [['sun-courtyard', 48]]);
  const restored = new ClinicBuild();
  assert.ok(restored.restore(b.snapshot()));
  restored.syncOwned(['expansion', 'pet-room', 'sun-courtyard']);
  assert.deepEqual(restored.unusedRoomKits, b.unusedRoomKits);
  assert.equal(restored.state.credits, 48);
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
test('new floor stays on connected greenspace, while erasure returns supported furniture', () => {
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
  const preview = b.erase({ x: -17, z: -11 }, { x: -17, z: -11 });
  assert.equal(preview.error, undefined);
  assert.deepEqual(preview.stored, ['coaster']);
  assert.deepEqual(b.snapshot(), before);
  assert.equal(
    b.floor({ x: -17, z: -11 }, { x: -17, z: -11 }, 'erase', 999, [], true)
      .error,
    undefined,
  );
  assert.equal(b.placement('coaster'), undefined);
  assert.equal(b.tiles.length, before.tiles.length - 1);
  assert.ok(b.restore(before));
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

test('every furniture type is sold by the copy, with no catalogue-size limit or duplicate bonuses', () => {
  const b = new ClinicBuild(),
    p = loadProgress();
  p.coins = 100000;
  const buy = (id: string) => {
    assert.ok(purchase(p, id), id);
    return b.buy(id);
  };
  for (const id of ['expansion', 'pet-room', 'play-annex', 'sun-courtyard'])
    buy(id);
  for (const u of upgrades) {
    if (!('furniture' in u)) continue;
    const before = b.items.length,
      coins = p.coins;
    const a = buy(u.id)!,
      c = buy(u.id)!;
    assert.equal(b.items.length, before + 2, u.id);
    assert.notEqual(a.id, c.id);
    assert.equal(a.recipe, c.recipe);
    assert.equal(a.placement, undefined);
    assert.equal(c.placement, undefined);
    assert.equal(p.coins, coins - 2 * u.price);
    assert.equal(p.upgrades.filter((id) => id === u.id).length, 1);
  }
  for (let i = 0; i < 50; i++) buy('lounge-chair');
  assert.equal(b.copies('seat-5').length, 55); // three kit chairs and 52 paid chairs
  assert.ok(b.items.length > buildRecipes.length);
  assert.equal(new Set(b.items.map((i) => i.id)).size, b.items.length);
  const before = b.snapshot();
  p.coins = 44;
  if (purchase(p, 'lounge-chair')) b.buy('lounge-chair');
  assert.equal(p.coins, 44);
  assert.deepEqual(b.snapshot(), before);
  const restored = new ClinicBuild();
  assert.ok(restored.restore(before));
  restored.syncOwned(p.upgrades);
  assert.deepEqual(
    restored.snapshot(),
    before,
    'reload never grants more copies or floor credits',
  );
  assert.equal(purchase(p, 'expansion'), false);
});

test('version-one build saves retain every chair, plant and active reservation through repeated migration', () => {
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic([0, 1, 2, 3]);
  const ids = ['expansion', 'pet-room', 'plants', 'wheel'] as const;
  s.configureLeisure([...ids]);
  tick(s, 25);
  const snapshot = s.snapshot();
  const old = {
    ...snapshot,
    build: {
      ...snapshot.build,
      version: 1,
      items: snapshot.build.items.map(({ recipe: _type, ...i }) => i),
    },
  };
  const restored = new TownSimulation(visits);
  assert.ok(restored.restore(old));
  restored.configureLeisure([...ids]);
  assert.deepEqual(restored.build.snapshot(), snapshot.build);
  assert.deepEqual(restored.leisure.snapshot(), snapshot.leisure);
  const copy = restored.build.buy('lounge-chair')!;
  assert.equal(restored.build.recipe(copy.id).name, 'Lounge chair');
  assert.equal(restored.build.copies('seat-5').length, 4);
  const again = new TownSimulation(visits);
  assert.ok(again.restore(restored.snapshot()));
  again.configureLeisure([...ids, 'lounge-chair']);
  assert.deepEqual(again.build.snapshot(), restored.build.snapshot());
  const corrupt = structuredClone(restored.snapshot());
  corrupt.build.items.at(-1)!.recipe = 'missing';
  assert.equal(again.restore(corrupt), false);
  const duplicate = restored.build.snapshot();
  duplicate.items.push({ ...duplicate.items.at(-1)! });
  assert.equal(again.build.restore(duplicate), false);
  assert.deepEqual(again.build.snapshot(), restored.build.snapshot());
});

test('every furnishing saves as a paid copy without owning its original room kit', () => {
  for (const product of upgrades) {
    if (!('furniture' in product)) continue;
    const b = new ClinicBuild(),
      p = loadProgress();
    p.coins = product.price * 2;
    for (let i = 0; i < 2; i++) {
      assert.ok(purchase(p, product.id));
      const copy: BuildItem = b.buy(product.id)!;
      assert.equal(copy.placement, undefined);
    }
    assert.equal(b.state.credits, 0);
    assert.deepEqual(b.state.unlocked, [product.id]);
    const saved = b.snapshot(),
      restored = new ClinicBuild();
    assert.ok(restored.restore(saved), product.id);
    restored.syncOwned(p.upgrades);
    assert.deepEqual(restored.snapshot(), saved, product.id);
  }
});

test('separate copies of chairs and wheels have independent places, queues and saved rotations', () => {
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic(
    ['Peanut', 'Sunny'].map((name) => visits.findIndex((v) => v.name === name)),
  );
  s.configureLeisure(['expansion', 'pet-room', 'wheel']);
  const chair = s.build.buy('lounge-chair')!,
    wheel = s.build.buy('wheel')!;
  s.configureLeisure(['expansion', 'pet-room', 'wheel', 'lounge-chair']);
  assert.equal(
    s.build.place(chair.id, { x: -8, z: 0, rotation: Math.PI / 2 }),
    undefined,
  );
  assert.equal(
    s.build.place(wheel.id, { x: -14, z: -6, rotation: Math.PI / 2 }),
    undefined,
  );
  const seats = s.build.stations.filter((st) => st.itemId === chair.id);
  assert.equal(seats.length, 1);
  assert.notEqual(seats[0].id, 'seat-5');
  assert.equal(s.build.stationRotation(seats[0]), Math.PI / 2);
  const stations = s.build.stations.filter((st) => st.kind === 'wheel');
  assert.equal(stations.length, 2);
  assert.equal(new Set(stations.map((st) => st.id)).size, 2);
  const seen = new Set<string>();
  let simultaneous = false;
  for (let i = 0; i < 1600; i++) {
    s.update(0.1);
    const using = [...s.leisure.pets.values()].filter(
      (p) =>
        p.phase === 'use' && s.leisure.station(p.station)?.kind === 'wheel',
    );
    using.forEach((p) => seen.add(p.station));
    simultaneous ||=
      using.length === 2 && new Set(using.map((p) => p.station)).size === 2;
  }
  assert.deepEqual(seen, new Set(stations.map((st) => st.id)));
  assert.ok(simultaneous, 'both wheels can be used at the same time');
  assert.equal(s.leisure.summary().filter((s) => s.kind === 'wheel').length, 2);
  const restored = new TownSimulation(visits);
  assert.ok(restored.restore(s.snapshot()));
  assert.deepEqual(restored.build.snapshot(), s.build.snapshot());
  assert.deepEqual(restored.leisure.snapshot(), s.leisure.snapshot());
  assert.equal(s.build.place('wheel', undefined), undefined);
  assert.ok(s.build.placement(wheel.id));
  assert.equal(s.build.stations.filter((st) => st.kind === 'wheel').length, 1);
});

for (const kind of ['ferris', 'play-tree'])
  test(`moving a second ${kind} waits for its rider without closing the first copy`, () => {
    const s = setup(),
      copy = s.build.buy(kind)!;
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
    assert.equal(
      s.build.place(copy.id, { x: -14, z: -22, rotation: Math.PI / 2 }),
      undefined,
    );
    const st = s.build.stations.find((st) => st.itemId === copy.id)!;
    const pet = [...s.leisure.pets.values()].find(
      (p) => s.visit(p.ticket).species === 'cat',
    )!;
    Object.assign(pet, {
      station: st.id,
      phase: 'use',
      elapsed: 3,
      remaining: 9,
      route: [],
    });
    const pose =
      kind === 'ferris' ? ridePose(kind, 3) : enrichmentPose(kind, 3, 'cat');
    pet.position = s.build.stationPoint(st, pose);
    s.leisure.beginMove(copy.id);
    assert.equal(s.leisure.movingReady(copy.id, s.households), false);
    assert.equal(s.leisure.available(s.leisure.station(kind)), true);
    assert.equal(s.leisure.available(st), false);
    let ready = false,
      steps = 0;
    for (; steps < 500 && !ready; steps++) {
      s.leisure.update(0.1, s.households, s.tickets, (id) => s.visit(id));
      ready = s.leisure.movingReady(copy.id, s.households);
    }
    assert.ok(ready);
    assert.ok(steps >= 85, 'wait for the full descent');
    assert.equal(s.build.place(copy.id, undefined), undefined);
    s.leisure.replan(s.households);
    s.leisure.endMove();
    assert.ok(s.build.placement(kind));
    assert.ok(new TownSimulation(visits).restore(s.snapshot()));
    callToRoom(s, pet.ticket);
  });

test('a separately purchased chair works before buying any room kit, and any placed book trolley supports reading', () => {
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic([0]);
  const chair = s.build.buy('lounge-chair')!;
  s.configureLeisure(['lounge-chair']);
  assert.equal(s.build.place('welcome-bench', undefined), undefined);
  assert.equal(
    s.build.place(chair.id, { x: -2.5, z: 2.5, rotation: 0 }),
    undefined,
  );
  tick(s, 20);
  const owner = [...s.leisure.owners.values()][0];
  assert.equal(owner.station, s.build.itemStations(chair.id)[0]);
  assert.equal(owner.phase, 'sit');
  s.build.buy('books');
  const books = s.build.buy('books')!;
  s.configureLeisure(['lounge-chair', 'books']);
  assert.equal(s.build.placement('books'), undefined);
  assert.equal(
    s.build.place(books.id, { x: 0.5, z: 2.5, rotation: 0 }),
    undefined,
  );
  tick(s, 1);
  assert.equal(owner.phase, 'read');
  assert.equal(s.build.place(books.id, undefined), undefined);
  tick(s, 1);
  assert.equal(owner.phase, 'sit');
});

test('grid-corner rectangles snap to the same tile edges in every drawing direction', () => {
  for (const [a, b] of [
    [
      { x: -11, z: -4 },
      { x: -5, z: 4 },
    ],
    [
      { x: -5, z: 4 },
      { x: -11, z: -4 },
    ],
    [
      { x: -11, z: 4 },
      { x: -5, z: -4 },
    ],
  ])
    assert.deepEqual(floorRectangle(a, b), {
      from: { x: -11, z: -4 },
      to: { x: -6, z: 3 },
      width: 6,
      depth: 8,
    });
  assert.equal(floorRectangle({ x: 0, z: 0 }, { x: 0, z: 3 }).width, 1);
});
test('room planning is free, commits a chosen entrance atomically, and saves walls and routes', () => {
  const b = new ClinicBuild(),
    a = { x: -11, z: -4 },
    end = { x: -5, z: 4 };
  const before = b.snapshot(),
    revision = b.revision;
  assert.match(
    b.space(a, end, 'room', true, undefined, 5000).error!,
    /Choose a doorway/,
  );
  const door = b.doorOptions(a, end)[0];
  const preview = b.space(a, end, 'room', true, door, 5000);
  assert.equal(preview.error, undefined);
  assert.equal(preview.cost, 144);
  assert.deepEqual(b.snapshot(), before);
  assert.equal(b.revision, revision);
  assert.equal(
    b.space(a, end, 'room', true, door, 5000, [], true).error,
    undefined,
  );
  assert.equal(b.tiles.length, before.tiles.length + 48);
  assert.deepEqual(b.state.doors, [door]);
  assert.equal(b.walkable(edgeCentre(door)), true);
  assert.equal(b.walkable({ x: -5, z: -2.5 }), false);
  assert.equal(b.route(localToTown(3, 1), localToTown(-8, 0)).length > 0, true);
  const saved = b.snapshot(),
    restored = new ClinicBuild();
  assert.equal(restored.restore(saved), true);
  assert.deepEqual(restored.snapshot(), saved);
  assert.equal(restored.walkable(edgeCentre(door)), true);
  assert.match(b.editDoor(door)!, /Connect every space/);
  assert.deepEqual(b.snapshot(), saved);
  const second = b.editableWalls().find((e) => e.x === -5 && e.z === -2)!;
  assert.equal(b.editDoor(second), undefined);
  assert.equal(b.editDoor(door), undefined);
  assert.equal(b.walkable(edgeCentre(door)), false);
  assert.equal(b.editDoor(door, true), undefined);
  assert.equal(b.walkable(edgeCentre(door)), true);
  assert.equal(new ClinicBuild().restore(b.snapshot()), true);
});
test('new entrances cannot leave the plot, trap an actor, or reclose across furniture', () => {
  const b = new ClinicBuild(),
    a = { x: -11, z: -4 },
    end = { x: -5, z: 4 };
  const door = b.doorOptions(a, end)[0];
  assert.ok(
    b.space(a, end, 'room', true, { x: 100, z: 100, axis: 'x' }, 5000, [], true)
      .error,
  );
  assert.equal(
    b.space(a, end, 'room', true, door, 5000, [], true).error,
    undefined,
  );
  const second = b.editableWalls().find((e) => e.x === -5 && e.z === -2)!;
  assert.equal(b.editDoor(second), undefined);
  const before = b.snapshot(),
    centre = edgeCentre(door);
  assert.match(
    b.editDoor(door, false, [localToTown(centre.x, centre.z)])!,
    /move clear/,
  );
  assert.deepEqual(b.snapshot(), before);
  // Even a valid second entrance must not permit a wall through an object.
  const item = b.items.find((i) => !b.recipe(i.id).soft)!;
  item.placement = { ...centre, rotation: 0 };
  assert.match(b.editDoor(door)!, /furniture/);
});
test('v2 layouts retain their floors and purchases; invalid and orphan door saves are rejected', () => {
  const b = new ClinicBuild();
  b.buy('expansion');
  const v2 = { ...b.snapshot(), version: 2 };
  const restored = new ClinicBuild();
  assert.equal(restored.restore(v2), true);
  assert.deepEqual(restored.snapshot(), b.snapshot());
  const a = { x: -11, z: -4 },
    end = { x: -5, z: 4 },
    door = b.doorOptions(a, end)[0];
  b.space(a, end, 'garden', true, door, 5000, [], true);
  for (const mutate of [
    (s: ReturnType<ClinicBuild['snapshot']>) => s.doors.push({ ...door }),
    (s: ReturnType<ClinicBuild['snapshot']>) =>
      (s.doors[0] = { x: 100, z: 100, axis: 'x' }),
    (s: ReturnType<ClinicBuild['snapshot']>) => (s.doors = []),
    (s: ReturnType<ClinicBuild['snapshot']>) =>
      (s.walls = s.walls.filter((e) => wallKey(e) !== wallKey(door))),
  ]) {
    const bad = b.snapshot();
    mutate(bad);
    const target = new ClinicBuild(),
      before = target.snapshot();
    assert.equal(target.restore(bad), false);
    assert.deepEqual(target.snapshot(), before);
  }
});

test('trying different doorway plans never reuses a discarded wall cache', () => {
  const b = new ClinicBuild(),
    a = { x: -11, z: -4 },
    end = { x: -5, z: 4 };
  const [first, second] = b.doorOptions(a, end);
  const before = b.snapshot();
  for (const door of [first, second, first]) {
    assert.equal(b.space(a, end, 'room', true, door, 5000).error, undefined);
    assert.deepEqual(b.snapshot(), before);
  }
  assert.equal(
    b.space(a, end, 'room', true, second, 5000, [], true).error,
    undefined,
  );
  assert.equal(b.walkable(edgeCentre(first)), false);
  assert.equal(b.walkable(edgeCentre(second)), true);
});

test('automatic entrances preserve free previews and choose a safe shared opening', () => {
  const b = new ClinicBuild(),
    a = { x: -11, z: -4 },
    end = { x: -5, z: 4 };
  b.buy('expansion');
  const before = b.snapshot(),
    revision = b.revision;
  // A person standing on the second edge needs that opening, not a wall.
  const actors = [localToTown(-5, 0.5)];
  const plan = b.autoSpace(a, end, 'room', 5000, actors);
  assert.equal(plan.error, undefined);
  assert.equal(plan.cost, 0);
  assert.deepEqual(plan.door, { x: -5, z: 0, axis: 'z' });
  assert.deepEqual(b.snapshot(), before);
  assert.equal(b.revision, revision);
  const placed = b.autoSpace(a, end, 'room', 5000, actors, true);
  assert.equal(placed.error, undefined);
  assert.equal(placed.cost, plan.cost);
  assert.deepEqual(placed.door, plan.door);
  assert.equal(b.state.credits, 0);
  assert.equal(b.tiles.length, before.tiles.length + 48);
  assert.equal(b.walkable(edgeCentre(plan.door!)), true);
  assert.ok(b.route(localToTown(3, 1), localToTown(-8, 0)).length);
  assert.ok(new ClinicBuild().restore(b.snapshot()));
});

test('automatic construction rejects unaffordable or disconnected plans without spending', () => {
  const b = new ClinicBuild(),
    before = b.snapshot();
  const costly = b.autoSpace(
    { x: -11, z: -4 },
    { x: -5, z: 4 },
    'garden',
    100,
    [],
    true,
  );
  assert.equal(costly.cost, 144);
  assert.ok(costly.error);
  assert.ok(
    b.autoSpace({ x: -18, z: -4 }, { x: -14, z: 4 }, 'room', 5000, [], true)
      .error,
  );
  assert.deepEqual(b.snapshot(), before);
  const open = b.autoSpace(
    { x: -11, z: -4 },
    { x: -5, z: 4 },
    'garden',
    5000,
    [],
    true,
  );
  assert.equal(open.error, undefined);
  assert.ok(open.door);
  assert.equal(b.walkable(edgeCentre(open.door!)), true);
  assert.equal(b.walkable({ x: -5, z: -2.5 }), false);
});

test('prefab snapping stays near the pointer and respects quarter-turn dimensions', () => {
  const b = new ClinicBuild(),
    prefab = clinicPrefabs[0];
  const candidates = prefabCandidates(b, prefab, { x: -8.8, z: 0 }, 0);
  assert.ok(candidates.some((p) => p.start.x === -11 && p.end.x === -5));
  const far = prefabCandidates(b, prefab, { x: -30, z: 0 }, 0);
  assert.equal(far.length, 1, 'do not snap across the whole plot');
  for (const p of prefabCandidates(b, prefab, { x: -9, z: 0 }, Math.PI / 2)) {
    assert.equal(p.end.x - p.start.x, 8);
    assert.equal(p.end.z - p.start.z, 6);
  }
});

test('gardens merge across saved perimeter fences and indoor additions get a clear door', () => {
  const b = new ClinicBuild();
  const first = b.autoSpace(
    { x: -11, z: -4 },
    { x: -5, z: 4 },
    'garden',
    5000,
    [],
    true,
  );
  assert.equal(first.error, undefined);
  assert.equal(
    first.doors.length,
    1,
    'garden needs an entrance from reception',
  );
  const saved = b.snapshot(),
    restored = new ClinicBuild();
  assert.ok(restored.restore(saved));
  assert.deepEqual(
    restored.snapshot(),
    saved,
    'loading does not rearrange old boundaries',
  );
  const a = { x: -15, z: -3 },
    end = { x: -10, z: 3 };
  const preview = restored.autoSpace(a, end, 'garden', 5000);
  assert.equal(preview.error, undefined);
  assert.equal(preview.cost, 72, 'overlapped garden tiles are kept');
  assert.deepEqual(preview.doors, [], 'no gate between gardens');
  assert.deepEqual(
    restored.snapshot(),
    saved,
    'preview must not remove the saved fence',
  );
  assert.equal(
    restored.autoSpace(a, end, 'garden', 5000, [], true).error,
    undefined,
  );
  assert.deepEqual(
    restored.state.doors,
    saved.doors,
    'keep the reception door',
  );
  for (let z = -3; z < 3; z++) {
    assert.equal(
      restored.state.walls.some(
        (w) => w.axis === 'z' && w.x === -11 && w.z === z,
      ),
      false,
    );
    assert.ok(
      restored.walkable({ x: -11, z: z + 0.5 }),
      'entire shared edge opens',
    );
  }
  assert.equal(
    restored.walkable({ x: -11, z: -3.5 }),
    false,
    'untouched perimeter stays fenced',
  );
  const room = restored.autoSpace(
    { x: -10, z: -8 },
    { x: -6, z: -4 },
    'room',
    5000,
    [],
    true,
  );
  assert.equal(room.error, undefined);
  assert.equal(
    room.doors.length,
    1,
    'a room built against a garden has a door',
  );
  assert.ok(restored.walkable(edgeCentre(room.door!)));
  for (const target of [
    { x: -14, z: 0 },
    { x: -8, z: -6 },
  ]) {
    let previous = localToTown(3, 1);
    const route = restored.route(previous, localToTown(target.x, target.z));
    assert.ok(route.length);
    for (const next of route) {
      for (let t = 0; t <= 1; t += 0.1)
        assert.ok(
          restored.walkable(
            toClinic({
              x: previous.x + (next.x - previous.x) * t,
              z: previous.z + (next.z - previous.z) * t,
            }),
          ),
        );
      previous = next;
    }
    assert.ok(distance(previous, localToTown(target.x, target.z)) < 0.01);
  }
  assert.ok(new ClinicBuild().restore(restored.snapshot()));
});

test('a garden touching both grass and an indoor room uses its open garden route without unnecessary doors', () => {
  const b = new ClinicBuild();
  assert.equal(
    b.autoSpace({ x: -11, z: -4 }, { x: -5, z: 0 }, 'garden', 5000, [], true)
      .error,
    undefined,
  );
  assert.equal(
    b.autoSpace({ x: -11, z: 0 }, { x: -5, z: 4 }, 'room', 5000, [], true)
      .error,
    undefined,
  );
  const before = b.snapshot();
  const result = b.autoSpace(
    { x: -15, z: -3 },
    { x: -11, z: 3 },
    'garden',
    5000,
    [],
    true,
  );
  assert.equal(result.error, undefined);
  assert.deepEqual(result.doors, []);
  assert.deepEqual(b.state.doors, before.doors);
  assert.ok(b.walkable({ x: -11, z: -1.5 }));
  assert.equal(
    b.walkable({ x: -11, z: 1.5 }),
    false,
    'indoor wall stays in place',
  );
  assert.equal(b.validate(), undefined);
  assert.ok(new ClinicBuild().restore(b.snapshot()));
});

test('automatic room entrances make room for several people on the shared edge', () => {
  const b = new ClinicBuild();
  const actors = [localToTown(-5, -0.5), localToTown(-5, 0.5)];
  const before = b.snapshot();
  const preview = b.autoSpace(
    { x: -11, z: -4 },
    { x: -5, z: 4 },
    'room',
    5000,
    actors,
  );
  assert.equal(preview.error, undefined);
  assert.equal(preview.doors.length, 2);
  assert.deepEqual(b.snapshot(), before);
  assert.equal(
    b.autoSpace({ x: -11, z: -4 }, { x: -5, z: 4 }, 'room', 5000, actors, true)
      .error,
    undefined,
  );
  for (const actor of actors) assert.ok(b.canStand(toClinic(actor)));
  assert.equal(b.validate(actors), undefined);
});

test('an extension can overlap an old floor row and connects at the actual shared wall', () => {
  const b = new ClinicBuild();
  assert.equal(
    b.autoSpace({ x: -11, z: -4 }, { x: -5, z: 4 }, 'room', 5000, [], true)
      .error,
    undefined,
  );
  const before = b.snapshot();
  const plan = b.autoSpace({ x: -10, z: -3 }, { x: -15, z: 3 }, 'garden', 5000);
  assert.equal(plan.error, undefined);
  assert.equal(plan.cost, 72);
  assert.equal(
    plan.door?.x,
    -11,
    'door belongs on the old outer wall, not through its floor',
  );
  assert.deepEqual(b.snapshot(), before);
  assert.equal(
    b.autoSpace({ x: -10, z: -3 }, { x: -15, z: 3 }, 'garden', 5000, [], true)
      .error,
    undefined,
  );
  for (let x = -15; x < -10; x++)
    for (let z = -3; z < 3; z++)
      assert.ok(
        b.contains({ x: x + 0.5, z: z + 0.5 }),
        `complete rectangle ${x},${z}`,
      );
  for (const cell of before.tiles)
    assert.deepEqual(
      b.tiles.find((t) => t.x === cell.x && t.z === cell.z),
      cell,
    );
  assert.ok(b.route(localToTown(3, 1), localToTown(-14, 0)).length);
  assert.ok(new ClinicBuild().restore(b.snapshot()));
});

for (const surface of ['room', 'garden'] as const)
  test(`extensions join all sides and drag directions, surface=${surface}`, () => {
    const rectangles = [
      [
        { x: -10, z: -3 },
        { x: -15, z: 3 },
      ], // overlaps the west row
      [
        { x: -10, z: -3 },
        { x: -6, z: -8 },
      ], // overlaps the north row
      [
        { x: -10, z: 3 },
        { x: -6, z: 7 },
      ], // overlaps the south row
      [
        { x: -15, z: -6 },
        { x: -9, z: 0 },
      ], // wraps around an old corner
    ];
    for (const [a, end] of rectangles)
      for (const [start, finish] of [
        [a, end],
        [end, a],
        [
          { x: a.x, z: end.z },
          { x: end.x, z: a.z },
        ],
        [
          { x: end.x, z: a.z },
          { x: a.x, z: end.z },
        ],
      ]) {
        const b = new ClinicBuild();
        assert.equal(
          b.autoSpace(
            { x: -11, z: -4 },
            { x: -5, z: 4 },
            'room',
            5000,
            [],
            true,
          ).error,
          undefined,
        );
        const before = b.snapshot(),
          revision = b.revision;
        const p = b.autoSpace(start, finish, surface, 5000);
        assert.equal(p.error, undefined, JSON.stringify([start, finish]));
        assert.deepEqual(b.snapshot(), before);
        assert.equal(b.revision, revision);
        const result = b.autoSpace(start, finish, surface, 5000, [], true);
        assert.equal(result.error, undefined);
        assert.equal(result.cost, (b.tiles.length - before.tiles.length) * 3);
        const rect = floorRectangle(start, finish);
        for (let x = rect.from.x; x <= rect.to.x; x++)
          for (let z = rect.from.z; z <= rect.to.z; z++)
            assert.ok(b.contains({ x: x + 0.5, z: z + 0.5 }));
        assert.ok(new ClinicBuild().restore(b.snapshot()));
      }
  });

test('one rectangle spanning existing floor opens each new patch and preserves old doors', () => {
  const b = new ClinicBuild();
  b.autoSpace({ x: -11, z: -4 }, { x: -5, z: 4 }, 'room', 5000, [], true);
  const old = b.snapshot();
  const result = b.autoSpace(
    { x: -10, z: -7 },
    { x: -6, z: 7 },
    'room',
    5000,
    [],
    true,
  );
  assert.equal(result.error, undefined);
  assert.equal(result.doors.length, 2);
  assert.equal(b.state.doors.length, old.doors.length + 2);
  assert.ok(b.route(localToTown(-8, -6), localToTown(-8, 6)).length);
  assert.ok(new ClinicBuild().restore(b.snapshot()));
  const before = b.snapshot();
  assert.ok(
    b.autoSpace({ x: -10, z: -7 }, { x: 100, z: 100 }, 'room', 5000, [], true)
      .error,
  );
  assert.deepEqual(b.snapshot(), before);
});

test('erasing a partial furniture footprint returns every affected copy exactly once and can be undone', () => {
  const b = new ClinicBuild();
  b.autoSpace({ x: -11, z: -4 }, { x: -5, z: 4 }, 'room', 5000, [], true);
  const one = b.buy('lounge-chair')!,
    two = b.buy('lounge-chair')!;
  assert.equal(b.place(one.id, { x: -9, z: 2, rotation: 0 }), undefined);
  assert.equal(
    b.place(two.id, { x: -9, z: -2, rotation: Math.PI / 2 }),
    undefined,
  );
  const before = b.snapshot(),
    revision = b.revision;
  // Their centres are outside the strip; their rotated footprints overlap it.
  const a = { x: -10, z: -4 },
    end = { x: -10, z: 3 };
  const preview = b.erase(a, end);
  assert.deepEqual(preview.stored.sort(), [one.id, two.id].sort());
  assert.equal(preview.removed, 8);
  assert.deepEqual(b.snapshot(), before);
  assert.equal(b.revision, revision);
  const result = b.erase(a, end, true);
  assert.equal(result.error, undefined);
  assert.equal(result.cost, 0);
  assert.equal(b.state.credits, before.credits);
  assert.equal(b.items.length, before.items.length);
  assert.equal(b.copies('seat-5').filter((i) => !i.placement).length, 2);
  assert.deepEqual(
    b.placement('welcome-bench'),
    before.items.find((i) => i.id === 'welcome-bench')!.placement,
  );
  assert.ok(new ClinicBuild().restore(b.snapshot()));
  assert.ok(b.restore(before));
  assert.deepEqual(b.snapshot(), before);
});

test('a cut through the only door gives both remaining room pieces a new safe entrance', () => {
  const b = new ClinicBuild();
  const originalDoor = b.autoSpace(
    { x: -11, z: -4 },
    { x: -5, z: 4 },
    'room',
    5000,
    [],
    true,
  ).doors[0];
  const before = b.snapshot();
  const result = b.erase(
    { x: -11, z: originalDoor.z },
    { x: -6, z: originalDoor.z },
    true,
  );
  assert.equal(result.error, undefined);
  assert.equal(result.removed, 6);
  assert.equal(result.detached, 0);
  assert.equal(b.tiles.length, before.tiles.length - 6);
  assert.equal(b.state.doors.length, 2);
  assert.ok(!b.state.doors.some((e) => wallKey(e) === wallKey(originalDoor)));
  for (const z of [-3, 2]) assert.ok(b.canStand({ x: -8.25, z }));
  assert.equal(b.validate(), undefined);
  assert.ok(new ClinicBuild().restore(b.snapshot()));
});

test('separated leftovers and their furniture survive erasure and reload but cannot attract occupants', () => {
  const s = setup(),
    b = s.build,
    before = b.snapshot();
  const result = b.erase({ x: -11, z: -4 }, { x: -6, z: 3 }, true);
  assert.equal(result.error, undefined);
  assert.equal(result.removed, 48);
  assert.ok(result.detached > 0);
  assert.deepEqual(
    b.placement('wheel'),
    before.items.find((i) => i.id === 'wheel')!.placement,
  );
  assert.equal(
    s.leisure.available(b.stations.find((station) => station.kind === 'wheel')),
    false,
  );
  s.leisure.reconcileBuild(s.households, before.tiles);
  for (const h of s.households.filter((h) => h.inClinic)) {
    const activity = s.leisure.owners.get(h.id);
    assert.ok(
      b.canStand(toClinic(h.position)) ||
        (activity &&
          s.leisure.available(
            b.stations.find((station) => station.id === activity.station),
          )),
    );
  }
  assert.ok(new TownSimulation(visits).restore(s.snapshot()));
  // Undo restores ordinary availability without another purchase.
  assert.ok(b.restore(before));
  s.leisure.reconcileBuild(s.households, before.tiles);
  assert.equal(
    s.leisure.available(b.stations.find((station) => station.kind === 'wheel')),
    true,
  );
  assert.equal(b.items.length, before.items.length);
  assert.ok(new TownSimulation(visits).restore(s.snapshot()));
});

test('occupied rides are returned safely, with ground-level pet state and reachable care afterward', () => {
  const s = setup(),
    b = s.build;
  const pet = [...s.leisure.pets.values()].find((p) =>
    s.leisure.canPlay(s.visit(p.ticket)),
  )!;
  pet.station = b.itemStations('coaster')[0];
  pet.phase = 'use';
  pet.elapsed = 4;
  Object.assign(pet.position, localToTown(-15, -8));
  const before = b.snapshot(),
    time = s.time;
  const result = b.erase({ x: -17, z: -11 }, { x: -17, z: -11 }, true);
  assert.equal(result.error, undefined);
  assert.ok(result.stored.includes('coaster'));
  s.leisure.reconcileBuild(s.households, before.tiles);
  assert.equal(pet.phase, 'rest');
  assert.equal(pet.station, '');
  assert.equal(pet.elapsed, 0);
  assert.equal(pet.called, false);
  assert.ok(b.canStand(toClinic(pet.position)));
  assert.equal(s.time, time);
  assert.ok(new TownSimulation(visits).restore(s.snapshot()));
  callToRoom(s, pet.ticket);
  s.abortVisit(pet.ticket);
  assert.ok(s.queue.includes(pet.ticket));
});

test('erasure ignores empty land and protected clinical floor and preserves valid saved geometry across varied cuts', () => {
  const b = new ClinicBuild();
  b.syncOwned(owned);
  const original = b.snapshot();
  for (let i = 0; i < 16; i++) {
    assert.ok(b.restore(original));
    const a = { x: -20 + ((i * 7) % 24), z: -23 + ((i * 11) % 28) };
    const end = { x: a.x + 1 + (i % 12), z: a.z + 1 + ((i * 3) % 12) };
    const plan = b.erase(a, end);
    assert.equal(plan.error, undefined, JSON.stringify({ a, end }));
    assert.deepEqual(b.snapshot(), original);
    assert.equal(b.erase(a, end, true).error, undefined);
    assert.ok(new ClinicBuild().restore(b.snapshot()));
    for (const id of plan.stored) assert.equal(b.placement(id), undefined);
    assert.equal(b.items.length, original.items.length);
    assert.equal(b.state.credits, original.credits);
  }
  const before = b.snapshot();
  const empty = b.erase({ x: 100, z: 100 }, { x: 200, z: 200 }, true);
  assert.equal(empty.removed, 0);
  assert.equal(empty.stored.length, 0);
  assert.deepEqual(b.snapshot(), before);
});

for (const surface of ['room', 'garden'] as const)
  test(`a ${surface} bridge reconnects a retained room and makes its furniture usable again`, () => {
    const b = new ClinicBuild();
    b.autoSpace({ x: -11, z: -4 }, { x: -5, z: 4 }, 'room', 5000, [], true);
    b.autoSpace({ x: -11, z: -10 }, { x: -5, z: -4 }, 'room', 5000, [], true);
    const chair = b.buy('lounge-chair')!;
    assert.equal(b.place(chair.id, { x: -8, z: -7, rotation: 0 }), undefined);
    assert.equal(
      b.erase({ x: -11, z: -4 }, { x: -6, z: -4 }, true).error,
      undefined,
    );
    const station = () => b.stations.find((s) => s.itemId === chair.id)!;
    assert.equal(b.stationAccessible(station()), false);
    const before = b.snapshot(),
      revision = b.revision;
    const preview = b.autoSpace(
      { x: -11, z: -4 },
      { x: -5, z: -3 },
      surface,
      5000,
    );
    assert.equal(preview.error, undefined);
    assert.equal(preview.cost, 18);
    assert.deepEqual(b.snapshot(), before);
    assert.equal(b.revision, revision);
    assert.ok(
      b.autoSpace({ x: -11, z: -4 }, { x: -5, z: -3 }, surface, 0, [], true)
        .error,
    );
    assert.deepEqual(b.snapshot(), before);

    assert.equal(
      b.autoSpace({ x: -11, z: -4 }, { x: -5, z: -3 }, surface, 5000, [], true)
        .error,
      undefined,
    );
    assert.equal(b.state.detached, undefined);
    assert.equal(b.stationAccessible(station()), true);
    assert.ok(new ClinicBuild().restore(b.snapshot()));
  });

test('extra species amusements are paid stored copies with saved placement and safe unloading', () => {
  for (const amusement of extraAmusements) {
    const s = new TownSimulation(visits, () => 0.5);
    const species = amusement.id.startsWith('fish-')
      ? 'goldfish'
      : amusement.id === 'bird-hoops'
        ? 'bird'
        : amusement.id === 'dig-box' || amusement.id === 'snuffle-mat'
          ? 'hamster'
          : 'cat';
    const patient = visits.findIndex(
      (v) =>
        v.species === species && !v.clinical?.fever && !v.clinical?.fracture,
    );
    s.seedClinic([patient]);
    s.configureClinic(8, 22);
    const ids = [
      'expansion',
      'pet-room',
      'play-annex',
      'sun-courtyard',
      amusement.id,
    ] as const;
    s.configureLeisure([...ids]);
    assert.equal(
      s.build.placement(amusement.id),
      undefined,
      'never invent an overlapping legacy position',
    );
    s.build.buy(amusement.id);
    assert.equal(
      s.build.items.filter((i) => i.recipe === amusement.id).length,
      2,
    );
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
    assert.equal(
      s.build.place(amusement.id, { x: -14, z: -22, rotation: Math.PI / 2 }),
      undefined,
      amusement.id,
    );
    s.leisure.replan(s.households);
    let rider: import('../src/clinic-leisure.ts').PetActivity | undefined;
    for (let i = 0; i < 2200 && !rider; i++) {
      s.update(0.1);
      rider = [...s.leisure.pets.values()].find(
        (p) => p.station === amusement.id && p.phase === 'use',
      );
    }
    assert.ok(rider, amusement.id + ' has an eligible rider');
    const station = s.build.stations.find((st) => st.id === amusement.id)!;
    assert.ok(station.species?.includes(s.visit(rider.ticket).species));
    const loaded = new TownSimulation(visits);
    assert.ok(loaded.restore(s.snapshot()));
    loaded.configureLeisure([...ids]);
    assert.deepEqual(loaded.leisure.snapshot(), s.leisure.snapshot());
    s.leisure.beginMove(amusement.id);
    let ready = false;
    for (let i = 0; i < 600 && !ready; i++) {
      s.leisure.update(0.1, s.households, s.tickets, (id) => s.visit(id));
      ready = s.leisure.movingReady(amusement.id, s.households);
    }
    assert.ok(ready, amusement.id + ' releases its rider before moving');
    assert.equal(s.build.place(amusement.id, undefined), undefined);
    s.leisure.replan(s.households);
    s.leisure.endMove();
    assert.ok(!s.build.stations.some((st) => st.id === amusement.id));
    callToRoom(s, rider.ticket);
  }
});
