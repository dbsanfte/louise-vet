import { expect, test } from '@playwright/test';
import { build } from 'vite';
import { TownSimulation } from '../src/town-simulation';
import { visits } from '../src/game';
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
test('four distinct traffic vehicles render in town and keep their identity while moving', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 900, height: 650 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/traffic-test.html', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body></body></html>',
    }),
  );
  await page.route('**/models/**', async (r) =>
    r.fulfill({ response: await r.fetch() }),
  );
  await page.goto('/traffic-test.html');
  await page.addScriptTag({ content: script });
  const s = new TownSimulation(visits, () => 0.5);
  const snapshot = s.snapshot();
  snapshot.cars.forEach((c, i) =>
    Object.assign(c, {
      x: -6 + i * 4,
      z: -1,
      direction: 1,
      facing: Math.PI / 2,
    }),
  );
  const first = await page.evaluate(
    (snapshot) => window.inspectTraffic(snapshot),
    snapshot,
  );
  expect(first.map((c) => c.kind)).toEqual([
    'compact',
    'estate',
    'pickup',
    'van',
  ]);
  expect(first.every((c) => c.wheels.length === 4)).toBe(true);
  await page.screenshot({ path: info.outputPath('traffic-variety.png') });
  const moved = await page.evaluate(
    (snapshot) => window.inspectTraffic(snapshot, 0.3),
    snapshot,
  );
  expect(moved.map((c) => c.kind)).toEqual(first.map((c) => c.kind));
  expect(moved.every((c, i) => c.wheels[0] !== first[i].wheels[0])).toBe(true);
  expect(errors).toEqual([]);
});
