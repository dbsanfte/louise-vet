import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TownSimulation } from '../src/town-simulation.ts';
import { visits } from '../src/game.ts';
import { clinicDoor, distance, onRoad } from '../src/town-map.ts';
import { entrancePlaces } from '../src/clinic-entrance.ts';
import { callToRoom } from './clinic-helpers.ts';
import { crowdedClinic } from './fixtures/entrance-state.ts';

function tick(s: TownSimulation, n: number) {
  for (let i = 0; i < n * 10; i++) s.update(0.1);
}
test('an old doorway pile spreads into separate reserved family places and saves without losing visits', () => {
  const s = crowdedClinic();
  const outside = s.households.filter((h) => !h.inClinic);
  assert.equal(outside.length, 14);
  assert.ok(
    outside.every((h) => distance(h.position, clinicDoor) === 0),
    'restoring does not teleport the crowd',
  );
  tick(s, 60);
  assert.equal(s.tickets.size, 18);
  for (const h of outside) {
    assert.equal(h.routine, 'clinic-wait');
    assert.equal(h.inClinic, false);
    assert.equal(h.route.length, 0);
    assert.ok(!onRoad(h.position));
    assert.ok(distance(h.position, clinicDoor) > 1.5);
    for (const other of outside)
      if (other !== h) assert.ok(distance(h.position, other.position) > 2);
  }
  const saved = s.snapshot();
  const restored = new TownSimulation(visits, () => 0.5);
  assert.ok(restored.restore(saved));
  assert.deepEqual(restored.entrance.snapshot(), s.entrance.snapshot());
  assert.deepEqual(
    restored.households.map((h) => h.position),
    s.households.map((h) => h.position),
  );
  const broken = structuredClone(saved);
  broken.entrance.places[1][1] = broken.entrance.places[0][1];
  assert.equal(restored.restore(broken), false);
  assert.deepEqual(restored.snapshot(), saved);
});
test('waiting families enter in arrival order, one at a time, after departing customers clear the door', () => {
  const s = crowdedClinic();
  tick(s, 60);
  for (let n = 0; n < 3; n++) {
    const next = s.entrance.waiting[0],
      id = s.queue[0];
    assert.ok(callToRoom(s, id));
    assert.ok(s.completeVisit(id));
    s.update(0.1);
    assert.equal(s.households[next].inClinic, false);
    let admitted = false;
    for (let i = 0; i < 400; i++) {
      s.update(0.1);
      assert.ok(
        s.households.filter((h) => h.routine === 'clinic-enter').length <= 1,
      );
      assert.ok(
        [...s.tickets.values()].filter((t) =>
          ['waiting', 'examining'].includes(t.status),
        ).length <= 4,
      );
      if (s.households[next].inClinic) {
        admitted = true;
        break;
      }
    }
    assert.ok(admitted);
    assert.equal(s.entrance.waiting.includes(next), false);
    assert.equal(s.entrance.places.has(next), false);
  }
});
test('outdoor places and companion resting spots stay clear of roads and each other', () => {
  const s = crowdedClinic();
  for (const spot of entrancePlaces) assert.equal(onRoad(spot), false);
  const h = s.households[0];
  h.position = { ...entrancePlaces[0] };
  const a = s.entrance.petSpot(h, 0),
    b = s.entrance.petSpot(h, 1);
  assert.ok(distance(a, b) > 0.65);
  assert.ok(distance(h.position, a) > 0.6);
  assert.ok(!onRoad(a) && !onRoad(b));
});
