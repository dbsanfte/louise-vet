import { test, expect, type Locator, type Page } from '@playwright/test';
import { build } from 'vite';
import { careSkills, type CareTool } from '../src/care-skill';
import { bandagePattern } from '../src/bandage-pattern';
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
async function openSliderFixture(page: Page) {
  const index = await (await page.request.get('/')).text();
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
}
async function sliderPointer(page: Page, touch: boolean) {
  const session = touch ? await page.context().newCDPSession(page) : null;
  return {
    async move(
      control: Locator,
      phase: 'start' | 'move' | 'end' | 'cancel',
      fraction: number,
      offsetY = 0,
    ) {
      const box = (await control.boundingBox())!;
      const point = {
        x: box.x + box.width * fraction,
        y: box.y + box.height / 2 + offsetY,
      };
      if (session)
        await session.send('Input.dispatchTouchEvent', {
          type: {
            start: 'touchStart',
            move: 'touchMove',
            end: 'touchEnd',
            cancel: 'touchCancel',
          }[phase] as 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
          touchPoints: ['end', 'cancel'].includes(phase)
            ? []
            : [{ ...point, id: 0 }],
        });
      else if (phase === 'start') {
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
      } else if (phase === 'move') await page.mouse.move(point.x, point.y);
      else await page.mouse.up();
    },
    dispose: () => session?.detach(),
  };
}
test('every movable treatment track and slider follows a finger or mouse through a continuous drag', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await openSliderFixture(page);
  const pointer = await sliderPointer(page, info.project.name === 'mobile');
  for (const tool of [
    'comb',
    'brush',
    'drops',
    'forceps',
    'cooling',
  ] as const) {
    await page.evaluate((tool) => window.openCare(tool), tool);
    const rail = page.locator('.skill-rail');
    const input = page.locator('#skill-position');
    const initial = await input.inputValue();
    for (const control of [rail, input]) {
      await pointer.move(control, 'start', 0.2);
      await pointer.move(control, 'move', 0.8);
      await pointer.move(control, 'end', 0.8);
      await expect(input).toHaveValue(initial);
    }
    await page.getByRole('button', { name: 'Start when ready' }).click();
    if (tool === 'forceps') {
      await pointer.move(rail, 'start', 0.2);
      await pointer.move(rail, 'move', 0.8);
      await pointer.move(rail, 'end', 0.8);
      await expect(input).toHaveValue('0');
      await page.getByRole('button', { name: 'Grip splinter' }).click();
    }
    for (const control of [rail, input]) {
      const scroll = await page
        .locator('.skill-dialog')
        .evaluate((d) => d.scrollTop);
      await pointer.move(control, 'start', 0.2);
      await pointer.move(control, 'move', 0.35, 55);
      await expect
        .poll(async () => Number(await input.inputValue()))
        .toBeGreaterThan(25);
      await pointer.move(control, 'move', 0.8, 55);
      await expect
        .poll(async () => Number(await input.inputValue()))
        .toBeGreaterThan(70);
      await pointer.move(control, 'move', 0.2, -35);
      await expect
        .poll(async () => Number(await input.inputValue()))
        .toBeLessThan(30);
      await pointer.move(control, 'cancel', 0.2);
      expect(
        await page.locator('.skill-dialog').evaluate((d) => d.scrollTop),
      ).toBe(scroll);
      const position = await input.inputValue();
      await pointer.move(page.locator('.skill-header'), 'start', 0.2);
      await pointer.move(page.locator('.skill-header'), 'move', 0.8);
      await pointer.move(page.locator('.skill-header'), 'end', 0.8);
      await expect(input).toHaveValue(position);
    }
    await input.focus();
    await input.press('Home');
    await expect(input).toHaveValue('0');
    await input.press('End');
    await expect(input).toHaveValue('100');
    await page.getByRole('button', { name: 'Cancel care activity' }).click();
    await expect(page.locator('#outcome')).toHaveText('Cancelled');
  }
  await pointer.dispose();
});
test('dragging completes combing, brushing, drops and forceps care', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await openSliderFixture(page);
  const pointer = await sliderPointer(page, info.project.name === 'mobile');
  for (const tool of ['comb', 'brush', 'drops', 'forceps'] as const) {
    await page.evaluate((tool) => window.openCare(tool), tool);
    const rail = page.locator('.skill-rail');
    const input = page.locator('#skill-position');
    const finish = page.getByRole('button', { name: 'Finish care' });
    await page.getByRole('button', { name: 'Start when ready' }).click();
    await expect(finish).toBeDisabled();
    if (tool === 'comb' || tool === 'brush') {
      // Complete continuous outward/return strokes on both controls.
      const control = tool === 'comb' ? rail : input;
      await pointer.move(control, 'start', 0);
      for (let stroke = 0; stroke < 6; stroke++) {
        const target = stroke % 2 === 0 ? 1 : 0;
        await pointer.move(control, 'move', 0.5);
        await pointer.move(control, 'move', target);
      }
      await pointer.move(control, 'end', 0);
    } else {
      if (tool === 'forceps')
        await page.getByRole('button', { name: 'Grip splinter' }).click();
      const targets = tool === 'drops' ? [0.25, 0.75, 0.4] : [0.25, 0.5, 0.8];
      await pointer.move(rail, 'start', tool === 'drops' ? 0.5 : 0);
      for (let stage = 0; stage < targets.length; stage++) {
        if (tool === 'drops' && stage > 0)
          await pointer.move(rail, 'start', targets[stage - 1]);
        await pointer.move(rail, 'move', targets[stage]);
        if (tool === 'drops') {
          await pointer.move(rail, 'end', targets[stage]);
          await page.getByRole('button', { name: 'Release a drop' }).click();
        }
        await expect(page.getByRole('meter')).toHaveAttribute(
          'aria-valuenow',
          String(Math.round(((stage + 1) / 3) * 100)),
        );
      }
      if (tool === 'forceps') await pointer.move(rail, 'end', 0.8);
    }
    await expect(finish).toBeEnabled();
    await expect(input).toBeDisabled();
    await expect(page.locator('#outcome')).toHaveText('');
    await page.screenshot({
      path: info.outputPath(`${tool}-drag-complete.png`),
    });
    await finish.click();
    await expect(page.locator('#outcome')).toHaveText('Care completed');
  }
  await pointer.dispose();
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
      if (tool === 'bandage')
        await page.screenshot({
          path: info.outputPath(`bandage-ready-${size.height}.png`),
        });
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
  const board = page.locator('.skill-wrap');
  const box = (await board.boundingBox())!;
  await page.mouse.move(
    box.x + box.width * bandagePattern[0].x,
    box.y + box.height * bandagePattern[0].y,
  );
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.9);
  await page.mouse.up();
  await expect(page.locator('.skill-feedback')).toContainText(
    'stay on the dotted ribbon',
  );
  await expect(page.locator('[data-skill-finish]')).toBeDisabled();
  for (const size of [
    { width: 360, height: 640 },
    { width: 740, height: 360 },
  ]) {
    await page.setViewportSize(size);
    expect(
      await page
        .locator('.skill-dialog')
        .evaluate((d) => d.scrollHeight - d.clientHeight),
    ).toBeLessThanOrEqual(1);
  }
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

test('bandage tracing follows mouse, touch and keyboard, with safe recovery and no click shortcuts', async ({
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
  await page.evaluate(() => window.openCare('bandage'));
  const board = page.getByRole('group', { name: 'Bandage wrapping pattern' });
  const finish = page.locator('[data-skill-finish]');
  const meter = page.getByRole('meter');
  const session =
    info.project.name === 'mobile'
      ? await page.context().newCDPSession(page)
      : null;
  const pointer = async (phase: 'start' | 'move' | 'end', index: number) => {
    const box = (await board.boundingBox())!,
      point = bandagePattern[index];
    const p = {
      x: box.x + point.x * box.width,
      y: box.y + point.y * box.height,
    };
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
  await pointer('start', 0);
  await pointer('move', 16);
  await pointer('end', 16);
  await expect(meter).toHaveAttribute('aria-valuenow', '0');
  await page.getByRole('button', { name: 'Start when ready' }).click();
  for (const i of [0, 16, 32, 48, 64, 80, 96]) {
    await pointer('start', i);
    await pointer('end', i);
  }
  await expect(meter).toHaveAttribute('aria-valuenow', '0');
  const beforeDrag = (await board.boundingBox())!;
  await pointer('start', 0);
  expect((await board.boundingBox())!.y).toBeCloseTo(beforeDrag.y, 1);
  for (let i = 1; i <= 24; i++) await pointer('move', i);
  // A shortcut to a later coil loses only the unfinished section.
  await pointer('move', 80);
  await pointer('end', 80);
  await expect(page.locator('.skill-feedback')).toContainText(
    'finished sections are safe',
  );
  await expect(meter).toHaveAttribute('aria-valuenow', '17');
  await expect(finish).toBeDisabled();
  await pointer('start', 16);
  for (let i = 17; i <= 48; i++) await pointer('move', i);
  await pointer('end', 48);
  await expect(meter).toHaveAttribute('aria-valuenow', '50');
  await page.screenshot({ path: info.outputPath('bandage-half-wrapped.png') });
  await page.mouse.move(1, 1);
  await expect(meter).toHaveAttribute('aria-valuenow', '50');
  await pointer('start', 48);
  for (let i = 49; i <= 96; i++) await pointer('move', i);
  await pointer('end', 96);
  await expect(finish).toBeEnabled();
  await finish.click();
  await expect(page.locator('#outcome')).toHaveText('Care completed');
  await session?.detach();

  // The arrow alternative moves the same roll in two dimensions and must trace
  // the same ribbon. It is not a second set of numbered completion buttons.
  await page.evaluate(() => window.openCare('bandage'));
  await page.getByRole('button', { name: 'Start when ready' }).click();
  await expect(board).toBeFocused();
  let cursor = { ...bandagePattern[0] };
  for (const point of bandagePattern.slice(1)) {
    for (const axis of ['x', 'y'] as const) {
      while (Math.abs(point[axis] - cursor[axis]) > 0.011) {
        const forward = point[axis] > cursor[axis];
        await board.press(
          axis === 'x'
            ? forward
              ? 'ArrowRight'
              : 'ArrowLeft'
            : forward
              ? 'ArrowDown'
              : 'ArrowUp',
        );
        cursor[axis] += forward ? 0.02 : -0.02;
      }
    }
  }
  await expect(finish).toBeEnabled();
  await finish.click();
  await expect(page.locator('#outcome')).toHaveText('Care completed');
});
