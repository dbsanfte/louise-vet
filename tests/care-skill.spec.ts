import { test, expect, type Page } from '@playwright/test';
import { build } from 'vite';
import { careSkills, type CareTool } from '../src/care-skill';
import { exerciseCareSkill } from './browser-helpers';
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
  for (const out of Array.isArray(result) ? result : [result])
    if ('output' in out)
      for (const chunk of out.output)
        if (chunk.type === 'chunk') script += chunk.code;
});
async function fixture(page: Page, tool: CareTool) {
  const index = await (await page.request.get('/')).text(),
    css = index.match(/href="([^"]+\.css)"/)![1];
  await page.route('**/skill-test.html', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${css}"><body></body>`,
    }),
  );
  await page.route(/\/(assets|models)\//, async (r) =>
    r.fulfill({ response: await r.fetch() }),
  );
  await page.goto('/skill-test.html');
  await page.addScriptTag({ content: script });
  await page.evaluate((tool) => window.openCare(tool), tool);
  await expect(page.locator('.skill-dialog')).toHaveAttribute(
    'data-ready',
    'true',
  );
}
async function pointer(page: Page, touch: boolean) {
  const session = touch ? await page.context().newCDPSession(page) : null;
  return {
    async send(
      phase: 'start' | 'move' | 'end' | 'cancel',
      x: number,
      y: number,
      selector = '.skill-canvas',
    ) {
      const b = (await page.locator(selector).boundingBox())!,
        p = { x: b.x + x * b.width, y: b.y + y * b.height };
      if (session)
        await session.send('Input.dispatchTouchEvent', {
          type: (
            {
              start: 'touchStart',
              move: 'touchMove',
              end: 'touchEnd',
              cancel: 'touchCancel',
            } as const
          )[phase],
          touchPoints:
            phase === 'end' || phase === 'cancel' ? [] : [{ ...p, id: 0 }],
        });
      else if (phase === 'start') {
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
      } else if (phase === 'move') await page.mouse.move(p.x, p.y);
      else await page.mouse.up();
    },
    dispose: () => session?.detach(),
  };
}
for (const tool of Object.keys(careSkills) as CareTool[])
  test(`${tool} care uses its rendered patient and tool, completes through contact, and fits short screens`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await fixture(page, tool);
    const dialog = page.locator('.skill-dialog');
    await expect(dialog.locator('[data-skill-finish]')).toBeDisabled();
    await expect(dialog.locator('[data-skill-start]')).toBeFocused();
    await expect(dialog.locator('canvas')).toHaveCount(1);
    for (const size of [
      { width: 360, height: 640 },
      { width: 740, height: 360 },
    ]) {
      await page.setViewportSize(size);
      const bad = await dialog.evaluate((d) =>
        [...d.querySelectorAll<HTMLElement>('button,input,[role="meter"]')]
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
    const frame = await page.evaluate(() => window.careGeometry().frames);
    await expect
      .poll(() => page.evaluate(() => window.careGeometry().frames))
      .toBeGreaterThan(frame);
    await page.screenshot({ path: info.outputPath(`${tool}-ready.png`) });
    await exerciseCareSkill(page);
    if (tool === 'bandage') {
      await expect
        .poll(() => page.evaluate(() => window.careGeometry().count))
        .toBe(576);
      expect(
        (await page.evaluate(() => window.careGeometry())).depth,
      ).toBeGreaterThan(0.1);
    }
    await expect(page.locator('#outcome')).toHaveText('');
    await page.screenshot({ path: info.outputPath(`${tool}-complete.png`) });
    await dialog.locator('[data-skill-finish]').click();
    await expect(page.locator('#outcome')).toHaveText('Care completed');
    expect(errors).toEqual([]);
  });
test('tools follow continuous native touch or mouse drags, with keyboard aim and safe cancellation', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await fixture(page, 'cooling');
  const p = await pointer(page, info.project.name === 'mobile'),
    cursor = page.locator('.care-cursor');
  await p.send('start', 0.2, 0.3);
  await p.send('move', 0.8, 0.7);
  await p.send('end', 0.8, 0.7);
  await expect(
    page.getByRole('meter', { name: 'Care progress' }),
  ).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('button', { name: 'Start when ready' }).click();
  await p.send('start', 0.2, 0.3);
  await p.send('move', 0.8, 0.7);
  await expect
    .poll(async () =>
      cursor.evaluate((e) => parseFloat((e as HTMLElement).style.left)),
    )
    .toBeCloseTo(80, 1);
  await p.send('cancel', 0.8, 0.7);
  const before = await cursor.getAttribute('style');
  await page.mouse.move(1, 1);
  await expect(cursor).toHaveAttribute('style', before!);
  await page.locator('.skill-canvas').focus();
  await page.keyboard.press('ArrowLeft');
  expect(await cursor.getAttribute('style')).not.toEqual(before);
  await page.getByRole('button', { name: 'Stop visit', exact: false }).click();
  await expect(page.locator('#outcome')).toHaveText('Stopped with no reward');
  await p.dispose();
});
test('native pressure and tilt sliders drag with a finger, pause on release and retain keyboard input', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await fixture(page, 'water-care');
  const p = await pointer(page, info.project.name === 'mobile'),
    input = page.locator('#skill-position');
  for (const tool of ['water-care', 'vaccine'] as const) {
    if (tool === 'vaccine') {
      await page.evaluate(() => window.openCare('vaccine'));
      await expect(page.locator('.skill-dialog')).toHaveAttribute(
        'data-ready',
        'true',
      );
    }
    await page.getByRole('button', { name: 'Start when ready' }).click();
    if (tool === 'vaccine') {
      await p.send('start', 0.5, 0.5);
      await page.waitForTimeout(600);
      await p.send('end', 0.5, 0.5);
      await page.getByRole('button', { name: 'Begin gentle press' }).click();
    }
    await p.send('start', 0.2, 0.5, '#skill-position');
    await p.send('move', 0.6, 0.5, '#skill-position');
    await expect
      .poll(async () => Number(await input.inputValue()))
      .toBeGreaterThan(55);
    await p.send('move', 0.3, 0.9, '#skill-position');
    await expect
      .poll(async () => Number(await input.inputValue()))
      .toBeLessThan(35);
    await p.send('cancel', 0.3, 0.9, '#skill-position');
    await expect(input).toHaveValue('0');
    await input.focus();
    await input.press('ArrowRight');
    await expect(input).toHaveValue('2');
    await input.press('Home');
    await expect(input).toHaveValue('0');
    await page.keyboard.press('Escape');
    await expect(page.locator('#outcome')).toHaveText('Cancelled');
  }
  await p.dispose();
});
test('bandage wraps the actual paw through native dragging, preserves checkpoints and supports keyboard tracing', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await fixture(page, 'bandage');
  const points = await page.locator('.care-wrap-path').evaluate((e) =>
    e
      .getAttribute('d')!
      .split(' ')
      .map((p) => {
        const [x, y] = p.slice(1).split(',').map(Number);
        return { x, y };
      }),
  );
  expect(points).toHaveLength(97);
  expect(
    points.every((p) => p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1),
  ).toBeTruthy();
  const p = await pointer(page, info.project.name === 'mobile');
  await page.getByRole('button', { name: 'Start when ready' }).click();
  for (const i of [0, 16, 32, 48, 64, 80, 96]) {
    await p.send('start', points[i].x, points[i].y);
    await p.send('end', points[i].x, points[i].y);
  }
  await expect(
    page.getByRole('meter', { name: 'Care progress' }),
  ).toHaveAttribute('aria-valuenow', '0');
  await p.send('start', points[0].x, points[0].y);
  for (const q of points.slice(1, 25)) await p.send('move', q.x, q.y);
  await p.send('move', 0.99, 0.99);
  await p.send('end', 0.99, 0.99);
  await expect(page.locator('.skill-feedback')).toContainText('last marker');
  await expect(
    page.getByRole('meter', { name: 'Care progress' }),
  ).toHaveAttribute('aria-valuenow', '17');
  await p.send('start', points[16].x, points[16].y);
  for (const q of points.slice(17, 49)) await p.send('move', q.x, q.y);
  await p.send('end', points[48].x, points[48].y);
  await page.screenshot({
    path: info.outputPath('real-paw-half-bandaged.png'),
  });
  await expect(
    page.getByRole('meter', { name: 'Care progress' }),
  ).toHaveAttribute('aria-valuenow', '50');
  const board = page.locator('.skill-canvas');
  await board.focus();
  let cursor = { ...points[48] };
  for (const q of points.slice(49))
    for (const axis of ['x', 'y'] as const)
      while (Math.abs(q[axis] - cursor[axis]) > 0.008) {
        const positive = q[axis] > cursor[axis];
        await board.press(
          axis === 'x'
            ? positive
              ? 'ArrowRight'
              : 'ArrowLeft'
            : positive
              ? 'ArrowDown'
              : 'ArrowUp',
        );
        cursor[axis] += positive ? 0.015 : -0.015;
      }
  await expect(page.locator('[data-skill-finish]')).toBeEnabled();
  await p.dispose();
});
test('rough cream application shows discomfort and a calm retry resets coverage', async ({
  page,
}, info) => {
  await fixture(page, 'cream');
  await page.getByRole('button', { name: 'Start when ready' }).click();
  const p = await pointer(page, info.project.name === 'mobile');
  await p.send('start', 0.15, 0.4);
  for (
    let i = 0;
    i < 40 && !(await page.locator('[data-skill-retry]').isVisible());
    i++
  )
    await p.send('move', i % 2 ? 0.15 : 0.85, 0.4);
  await p.send('end', 0.5, 0.4);
  await expect(page.locator('.skill-dialog')).toHaveAttribute(
    'data-startled',
    'true',
  );
  await expect(page.locator('[data-skill-finish]')).toBeDisabled();
  await page.getByRole('button', { name: 'Try gently again' }).click();
  await expect(page.getByRole('meter', { name: 'Discomfort' })).toHaveAttribute(
    'aria-valuenow',
    '0',
  );
  await expect(
    page.getByRole('meter', { name: 'Care progress' }),
  ).toHaveAttribute('aria-valuenow', '0');
  await p.dispose();
});

test('the normal rendering path also shows the patient and full 3D bandage', async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== 'desktop',
    'Check the normal renderer once; touch uses the same scene.',
  );
  await page.setViewportSize({ width: 700, height: 600 });
  await fixture(page, 'bandage');
  await exerciseCareSkill(page);
  const before = await page.evaluate(() => window.careGeometry());
  await page.evaluate(() => window.normalCareGraphics(true));
  await expect
    .poll(() => page.evaluate(() => window.careGeometry().frames))
    .toBeGreaterThan(before.frames);
  await page.screenshot({
    path: info.outputPath('normal-rendering-bandage.png'),
  });
  expect((await page.evaluate(() => window.careGeometry())).count).toBe(576);
  await page.evaluate(() => window.normalCareGraphics(false));
});
