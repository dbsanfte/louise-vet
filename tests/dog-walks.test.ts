import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TownSimulation } from '../src/town-simulation.ts';
import { visits } from '../src/game.ts';
import { streetDetails, outsideClinic } from '../src/dog-walks.ts';
import { distance, onRoad, localToTown } from '../src/town-map.ts';
function fixture(name = 'Scout') {
  const s = new TownSimulation(visits, () => 0.5);
  const h = s.households.find((h) => h.pets.some((p) => p.name === name))!;
  const site = streetDetails.find(
    (p) => p.kind === 'hydrant' && p.x > 0 && Math.abs(p.z) < 5,
  )!;
  h.position = { x: site.x - 0.7, z: site.z + Math.sign(-site.z) * 0.45 };
  h.routine = 'walk';
  h.companions = [name];
  h.facing = Math.PI / 2;
  h.route = [
    { x: site.x + 3, z: h.position.z },
    { x: site.x + 6, z: h.position.z },
  ];
  return { s, h, site, spot: { x: site.x - 0.4, z: site.z + 0.2 } };
}
function tick(s: TownSimulation, seconds: number) {
  for (let i = 0; i < seconds * 10; i++) s.update(0.1);
}
for (const kind of ['poo', 'sniff', 'wee'] as const)
  test(`outdoor ${kind} pause saves, finishes and lets the family walk on`, () => {
    const { s, h, site, spot } = fixture();
    assert.ok(s.dogWalks.start(h, 'Scout', kind, spot, site.id));
    const route = structuredClone(h.route),
      anchor = { ...h.position };
    const seen = new Set<string>();
    let litter = false,
      cleaned = false;
    for (let i = 0; i < 250 && s.dogWalks.locked(h.id); i++) {
      s.update(0.1);
      const b = s.dogWalks.active.get(h.id);
      if (!b) break;
      seen.add(b.phase);
      litter ||= b.litter;
      if (b.phase === 'approach' || b.phase === 'sniff' || b.phase === 'toilet')
        assert.deepEqual(h.position, anchor);
      if (b.phase === 'return') {
        assert.equal(b.litter, false);
        cleaned = true;
      }
      assert.deepEqual(
        h.route,
        route,
        'the walk route is preserved until cleanup finishes',
      );
      const reload = new TownSimulation(visits, () => 0.5);
      assert.ok(reload.restore(s.snapshot()), b.phase);
    }
    assert.equal(s.dogWalks.locked(h.id), false);
    assert.ok(cleaned);
    assert.equal(litter, kind === 'poo');
    assert.equal(seen.has('collect'), kind === 'poo');
    const before = { ...h.position };
    tick(s, 1);
    assert.ok(distance(before, h.position) > 0.5);
  });
test('only male dogs wee, and all breaks reject clinic visits, clinic grounds and roads', () => {
  const { s, h, site, spot } = fixture('Luna');
  assert.equal(s.dogWalks.start(h, 'Luna', 'wee', spot, site.id), false);
  assert.ok(s.dogWalks.start(h, 'Luna', 'sniff', spot, site.id));
  for (const condition of ['inside', 'journey', 'road', 'grounds'] as const) {
    const { s, h, site, spot } = fixture();
    if (condition === 'inside') h.inClinic = true;
    if (condition === 'journey') h.routine = 'clinic-walk';
    if (condition === 'road') h.position = { x: 0, z: 0 };
    if (condition === 'grounds') h.position = localToTown(-1, 0);
    assert.equal(
      s.dogWalks.start(h, 'Scout', 'poo', spot, site.id),
      false,
      condition,
    );
  }
});
test('cleanup resumes after reloading; invalid or old saves cannot leave litter or stuck families', () => {
  const { s, h, site, spot } = fixture();
  s.dogWalks.start(h, 'Scout', 'poo', spot, site.id);
  for (
    let i = 0;
    i < 100 && s.dogWalks.active.get(h.id)?.phase !== 'collect';
    i++
  )
    s.update(0.1);
  assert.ok(s.dogWalks.active.get(h.id)?.litter);
  const snapshot = s.snapshot(),
    reload = new TownSimulation(visits, () => 0.5);
  assert.ok(reload.restore(snapshot));
  tick(reload, 10);
  assert.equal(reload.dogWalks.active.size, 0);
  const broken = structuredClone(snapshot);
  broken.dogWalks.active[0].spot = { x: 0, z: 0 };
  assert.equal(s.restore(broken), false);
  assert.deepEqual(s.snapshot(), snapshot);
  const legacy = structuredClone(snapshot) as Partial<typeof snapshot>;
  delete legacy.dogWalks;
  assert.ok(new TownSimulation(visits).restore(legacy));
});
test('natural dog walks produce occasional cleanups and sniffing stops; street fixtures stay off the road and clinic', () => {
  let seed = 129;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const s = new TownSimulation(visits, random);
  s.emergencies.due = 99999;
  const seen = new Set<string>();
  let starts = 0;
  const previous = new Set<number>();
  for (let i = 0; i < 12000; i++) {
    s.update(0.1);
    for (const [id, b] of s.dogWalks.active) {
      seen.add(b.kind);
      if (!previous.has(id)) starts++;
      if (b.kind === 'wee')
        assert.equal(
          s.households[id].pets.find((p) => p.name === b.pet)?.sex,
          'male',
        );
    }
    previous.clear();
    for (const id of s.dogWalks.active.keys()) previous.add(id);
  }
  assert.ok(starts > 3 && starts < 80, `occasional breaks: ${starts}`);
  assert.ok(seen.has('poo'));
  assert.ok(seen.has('sniff'));
  assert.ok(seen.has('wee'));
  assert.ok(streetDetails.filter((s) => s.kind === 'lamppost').length >= 12);
  assert.ok(streetDetails.filter((s) => s.kind === 'hydrant').length >= 4);
  for (const p of streetDetails) {
    assert.ok(!onRoad(p));
    assert.ok(outsideClinic(p));
  }
});

test('nearby families cannot crowd a reserved fixture, and dogs do not stop half inside a crossing', () => {
  const { s, h, site, spot } = fixture();
  assert.ok(s.dogWalks.start(h, 'Scout', 'sniff', spot, site.id));
  const other = s.households.find((o) =>
    o.pets.some((p) => p.name === 'Teddy'),
  )!;
  Object.assign(other, {
    routine: 'walk',
    position: { ...h.position },
    companions: ['Teddy'],
    facing: h.facing,
  });
  assert.equal(s.dogWalks.start(other, 'Teddy', 'wee', spot, site.id), false);
  s.dogWalks.active.clear();
  other.position = { x: 0, z: 2.2 };
  other.facing = 0;
  assert.equal(
    s.dogWalks.start(other, 'Teddy', 'poo', { x: 0, z: 2.65 }),
    false,
    'trailing dog is still in the crossing',
  );
});
