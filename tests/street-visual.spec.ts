import { expect, test } from '@playwright/test';
import { build } from 'vite';
import { TownSimulation } from '../src/town-simulation';
import { visits } from '../src/game';
import { streetDetails } from '../src/dog-walks';
let script = '';
test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: {
        entry: 'tests/fixtures/emergency-harness.ts',
        formats: ['iife'],
        name: 'EmergencyHarness',
      },
    },
  });
  for (const out of Array.isArray(result) ? result : [result])
    if ('output' in out)
      for (const c of out.output) if (c.type === 'chunk') script += c.code;
});
test('street furniture, sniffing, leg lift and owner cleanup render outdoors', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 900, height: 650 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/street-test.html', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body></body></html>',
    }),
  );
  await page.route('**/models/**', async (r) =>
    r.fulfill({ response: await r.fetch() }),
  );
  await page.goto('/street-test.html');
  await page.addScriptTag({ content: script });
  const s = new TownSimulation(visits, () => 0.5);
  const h = s.households.find((h) => h.pets.some((p) => p.name === 'Scout'))!;
  const site = streetDetails.find(
    (p) => p.kind === 'hydrant' && p.x > 0 && Math.abs(p.z) < 5,
  )!;
  h.position = { x: site.x - 0.7, z: site.z + 0.45 };
  h.routine = 'walk';
  h.companions = ['Scout'];
  h.facing = Math.PI / 2;
  h.route = [{ x: site.x + 3, z: h.position.z }];
  const spot = { x: site.x - 0.4, z: site.z + 0.2 };
  const initial = s.snapshot();
  for (const kind of ['sniff', 'wee', 'poo'] as const) {
    expect(s.restore(initial)).toBe(true);
    const owner = s.households[h.id];
    expect(s.dogWalks.start(owner, 'Scout', kind, spot, site.id)).toBe(true);
    const target =
      kind === 'sniff' ? 'sniff' : kind === 'wee' ? 'toilet' : 'collect';
    for (let i = 0; i < 150; i++) {
      s.update(0.1);
      const b = s.dogWalks.active.get(h.id);
      if (b?.phase === target && b.elapsed > 0.6 && !b.ownerRoute.length) break;
    }
    const result = await page.evaluate(
      ({ snapshot, site }) => window.inspectDogWalk(snapshot, site),
      { snapshot: s.snapshot(), site },
    );
    expect(result.fixtures).toBe(streetDetails.length);
    expect(result.pets).toHaveLength(1);
    expect(result.pets[0].phase).toBe(target);
    if (kind === 'sniff') {
      expect(result.props).toEqual([]);
      expect(result.pets[0].head).toBeGreaterThan(0.2);
    }
    if (kind === 'wee') {
      expect(result.props).toEqual(['wee']);
      expect(result.pets[0].leg).toBeGreaterThan(0.6);
    }
    if (kind === 'poo') {
      expect(result.props.sort()).toEqual(['bag', 'poo']);
      expect(result.bentOwners).toContain(owner.owner);
    }
    await page.screenshot({ path: info.outputPath('dog-' + kind + '.png') });
  }
  for (let i = 0; i < 100; i++) s.update(0.1);
  const done = await page.evaluate(
    ({ snapshot, site }) => window.inspectDogWalk(snapshot, site),
    { snapshot: s.snapshot(), site },
  );
  expect(done.props).toEqual([]);
  expect(done.pets).toEqual([]);
  expect(done.bentOwners).toEqual([]);
  expect(errors).toEqual([]);
});
