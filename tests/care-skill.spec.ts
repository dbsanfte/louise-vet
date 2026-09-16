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
      const b = (await page
          .locator(selector === '.skill-canvas' ? '.care-surface' : selector)
          .boundingBox())!,
        p = {
          x: b.x + x * b.width,
          y:
            b.y +
            y * b.height +
            (touch && selector === '.skill-canvas' ? 55 : 0),
        };
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
    await expect(dialog.locator('[data-skill-start]')).toHaveCount(0);
    await expect(dialog.locator('.skill-canvas')).toBeFocused();
    await page.waitForTimeout(200);
    await expect(dialog).toHaveAttribute('data-started', 'false');
    expect((await page.evaluate(() => window.careContact())).elapsed).toBe(0);
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
test('every care tool aims above native touch with reachable edges and direct mouse aim', async ({
  page,
}, info) => {
  const touch = info.project.name === 'mobile';
  await fixture(page, 'cream');
  const p = await pointer(page, touch);
  for (const size of [
    { width: 360, height: 640 },
    { width: 740, height: 360 },
  ]) {
    await page.setViewportSize(size);
    for (const tool of (Object.keys(careSkills) as CareTool[]).filter(
      (tool) => tool !== 'water-care',
    )) {
      await page.evaluate((tool) => window.openCare(tool), tool);
      await expect(page.locator('.skill-dialog')).toHaveAttribute(
        'data-ready',
        'true',
      );
      const surface = page.locator('.care-surface');
      const board = page.locator('.skill-canvas');
      // Wait for the projected geometry to catch up with a rotated phone.
      const frames = await page.evaluate(() => window.careGeometry().frames);
      await expect
        .poll(() => page.evaluate(() => window.careGeometry().frames))
        .toBeGreaterThan(frames);
      const start =
        tool === 'bandage'
          ? await page.locator('.care-target').evaluate((e) => ({
              x: Number((e as HTMLElement).dataset.x),
              y: Number((e as HTMLElement).dataset.y),
            }))
          : { x: 0.5, y: 0.5 };
      await p.send('start', start.x, start.y);
      for (const target of [
        { x: 0.25, y: 0.1 },
        { x: 0.75, y: 0.95 },
      ]) {
        const b = (await surface.boundingBox())!;
        const finger = {
          x: b.x + target.x * b.width,
          y: b.y + target.y * b.height + (touch ? 55 : 0),
        };
        const bounds = (await board.boundingBox())!;
        expect(finger.y).toBeLessThan(bounds.y + bounds.height);
        expect(finger.y).toBeLessThan(size.height);
        await p.send('move', target.x, target.y);
        await expect
          .poll(async () => {
            const tip = await page.locator('.care-cursor').evaluate((e) => {
              const b = e.getBoundingClientRect();
              return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
            });
            return Math.max(
              Math.abs(tip.x - finger.x),
              Math.abs(finger.y - tip.y - (touch ? 55 : 0)),
            );
          })
          .toBeLessThan(2);
        // Changing contact/feedback must not shift the treatment grid under the hand.
        expect(await surface.boundingBox()).toEqual(b);
      }
      if (tool === 'cream')
        await page.screenshot({
          path: info.outputPath(`offset-${size.width}.png`),
        });
      await p.send('cancel', 0.75, 0.95);
      const before = await page.locator('.care-cursor').getAttribute('style');
      await page.mouse.move(1, 1);
      await expect(page.locator('.care-cursor')).toHaveAttribute(
        'style',
        before!,
      );
    }
  }
  await p.dispose();
});

test('native vaccine pressure drags with a finger, pauses on release and retains keyboard input', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await fixture(page, 'vaccine');
  const p = await pointer(page, info.project.name === 'mobile'),
    input = page.locator('#skill-position');
  await p.send('start', 0.5, 0.5);
  await page.waitForTimeout(600);
  await p.send('end', 0.5, 0.5);
  await page.getByRole('button', { name: 'Begin gentle press' }).click();
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
  await p.dispose();
});
test('bandage wraps the actual paw through native dragging, recovers within a drag without losing progress and supports keyboard tracing', async ({
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
  for (const i of [0, 16, 32, 48, 64, 80, 96]) {
    await p.send('start', points[i].x, points[i].y);
    await p.send('end', points[i].x, points[i].y);
  }
  await expect(
    page.getByRole('meter', { name: 'Care progress' }),
  ).toHaveAttribute('aria-valuenow', '0');
  await p.send('start', points[0].x, points[0].y);
  for (const q of points.slice(1, 25)) await p.send('move', q.x, q.y);
  await expect(
    page.getByRole('meter', { name: 'Care progress' }),
  ).toHaveAttribute('aria-valuenow', '25');
  const progress = await page
    .getByRole('meter', { name: 'Care progress' })
    .getAttribute('aria-valuenow');
  await p.send('move', 0.99, 0.99);
  await expect(page.locator('.skill-dialog')).toHaveAttribute(
    'data-rejoining',
    'true',
  );
  await expect(page.locator('.skill-feedback')).toContainText('glowing ring');
  await expect(
    page.getByRole('meter', { name: 'Care progress' }),
  ).toHaveAttribute('aria-valuenow', progress!);
  // Rejoin without lifting: the off-path part must not be drawn as a shortcut.
  await p.send('move', points[24].x, points[24].y);
  await expect(page.locator('.skill-dialog')).toHaveAttribute(
    'data-rejoining',
    'false',
  );
  for (const q of points.slice(25, 49)) await p.send('move', q.x, q.y);
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
test('gentle cream strokes reach every patch through offset touch or direct mouse contact', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await fixture(page, 'cream');
  const p = await pointer(page, info.project.name === 'mobile');
  for (let i = 0; i < 6; i++) {
    const mark = page.locator(`[data-care-mark="${i}"]`);
    const center = await mark.evaluate((e) => ({
      x: Number((e as HTMLElement).dataset.x),
      y: Number((e as HTMLElement).dataset.y),
    }));
    await p.send('start', center.x + 0.025, center.y);
    await expect
      .poll(() => page.evaluate(() => window.careContact().holding))
      .toBe(true);
    for (let j = 1; j <= 36 && (await mark.isVisible()); j++) {
      await p.send(
        'move',
        center.x + Math.cos(j * 0.3) * 0.025,
        center.y + Math.sin(j * 0.3) * 0.025,
      );
      await page.waitForTimeout(40);
    }
    if (i === 0)
      await page.screenshot({
        path: info.outputPath('gentle-visible-contact.png'),
      });
    await p.send('end', center.x, center.y);
    await expect(mark).toBeHidden();
  }
  await expect(page.locator('[data-skill-finish]')).toBeEnabled();
  await expect(page.getByRole('meter', { name: 'Discomfort' })).toHaveAttribute(
    'aria-valuenow',
    '0',
  );
  await p.dispose();
});

test('a normal finger hold can follow the breathing patch and complete cooling', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await fixture(page, 'cooling');
  const p = await pointer(page, info.project.name === 'mobile');
  const target = () =>
    page.locator('.care-target').evaluate((e) => ({
      x: Number((e as HTMLElement).dataset.x),
      y: Number((e as HTMLElement).dataset.y),
    }));
  const start = await target();
  await p.send('start', start.x, start.y);
  for (
    let i = 0;
    i < 100 && (await page.locator('[data-skill-finish]').isDisabled());
    i++
  ) {
    const aim = await target();
    await p.send('move', aim.x, aim.y);
    await page.waitForTimeout(50);
  }
  await p.send('end', start.x, start.y);
  await expect(page.locator('[data-skill-finish]')).toBeEnabled();
  await expect(page.getByRole('meter', { name: 'Discomfort' })).toHaveAttribute(
    'aria-valuenow',
    '0',
  );
  await p.dispose();
});

test('rough cream application shows discomfort and a calm retry resets coverage', async ({
  page,
}, info) => {
  await fixture(page, 'cream');
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

test('the normal rendering path shows the full 3D bandage and swimming fish', async ({
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
  await page.evaluate(() => window.openCare('water-care'));
  await expect(page.locator('.skill-dialog')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await page.evaluate(() => window.normalCareGraphics(true));
  expect((await page.evaluate(() => window.careFish())).rendered).toBe(true);
  await exerciseCareSkill(page);
  const fishFrame = (await page.evaluate(() => window.careFish())).frames;
  await expect
    .poll(() => page.evaluate(() => window.careFish().frames))
    .toBeGreaterThan(fishFrame);
  await page.screenshot({ path: info.outputPath('normal-rendering-fish.png') });
  await page.evaluate(() => window.normalCareGraphics(false));
});

test('fish care starts with the first native tap, needs only timing, and supports keyboard drops', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await fixture(page, 'water-care');
  const dialog = page.locator('.skill-dialog');
  const p = await pointer(page, info.project.name === 'mobile');
  await expect(
    dialog.locator('input,[data-skill-action],[data-skill-start]'),
  ).toHaveCount(0);
  const before = await page.evaluate(() => window.careFish());
  expect(before.rendered).toBe(true);
  // Waiting, hovering and reading must not start the timer.
  await page.mouse.move(5, 5);
  await page.waitForTimeout(300);
  expect((await page.evaluate(() => window.careContact())).elapsed).toBe(0);
  await p.send('start', 0.5, 0.5);
  await expect(dialog).toHaveAttribute('data-started', 'true');
  await expect.poll(() => page.evaluate(() => window.careFish().drops)).toBe(1);
  // A held finger releases just one drop.
  await page.waitForTimeout(1000);
  expect((await page.evaluate(() => window.careFish())).drops).toBe(1);
  await p.send('end', 0.5, 0.5);
  const moved = await page.evaluate(() => window.careFish());
  expect(Math.hypot(moved.x - before.x, moved.y - before.y)).toBeGreaterThan(
    0.05,
  );
  await page.screenshot({ path: info.outputPath('swimming-fish.png') });
  // Tap on another part of the bowl: placement never moves the fixed dropper.
  await expect(dialog).toHaveAttribute('data-water-state', 'wait');
  await p.send('start', 0.7, 0.4);
  await p.send('end', 0.7, 0.4);
  await expect
    .poll(() => page.evaluate(() => window.careFish().misses))
    .toBeGreaterThan(0);
  expect((await page.evaluate(() => window.careFish())).drops).toBe(1);
  await expect(page.locator('.skill-feedback')).toContainText('fish is fine');
  await exerciseCareSkill(page);
  await expect(dialog.locator('[data-skill-finish]')).toBeEnabled();
  expect((await page.evaluate(() => window.careFish())).drops).toBe(5);
  await p.dispose();
});

test('keyboard contact starts care without a start button', async ({
  page,
}) => {
  await fixture(page, 'cooling');
  const board = page.locator('.skill-canvas');
  await board.press('ArrowRight');
  await expect(page.locator('.skill-dialog')).toHaveAttribute(
    'data-started',
    'true',
  );
  expect(
    (await page.evaluate(() => window.careContact())).position.x,
  ).toBeCloseTo(0.515);
  await board.press('Space');
  await expect
    .poll(() => page.evaluate(() => window.careContact().holding))
    .toBe(false);
  await page.keyboard.press('Escape');
  await expect(page.locator('#outcome')).toHaveText('Cancelled');
});
