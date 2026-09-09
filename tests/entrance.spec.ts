import { expect, test } from '@playwright/test';
import { build } from 'vite';
import { crowdedClinic } from './fixtures/entrance-state';
import { clinicDoor, distance } from '../src/town-map';
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
test('a recovered full clinic renders separated families with the doorway clear', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 900, height: 650 });
  await page.route('**/entrance-test.html', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body></body></html>',
    }),
  );
  await page.route('**/models/**', async (r) =>
    r.fulfill({ response: await r.fetch() }),
  );
  await page.goto('/entrance-test.html');
  await page.addScriptTag({ content: script });
  const s = crowdedClinic();
  for (let i = 0; i < 600; i++) s.update(0.1);
  const actors = await page.evaluate(
    (snapshot) => window.inspectEntrance(snapshot),
    s.snapshot(),
  );
  expect(actors.owners).toHaveLength(14);
  expect(actors.pets).toHaveLength(
    s.households.filter((h) => !h.inClinic).flatMap((h) => h.companions).length,
  );
  for (const owner of actors.owners) {
    expect(distance(owner, clinicDoor)).toBeGreaterThan(1.5);
    for (const other of actors.owners)
      if (owner.name !== other.name)
        expect(distance(owner, other)).toBeGreaterThan(2);
    const h = s.households.find((h) => h.owner === owner.name)!;
    for (const pet of h.pets.filter((p) =>
      ['cat', 'dog'].includes(p.species),
    )) {
      const model = actors.pets.find((p) => p.name === pet.name)!;
      expect(distance(model, owner)).toBeGreaterThan(0.6);
      expect(distance(model, owner)).toBeLessThan(1.6);
    }
  }
  await page.screenshot({ path: info.outputPath('entrance.png') });
});
