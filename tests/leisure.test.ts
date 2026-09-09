import { callToRoom } from './clinic-helpers.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TownSimulation } from '../src/town-simulation.ts';
import {
  visits,
  upgrades,
  purchase,
  loadProgress,
  clinicCapacity,
  type UpgradeId,
} from '../src/game.ts';
import {
  type PetActivity,
  clinicPlan,
  interiorRoute,
  townToLocal,
} from '../src/clinic-leisure.ts';
import {
  distance,
  localToTown,
  clinicDesk,
  examOwner,
} from '../src/town-map.ts';
const owned = upgrades
  .filter((u) => u.id !== 'stock')
  .map((u) => u.id) as UpgradeId[];
const tick = (s: TownSimulation, t: number) => {
  for (let i = 0; i < t * 10; i++) s.update(0.1);
};
function setup(
  names = ['Luna', 'Milo', 'Peanut', 'Sunny', 'Hazel', 'Cleo', 'Pip', 'Daisy'],
) {
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic(names.map((name) => visits.findIndex((v) => v.name === name)));
  s.configureClinic(8, 22);
  s.configureLeisure(owned);
  return s;
}
test('rooms and amusements require their parent module and charge only once', () => {
  const p = loadProgress();
  p.coins = 5000;
  assert.equal(purchase(p, 'pet-room'), false);
  assert.equal(purchase(p, 'wheel'), false);
  assert.equal(p.coins, 5000);
  assert.ok(purchase(p, 'expansion'));
  assert.equal(clinicCapacity(p.upgrades), 6);
  assert.ok(purchase(p, 'pet-room'));
  assert.equal(clinicCapacity(p.upgrades), 8);
  assert.ok(purchase(p, 'wheel'));
  const balance = p.coins;
  assert.equal(purchase(p, 'wheel'), false);
  assert.equal(balance, p.coins);
});
test('owners use exclusive seats, books and games while eligible pets take real turns', () => {
  const s = setup();
  const poses = new Set<string>(),
    rides = new Set<string>();
  let queue = false;
  for (let i = 0; i < 2400; i++) {
    s.update(0.1);
    for (const a of s.leisure.owners.values()) poses.add(a.phase);
    const stations = [...s.leisure.owners.values()].map((a) => a.station);
    assert.equal(new Set(stations).size, stations.length);
    for (const summary of s.leisure.summary()) {
      queue ||= summary.queued > 0;
      assert.ok(summary.queued <= 3);
      const active = [...s.leisure.pets.values()].filter(
        (p) => p.station === summary.id && ['use', 'board'].includes(p.phase),
      );
      assert.ok(active.length <= 1);
      for (const p of active) {
        rides.add(summary.id);
        const station = clinicPlan.stations.find((st) => st.id === summary.id)!;
        assert.ok(station.species?.includes(s.visit(p.ticket).species));
      }
    }
  }
  assert.ok(poses.has('read'));
  assert.ok(poses.has('game'));
  assert.ok(queue);
  for (const ride of [
    'scratch',
    'wheel',
    'carousel',
    'toys',
    'coaster',
    'ferris',
  ])
    assert.ok(rides.has(ride), ride);
  assert.ok(
    [...s.leisure.pets.values()].some((p) => p.turns >= 2),
    'rides finish and pets can take later turns',
  );
  const pip = [...s.tickets.values()].find((t) => t.pet === 'Pip')!;
  assert.equal(
    s.leisure.pets.get(pip.id)?.turns,
    0,
    'broken bones rest beside the owner',
  );
});
test('ride queues preserve their order, positions and occupancy on reload', () => {
  const s = setup(['Milo', 'Cleo', 'Poppy', 'Biscuit']);
  // Make this a cat scratching-post-only playroom to exercise its line.
  s.configureLeisure(['expansion', 'pet-room', 'scratch']);
  tick(s, 25);
  const before = s.snapshot(),
    r = new TownSimulation(visits, () => 0.5);
  assert.ok(r.restore(JSON.parse(JSON.stringify(before))));
  r.configureLeisure(['expansion', 'pet-room', 'scratch']);
  r.configureClinic(8, 22);
  assert.deepEqual(r.leisure.snapshot(), s.leisure.snapshot());
  const queue = [...s.leisure.pets.values()]
    .filter((p) => p.station === 'scratch')
    .sort((a, b) => a.joined - b.joined);
  for (let i = 0; i < 800; i++) {
    s.update(0.1);
    r.update(0.1);
  }
  for (const p of queue) assert.ok(s.leisure.pets.get(p.ticket)!.turns > 0);
  assert.deepEqual(r.leisure.snapshot(), s.leisure.snapshot());
});
test('calling a pet frees its ride and walks it back before examination; abort and completion remain usable', () => {
  const s = setup(['Hazel', 'Luna']);
  let id: number | undefined;
  for (let i = 0; i < 900; i++) {
    s.update(0.1);
    id = [...s.leisure.pets.values()].find((p) => p.phase === 'use')?.ticket;
    if (id !== undefined) break;
  }
  assert.notEqual(id, undefined);
  const h = s.households.find((h) => h.ticket === id)!;
  assert.equal(s.startVisit(id!), false);
  assert.ok(s.leisure.pets.get(id!)?.called);
  let started = false,
    previous = { ...s.leisure.pets.get(id!)!.position };
  for (let i = 0; i < 500; i++) {
    s.update(0.1);
    const p = s.leisure.pets.get(id!);
    if (p) {
      assert.ok(distance(previous, p.position) <= 0.161);
      previous = { ...p.position };
    }
    if (s.startVisit(id!)) {
      started = true;
      break;
    }
  }
  assert.ok(started);
  assert.equal(s.leisure.pets.has(id!), false);
  assert.ok(s.abortVisit(id!));
  assert.notEqual(
    s.leisure.owners.get(h.id)?.phase,
    'wait',
    'aborting releases the owner to resume pastimes',
  );
  assert.ok(callToRoom(s, id!));
  assert.ok(s.completeVisit(id!));
  assert.equal(s.leisure.owners.has(h.id), false);
  tick(s, 90);
  assert.equal(s.tickets.has(id!), false);
});
test('old saves need no activity state and malformed leisure data cannot replace a good town', () => {
  const s = setup();
  tick(s, 15);
  const r = new TownSimulation(visits, () => 0.5);
  assert.ok(r.restore(s.snapshot()));
  const bad = s.snapshot();
  bad.leisure.pets[0].position.x = 1e6;
  assert.equal(r.restore(bad), false);
  const missingRide = s.snapshot();
  missingRide.leisure.pets[0].phase = 'use';
  missingRide.leisure.pets[0].station = '';
  assert.equal(r.restore(missingRide), false);
  const duplicateSeat = s.snapshot();
  duplicateSeat.leisure.owners[1].station =
    duplicateSeat.leisure.owners[0].station;
  assert.equal(r.restore(duplicateSeat), false);
  assert.deepEqual(
    r.snapshot(),
    s.snapshot(),
    'rejected data cannot partially replace the town',
  );
  const old = s.snapshot() as Partial<ReturnType<TownSimulation['snapshot']>>;
  delete old.leisure;
  assert.ok(r.restore(old));
});
test('interior trips stay within connected rooms and use the middle of each doorway', () => {
  const route = interiorRoute(
    localToTown(-15.5, 2),
    localToTown(3.45, 1.65),
  ).map(townToLocal);
  assert.ok(route.some((p) => Math.abs(p.z) < 1e-6));
  for (const p of route)
    assert.ok(p.x >= -17 && p.x <= 5.6 && Math.abs(p.z) <= 4);
});

test('waiting owners keep their places, then walk to the desk only when called', () => {
  const s = setup();
  tick(s, 20);
  const settled = [...s.leisure.owners.values()].map((a) => ({
    id: a.household,
    station: a.station,
    position: { ...s.households[a.household].position },
  }));
  tick(s, 90);
  for (const before of settled) {
    assert.equal(s.leisure.owners.get(before.id)?.station, before.station);
    assert.deepEqual(s.households[before.id].position, before.position);
  }
  const h = s.households.find(
    (h) => h.ticket !== undefined && s.leisure.owners.has(h.id),
  )!;
  assert.equal(s.startVisit(h.ticket!), false);
  let previous = { ...h.position },
    reached = false,
    visitedDesk = false;
  for (let i = 0; i < 500; i++) {
    s.update(0.1);
    assert.ok(
      distance(previous, h.position) <= 0.151,
      'owner walks without teleporting',
    );
    previous = { ...h.position };
    visitedDesk ||= distance(h.position, clinicDesk) < 0.08;
    if (s.startVisit(h.ticket!)) {
      reached = true;
      break;
    }
  }
  assert.ok(reached);
  assert.ok(visitedDesk);
  assert.ok(distance(h.position, examOwner) < 0.08);
});

test('new arrivals check in at the desk once and settle; cancelling a call or reloading returns to waiting', () => {
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic([]);
  s.configureClinic(4, 22);
  s.requestVisit('Luna', 'checkup');
  const h = s.households[0];
  let checkedIn = false;
  for (let i = 0; i < 1000; i++) {
    s.update(0.1);
    const a = s.leisure.owners.get(h.id);
    if (a?.phase === 'check-in') {
      checkedIn = true;
      assert.ok(distance(h.position, clinicDesk) < 0.08);
    }
    if (a?.phase === 'sit') break;
  }
  assert.ok(checkedIn);
  const seat = { ...h.position };
  tick(s, 50);
  assert.deepEqual(h.position, seat);
  const id = h.ticket!;
  assert.equal(s.startVisit(id), false);
  for (
    let i = 0;
    i < 100 && s.leisure.owners.get(h.id)?.phase !== 'desk';
    i++
  ) {
    s.update(0.1);
    s.startVisit(id);
  }
  assert.equal(s.leisure.owners.get(h.id)?.phase, 'desk');
  s.update(0.1);
  const r = new TownSimulation(visits, () => 0.5);
  assert.ok(r.restore(s.snapshot()));
  assert.ok(r.queue.includes(id));
  tick(r, 15);
  assert.equal(r.leisure.owners.get(h.id)?.phase, 'sit');
  s.leisure.cancelRecall(id, s.households);
  tick(s, 15);
  assert.equal(s.leisure.owners.get(h.id)?.phase, 'sit');
  assert.equal(s.tickets.get(id)?.status, 'waiting');
});

test('new rides enforce purchases, take moving turns and unload before recall', () => {
  const progress = loadProgress();
  progress.coins = 2000;
  for (const id of ['coaster', 'ferris'] as const)
    assert.equal(purchase(progress, id), false);
  purchase(progress, 'expansion');
  purchase(progress, 'pet-room');
  for (const id of ['coaster', 'ferris'] as const) {
    const balance = progress.coins;
    assert.ok(purchase(progress, id));
    assert.equal(
      progress.coins,
      balance - upgrades.find((u) => u.id === id)!.price,
    );
    assert.equal(purchase(progress, id), false);
    const s = setup(['Luna']);
    s.configureLeisure(['expansion', 'pet-room', id]);
    let rider: PetActivity | undefined;
    for (let i = 0; i < 3000; i++) {
      s.update(0.05);
      rider = [...s.leisure.pets.values()].find(
        (p) => p.station === id && p.phase === 'use' && p.elapsed > 3,
      );
      if (rider) break;
    }
    assert.ok(rider, `${id} boards an eligible pet`);
    const ticket = rider.ticket;
    const r = new TownSimulation(visits, () => 0.5);
    assert.ok(r.restore(s.snapshot()), 'raised ride state survives reload');
    assert.deepEqual(r.leisure.snapshot(), s.leisure.snapshot());
    assert.equal(s.startVisit(ticket), false);
    assert.equal(
      rider.phase,
      'use',
      'call waits for the cabin to reach the station',
    );
    assert.ok(rider.called);
    tick(s, 1);
    assert.equal(rider.phase, 'use', 'no mid-air disembarking');
    assert.ok(callToRoom(s, ticket));
    assert.ok(s.abortVisit(ticket));
    assert.ok(s.queue.includes(ticket));
  }
});

test('older playground saves align moved stations without losing the active turn', () => {
  const s = setup(['Peanut']);
  for (let i = 0; i < 1000; i++) {
    s.update(0.1);
    if (
      [...s.leisure.pets.values()].some(
        (p) => p.station === 'wheel' && p.phase === 'use',
      )
    )
      break;
  }
  const saved = s.snapshot();
  const pet = saved.leisure.pets.find(
    (p) => p.station === 'wheel' && p.phase === 'use',
  )!;
  assert.ok(pet);
  const current = { ...pet.position };
  pet.position = localToTown(-15.5, 2);
  const restored = new TownSimulation(visits, () => 0.5);
  assert.ok(restored.restore(saved));
  assert.deepEqual(restored.leisure.pets.get(pet.ticket)?.position, current);
  assert.equal(restored.leisure.pets.get(pet.ticket)?.remaining, pet.remaining);
  assert.equal(restored.leisure.pets.get(pet.ticket)?.turns, pet.turns);
});

test('extension purchases unlock six usable activities including bird flights and cat climbs', () => {
  const progress = loadProgress();
  progress.coins = 5000;
  const additions = [
    'treat-dispenser',
    'water-dispenser',
    'toy-box',
    'yarn',
    'aviary',
    'play-tree',
  ] as const;
  for (const id of additions) assert.equal(purchase(progress, id), false);
  assert.equal(purchase(progress, 'play-annex'), false);
  for (const id of ['expansion', 'pet-room', 'play-annex'] as const)
    assert.ok(purchase(progress, id));
  for (const id of additions) {
    const coins = progress.coins;
    assert.ok(purchase(progress, id));
    assert.equal(
      progress.coins,
      coins - upgrades.find((u) => u.id === id)!.price,
    );
    assert.equal(purchase(progress, id), false);
  }
  assert.equal(clinicCapacity(progress.upgrades), 8);
  assert.equal(progress.stock, 3, 'dispensers do not spend retail stock');
  const s = setup(['Luna', 'Milo', 'Peanut', 'Pico']);
  const seen = new Set<string>();
  for (let i = 0; i < 4500; i++) {
    s.update(0.1);
    for (const p of s.leisure.pets.values())
      if (p.phase === 'use') {
        seen.add(p.station);
        if (s.visit(p.ticket).species === 'bird')
          assert.ok(
            ['water-dispenser', 'aviary', 'play-tree', 'bird-chimes'].includes(
              p.station,
            ),
          );
      }
  }
  for (const id of additions)
    assert.ok(seen.has(id), `${id} has a real pet user`);
  const restored = new TownSimulation(visits, () => 0.5);
  assert.ok(restored.restore(s.snapshot()));
  assert.deepEqual(restored.leisure.snapshot(), s.leisure.snapshot());
});

test('called birds and climbing cats finish at ground level before returning to care', async () => {
  const { enrichmentPose } = await import('../src/clinic-enrichment.ts');
  for (const [name, station] of [
    ['Pico', 'aviary'],
    ['Milo', 'play-tree'],
  ]) {
    const s = setup([name]);
    s.configureLeisure([
      'expansion',
      'pet-room',
      'play-annex',
      station as UpgradeId,
    ]);
    let pet: PetActivity | undefined;
    for (let i = 0; i < 3000; i++) {
      s.update(0.05);
      pet = [...s.leisure.pets.values()].find(
        (p) => p.station === station && p.phase === 'use' && p.elapsed > 4,
      );
      if (pet) break;
    }
    assert.ok(pet, `${name} reaches ${station}`);
    assert.ok(
      enrichmentPose(station, pet.elapsed, s.visit(pet.ticket).species).y > 0.5,
    );
    const saved = new TownSimulation(visits, () => 0.5);
    assert.ok(saved.restore(s.snapshot()), 'an elevated turn survives reload');
    assert.equal(s.startVisit(pet.ticket), false);
    assert.equal(pet.phase, 'use');
    assert.ok(pet.called);
    let lastHeight = 0;
    while (pet.phase === 'use') {
      lastHeight = enrichmentPose(
        station,
        pet.elapsed,
        s.visit(pet.ticket).species,
      ).y;
      s.update(0.05);
    }
    assert.ok(lastHeight < 0.04, 'no mid-air dismount when recalled');
    assert.ok(callToRoom(s, pet.ticket));
    assert.ok(s.abortVisit(pet.ticket));
  }
});

test('lounge seats face inward and their approaches and pet rest spots avoid the furniture', async () => {
  const { clinicPetRest } = await import('../src/clinic-leisure.ts');
  for (const seat of clinicPlan.stations.filter((s) =>
    s.id.startsWith('seat-'),
  )) {
    assert.ok(Math.cos(seat.facing) < -0.99);
    const owner = {
      position: localToTown(seat.x, seat.z),
      facing: seat.facing,
    };
    const route = interiorRoute(clinicDesk, owner.position).map(townToLocal);
    assert.ok(
      route.at(-2)!.z < seat.z - 0.8,
      'approach from in front of the chair',
    );
    const pet = townToLocal(clinicPetRest(owner));
    assert.ok(pet.z < seat.z - 1, 'pet is clear of the chair and seated legs');
  }
  const route = interiorRoute(
    localToTown(-6.35, -10),
    localToTown(-9.7, 2.65),
  ).map(townToLocal);
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i];
    for (let step = 0; step <= 20; step++) {
      const p = {
        x: a.x + ((b.x - a.x) * step) / 20,
        z: a.z + ((b.z - a.z) * step) / 20,
      };
      assert.ok(
        !(Math.abs(p.x + 8.2) < 0.9 && Math.abs(p.z + 2.1) < 0.8),
        'garden route avoids the game table',
      );
    }
  }
});
