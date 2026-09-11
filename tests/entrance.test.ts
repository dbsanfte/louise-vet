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
    // Isolate FIFO/doorway behavior with fresh patience; timeout and retry have
    // their own full-queue test below.
    for (const h of s.households.filter(
      (h) => !h.inClinic && h.routine === 'clinic-wait',
    ))
      h.remaining = 300;
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

test('a neglected outside queue disperses into daily routines without losing care or indoor places', () => {
  const s = crowdedClinic(),
    indoor = [...s.queue];
  const outside = s.households.filter((h) => !h.inClinic);
  const ruby = outside.find((h) => h.owner === 'Ruby')!;
  const companionCare = {
    household: ruby.id,
    pet: 'Pico',
    reason: 'post-fire' as const,
  };
  s.emergencies.pending.push(companionCare);
  // Include ordinary appointments as well as rescued pets in this crowded save.
  for (const h of outside.slice(0, 7))
    s.tickets.get(h.ticket!)!.reason = 'checkup';
  const care = outside.map((h) => ({
    id: h.ticket!,
    pet: s.tickets.get(h.ticket!)!.pet,
    reason: s.tickets.get(h.ticket!)!.reason,
  }));
  tick(s, 180);
  assert.deepEqual(
    s.queue,
    indoor,
    'inside families never abandon their places',
  );
  assert.equal(s.entrance.waiting.length, 0);
  assert.equal(s.entrance.places.size, 0);
  assert.equal(s.tickets.size, 18);
  assert.deepEqual(
    s.emergencies.pending,
    [companionCare],
    'the second rescued pet still needs its own visit',
  );
  for (const { id, pet, reason } of care) {
    assert.equal(s.tickets.get(id)?.status, 'deferred');
    assert.equal(s.tickets.get(id)?.pet, pet);
    assert.equal(s.tickets.get(id)?.reason, reason);
  }
  assert.equal(s.events.filter((e) => e.kind === 'deferred').length, 14);
  assert.ok(
    new Set(outside.map((h) => h.retryCareAt)).size > 5,
    'return times are staggered',
  );
  let active = 0;
  for (let i = 0; i < 2400; i++) {
    s.update(0.1);
    active = Math.max(
      active,
      outside.filter((h) =>
        ['walk', 'park', 'chat', 'gather'].includes(h.routine),
      ).length,
    );
    assert.equal(
      s.entrance.waiting.length,
      0,
      'no repeat street queue while the clinic remains full',
    );
    if (ruby.routine === 'park')
      assert.deepEqual(
        ruby.companions,
        [],
        'both rescued pets rest at home while Ruby continues her day',
      );
  }
  assert.ok(active >= 10, `${active} families continued their day`);
  assert.deepEqual(s.queue, indoor);
  assert.ok(
    outside.every((h) => s.tickets.get(h.ticket!)?.status === 'deferred'),
  );
  const saved = s.snapshot(),
    restored = new TownSimulation(visits, () => 0.5);
  assert.ok(restored.restore(saved));
  assert.deepEqual(restored.snapshot(), saved);
  const broken = structuredClone(saved);
  broken.households[outside[0].id].retryCareAt = undefined;
  assert.equal(restored.restore(broken), false);
  assert.deepEqual(restored.snapshot(), saved);
});

test('a deferred patient returns after the cooldown when a real place opens, keeping its original case', () => {
  const s = crowdedClinic();
  tick(s, 180);
  const deferred = new Map(
    [...s.tickets]
      .filter(([, t]) => t.status === 'deferred')
      .map(([id, t]) => [id, { ...t }]),
  );
  const treated = s.queue[0];
  assert.ok(callToRoom(s, treated));
  assert.ok(s.completeVisit(treated));
  // Even with room available, no one immediately turns around to queue again.
  tick(s, 5);
  assert.equal(
    [...deferred.keys()].filter(
      (id) => s.tickets.get(id)?.status !== 'deferred',
    ).length,
    0,
  );
  let returned: number | undefined;
  for (let i = 0; i < 5000; i++) {
    s.update(0.1);
    returned = [...deferred.keys()].find(
      (id) => s.tickets.get(id)?.status === 'waiting',
    );
    if (returned !== undefined) break;
  }
  assert.notEqual(
    returned,
    undefined,
    'an original patient eventually returns',
  );
  const original = deferred.get(returned!)!,
    current = s.tickets.get(returned!)!;
  assert.equal(current.pet, original.pet);
  assert.equal(current.reason, original.reason);
  assert.equal(current.createdAt, original.createdAt);
  assert.ok(s.queue.includes(returned!));
  assert.equal(
    s.households.find((h) => h.ticket === returned)!.retryCareAt,
    undefined,
  );
  assert.ok(new TownSimulation(visits).restore(s.snapshot()));
});
