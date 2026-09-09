import { expect, test } from '@playwright/test';
import { build } from 'vite';
import { TownSimulation } from '../src/town-simulation';
import { visits, type UpgradeId } from '../src/game';
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
test('textured sunny streets become rainy, cats shelter with owners, and the new courtyard renders activities', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 900, height: 650 });
  await page.route('**/polish-test.html', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body></body></html>',
    }),
  );
  await page.route('**/models/**', async (r) =>
    r.fulfill({ response: await r.fetch() }),
  );
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/polish-test.html');
  await page.addScriptTag({ content: script });
  const s = new TownSimulation(visits, () => 0.1),
    h = s.households.find((h) => h.pets.some((p) => p.name === 'Milo'))!;
  Object.assign(h, {
    routine: 'walk',
    position: { x: -8, z: -3 },
    facing: Math.PI / 2,
    companions: ['Milo'],
    route: [{ x: -4, z: -3 }],
  });
  let result = await page.evaluate(
    (snapshot) => window.inspectPolish(snapshot, [], 'town'),
    s.snapshot(),
  );
  expect(result.surfaces).toEqual(
    expect.arrayContaining(['road', 'paving', 'grass', 'wood', 'roof']),
  );
  expect(result.glossy).toBeGreaterThan(3);
  expect(result.rain).toBe(false);
  await page.screenshot({ path: info.outputPath('sunny-surfaces.png') });
  s.weather.phase = 'rain';
  s.weather.remaining = 24;
  for (let i = 0; i < 70; i++) {
    s.time += 0.1;
    s.weather.update(
      0.1,
      s.households,
      () => 0.1,
      () => false,
    );
  }
  result = await page.evaluate(
    (snapshot) => window.inspectPolish(snapshot, [], 'town'),
    s.snapshot(),
  );
  expect(result.rain).toBe(true);
  expect(result.sheltering).toContain('Milo');
  await page.screenshot({ path: info.outputPath('rain-and-shelter.png') });
  const owned: UpgradeId[] = [
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
  ];
  const c = new TownSimulation(visits, () => 0.5);
  c.configureLeisure(owned);
  c.configureClinic(8, 22);
  c.seedClinic(
    ['Luna', 'Milo', 'Cleo', 'Pico', 'Melody', 'Hazel', 'Pip', 'Daisy'].map(
      (n) => visits.findIndex((v) => v.name === n),
    ),
  );
  let best = c.snapshot(),
    score = -1;
  for (let i = 0; i < 4500; i++) {
    c.update(0.1);
    const active = [...c.leisure.pets.values()].filter(
      (p) =>
        p.phase === 'use' &&
        ['bubbles', 'cat-nook', 'bird-chimes'].includes(p.station),
    );
    const value =
      active.length * 10 +
      [...c.leisure.owners.values()].filter(
        (a) => a.station.startsWith('puzzle') && a.phase === 'game',
      ).length;
    if (value > score) {
      score = value;
      best = c.snapshot();
    }
  }
  result = await page.evaluate(
    ({ snapshot, owned }) => window.inspectPolish(snapshot, owned, 'courtyard'),
    { snapshot: best, owned },
  );
  expect(result.activities).toEqual(
    expect.arrayContaining(['bubbles', 'cat-nook', 'bird-chimes']),
  );
  expect(result.rain).toBe(false);
  await page.screenshot({ path: info.outputPath('sunshine-courtyard.png') });
  await page.evaluate(
    ({ snapshot, owned }) => window.inspectPolish(snapshot, owned, 'reception'),
    { snapshot: best, owned },
  );
  await page.screenshot({ path: info.outputPath('reception-decorations.png') });
  expect(errors).toEqual([]);
});
