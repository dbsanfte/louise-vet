import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TownSimulation } from '../src/town-simulation.ts';
import { visits } from '../src/game.ts';
import { parkPlan, parkSeat, parkRest, parkPetPose } from '../src/park.ts';
import { distance, layout, segmentDistance } from '../src/town-map.ts';
import { ParkScenery } from '../src/park-scenery.ts';
function crowded() {
  const s = new TownSimulation(visits, () => 0.5);
  for (const h of s.households) {
    const seat = parkSeat(h.id);
    h.position = { x: seat.x, z: seat.z };
    h.facing = seat.facing;
    h.routine = 'park';
    h.remaining = 280;
    h.companions = h.pets.map((p) => p.name);
    s.park.enter(h);
    const v = s.park.visits.get(h.id)!;
    v.seated = true;
    v.route = [];
    v.pets.forEach((p, i) => (p.position = parkRest(h.id, i)));
  }
  return s;
}
test('pond ducks face their swimming direction throughout a full lap', async () => {
  const { readFile } = await import('node:fs/promises');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { Group, Vector3 } = await import('three');
  const bytes = await readFile(
    new URL('../public/models/town/duck.glb', import.meta.url),
  );
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const scenery = new ParkScenery(new Group(), scene);
  const park = new TownSimulation(visits).park;
  const ducks = scenery.group.children.filter((o) =>
    o.getObjectByName('duck_bill'),
  );
  assert.equal(ducks.length, 4);
  for (let time = 0; time < 30; time += 2) {
    scenery.update(time, park);
    scenery.group.updateMatrixWorld(true);
    const previous = ducks.map((d) => d.position.clone());
    const forwards = ducks.map((d) => {
      const bill = d
        .getObjectByName('duck_bill')!
        .getWorldPosition(new Vector3());
      const tail = d
        .getObjectByName('duck_tail')!
        .getWorldPosition(new Vector3());
      return bill.sub(tail).setY(0).normalize();
    });
    scenery.update(time + 0.01, park);
    ducks.forEach((duck, i) => {
      const movement = duck.position
        .clone()
        .sub(previous[i])
        .setY(0)
        .normalize();
      assert.ok(
        forwards[i].dot(movement) > 0.99,
        `duck ${i} swims bill-first at ${time}s`,
      );
    });
  }
});
test('all eighteen families have separate seats, and each pet type enjoys a suitable park activity', () => {
  const s = crowded(),
    seen = new Set<string>();
  for (let n = 0; n < 1800; n++) {
    s.update(0.1);
    const active = new Set<string>();
    for (const v of s.park.visits.values())
      for (const p of v.pets) {
        if (p.station) {
          assert.ok(!active.has(p.station), 'one pet per attraction');
          active.add(p.station);
          assert.ok(
            parkPlan.stations
              .find((st) => st.id === p.station)!
              .species.includes(p.species),
          );
        }
        if (p.phase === 'use') seen.add(p.species);
        if (p.species === 'goldfish') {
          assert.equal(p.station, undefined);
          assert.equal(p.phase, 'rest');
        }
        const pose = parkPetPose(p);
        assert.ok(Number.isFinite(pose.x) && Number.isFinite(pose.y));
      }
  }
  for (const species of ['dog', 'cat', 'rabbit', 'hamster', 'gerbil', 'bird'])
    assert.ok(seen.has(species), species);
  for (const a of s.households)
    for (const b of s.households)
      if (a.id !== b.id)
        assert.ok(
          distance(a.position, b.position) > 0.7,
          'seated families do not stack',
        );
  assert.ok(
    s.park.chatting(0, 181) || s.park.chatting(0, 185),
    'paired bench conversation',
  );
});
test('park activity saves retain positions and reservations; malformed states are rejected atomically', () => {
  const s = crowded();
  for (let i = 0; i < 80; i++) s.update(0.1);
  const snapshot = s.snapshot(),
    r = new TownSimulation(visits);
  assert.ok(r.restore(snapshot));
  assert.deepEqual(r.park.snapshot(), s.park.snapshot());
  const bad = structuredClone(snapshot);
  bad.park[0].pets[0].position.x = Infinity;
  assert.equal(r.restore(bad), false);
  assert.deepEqual(r.park.snapshot(), s.park.snapshot());
  const old = structuredClone(snapshot) as Partial<typeof snapshot>;
  delete old.park;
  const legacy = new TownSimulation(visits);
  assert.ok(legacy.restore(old));
  legacy.update(0.1);
  assert.equal(legacy.park.visits.size, 18);
});
test('park families gather companions, walk out, and return home or continue an invited clinic visit', () => {
  for (const clinic of [false, true]) {
    const s = crowded(),
      h = s.households[0];
    for (let i = 0; i < 140; i++) s.update(0.1);
    if (clinic) {
      assert.ok(s.requestVisit('Luna', 'authored'));
      assert.equal(h.routine, 'clinic-gather');
    } else h.remaining = 0;
    for (
      let i = 0;
      i < 1600 && (clinic ? !h.inClinic : h.routine !== 'garden');
      i++
    )
      s.update(0.1);
    assert.equal(s.park.visits.has(h.id), false);
    assert.ok(clinic ? h.inClinic : h.routine === 'garden');
    assert.ok(new TownSimulation(visits).restore(s.snapshot()));
  }
});
test('park furniture and activity centres leave space around the roads and pond', () => {
  for (const p of [...parkPlan.benches, ...parkPlan.stations]) {
    const clearance = Math.min(
      ...layout.roads.flatMap((r) =>
        r.points
          .slice(1)
          .map((b, i) =>
            segmentDistance(
              p,
              { x: r.points[i][0], z: r.points[i][1] },
              { x: b[0], z: b[1] },
            ),
          ),
      ),
    );
    assert.ok(
      clearance > 4.1,
      `park furniture at ${p.x},${p.z} clears the road and pavement`,
    );
    assert.ok(distance(p, parkPlan.pond) > parkPlan.pond.radius + 0.6);
  }
});

test('the pond water is above its bank bed and visible where the ducks swim', async () => {
  const { readFile } = await import('node:fs/promises');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { Raycaster, Vector3, Mesh } = await import('three');
  const bytes = await readFile(
    new URL('../public/models/town/park.glb', import.meta.url),
  );
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  const ray = new Raycaster(
    new Vector3(parkPlan.pond.x + 0.7, 2, parkPlan.pond.z),
    new Vector3(0, -1, 0),
  );
  const hit = ray.intersectObject(gltf.scene, true)[0];
  assert.ok(hit?.object instanceof Mesh);
  const materials = Array.isArray(hit.object.material)
    ? hit.object.material
    : [hit.object.material];
  assert.ok(
    materials.some((m) => m.name === 'water'),
    'the sand bed must not cover the water surface',
  );
});
