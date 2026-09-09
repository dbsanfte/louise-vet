import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  visits,
  upgrades,
  purchase,
  loadProgress,
  clinicCapacity,
} from '../src/game.ts';
import { TownSimulation } from '../src/town-simulation.ts';
import { clinicPlan, interiorRoute } from '../src/clinic-leisure.ts';
import {
  localToTown,
  onRoad,
  layout,
  segmentDistance,
} from '../src/town-map.ts';
import { callToRoom } from './clinic-helpers.ts';
test('courtyard purchases charge once, require space, and preserve eight-patient capacity', () => {
  const p = loadProgress();
  p.coins = 5000;
  for (const id of [
    'sun-courtyard',
    'puzzle-table',
    'bubbles',
    'cat-nook',
    'bird-chimes',
    'flower-border',
  ])
    assert.equal(purchase(p, id), false);
  for (const id of [
    'expansion',
    'pet-room',
    'sun-courtyard',
    'puzzle-table',
    'bubbles',
    'cat-nook',
    'bird-chimes',
    'flower-border',
    'bunting',
    'cosy-rug',
    'wall-art',
  ])
    assert.ok(purchase(p, id));
  assert.equal(clinicCapacity(p.upgrades), 8);
  const coins = p.coins;
  assert.equal(purchase(p, 'bubbles'), false);
  assert.equal(p.coins, coins);
});
test('the courtyard stays off streets; all new activities are used, saved, and can be recalled for care', () => {
  const room = clinicPlan.rooms.find((r) => r.id === 'sun-courtyard')!;
  for (let x = room.x - room.width / 2; x <= room.x + room.width / 2; x += 0.25)
    for (
      let z = room.z - room.depth / 2;
      z <= room.z + room.depth / 2;
      z += 0.25
    ) {
      const p = localToTown(x, z);
      assert.ok(!onRoad(p));
      for (const road of layout.roads)
        for (let i = 1; i < road.points.length; i++)
          assert.ok(
            segmentDistance(
              p,
              { x: road.points[i - 1][0], z: road.points[i - 1][1] },
              { x: road.points[i][0], z: road.points[i][1] },
            ) > 4.1,
          );
    }
  const s = new TownSimulation(visits, () => 0.5);
  const owned = upgrades.filter((u) => u.id !== 'stock').map((u) => u.id);
  s.configureLeisure(owned);
  s.configureClinic(8, 22);
  s.seedClinic(
    ['Luna', 'Milo', 'Pico', 'Melody', 'Cleo', 'Hazel', 'Pip', 'Daisy'].map(
      (n) => visits.findIndex((v) => v.name === n),
    ),
  );
  const seen = new Set<string>();
  let puzzle = false;
  for (let i = 0; i < 4500; i++) {
    s.update(0.1);
    for (const p of s.leisure.pets.values())
      if (p.phase === 'use') seen.add(p.station);
    puzzle ||= [...s.leisure.owners.values()].some(
      (a) => a.station.startsWith('puzzle') && a.phase === 'game',
    );
  }
  for (const id of ['bubbles', 'cat-nook', 'bird-chimes'])
    assert.ok(seen.has(id), id + ' receives a real turn');
  assert.ok(puzzle);
  const saved = s.snapshot();
  const restored = new TownSimulation(visits, () => 0.5);
  restored.configureLeisure(owned);
  restored.configureClinic(8, 22);
  assert.ok(restored.restore(saved));
  assert.ok(callToRoom(restored, restored.queue[0]));
  const route = interiorRoute(
    localToTown(-15.4, -18.6),
    localToTown(-1.3, -0.1),
  );
  assert.ok(
    route.some((p) => Math.abs(p.x - localToTown(-11.55, -18.6).x) < 0.01),
  );
});
