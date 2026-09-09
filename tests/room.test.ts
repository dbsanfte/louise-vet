import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TownSimulation } from '../src/town-simulation.ts';
import { visits } from '../src/game.ts';
import {
  distance,
  examDoor,
  examOwner,
  vetHome,
  vetExam,
  clinicDesk,
} from '../src/town-map.ts';
import { townToLocal } from '../src/clinic-leisure.ts';
import { callToRoom } from './clinic-helpers.ts';
// A continuous step may pass a waypoint without ending precisely on it.
function passesDoor(a: { x: number; z: number }, b: { x: number; z: number }) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    length = dx * dx + dz * dz;
  const t = length
    ? Math.max(
        0,
        Math.min(
          1,
          ((examDoor.x - a.x) * dx + (examDoor.z - a.z) * dz) / length,
        ),
      )
    : 0;
  return distance({ x: a.x + t * dx, z: a.z + t * dz }, examDoor) < 0.05;
}
function setup() {
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic([0, 1]);
  for (let i = 0; i < 200; i++) s.update(0.1);
  const id = s.queue[0],
    h = s.households.find((h) => h.ticket === id)!;
  return { s, id, h };
}
function tick(s: TownSimulation, seconds: number) {
  for (let i = 0; i < seconds * 10; i++) s.update(0.1);
}
test('Louise meets the family at the counter and both walk through the door before examination', () => {
  const { s, id, h } = setup();
  let met = false,
    vetDoor = false,
    ownerDoor = false,
    started = false;
  for (let i = 0; i < 500; i++) {
    const owner = { ...h.position },
      vet = { ...s.escort.position };
    if (s.startVisit(id)) {
      started = true;
      break;
    }
    if (s.escort.phase === 'approach') {
      assert.ok(distance(h.position, clinicDesk) < 0.05);
      met = true;
    }
    assert.equal(s.tickets.get(id)?.status, 'waiting');
    assert.ok(s.queue.includes(id));
    s.update(0.1);
    assert.ok(distance(owner, h.position) <= 0.151);
    assert.ok(distance(vet, s.escort.position) <= 0.171);
    vetDoor ||= passesDoor(vet, s.escort.position);
    ownerDoor ||= passesDoor(owner, h.position);
  }
  assert.ok(started && met && vetDoor && ownerDoor);
  assert.ok(distance(h.position, examOwner) < 0.05);
  assert.ok(distance(s.escort.position, vetExam) < 0.05);
  assert.equal(s.leisure.owners.get(h.id)?.phase, 'in-room');
  assert.equal(
    s.startVisit(s.queue[0]),
    false,
    'one Louise cannot lead another patient during care',
  );
});
test('cancelling inside the doorway, stopping care and completing care all use the doorway on return', () => {
  for (const action of ['cancel', 'abort', 'complete']) {
    const { s, id, h } = setup();
    if (action === 'cancel') {
      for (let i = 0; i < 500 && townToLocal(h.position).z >= -5; i++) {
        s.startVisit(id);
        s.update(0.1);
      }
      assert.equal(s.escort.phase, 'lead');
      s.cancelCall(id);
      assert.equal(s.tickets.get(id)?.status, 'waiting');
    } else {
      callToRoom(s, id);
      assert.ok(action === 'abort' ? s.abortVisit(id) : s.completeVisit(id));
    }
    let vetDoor = false,
      ownerDoor = false;
    for (let i = 0; i < 400; i++) {
      const vet = { ...s.escort.position },
        owner = { ...h.position };
      s.update(0.1);
      vetDoor ||= passesDoor(vet, s.escort.position);
      ownerDoor ||= passesDoor(owner, h.position);
    }
    assert.ok(vetDoor && ownerDoor, action);
    assert.equal(s.escort.phase, 'idle');
    assert.ok(distance(s.escort.position, vetHome) < 0.05);
    if (action !== 'complete') {
      assert.ok(s.queue.includes(id));
      assert.equal(s.leisure.owners.get(h.id)?.phase, 'sit');
    } else assert.equal(s.queue.includes(id), false);
  }
});
test('reload cancels an unfinished escort without teleporting Louise or losing the patient', () => {
  const { s, id, h } = setup();
  for (let i = 0; i < 500 && townToLocal(h.position).z >= -5; i++) {
    s.startVisit(id);
    s.update(0.1);
  }
  const r = new TownSimulation(visits, () => 0.5);
  assert.ok(r.restore(JSON.parse(JSON.stringify(s.snapshot()))));
  assert.deepEqual(r.escort.position, s.escort.position);
  assert.deepEqual(r.households[h.id].position, h.position);
  assert.equal(r.escort.phase, 'return');
  assert.ok(r.queue.includes(id));
  tick(r, 25);
  assert.equal(r.escort.phase, 'idle');
  assert.equal(r.leisure.owners.get(h.id)?.phase, 'sit');
  const before = r.snapshot(),
    bad = r.snapshot();
  bad.escort.position.x = 10000;
  assert.equal(r.restore(bad), false);
  assert.deepEqual(r.snapshot(), before);
  const old = r.snapshot() as Partial<ReturnType<TownSimulation['snapshot']>>;
  delete old.escort;
  assert.ok(new TownSimulation(visits).restore(old));
});
