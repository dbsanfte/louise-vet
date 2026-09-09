import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceActiveTime } from '../src/active-time.ts';
import { OwnerTrail } from '../src/owner-trail.ts';
import { TownSimulation } from '../src/town-simulation.ts';
import { visits } from '../src/game.ts';
import { clinicDoor, distance } from '../src/town-map.ts';
import { townToLocal } from '../src/clinic-leisure.ts';
test('a second dog follows the owner through both clinic doorways and stops at the waiting place', () => {
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic([]);
  const h = s.households.find((h) => h.owner === 'Amelia')!;
  h.routine = 'walk';
  h.companions = ['Luna', 'Scout'];
  assert.ok(s.requestVisit('Luna', 'authored'));
  const trail = new OwnerTrail(h.position);
  let companion = trail.sample(0.85),
    entrance = false,
    room = false;
  function tick() {
    const previous = companion,
      ownerBefore = { ...h.position };
    s.update(0.1);
    trail.update(h.position);
    companion = trail.sample(0.85);
    assert.ok(
      distance(previous, companion) <=
        distance(ownerBefore, h.position) + 0.002,
      'companion travels no further than its owner each step',
    );
    const p = townToLocal(companion);
    if (h.inClinic && p.x > 4.9 && p.x < 5.2) {
      entrance = true;
      assert.ok(
        Math.abs(p.z - 1.65) < 0.01,
        'second pet uses the street doorway, not its wall',
      );
    }
    if (h.inClinic && p.z > -4.2 && p.z < -3.8) {
      room = true;
      assert.ok(
        Math.abs(p.x - 3.5) < 0.01,
        'second pet uses the examination doorway',
      );
    }
  }
  for (let i = 0; i < 1000 && s.leisure.owners.get(h.id)?.phase !== 'sit'; i++)
    tick();
  assert.ok(h.companions.includes('Scout'));
  assert.ok(entrance);
  assert.ok(distance(companion, clinicDoor) > 2);
  assert.ok(distance(companion, h.position) < 1);
  const resting = { ...companion };
  for (let i = 0; i < 300; i++) tick();
  assert.deepEqual(
    companion,
    resting,
    'stationary position selects idle instead of endless walking',
  );
  const id = h.ticket!;
  let started = false;
  for (let i = 0; i < 500; i++) {
    if (s.startVisit(id)) {
      started = true;
      break;
    }
    tick();
  }
  assert.ok(started && room);
  assert.ok(townToLocal(companion).z < -4.5);
  assert.ok(s.abortVisit(id));
  room = false;
  for (let i = 0; i < 300; i++) tick();
  assert.ok(room, 'companion also follows back out after stopping the visit');
});
test('a discontinuous restored position drops a stale trail instead of cutting across town', () => {
  const trail = new OwnerTrail({ x: 0, z: 0 });
  trail.update({ x: 1, z: 0 });
  assert.deepEqual(trail.sample(0.5), { x: 0.5, z: 0 });
  trail.update({ x: 12, z: 6 });
  assert.deepEqual(trail.sample(0.85), { x: 12, z: 6 });
});

test('slow active frames advance the town clock without large physics jumps or offline catch-up', () => {
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic([]);
  let largest = 0;
  const advance = (elapsed: number) =>
    advanceActiveTime(elapsed, (dt) => {
      largest = Math.max(largest, dt);
      s.update(dt);
    });
  for (let i = 0; i < 20; i++) advance(0.4);
  assert.ok(
    Math.abs(s.time - 8) < 1e-6,
    'rendering delays must not stretch an eight-second walk into a minute',
  );
  assert.ok(
    largest <= 0.05,
    'crossings and companion paths are checked in small steps',
  );
  for (let i = 0; i < 10; i++) advance(2.3);
  assert.ok(
    Math.abs(s.time - 31) < 1e-6,
    'multi-second software frames preserve the duration of a journey',
  );
  advance(60);
  assert.ok(
    Math.abs(s.time - 31.5) < 1e-6,
    'returning after a long pause catches up at most half a second',
  );
  advance(0);
  advance(-1);
  advance(NaN);
  assert.ok(Math.abs(s.time - 31.5) < 1e-6);
});

test('route walking consumes short segments without pausing or cutting corners', async () => {
  const { walkRoute, turnToward } = await import('../src/movement.ts');
  const p = { x: 0, z: 0 },
    route = [
      { x: 0, z: 0 },
      { x: 0.1, z: 0 },
      { x: 0.1, z: 0.1 },
      { x: 1, z: 0.1 },
    ];
  walkRoute(p, route, 0.25, 1);
  assert.ok(Math.abs(p.x - 0.15) < 1e-8);
  assert.ok(Math.abs(p.z - 0.1) < 1e-8);
  assert.deepEqual(route, [{ x: 1, z: 0.1 }]);
  const turned = turnToward(Math.PI - 0.02, -Math.PI + 0.02, 0.1);
  assert.ok(
    turned > Math.PI - 0.02 && turned < Math.PI + 0.02,
    'turns across the angle seam without spinning',
  );
});
