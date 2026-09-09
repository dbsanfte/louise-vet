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
test('authored service models and every major rescue pose render in the actual town', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 900, height: 650 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/rescue-test.html', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body></body></html>',
    }),
  );
  await page.route('**/models/**', async (route) =>
    route.fulfill({ response: await route.fetch() }),
  );
  await page.goto('/rescue-test.html');
  await page.addScriptTag({ content: script });
  for (const [kind, name] of [
    ['fire', 'Luna'],
    ['lost', 'Pico'],
    ['lost', 'Milo'],
  ] as const) {
    const s = new TownSimulation(visits, () => 0.5);
    s.households.forEach((h) => {
      h.remaining = 290;
      h.nextCare = 9999;
    });
    const h = s.households.find((h) => h.pets.some((p) => p.name === name))!;
    s.emergencies.start(kind, h, s.households, 0, () => 0.5);
    if (kind === 'lost') s.emergencies.active!.pets = [name];
    const wanted = new Set(
      kind === 'fire'
        ? ['dispatch', 'extinguish', 'exit-house']
        : ['climb', 'descend', 'handover'],
    );
    for (let i = 0; i < 4000 && wanted.size; i++) {
      s.update(0.1);
      const e = s.emergencies.active;
      if (!e || !wanted.has(e.phase) || e.elapsed < 2) continue;
      if (e.phase === 'climb' && e.elapsed < 3) continue;
      if (
        e.phase === 'extinguish' &&
        (e.partner?.route.length || e.elapsed < 5)
      )
        continue;
      wanted.delete(e.phase);
      const pose = await page.evaluate(
        (snapshot) => window.inspectRescue(snapshot),
        s.snapshot(),
      );
      expect(pose.phase).toBe(e.phase);
      await page.screenshot({
        path: info.outputPath(`${name}-${e.phase}.png`),
      });
    }
    expect([...wanted]).toEqual([]);
    if (kind === 'fire')
      for (const focus of ['fire', 'police'] as const) {
        await page.evaluate(
          ({ snapshot, focus }) => window.inspectRescue(snapshot, focus),
          { snapshot: s.snapshot(), focus },
        );
        await page.screenshot({
          path: info.outputPath(`${focus}-station.png`),
        });
      }
  }
  expect(errors).toEqual([]);
});
