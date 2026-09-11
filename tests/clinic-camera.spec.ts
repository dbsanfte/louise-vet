import { expect, test } from '@playwright/test';
import { build } from 'vite';
import { TownSimulation } from '../src/town-simulation';
import { upgrades, visits } from '../src/game';
const owned = upgrades.filter((u) => u.id !== 'stock').map((u) => u.id);
let script = '';
test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      lib: {
        entry: 'tests/fixtures/emergency-harness.ts',
        formats: ['iife'],
        name: 'ClinicHarness',
      },
    },
  });
  for (const out of Array.isArray(result) ? result : [result])
    if ('output' in out)
      for (const c of out.output) if (c.type === 'chunk') script += c.code;
});
test.setTimeout(90000);

test('clinic gestures orbit and pan within the grounds, zoom, and release room jumps', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 900, height: 650 });
  await page.route('**/clinic-camera-test.html', (r) =>
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
  await page.goto('/clinic-camera-test.html');
  await page.addScriptTag({ content: script });
  await page.evaluate(
    ({ snapshot, owned }) => window.inspectPolish(snapshot, owned, 'courtyard'),
    { snapshot: new TownSimulation(visits).snapshot(), owned },
  );
  const initial = await page.evaluate(() => window.clinicCamera());
  expect(initial.enabled).toBe(true);
  expect(initial.courtyard).toEqual(
    expect.arrayContaining(['grass', 'picket fence', 'stepping stones']),
  );
  expect(initial.texturedLawn).toBe(true);
  await page.screenshot({ path: info.outputPath('outdoor-courtyard.png') });

  if (info.project.name === 'mobile') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 450, y: 300 }],
    });
    for (let i = 1; i <= 6; i++)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: 450 + i * 20, y: 300 }],
      });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  } else {
    await page.mouse.move(450, 300);
    await page.mouse.down();
    await page.mouse.move(570, 300, { steps: 6 });
    await page.mouse.up();
  }
  const orbit = await page.evaluate(() => window.clinicCamera());
  expect(Math.abs(orbit.angle - initial.angle)).toBeGreaterThan(0.15);
  if (info.project.name === 'mobile') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: 360, y: 300, id: 0 },
        { x: 460, y: 300, id: 1 },
      ],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: 400, y: 340, id: 0 },
        { x: 540, y: 340, id: 1 },
      ],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  } else {
    await page.mouse.move(450, 300);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(510, 340, { steps: 5 });
    await page.mouse.up({ button: 'right' });
    await page.mouse.wheel(0, -300);
  }
  const moved = await page.evaluate(() => window.clinicCamera());
  expect(moved.target).not.toEqual(orbit.target);
  expect(moved.zoom).toBeGreaterThan(orbit.zoom);
  expect(moved.target[1]).toBeCloseTo(initial.target[1]);
  const edge = await page.evaluate(() =>
    window.clinicCamera('pan', 1000, 1000),
  );
  expect(
    Math.hypot(
      edge.target[0] - edge.centre[0],
      edge.target[2] - edge.centre[2],
    ),
  ).toBeLessThanOrEqual(edge.radius + 0.001);
  const jump = await page.evaluate(() => window.clinicCamera('courtyard'));
  const settled = await page.evaluate(() => window.clinicCamera());
  expect(settled.position).toEqual(jump.position);
  expect(settled.target).toEqual(jump.target);
  expect(settled.zoom).toBe(1);
  expect(
    (await page.evaluate(() => window.clinicCamera('pan', 1, 0))).target,
  ).not.toEqual(jump.target);
  expect((await page.evaluate(() => window.clinicCamera('town'))).enabled).toBe(
    false,
  );
  expect((await page.evaluate(() => window.clinicCamera('exam'))).enabled).toBe(
    false,
  );
  expect(
    (await page.evaluate(() => window.clinicCamera('reception'))).enabled,
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('office arrow keys and touch buttons free the camera without interfering with shop dialogs', async ({
  page,
}, info) => {
  await page.addInitScript(
    (owned) =>
      localStorage.setItem(
        'louises-vet-office-v1',
        JSON.stringify({
          version: 1,
          coins: 3000,
          upgrades: owned,
          stock: 3,
          earned: 0,
          happiness: 100,
          treated: 0,
          sound: false,
        }),
      ),
    owned,
  );
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  const courtyard = page.getByRole('button', {
    name: 'Courtyard',
    exact: true,
  });
  await courtyard.click();
  await expect(courtyard).toHaveAttribute('aria-pressed', 'true');
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
    await courtyard.click();
    await page.keyboard.press(key);
    await expect(courtyard).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.room-pill')).toContainText('YOUR CLINIC');
  }
  for (const name of [
    'Pan clinic left',
    'Pan clinic right',
    'Pan clinic up',
    'Pan clinic down',
    'Zoom into clinic',
    'Zoom out of clinic',
  ]) {
    await courtyard.click();
    await page.getByRole('button', { name, exact: true }).click();
    await expect(courtyard).toHaveAttribute('aria-pressed', 'false');
  }
  await courtyard.click();
  await page.getByRole('button', { name: /Clinic shop/ }).click();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Escape');
  await expect(courtyard).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({
    path: info.outputPath('clinic-camera-controls.png'),
  });
});
