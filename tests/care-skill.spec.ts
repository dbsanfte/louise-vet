import { test, expect } from '@playwright/test';
import { build } from 'vite';
import { careSkills, type CareTool } from '../src/care-skill';
import { completeCareSkill } from './browser-helpers';
let script = '';
test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: {
        entry: 'tests/fixtures/care-skill-harness.ts',
        formats: ['iife'],
        name: 'CareHarness',
      },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  for (const out of outputs)
    if ('output' in out)
      for (const chunk of out.output)
        if (chunk.type === 'chunk') script += chunk.code;
});
test('all care activities support real controls and fit short windows', async ({
  page,
  baseURL,
}, info) => {
  const index = await (await page.request.get(baseURL!)).text();
  const css = index.match(/href="([^"]+\.css)"/)![1];
  await page.route('**/skill-test.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${css}"></head><body></body></html>`,
    }),
  );
  await page.route('**/assets/**', async (route) =>
    route.fulfill({ response: await route.fetch() }),
  );
  await page.goto('/skill-test.html');
  await page.addScriptTag({ content: script });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const tool of Object.keys(careSkills) as CareTool[]) {
    await page.setViewportSize(
      info.project.name === 'mobile'
        ? { width: 360, height: 640 }
        : { width: 1280, height: 650 },
    );
    await page.evaluate((tool) => window.openCare(tool), tool);
    const dialog = page.locator('.skill-dialog');
    await expect(dialog.locator('[data-skill-finish]')).toBeDisabled();
    await expect(dialog.locator('[data-skill-start]')).toBeFocused();
    for (const size of [
      { width: 360, height: 640 },
      { width: 740, height: 360 },
    ]) {
      await page.setViewportSize(size);
      const bad = await dialog.evaluate((d) =>
        [...d.querySelectorAll<HTMLElement>('button,input')]
          .filter((e) => e.checkVisibility())
          .filter((e) => {
            const r = e.getBoundingClientRect(),
              b = d.getBoundingClientRect();
            return (
              r.top < b.top ||
              r.bottom > b.bottom ||
              r.top < 0 ||
              r.bottom > innerHeight ||
              r.left < 0 ||
              r.right > innerWidth
            );
          })
          .map((e) => e.textContent || e.ariaLabel),
      );
      expect(bad, tool).toEqual([]);
    }
    await page.setViewportSize({ width: 360, height: 640 });
    await completeCareSkill(page);
    await expect(page.locator('#outcome')).toHaveText('Care completed');
  }
  expect(errors).toEqual([]);
});
test('care dialogs trap focus, explain mistakes, cancel and stop without completing', async ({
  page,
  baseURL,
}, info) => {
  const index = await (await page.request.get(baseURL!)).text(),
    css = index.match(/href="([^"]+\.css)"/)![1];
  await page.route('**/skill-test.html', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${css}"><body></body>`,
    }),
  );
  await page.route('**/assets/**', async (route) =>
    route.fulfill({ response: await route.fetch() }),
  );
  await page.goto('/skill-test.html');
  await page.addScriptTag({ content: script });
  await page.evaluate(() => window.openCare('bandage'));
  await page.getByRole('button', { name: 'Start when ready' }).click();
  await page.getByRole('button', { name: 'Wrap step 4' }).click();
  await expect(page.locator('.skill-feedback')).toContainText(
    'next numbered arrow',
  );
  await expect(page.locator('[data-skill-finish]')).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.locator('#outcome')).toHaveText('Cancelled');
  await page.evaluate(() => window.openCare('vaccine'));
  await page.getByRole('button', { name: 'Start when ready' }).click();
  await page.getByRole('button', { name: 'Give vaccine', exact: true }).click();
  await page
    .getByRole('button', { name: 'Pause vaccine', exact: true })
    .click();
  await expect(page.locator('.skill-feedback')).toContainText(
    'No vaccine given',
  );
  await page.screenshot({ path: info.outputPath('vaccine-pressure.png') });
  await page.getByRole('button', { name: 'Stop visit' }).click();
  await expect(page.locator('#outcome')).toHaveText('Stopped with no reward');
});

test('the ice pack follows mouse and touch dragging and can finish cooling', async ({
  page,
  baseURL,
}, info) => {
  const index = await (await page.request.get(baseURL!)).text();
  const css = index.match(/href="([^"]+\.css)"/)![1];
  await page.route('**/skill-test.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${css}"><body></body>`,
    }),
  );
  await page.route('**/assets/**', async (route) =>
    route.fulfill({ response: await route.fetch() }),
  );
  await page.goto('/skill-test.html');
  await page.addScriptTag({ content: script });
  await page.evaluate(() => window.openCare('cooling'));
  const rail = page.locator('.skill-rail.steady');
  const input = page.locator('#skill-position');
  const finish = page.locator('[data-skill-finish]');
  const touch = info.project.name === 'mobile';
  const session = touch ? await page.context().newCDPSession(page) : null;
  const point = async (fraction: number) => {
    const box = (await rail.boundingBox())!;
    return { x: box.x + box.width * fraction, y: box.y + box.height / 2 };
  };
  const pointer = async (phase: 'start' | 'move' | 'end', fraction: number) => {
    const p = await point(fraction);
    if (session)
      await session.send('Input.dispatchTouchEvent', {
        type:
          phase === 'start'
            ? 'touchStart'
            : phase === 'move'
              ? 'touchMove'
              : 'touchEnd',
        touchPoints: phase === 'end' ? [] : [{ ...p, id: 0 }],
      });
    else if (phase === 'start') {
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
    } else if (phase === 'move') await page.mouse.move(p.x, p.y);
    else await page.mouse.up();
  };
  // Reading mode must not engage care accidentally.
  await pointer('start', 0.5);
  await pointer('move', 0.2);
  await pointer('end', 0.2);
  await expect(input).toHaveValue('50');
  await page.getByRole('button', { name: 'Start when ready' }).click();
  await pointer('start', 0.5);
  await pointer('move', 0.2);
  await expect
    .poll(async () => Number(await input.inputValue()))
    .toBeLessThan(25);
  await pointer('move', 0.8);
  await expect
    .poll(async () => Number(await input.inputValue()))
    .toBeGreaterThan(75);
  // Capture keeps working past the edge, and clamps to the rail.
  await pointer('move', 1.05);
  await expect(input).toHaveValue('100');
  await pointer('end', 1.05);
  const hover = await point(0.2);
  await page.mouse.move(hover.x, hover.y);
  await expect(input).toHaveValue('100');
  // Keyboard remains a usable alternative to direct manipulation.
  await input.focus();
  await input.press('Home');
  await expect(input).toHaveValue('0');
  await pointer('start', 0.5);
  for (let i = 0; i < 100 && !(await finish.isEnabled()); i++) {
    const target = Number(
      await rail.locator('.skill-target').getAttribute('data-target'),
    );
    await pointer('move', target);
    await page.waitForTimeout(80);
  }
  await pointer('end', 0.5);
  await expect(finish).toBeEnabled();
  await page.screenshot({ path: info.outputPath('cooling-drag.png') });
  await finish.click();
  await expect(page.locator('#outcome')).toHaveText('Care completed');
  await session?.detach();
});
