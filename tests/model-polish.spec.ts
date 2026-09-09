import { test, expect } from '@playwright/test';
import { build } from 'vite';
let script = '';
test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: {
        entry: 'tests/fixtures/model-polish-harness.ts',
        formats: ['iife'],
        name: 'ModelHarness',
      },
    },
  });
  for (const out of Array.isArray(result) ? result : [result])
    if ('output' in out)
      for (const chunk of out.output)
        if (chunk.type === 'chunk') script += chunk.code;
});
test('polished models render, animate, and keep findings with reversible soft fur', async ({
  page,
}, info) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 800, height: 600 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (e) => {
    if (e.type() === 'error') errors.push(e.text());
  });
  await page.route('**/model-test.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body></body></html>',
    }),
  );
  await page.route('**/models/**', async (route) =>
    route.fulfill({ response: await route.fetch() }),
  );
  await page.goto('/model-test.html');
  await page.addScriptTag({ content: script });
  for (const name of ['louise', 'visitor', 'visitor-ponytail', 'visitor-bob']) {
    await page.evaluate((name) => window.inspectModel(name), name);
    const idle = await page.screenshot({
      path: info.outputPath(`${name}-idle.png`),
    });
    await page.evaluate(() => window.poseModel('Walk', 0.4));
    const walking = await page.screenshot({
      path: info.outputPath(`${name}-walk.png`),
    });
    expect(idle.equals(walking)).toBe(false);
    await page.evaluate(() => window.poseModel('Sit', 0.4));
    await page.screenshot({ path: info.outputPath(`${name}-sit.png`) });
  }
  const coat = await page.evaluate(() =>
    window.inspectModel('pets/dog-golden', true),
  );
  expect(coat.fuzz).toBeGreaterThan(0);
  expect(coat.textured).toBe(coat.fuzz);
  expect(coat.needles).toBe(0);
  expect(coat.findings).toBe(1);
  await page.screenshot({ path: info.outputPath('soft-dog-coat.png') });
  expect(await page.evaluate(() => window.removeFur())).toEqual({
    fuzz: 0,
    findings: 0,
    restored: true,
  });
  await page.evaluate(() => window.inspectModel('pets/cat-silver', true));
  await page.screenshot({ path: info.outputPath('soft-cat-coat.png') });
  expect(errors).toEqual([]);
});
