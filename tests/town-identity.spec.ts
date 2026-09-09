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
test('people and pets identify themselves through mouse hover or touch selection', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 900, height: 650 });
  await page.route('**/names-test.html', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body></body></html>',
    }),
  );
  await page.route('**/models/**', async (r) =>
    r.fulfill({ response: await r.fetch() }),
  );
  await page.goto('/names-test.html');
  await page.addScriptTag({ content: script });
  const s = new TownSimulation(visits, () => 0.5);
  const owner = s.households[0];
  owner.routine = 'gather'; // Owners in the garden routine are inside their homes.
  owner.remaining = 100;
  owner.position.x += 1.2;
  owner.position.z += 1.2;
  for (const label of [
    'Amelia · Luna & Scout’s owner',
    'Luna · Amelia’s dog',
    'Pond duck',
  ]) {
    const target = await page.evaluate(
      ({ snapshot, label }) => window.inspectNamed(snapshot, label),
      { snapshot: s.snapshot(), label },
    );
    if (info.project.name === 'mobile')
      await page.touchscreen.tap(target.x, target.y);
    else await page.mouse.move(target.x, target.y);
    await expect(page.locator('#identity')).toHaveText(label);
    await page.screenshot({
      path: info.outputPath(label.split(' · ')[0] + '.png'),
    });
  }
});
