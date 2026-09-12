import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TownWeather, shelterPointClear } from '../src/town-weather.ts';
import { TownSimulation } from '../src/town-simulation.ts';
import { visits } from '../src/game.ts';
import { distance, onRoad } from '../src/town-map.ts';
function walkingCat() {
  const s = new TownSimulation(visits, () => 0.1);
  const h = s.households.find((h) => h.pets.some((p) => p.name === 'Milo'))!;
  Object.assign(h, {
    routine: 'walk',
    position: { x: -8, z: -3 },
    facing: Math.PI / 2,
    companions: ['Milo'],
    route: [{ x: -4, z: -3 }],
  });
  s.weather.phase = 'rain';
  s.weather.remaining = 20;
  return { s, h };
}
test('a cat hurries under a separate tree, its owner follows, and both resume their unchanged route after rain', () => {
  const { s, h } = walkingCat(),
    w = s.weather;
  const original = structuredClone(h.route),
    origin = { ...h.position };
  for (let i = 0; i < 70; i++) {
    w.update(
      0.1,
      s.households,
      () => 0.1,
      () => false,
    );
    assert.ok(!onRoad(h.position));
    assert.ok(shelterPointClear(h.position));
    if (w.active.has(h.id)) assert.ok(!onRoad(w.active.get(h.id)!.petPosition));
  }
  const shelter = w.active.get(h.id)!;
  assert.ok(shelter);
  assert.equal(shelter.phase, 'wait');
  assert.ok(distance(h.position, shelter.petPosition) > 0.8);
  assert.deepEqual(h.route, original);
  assert.match(s.status(h), /staying dry/);
  const saved = s.snapshot(),
    restored = new TownSimulation(visits, () => 0.1);
  assert.ok(restored.restore(saved));
  assert.deepEqual(restored.weather.snapshot(), w.snapshot());
  for (let i = 0; i < 250; i++)
    w.update(
      0.1,
      s.households,
      () => 0.1,
      () => false,
    );
  assert.equal(w.active.size, 0);
  assert.ok(distance(h.position, origin) < 0.001);
  assert.deepEqual(h.route, original);
  const broken = structuredClone(saved);
  broken.weather.active[0].tree = 999;
  assert.equal(restored.restore(broken), false);
  assert.deepEqual(restored.weather.snapshot(), saved.weather);
});
test('shelter approaches reject buildings, fences, roads and clinic grounds', () => {
  for (const p of [
    { x: -12, z: -8 },
    { x: -8.6, z: -8 },
    { x: -24, z: -7 },
    { x: 0, z: 0 },
  ])
    assert.equal(shelterPointClear(p), false);
  assert.equal(shelterPointClear({ x: -8, z: -3 }), true);
});
test('weather is mostly sunny, has short showers, and old saves acquire weather without losing journeys', () => {
  const w = new TownWeather();
  let sun = 0,
    rain = 0,
    showers = 0,
    previous = w.phase;
  for (let i = 0; i < 10000; i++) {
    w.update(
      0.1,
      [],
      () => 0.5,
      () => false,
    );
    if (w.phase === 'sunny') sun++;
    else rain++;
    if (w.phase !== previous && w.phase === 'rain') showers++;
    previous = w.phase;
  }
  assert.ok(sun > rain * 5);
  assert.ok(showers >= 5);
  assert.ok(w.wetness >= 0 && w.wetness <= 1);
  const { s, h } = walkingCat();
  const saved: Partial<ReturnType<TownSimulation['snapshot']>> = s.snapshot();
  delete saved.weather;
  const restored = new TownSimulation(visits);
  assert.ok(restored.restore(saved));
  assert.equal(restored.weather.phase, 'sunny');
  assert.deepEqual(restored.households[h.id].position, h.position);
});
test('shelter rolls are likely but not certain, and never interrupt clinic care, road crossings or other events', () => {
  for (const blocked of ['clinic', 'road', 'event', 'unlucky']) {
    const { s, h } = walkingCat();
    if (blocked === 'clinic') h.inClinic = true;
    if (blocked === 'road') h.position.z = 0;
    s.weather.update(
      0.1,
      s.households,
      () => (blocked === 'unlucky' ? 0.99 : 0.1),
      () => blocked === 'event',
    );
    assert.equal(s.weather.active.size, 0);
  }
});

test('built-over shade trees stop attracting cats and an old shelter journey can safely return', () => {
  const { s, h } = walkingCat();
  s.weather.update(
    0.1,
    s.households,
    () => 0.1,
    () => false,
    () => true,
  );
  assert.equal(s.weather.active.size, 0);
  s.weather.update(
    0.1,
    s.households,
    () => 0.1,
    () => false,
  );
  assert.ok(s.weather.active.has(h.id));
  const original = structuredClone(h.route);
  for (let i = 0; i < 200; i++)
    s.weather.update(
      0.1,
      s.households,
      () => 0.1,
      () => false,
      () => true,
    );
  assert.equal(s.weather.active.size, 0);
  assert.deepEqual(h.route, original);
});
