import { expect, test, type Page } from '@playwright/test';
import { build } from 'vite';
import { TownSimulation } from '../src/town-simulation';
import { visits, upgrades, type UpgradeId } from '../src/game';
import { touchCamera } from './touch-camera';
const owned = upgrades.filter((u) => u.id !== 'stock').map((u) => u.id);
let script = '';
test.setTimeout(120000);
test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      lib: {
        entry: 'tests/fixtures/clinic-build-harness.ts',
        formats: ['iife'],
        name: 'BuildHarness',
      },
    },
  });
  for (const out of Array.isArray(result) ? result : [result])
    if ('output' in out)
      for (const chunk of out.output)
        if (chunk.type === 'chunk') script += chunk.code;
});
async function open(
  page: Page,
  busy = false,
  items: UpgradeId[] = owned,
  legacy = false,
  patients = ['Luna', 'Milo', 'Peanut', 'Pico'],
  coins = 5000,
) {
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic(
    busy ? patients.map((n) => visits.findIndex((v) => v.name === n)) : [],
  );
  s.configureClinic(8, 22);
  s.configureLeisure(items);
  if (busy) for (let i = 0; i < 250; i++) s.update(0.1);
  const town = s.snapshot();
  const { build: _layout, ...legacyTown } = town;
  const index = await (await page.request.get('/')).text(),
    css = index.match(/href="([^"]+\.css)"/)![1];
  await page.addInitScript(
    ({ town, owned, coins }) => {
      if (!localStorage.getItem('louises-vet-office-v1'))
        localStorage.setItem(
          'louises-vet-office-v1',
          JSON.stringify({
            version: 1,
            coins,
            earned: 0,
            happiness: 100,
            treated: 0,
            stock: 3,
            upgrades: owned,
            sound: false,
            town,
          }),
        );
    },
    { town: legacy ? legacyTown : town, owned: items, coins },
  );
  await page.route('**/build-test.html', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${css}"><div id="app"></div><script src="/build-harness.js"></script>`,
    }),
  );
  await page.route('**/build-harness.js', (r) =>
    r.fulfill({ contentType: 'application/javascript', body: script }),
  );
  await page.route(/\/(assets|models|images)\//, async (r) =>
    r.fulfill({ response: await r.fetch() }),
  );
  await page.goto('/build-test.html');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-building', 'true');
}
async function chooseTool(page: Page, tool: string) {
  if (tool === 'items') {
    await page.locator('[data-build="mode"][data-value="items"]').click();
    return;
  }
  if (tool !== 'camera')
    await page.locator('[data-build="mode"][data-value="spaces"]').click();
  await page.locator(`[data-build="tool"][data-value="${tool}"]`).click();
}
async function tap(
  page: Page,
  x: number,
  z: number,
  touch: boolean,
  frame = true,
) {
  const p = await page.evaluate(
    ({ x, z, frame }) => window.buildTest.point(x, z, frame),
    { x, z, frame },
  );
  if (touch) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}
async function visibleDoors(page: Page) {
  return page.evaluate(() => {
    window.buildTest.step(0);
    return window.buildTest
      .doors()
      .filter((o) => o.visible)
      .map(({ x, z }) => [x, z]);
  });
}
async function movePlaced(page: Page, id: string) {
  await chooseTool(page, 'items');
  const point = await page.evaluate((id) => window.buildTest.itemPoint(id), id);
  if (await page.evaluate(() => matchMedia('(pointer:coarse)').matches))
    await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await expect
    .poll(() => page.evaluate(() => window.buildTest.selection()))
    .toBe(id);
}
test('fresh clinics and unbuilt room kits have no doors standing outside the building', async ({
  page,
}, info) => {
  await open(page, false, []);
  await expect(page.locator('.build-room-kit')).toHaveCount(0);
  expect(await page.evaluate(() => window.buildTest.doors())).toHaveLength(4);
  await page.evaluate(() => window.buildTest.point(-8, -6, true));
  await page.waitForTimeout(900);
  await page.screenshot({ path: info.outputPath('fresh-clinic-doors.png') });
  // Only the door in the starter clinic's actual lounge opening is present.
  expect(await visibleDoors(page)).toEqual([[-5.14, 0]]);
  await page.locator('[data-build="shop"]').click();
  for (const id of ['expansion', 'pet-room', 'play-annex', 'sun-courtyard'])
    await page.locator(`[data-upgrade="${id}"]`).click();
  await page.getByRole('button', { name: 'Close shop', exact: true }).click();
  await expect(page.locator('.build-room-kit')).toHaveCount(0);
  await chooseTool(page, 'room');
  const kits = page.locator('.build-room-kit');
  await expect(kits).toHaveCount(2);
  await expect(kits.nth(0)).toHaveAttribute('data-kit', 'expansion');
  await expect(kits.nth(1)).toHaveAttribute('data-kit', 'play-annex');
  await expect(page.locator('[data-build="pick"]')).toHaveCount(0);
  const before = await page.evaluate(() => window.buildTest.snapshot().build);
  await kits.locator('[data-id="expansion"]').click();
  await expect(
    page.locator('[data-build="tool"][data-value="room"]'),
  ).toHaveAttribute('aria-pressed', 'true');
  await chooseTool(page, 'garden');
  await expect(kits).toHaveCount(2);
  await kits.locator('[data-id="sun-courtyard"]').click();
  await expect(
    page.locator('[data-build="tool"][data-value="garden"]'),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    before,
  );
  await page.screenshot({ path: info.outputPath('unused-room-kits.png') });
  expect(await visibleDoors(page)).toEqual([[-5.14, 0]]);
  await page.reload();
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  expect(await visibleDoors(page)).toEqual([[-5.14, 0]]);
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await chooseTool(page, 'room');
  await expect(kits).toHaveCount(2);
  await chooseTool(page, 'garden');
  await expect(kits).toHaveCount(2);
});
const doorStages: { items: UpgradeId[]; doors: number[][] }[] = [
  {
    items: ['expansion'],
    doors: [
      [-11, 0],
      [-8, -4],
    ],
  },
  {
    items: ['expansion', 'pet-room'],
    doors: [
      [-8, -4],
      [-11.95, -12],
    ],
  },
  {
    items: ['expansion', 'pet-room', 'play-annex', 'sun-courtyard'],
    doors: [],
  },
];
for (const [i, { items, doors }] of doorStages.entries())
  test(`migrated clinic with ${items.length} built rooms keeps doors attached to existing walls`, async ({
    page,
  }, info) => {
    await open(page, false, items, true);
    expect(await visibleDoors(page)).toEqual(doors);
    if (i === 0) {
      // Room kits alone must not open existing doors or add distant doors.
      await page.locator('[data-build="shop"]').click();
      for (const id of ['pet-room', 'play-annex', 'sun-courtyard'])
        await page.locator(`[data-upgrade="${id}"]`).click();
      await page
        .getByRole('button', { name: 'Close shop', exact: true })
        .click();
      expect(await visibleDoors(page)).toEqual(doors);
      await page.waitForTimeout(900);
      await page.screenshot({
        path: info.outputPath('migrated-lounge-doors.png'),
      });
      await chooseTool(page, 'garden');
      await page.locator('[data-build="boundary"][data-value="open"]').click();
      await tap(page, -12, -3, info.project.name === 'mobile');
      await tap(page, -12, -1, info.project.name === 'mobile');
      await expect(page.locator('#build-feedback')).toContainText('ready');
      expect(await visibleDoors(page)).toEqual([]);
    }
  });
test('migrated furniture can be stored, placed, rotated and saved with controls staying on screen', async ({
  page,
}, info) => {
  const touch = info.project.name === 'mobile';
  if (touch) await page.setViewportSize({ width: 360, height: 640 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  const before = await page.evaluate(() => window.buildTest.snapshot().build);
  expect(before.customized).toBe(false);
  const parts = await page.evaluate(() => window.buildTest.models());
  expect(
    parts
      .filter(
        (m) =>
          m.id === 'welcome-bench' ||
          m.id === 'shelf' ||
          m.id.startsWith('base-plant'),
      )
      .every((m) => m.parts > 0),
  ).toBe(true);
  await movePlaced(page, 'plant-0');
  await page.evaluate(() => window.buildTest.step(20));
  await expect(page.locator('[data-build="store"]')).toBeEnabled();
  await page.locator('[data-build="store"]').click();
  await expect(
    page.locator('[data-build="pick"][data-id="plant-0"]'),
  ).toContainText('1 available');
  await page.locator('[data-build="pick"][data-id="plant-0"]').click();
  if (touch) await page.locator('[data-build="rotate"]').click();
  else await page.keyboard.press('r');
  await tap(page, -8, 0, touch);
  await expect(page.locator('#build-feedback')).toContainText('Lovely');
  const after = await page.evaluate(() => window.buildTest.snapshot().build);
  expect(after.items.find((i) => i.id === 'plant-0')!.placement).toEqual({
    x: -8,
    z: 0,
    rotation: Math.PI / 2,
  });
  expect(after.floorEdited).toBe(false);
  expect(after.tiles).toEqual(before.tiles);
  for (const sel of [
    '[data-build="done"]',
    '[data-build="rotate"]',
    '.bottom-bar',
    '[data-build="shop"]',
  ]) {
    const box = await page.locator(sel).boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height + 1,
    );
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight + 2,
    ),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath('build-editor.png') });
  await page.locator('[data-build="done"]').click();
  await expect(page.locator('.patient-list')).toBeVisible();
  await page.reload();
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    after,
  );
  expect(errors).toEqual([]);
});
test('build a connected garden and room, reject unsafe furniture, and cancel without changing the clinic', async ({
  page,
}, info) => {
  await open(page);
  const touch = info.project.name === 'mobile';
  await chooseTool(page, 'garden');
  await page.locator('[data-build="boundary"][data-value="open"]').click();
  await tap(page, -18, -7, touch);
  await tap(page, -17, 0, touch);
  await expect(page.locator('#build-feedback')).toContainText('ready');
  let state = await page.evaluate(() => window.buildTest.snapshot().build);
  const gardenCoins = await page.getByTestId('coins').textContent();
  expect(
    state.tiles.filter((t) => t.x === -18 && t.z >= -7 && t.z < 0),
  ).toHaveLength(7);
  expect(
    state.tiles
      .filter((t) => t.x === -18 && t.z >= -7 && t.z <= -1)
      .every((t) => t.surface === 'garden'),
  ).toBe(true);
  await chooseTool(page, 'room');
  await page.locator('[data-build="boundary"][data-value="open"]').click();
  // Repaint the same explicit rectangle. A zero-width boundary stroke would
  // now grow outward into new floor, rather than selecting the old strip.
  await tap(page, -18, -7, touch);
  await tap(page, -17, 0, touch);
  state = await page.evaluate(() => window.buildTest.snapshot().build);
  expect(
    state.tiles
      .filter((t) => t.x === -18 && t.z >= -7 && t.z <= -1)
      .every((t) => t.surface === 'room'),
  ).toBe(true);
  await expect(page.getByTestId('coins')).toHaveText(gardenCoins!);
  await chooseTool(page, 'items');
  await movePlaced(page, 'bench');
  await page.evaluate(() => window.buildTest.step(20));
  await tap(page, 3.5, -4, touch);
  await expect(page.locator('#build-feedback')).toContainText(
    /clear|own space|floor/,
  );
  await page.locator('[data-build="cancel"]').click();
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    state,
  );
  await page.locator('[data-build="plot"]').click();
  await page.evaluate(() => window.buildTest.step(0));
  await page.screenshot({ path: info.outputPath('build-whole-plot.png') });
});
test('picking occupied seating lets owners and pets leave before hiding it and resuming care', async ({
  page,
}) => {
  await open(page, true);
  const before = await page.evaluate(() => window.buildTest.snapshot());
  const station = before.leisure.owners.find(
    (o) => o.station.startsWith('seat-') && ['sit', 'read'].includes(o.phase),
  )!.station;
  const item = ['seat-0', 'seat-1', 'seat-2'].includes(station)
    ? 'welcome-bench'
    : ['seat-3', 'seat-4'].includes(station)
      ? 'bench'
      : station;
  await movePlaced(page, item);
  await page.evaluate(() => window.buildTest.step(45));
  await expect(page.locator('[data-build="store"]')).toBeEnabled();
  await page.locator('[data-build="store"]').click();
  await page.locator('[data-build="done"]').click();
  await page.evaluate(() => window.buildTest.step(20));
  const after = await page.evaluate(() => window.buildTest.snapshot());
  expect(
    after.build.items.find((i) => i.id === item)?.placement,
  ).toBeUndefined();
  expect(after.leisure.owners.some((o) => o.station === station)).toBe(false);
  await expect(page.locator('.patient-list')).toBeVisible();
});

test('paid furniture copies have ordinary names, counts and independent placement on desktop and touch', async ({
  page,
}, info) => {
  const touch = info.project.name === 'mobile';
  if (touch) await page.setViewportSize({ width: 360, height: 640 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, true, ['expansion', 'pet-room'], false, [
    'Luna',
    'Milo',
    'Peanut',
    'Sunny',
  ]);
  await page.locator('[data-build="shop"]').click();
  for (const [id, count] of [
    ['lounge-chair', 4],
    ['wheel', 2],
  ] as const) {
    const buy = page.locator(`[data-upgrade="${id}"]`);
    for (let i = 0; i < count; i++) {
      await buy.scrollIntoViewIfNeeded();
      const scroll = await page
        .locator('.modal.shop')
        .evaluate((el) => el.scrollTop);
      await buy.click();
      await expect(buy).toBeEnabled();
      expect(
        Math.abs(
          (await page.locator('.modal.shop').evaluate((el) => el.scrollTop)) -
            scroll,
        ),
      ).toBeLessThan(3);
    }
  }
  await expect(page.getByTestId('coins')).toHaveText('4,600');
  await expect(
    page
      .locator('.shop-card')
      .filter({ has: page.locator('[data-upgrade="lounge-chair"]') }),
  ).toContainText('3 placed · 4 stored');
  await expect(
    page
      .locator('.shop-card')
      .filter({ has: page.locator('[data-upgrade="wheel"]') }),
  ).toContainText('0 placed · 2 stored');
  await page.getByRole('button', { name: 'Close shop', exact: true }).click();
  await expect(page.locator('.build-list')).not.toContainText(
    /Lounge chair [0-9]/,
  );
  await expect(
    page.locator('[data-build="pick"][data-id="seat-5~1"]'),
  ).toContainText('4 available');
  for (const [id, x, z] of [
    ['seat-5~1', -8, 0],
    ['wheel', -14, -6],
    ['wheel~1', -14, -9],
  ] as const) {
    await page.locator(`[data-build="pick"][data-id="${id}"]`).click();
    if (touch) await page.locator('[data-build="rotate"]').click();
    else await page.keyboard.press('r');
    await tap(page, x, z, touch);
    await expect(page.locator('#build-feedback')).toContainText('Lovely');
  }
  await expect(
    page.locator('[data-build="pick"][data-id="seat-5~2"]'),
  ).toContainText('3 available');
  await expect(page.locator('.build-card[data-recipe="wheel"]')).toHaveCount(0);
  const placed = await page.evaluate(() => window.buildTest.snapshot().build);
  const models = await page.evaluate(() => window.buildTest.models());
  for (const id of ['seat-5~1', 'wheel', 'wheel~1']) {
    const model = models.find((m) => m.id === id)!;
    expect(model.visible).toBe(true);
    expect(model.parts).toBeGreaterThan(0);
    expect(model.rotation).toBeCloseTo(Math.PI / 2);
    expect(placed.items.find((i) => i.id === id)!.placement).toEqual({
      x: model.x,
      z: model.z,
      rotation: model.rotation,
    });
  }
  await page.screenshot({
    path: info.outputPath('separate-furniture-copies.png'),
  });
  await page.locator('[data-build="done"]').click();
  let both = false;
  for (let i = 0; i < 100 && !both; i++) {
    both = await page.evaluate(() => {
      window.buildTest.step(2);
      const pets = window.buildTest.snapshot().leisure.pets;
      const riders = pets.filter(
        (p) =>
          p.station.startsWith('wheel') && p.phase === 'use' && p.elapsed > 0,
      );
      if (riders.length !== 2) return false;
      const models = window.buildTest.models();
      return riders.every(
        (p) =>
          Math.abs(
            models.find((m) => m.id === (p.station.split('@')[1] ?? p.station))!
              .wheelRotation! -
              p.elapsed * 4,
          ) < 0.001,
      );
    });
  }
  expect(both, 'two pets ride separately animated wheels at once').toBe(true);
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await movePlaced(page, 'wheel~1');
  await page.evaluate(() => window.buildTest.step(45));
  await page.locator('[data-build="store"]').click();
  await expect(page.locator('.build-card[data-recipe="wheel"]')).toContainText(
    '1 available',
  );
  const stored = await page.evaluate(() => window.buildTest.snapshot().build);
  expect(
    stored.items.find((i) => i.id === 'wheel~1')!.placement,
  ).toBeUndefined();
  expect(stored.items.find((i) => i.id === 'wheel')!.placement).toEqual(
    placed.items.find((i) => i.id === 'wheel')!.placement,
  );
  await expect(page.getByTestId('coins')).toHaveText('4,600');
  await page.locator('[data-build="done"]').click();
  await page.reload();
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    stored,
  );
  await page.getByRole('button', { name: /Clinic shop/ }).click();
  await expect(
    page
      .locator('.shop-card')
      .filter({ has: page.locator('[data-upgrade="lounge-chair"]') }),
  ).toContainText('4 placed · 3 stored');
  await expect(
    page
      .locator('.shop-card')
      .filter({ has: page.locator('[data-upgrade="wheel"]') }),
  ).toContainText('1 placed · 1 stored');
  await expect(page.locator('[data-upgrade="wheel"]')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('recovering rejected town activity keeps all paid furniture, placements and floor credits', async ({
  page,
}, info) => {
  await open(page, false, ['expansion', 'pet-room']);
  await page.locator('[data-build="shop"]').click();
  for (let i = 0; i < 4; i++)
    await page.locator('[data-upgrade="lounge-chair"]').click();
  for (let i = 0; i < 2; i++)
    await page.locator('[data-upgrade="wheel"]').click();
  await page.locator('[data-upgrade="play-annex"]').click();
  await page.getByRole('button', { name: 'Close shop', exact: true }).click();
  await page.locator('[data-build="pick"][data-id="seat-5~1"]').click();
  await tap(page, -8, 0, info.project.name === 'mobile');
  await expect(page.locator('#build-feedback')).toContainText('Lovely');
  await page.locator('[data-build="done"]').click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('louises-vet-office-v1')!),
  );
  const bad = structuredClone(saved);
  bad.town.households[0].remaining = -100;
  expect(new TownSimulation(visits).restore(bad.town)).toBe(false);
  await page.evaluate(
    (bad) => localStorage.setItem('louises-vet-office-v1', JSON.stringify(bad)),
    bad,
  );
  await page.reload();
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    saved.town.build,
  );
  await expect(page.getByTestId('coins')).toHaveText('4,300');
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await expect(page.locator('.build-price')).toContainText(
    '48 free floor tiles',
  );
  await expect(
    page.locator('[data-build="pick"][data-id="seat-5~2"]'),
  ).toContainText('3 available');
  await expect(
    page.locator('[data-build="pick"][data-id="wheel"]'),
  ).toContainText('2 available');
  await page.locator('[data-build="done"]').click();
  await page.reload();
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    saved.town.build,
  );
});

test('illustrated catalogue stacks all copies, explains availability, and keeps cards and camera controls separate', async ({
  page,
}, info) => {
  const mobile = info.project.name === 'mobile';
  await page.setViewportSize(
    mobile ? { width: 360, height: 640 } : { width: 1280, height: 720 },
  );
  await open(page, false, ['expansion', 'pet-room']);
  const cards = page.locator('.build-card');
  const names = await cards.locator('strong').allTextContents();
  expect(new Set(names).size).toBe(names.length);
  const chair = page.locator('.build-card[data-recipe="seat-5"]');
  await expect(chair).toHaveCount(0);
  await expect(cards).toHaveCount(0);
  await expect(page.locator('[data-build="move"]')).toHaveCount(0);
  await expect(page.locator('.build-list')).toContainText(
    'Tap furniture in the clinic',
  );
  await page.locator('[data-build="shop"]').click();
  const products = page.locator('.shop-card');
  await expect(products.locator('img')).toHaveCount(upgrades.length);
  // Decode every real portrait, including initially offscreen products.
  expect(
    await products.locator('img').evaluateAll(async (images) => {
      for (const image of images as HTMLImageElement[]) {
        image.loading = 'eager';
        await image.decode();
      }
      return images.every(
        (image) => (image as HTMLImageElement).naturalWidth === 256,
      );
    }),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath('illustrated-shop.png') });
  expect(
    await products.evaluateAll((cards) =>
      cards.every((card) => {
        const art = card.querySelector('.shop-art')!.getBoundingClientRect();
        const img = card.querySelector('img')!.getBoundingClientRect();
        const text = card.querySelector('small')!.getBoundingClientRect();
        return (
          img.top >= art.top - 1 &&
          img.bottom <= art.bottom + 1 &&
          img.right <= art.right + 1 &&
          art.bottom <= text.top
        );
      }),
    ),
  ).toBe(true);
  for (let i = 0; i < 2; i++)
    await page.locator('[data-upgrade="lounge-chair"]').click();
  await page.locator('[data-upgrade="wheel"]').click();
  await page.getByRole('button', { name: 'Close shop', exact: true }).click();
  await expect(chair).toHaveCount(1);
  await expect(chair).toContainText('2 available');
  await expect(cards.first()).toHaveAttribute('data-recipe', 'seat-5');
  await expect(cards.nth(1)).toHaveAttribute('data-recipe', 'wheel');
  await expect(cards.nth(1)).toContainText('1 available');
  const availability = await cards.evaluateAll((cards) =>
    cards.map((c) => Number((c as HTMLElement).dataset.available)),
  );
  expect(availability).toEqual([2, 1]);
  await expect(chair.locator('[data-build="pick"]')).toBeEnabled();
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
  await chair.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('illustrated-build.png') });

  // Every spare-item card has separate space for its picture and words. Its internal
  // list may scroll, but neither its contents nor fixed tools overlap each other.
  for (const size of mobile
    ? [
        { width: 360, height: 640 },
        { width: 412, height: 915 },
      ]
    : [
        { width: 1280, height: 720 },
        { width: 900, height: 550 },
      ]) {
    await page.setViewportSize(size);
    const errors = await page.evaluate(() => {
      const errors: string[] = [];
      for (const card of document.querySelectorAll<HTMLElement>(
        '.build-card',
      )) {
        const img = card.querySelector('img')!.getBoundingClientRect();
        const words = card
          .querySelector('.build-card-text')!
          .getBoundingClientRect();
        const pick = card
          .querySelector('[data-build="pick"]')!
          .getBoundingClientRect();
        if (
          img.right > words.left + 1 ||
          words.right > pick.right + 1 ||
          words.bottom > pick.bottom + 1
        )
          errors.push(card.dataset.recipe!);
      }
      const list = document
        .querySelector('.build-list')!
        .getBoundingClientRect();
      const tools = document
        .querySelector('.build-controls')!
        .getBoundingClientRect();
      const feedback = document
        .querySelector('#build-feedback')!
        .getBoundingClientRect();
      if (
        list.height < 85 ||
        tools.bottom > list.top ||
        list.bottom > feedback.top
      )
        errors.push('list space');
      if (
        document.documentElement.scrollHeight > innerHeight + 1 ||
        document.documentElement.scrollWidth > innerWidth + 1
      )
        errors.push('page overflow');
      return errors;
    });
    expect(errors, `layout at ${size.width} × ${size.height}`).toEqual([]);
    for (const selector of [
      '[data-build="done"]',
      '[data-build="shop"]',
      '[data-build="rotate"]',
      ...(mobile
        ? []
        : [
            '[data-action="clinic-rotate-left"]',
            '[data-action="clinic-rotate-right"]',
          ]),
    ]) {
      const box = (await page.locator(selector).boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(size.height + 1);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
    }
  }
  const before = await page.evaluate(() => window.buildTest.snapshot().build);
  const camera = await page.evaluate(() => window.buildTest.camera());
  if (mobile) {
    await expect(page.locator('#scene-controls')).toBeHidden();
    await chooseTool(page, 'camera');
    await touchCamera(page, 'orbit');
    const orbit = await page.evaluate(() => window.buildTest.camera());
    expect(orbit.position).not.toEqual(camera.position);
    expect(orbit.target).toEqual(camera.target);
    await touchCamera(page, 'pan-zoom');
    const moved = await page.evaluate(() => window.buildTest.camera());
    expect(moved.target).not.toEqual(orbit.target);
    expect(moved.zoom).toBeGreaterThan(orbit.zoom);
  } else {
    await page
      .getByRole('button', { name: 'Rotate clinic camera left', exact: true })
      .click();
    const left = await page.evaluate(() => window.buildTest.camera());
    expect(left.position).not.toEqual(camera.position);
    expect(left.target).toEqual(camera.target);
    expect(left.zoom).toBe(camera.zoom);
    await page
      .getByRole('button', { name: 'Rotate clinic camera right', exact: true })
      .click();
    const back = await page.evaluate(() => window.buildTest.camera());
    back.position.forEach((n, i) =>
      expect(n).toBeCloseTo(camera.position[i], 5),
    );
  }
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    before,
  );
  // Pick the actual chair in the scene; storing it adds a spare to the one card.
  await movePlaced(page, 'seat-7');
  await page.evaluate(() => window.buildTest.step(20));
  await expect(chair).toHaveCount(1);
  await page.locator('[data-build="store"]').click();
  await expect(chair).toContainText('3 available');
  await expect(chair).not.toContainText('placed');
});

test('room rectangles preview while held, connect automatically and survive camera gestures', async ({
  page,
}, info) => {
  const touch = info.project.name === 'mobile';
  if (touch) await page.setViewportSize({ width: 360, height: 640 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, false, []);
  const before = await page.evaluate(() => window.buildTest.snapshot().build);
  await page
    .locator('.build-list')
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  await chooseTool(page, 'room');
  await expect(page.locator('.space-guide')).toContainText(
    'Doors connect automatically',
  );
  expect(await page.locator('.build-list').evaluate((el) => el.scrollTop)).toBe(
    0,
  );
  await page.evaluate(() => window.buildTest.point(-8, 0, true));
  const points = await page.evaluate(() =>
    [
      [-11, -4],
      [-7, 1],
      [-5, 4],
    ].map(([x, z]) => window.buildTest.point(x, z)),
  );
  const client = touch ? await page.context().newCDPSession(page) : undefined;
  const move = async (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    p?: { x: number; y: number },
  ) => {
    if (client)
      await client.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: p ? [{ ...p, id: 1 }] : [],
      });
    else if (type === 'touchStart') {
      await page.mouse.move(p!.x, p!.y);
      await page.mouse.down();
    } else if (type === 'touchMove')
      await page.mouse.move(p!.x, p!.y, { steps: 5 });
    else await page.mouse.up();
  };
  await move('touchStart', points[0]);
  await move('touchMove', points[1]);
  await expect
    .poll(() => page.evaluate(() => window.buildTest.preview()))
    .toMatchObject({
      visible: true,
      width: 4,
      depth: 5,
      outlined: true,
      depthTest: false,
    });
  await move('touchMove', points[2]);
  await expect
    .poll(() => page.evaluate(() => window.buildTest.preview()))
    .toMatchObject({ visible: true, x: -8, z: 0, width: 6, depth: 8 });
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    before,
  );
  await expect(page.locator('#build-feedback')).toContainText('6 × 8 tiles');
  await page.screenshot({ path: info.outputPath('room-drag-held.png') });
  await move('touchEnd');
  await expect(page.locator('#build-feedback')).toContainText('ready');
  await expect(page.locator('[data-build="place"]')).toHaveCount(0);
  await expect(page.locator('[data-build="undo"]')).toBeEnabled();
  await expect(page.locator('[data-build="next-door"]')).toHaveCount(0);
  const released = await page.evaluate(() => window.buildTest.snapshot().build);
  if (touch) {
    const camera = await page.evaluate(() => window.buildTest.camera());
    await touchCamera(page, 'pan-zoom');
    const moved = await page.evaluate(() => window.buildTest.camera());
    expect(moved.zoom).toBeGreaterThan(camera.zoom);
    expect(moved.target).not.toEqual(camera.target);
    await touchCamera(page, 'twist');
    expect(
      (await page.evaluate(() => window.buildTest.camera())).position,
    ).not.toEqual(moved.position);
  }
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    released,
  );
  let built = await page.evaluate(() => window.buildTest.snapshot().build);
  expect(built.tiles.length).toBe(before.tiles.length + 48);
  expect(built.doors).toHaveLength(1);
  expect(built.walls.length).toBeGreaterThan(0);
  await expect(page.locator('.build-price')).toContainText('4856 coins');
  const changedAt = await page.evaluate(() => {
    window.buildTest.step(0);
    return performance.now();
  });
  await expect
    .poll(() => page.evaluate(() => window.buildTest.scenery().renderedAt))
    .toBeGreaterThan(changedAt);
  expect(await page.evaluate(() => window.buildTest.scenery())).toMatchObject({
    doors: 1,
    hints: 0,
  });
  expect(
    await page.evaluate(() => window.buildTest.scenery().walls),
  ).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.buildTest.preview().visible)).toBe(
    false,
  );
  await page.screenshot({ path: info.outputPath('room-built.png') });
  await chooseTool(page, 'door');
  const door = built.doors[0];
  await tap(
    page,
    door.x + (door.axis === 'x' ? 0.5 : 0),
    door.z + (door.axis === 'z' ? 0.5 : 0),
    touch,
  );
  await expect(page.locator('[data-build="place"]')).toHaveText(
    'Close doorway',
  );
  await page.locator('[data-build="place"]').click();
  await expect(page.locator('#build-feedback')).toContainText(
    'Connect every space',
  );
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    built,
  );
  await tap(page, -5, -2.5, touch);
  await expect(page.locator('[data-build="place"]')).toHaveText(
    'Place doorway',
  );
  await page.locator('[data-build="place"]').click();
  await expect(page.locator('#build-feedback')).toContainText(
    'Entrance updated',
  );
  expect(
    await page.evaluate(() => window.buildTest.snapshot().build.doors),
  ).toHaveLength(2);
  await tap(page, door.x, door.z + 0.5, touch);
  await page.locator('[data-build="place"]').click();
  await expect(page.locator('#build-feedback')).toContainText(
    'Entrance updated',
  );
  expect(
    await page.evaluate(() => window.buildTest.snapshot().build.doors),
  ).toHaveLength(1);
  await page.locator('[data-build="door-mode"][data-value="wall"]').click();
  await tap(page, door.x, door.z + 0.5, touch);
  await expect(page.locator('[data-build="place"]')).toHaveText('Remove wall');
  await page.locator('[data-build="place"]').click();
  await expect(page.locator('#build-feedback')).toContainText(
    'Entrance updated',
  );
  built = await page.evaluate(() => window.buildTest.snapshot().build);
  expect(
    built.walls.some(
      (e) => e.axis === door.axis && e.x === door.x && e.z === door.z,
    ),
  ).toBe(false);
  await expect(page.locator('.build-price')).toContainText('4856 coins');
  await page.locator('[data-build="cancel"]').click();
  expect(
    await page.evaluate(() => window.buildTest.scenery().hints),
  ).toBeGreaterThan(0);
  await page.locator('[data-build="done"]').click();
  await page.reload();
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    built,
  );
  expect(errors).toEqual([]);
});

test('interrupted drawing and cancelled invalid plans keep the clinic and coins unchanged', async ({
  page,
}, info) => {
  const touch = info.project.name === 'mobile';
  await open(page, false, []);
  const before = await page.evaluate(() => window.buildTest.snapshot().build);
  await chooseTool(page, 'garden');
  await page.evaluate(() => window.buildTest.point(-8, 0, true));
  const [a, b] = await page.evaluate(() =>
    [
      [-11, -4],
      [-5, 4],
    ].map(([x, z]) => window.buildTest.point(x, z)),
  );
  if (touch) {
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...a, id: 1 }],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ ...b, id: 1 }],
    });
    await expect
      .poll(() => page.evaluate(() => window.buildTest.preview().width))
      .toBe(6);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchCancel',
      touchPoints: [],
    });
  } else {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 5 });
    await expect
      .poll(() => page.evaluate(() => window.buildTest.preview().width))
      .toBe(6);
    await page.keyboard.press('Escape');
    await page.mouse.up();
  }
  expect(await page.evaluate(() => window.buildTest.preview().visible)).toBe(
    false,
  );
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    before,
  );
  await page.locator('[data-build="boundary"][data-value="open"]').click();
  await tap(page, 9, 2, touch);
  await tap(page, 11, 4, touch);
  await expect(page.locator('#build-feedback')).toContainText('greenspace');
  await expect(page.locator('.space-guide h3')).toHaveText('Check your plan');
  expect(await page.evaluate(() => window.buildTest.preview().color)).toBe(
    0xd36f58,
  );
  await expect(page.locator('[data-build="place"]')).toHaveCount(0);
  await page.locator('[data-build="cancel"]').click();
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    before,
  );
  await expect(page.locator('.build-price')).toContainText('5000 coins');
});

test('space modes show Garden prefabs and Undo refunds consecutive builds without confirmation', async ({
  page,
}, info) => {
  const touch = info.project.name === 'mobile';
  if (touch) await page.setViewportSize({ width: 360, height: 640 });
  await open(page, false, []);
  await expect(
    page.locator('[data-build="mode"][data-value="items"]'),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.locator('[data-build="tool"][data-value="garden"]'),
  ).toHaveCount(0);
  await page.locator('[data-build="shop"]').click();
  await page.locator('[data-upgrade="expansion"]').click();
  await page.getByRole('button', { name: 'Close shop', exact: true }).click();
  const before = await page.evaluate(() => window.buildTest.snapshot().build);
  const coins = Number(
    (await page.getByTestId('coins').textContent())!.replaceAll(',', ''),
  );
  expect(before.credits).toBe(48);
  await chooseTool(page, 'garden');
  await expect(
    page.locator('[data-build="mode"][data-value="spaces"]'),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-build="pick"]')).toHaveCount(0);
  await expect(page.locator('[data-build="place"]')).toHaveCount(0);
  await expect(page.locator('.prefab-grid > article')).toHaveCount(2);
  await expect(
    page.locator('.prefab-grid [data-prefab="sun-courtyard"]'),
  ).toBeVisible();
  await expect(
    page.locator('.prefab-grid [data-prefab="pet-room"]'),
  ).toBeVisible();
  // Both garden pictures are actually in the list's visible area, not buried below help.
  const originalSize = page.viewportSize()!;
  for (const size of touch
    ? [originalSize, { width: 844, height: 390 }]
    : [originalSize]) {
    await page.setViewportSize(size);
    const visible = await page
      .locator('.prefab-grid img')
      .evaluateAll((images) => {
        const list = document
          .querySelector('.build-list')!
          .getBoundingClientRect();
        return images.every((img) => {
          const r = img.getBoundingClientRect();
          return r.top >= list.top && r.bottom <= list.bottom + 1;
        });
      });
    expect(visible).toBe(true);
  }
  await page.setViewportSize(originalSize);
  await expect(
    page.locator('.build-controls [data-build="undo"] svg'),
  ).toHaveCount(1);
  await expect(
    page.locator('.build-controls [data-value="erase"] svg'),
  ).toHaveCount(1);
  await expect(page.locator('.space-options')).toContainText('Interior');
  await expect(page.locator('.space-options')).toContainText('Exterior');
  await expect(page.locator('.space-options')).not.toContainText(
    /With walls|Open space/,
  );
  await page.screenshot({
    path: info.outputPath('garden-prefabs-and-controls.png'),
  });
  await chooseTool(page, 'room');
  await tap(page, -11, -4, touch);
  await tap(page, -5, 4, touch);
  await expect(page.locator('[data-build="undo"]')).toBeEnabled();
  const first = await page.evaluate(() => window.buildTest.snapshot().build);
  expect(first.tiles.length).toBe(before.tiles.length + 48);
  expect(first.credits).toBe(0);
  expect(first.doors).toHaveLength(1);
  await expect(page.getByTestId('coins')).toHaveText(coins.toLocaleString());
  // The following space uses coins, and must keep its new doorway when saved.
  await chooseTool(page, 'garden');
  await tap(page, -11, -3, touch);
  await tap(page, -15, 3, touch);
  await expect(page.getByTestId('coins')).toHaveText(
    (coins - 72).toLocaleString(),
  );
  const second = await page.evaluate(() => window.buildTest.snapshot().build);
  expect(second.tiles.length).toBe(first.tiles.length + 24);
  await page.screenshot({ path: info.outputPath('released-space-built.png') });
  await chooseTool(page, 'camera');
  await expect(page.locator('[data-build="store"]')).toHaveCount(0);
  if (touch) await touchCamera(page, 'pan-zoom');
  await page.locator('[data-build="undo"]').click();
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    first,
  );
  await expect(page.getByTestId('coins')).toHaveText(coins.toLocaleString());
  if (touch) await page.locator('[data-build="undo"]').click();
  else await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    before,
  );
  await expect(page.locator('[data-build="undo"]')).toBeDisabled();
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('coins')).toHaveText(coins.toLocaleString());
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('louises-vet-office-v1')!).town.build,
    ),
  ).toEqual(before);
  // Prefabs use the same undo history, including restored credits.
  await chooseTool(page, 'garden');
  const picture = page.locator('[data-prefab="sun-courtyard"] img');
  if (touch) await picture.tap();
  else await picture.click();
  await tap(page, -8, 0, touch);
  await expect(page.locator('[data-build="undo"]')).toBeEnabled();
  expect(
    (await page.evaluate(() => window.buildTest.snapshot().build)).credits,
  ).toBe(0);
  await page.locator('[data-build="undo"]').click();
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    before,
  );
  await page.locator('[data-build="done"]').click();
  await page.reload();
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    before,
  );
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await chooseTool(page, 'room');
  await expect(page.locator('[data-build="undo"]')).toBeDisabled();
});

test('a second finger interrupts drawing and the remaining finger cannot build accidentally', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'Real multi-touch input');
  await page.setViewportSize({ width: 360, height: 640 });
  await open(page, false, []);
  const before = await page.evaluate(() => window.buildTest.snapshot().build);
  await chooseTool(page, 'room');
  await page.evaluate(() => window.buildTest.point(-8, 0, true));
  const [a, b] = await page.evaluate(() =>
    [
      [-11, -4],
      [-7, 1],
    ].map(([x, z]) => window.buildTest.point(x, z)),
  );
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...a, id: 1 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ ...b, id: 1 }],
  });
  expect(await page.evaluate(() => window.buildTest.preview().visible)).toBe(
    true,
  );
  const other = { x: b.x + 45, y: b.y - 30, id: 2 };
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ ...b, id: 1 }, other],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: b.x - 20, y: b.y, id: 1 },
      { ...other, x: other.x + 20 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [{ ...b, id: 1 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: b.x + 20, y: b.y + 20, id: 1 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await cdp.detach();
  expect(await page.evaluate(() => window.buildTest.preview().visible)).toBe(
    false,
  );
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    before,
  );
  await expect(page.locator('.space-guide h3')).toHaveText('Floor shapes');
  await tap(page, -11, -4, true);
  await tap(page, -5, 4, true);
  await expect(page.locator('[data-build="undo"]')).toBeEnabled();
});

test('pictured prefabs drag into a snapped connected room and remain editable after reload', async ({
  page,
}, info) => {
  const touch = info.project.name === 'mobile';
  if (touch) await page.setViewportSize({ width: 360, height: 640 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, false, []);
  await page.locator('[data-build="shop"]').click();
  await page.locator('[data-upgrade="expansion"]').click();
  await page.getByRole('button', { name: 'Close shop', exact: true }).click();
  const coins = (await page.locator('.build-price').innerText()).match(
    /^\d+ coins/,
  )![0];
  const before = await page.evaluate(() => window.buildTest.snapshot().build);
  // An unused room kit leads its surface's prefab list in Build spaces.
  await chooseTool(page, 'room');
  const picture = page.locator('[data-prefab="expansion"] img');
  await picture.scrollIntoViewIfNeeded();
  await expect(picture).toBeVisible();
  expect(
    await picture.evaluate(
      (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
    ),
  ).toBe(true);
  await page.evaluate(() => window.buildTest.point(-8, 0, true));
  const box = (await picture.boundingBox())!,
    a = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  // Drop a little away from the wall: the plan snaps into the adjoining edge.
  const end = await page.evaluate(() => window.buildTest.point(-9, 0));
  const cdp = touch ? await page.context().newCDPSession(page) : undefined;
  if (cdp) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...a, id: 1 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ ...end, id: 1 }],
    });
  } else {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
  }
  await expect
    .poll(() => page.evaluate(() => window.buildTest.preview()))
    .toMatchObject({
      visible: true,
      x: -8,
      z: 0,
      width: 6,
      depth: 8,
      color: 0x76b873,
    });
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    before,
  );
  await page.screenshot({ path: info.outputPath('prefab-drag-held.png') });
  if (cdp) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await cdp.detach();
  } else await page.mouse.up();
  await expect(page.locator('#build-feedback')).toContainText('ready');
  const built = await page.evaluate(() => window.buildTest.snapshot().build);
  expect(built.tiles.length).toBe(before.tiles.length + 48);
  expect(built.doors).toHaveLength(1);
  await expect(page.locator('.build-price')).toContainText(coins);
  await page.screenshot({ path: info.outputPath('prefab-built.png') });
  await page.locator('[data-build="done"]').click();
  await page.reload();
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    built,
  );
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await chooseTool(page, 'door');
  await tap(page, -5, -2.5, touch);
  await page.locator('[data-build="place"]').click();
  expect(
    (await page.evaluate(() => window.buildTest.snapshot().build)).doors,
  ).toHaveLength(2);
  expect(errors).toEqual([]);
});

test('prefab cards support tap placement, rotation, invalid retries and outside-drop cancellation', async ({
  page,
}, info) => {
  const touch = info.project.name === 'mobile';
  if (touch) await page.setViewportSize({ width: 360, height: 640 });
  await open(page, false, []);
  const before = await page.evaluate(() => window.buildTest.snapshot().build);
  await chooseTool(page, 'room');
  const picture = page.locator('[data-prefab="expansion"] img');
  await picture.scrollIntoViewIfNeeded();
  if (touch) await picture.tap();
  else await picture.click();
  await expect(page.locator('.space-guide h3')).toHaveText('Waiting room');
  await page.locator('[data-build="rotate"]').click();
  expect(await page.evaluate(() => window.buildTest.preview())).toMatchObject({
    width: 8,
    depth: 6,
  });
  await tap(page, 0, 0, touch);
  await expect(page.locator('[data-build="place"]')).toBeDisabled();
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    before,
  );
  if (touch) {
    await touchCamera(page, 'pan-zoom');
    await expect(page.locator('.space-guide h3')).toHaveText('Waiting room');
    expect(
      await page.evaluate(() => window.buildTest.snapshot().build),
    ).toEqual(before);
  }
  await page.locator('[data-build="cancel"]').click();
  await picture.scrollIntoViewIfNeeded();
  const box = (await picture.boundingBox())!,
    start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const outside = { x: 20, y: 20 };
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...start, id: 1 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ ...outside, id: 1 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(outside.x, outside.y, { steps: 8 });
    await page.mouse.up();
  }
  expect(await page.evaluate(() => window.buildTest.preview().visible)).toBe(
    false,
  );
  await expect(page.locator('.space-guide h3')).toHaveText('Floor shapes');
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    before,
  );
  await chooseTool(page, 'garden');
  const garden = page.locator('[data-prefab="sun-courtyard"] img');
  await garden.scrollIntoViewIfNeeded();
  if (touch) await garden.tap();
  else await garden.click();
  await tap(page, -8, 0, touch);
  await expect(page.locator('#build-feedback')).toContainText('ready');
  const built = await page.evaluate(() => window.buildTest.snapshot().build);
  expect(built.tiles.length).toBe(before.tiles.length + 48);
  expect(built.doors).toHaveLength(1);
  expect(built.tiles.filter((t) => t.surface === 'garden')).toHaveLength(48);
  await expect(page.locator('.build-price')).toContainText('4856 coins');
  await page.screenshot({ path: info.outputPath('prefab-garden.png') });
});

test('adjoining rectangles keep their anchor and full footprint through dragging, doors and reload', async ({
  page,
}, info) => {
  const touch = info.project.name === 'mobile';
  if (touch) await page.setViewportSize({ width: 360, height: 640 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, false, []);
  await chooseTool(page, 'room');
  const picture = page.locator('[data-prefab="expansion"] img');
  await picture.scrollIntoViewIfNeeded();
  if (touch) await picture.tap();
  else await picture.click();
  await page.locator('[data-build="place"]').click();
  const original = await page.evaluate(() => window.buildTest.snapshot().build);
  const cdp = touch ? await page.context().newCDPSession(page) : undefined;
  const input = async (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    p?: { x: number; y: number },
  ) => {
    if (cdp)
      await cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: p ? [{ ...p, id: 1 }] : [],
      });
    else if (type === 'touchStart') {
      await page.mouse.move(p!.x, p!.y);
      await page.mouse.down();
    } else if (type === 'touchMove')
      await page.mouse.move(p!.x, p!.y, { steps: 5 });
    else await page.mouse.up();
  };
  // Deliberately start/end slightly outside the existing edge, in all four
  // directions. These are pointer positions, not pre-snapped grid coordinates.
  for (const [start, end] of [
    [
      [-11.65, -3],
      [-15, 3],
    ],
    [
      [-15, 3],
      [-11.65, -3],
    ],
    [
      [-11.65, 3],
      [-15, -3],
    ],
    [
      [-15, -3],
      [-11.65, 3],
    ],
  ]) {
    await chooseTool(page, 'garden');
    await page.evaluate(() => window.buildTest.point(-13, 0, true));
    const camera = await page.evaluate(() => window.buildTest.camera());
    const points = await page.evaluate(
      ({ start, end }) =>
        [start, end].map(([x, z]) => window.buildTest.point(x, z)),
      { start, end },
    );
    await input('touchStart', points[0]);
    await expect
      .poll(() => page.evaluate(() => window.buildTest.preview()))
      .toMatchObject({ visible: true, width: 0.18, depth: 0.18 });
    if (start[0] === -11.65 && start[1] === -3) {
      const first = await page.evaluate(() =>
        window.buildTest.point(-12.2, -2),
      );
      await input('touchMove', first);
      await expect
        .poll(() => page.evaluate(() => window.buildTest.preview()))
        .toMatchObject({ x: -11.5, z: -2.5, width: 1, depth: 1 });
    }
    await input('touchMove', points[1]);
    await expect
      .poll(() => page.evaluate(() => window.buildTest.preview()))
      .toMatchObject({
        visible: true,
        x: -13,
        z: 0,
        width: 4,
        depth: 6,
        color: 0x76b873,
      });
    expect(await page.evaluate(() => window.buildTest.camera())).toEqual(
      camera,
    );
    expect(await page.evaluate(() => window.buildTest.scenery().hints)).toBe(1);
    expect(
      await page.evaluate(() => window.buildTest.snapshot().build),
    ).toEqual(original);
    await input('touchEnd');
    await expect(page.locator('[data-build="undo"]')).toBeEnabled();
    await page.locator('[data-build="undo"]').click();
    expect(
      await page.evaluate(() => window.buildTest.snapshot().build),
    ).toEqual(original);
  }
  // Intentionally overlap a whole row: keep every requested tile and open the
  // existing wall, rather than placing a new wall through the older floor.
  await chooseTool(page, 'garden');
  await page.evaluate(() => window.buildTest.point(-13, 0, true));
  const [start, mid, end] = await page.evaluate(() =>
    [
      [-10, -3],
      [-12, 0],
      [-15, 3],
    ].map(([x, z]) => window.buildTest.point(x, z)),
  );
  await input('touchStart', start);
  await input('touchMove', mid);
  await expect
    .poll(() => page.evaluate(() => window.buildTest.preview()))
    .toMatchObject({
      x: -11,
      z: -1.5,
      width: 2,
      depth: 3,
      color: 0x76b873,
    });
  await input('touchMove', end);
  await expect
    .poll(() => page.evaluate(() => window.buildTest.preview()))
    .toMatchObject({
      x: -12.5,
      z: 0,
      width: 5,
      depth: 6,
      color: 0x76b873,
    });
  // Check a rendered frame while still holding the pointer, not just the
  // updated scene graph before the software renderer presents that frame.
  const changedAt = await page.evaluate(() => performance.now());
  await expect
    .poll(() => page.evaluate(() => window.buildTest.scenery().renderedAt))
    .toBeGreaterThan(changedAt);
  await page.screenshot({
    path: info.outputPath('adjoining-overlap-held.png'),
  });
  await input('touchEnd');
  await cdp?.detach();
  await expect(page.locator('[data-build="undo"]')).toBeEnabled();
  const built = await page.evaluate(() => window.buildTest.snapshot().build);
  expect(built.tiles.length).toBe(original.tiles.length + 24);
  expect(built.doors.some((d) => d.axis === 'z' && d.x === -11)).toBe(true);
  expect(built.walls.some((d) => d.axis === 'z' && d.x === -10)).toBe(false);
  for (const tile of original.tiles)
    expect(built.tiles.find((t) => t.x === tile.x && t.z === tile.z)).toEqual(
      tile,
    );
  await expect(page.locator('.build-price')).toContainText('4784 coins');
  await page.screenshot({
    path: info.outputPath('adjoining-overlap-built.png'),
  });
  await page.locator('[data-build="done"]').click();
  await page.reload();
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    built,
  );
  expect(errors).toEqual([]);
});

test('a migrated room accepts north and south additions with automatic connecting doors', async ({
  page,
}, info) => {
  const touch = info.project.name === 'mobile';
  await open(page, false, ['expansion']);
  const original = await page.evaluate(() => window.buildTest.snapshot().build);
  await chooseTool(page, 'room');
  // Start one old row inside the room, then grow north using two corner taps.
  await tap(page, -10, -3, touch);
  await tap(page, -6, -8, touch);
  await expect(page.locator('[data-build="undo"]')).toBeEnabled();
  // Reverse the direction and end slightly short of the south edge.
  await tap(page, -6, 7, touch);
  await tap(page, -10, 4.65, touch);
  await expect(page.locator('[data-build="undo"]')).toBeEnabled();
  const built = await page.evaluate(() => window.buildTest.snapshot().build);
  expect(built.tiles.length).toBe(original.tiles.length + 28);
  expect(built.doors.some((d) => d.axis === 'x' && d.z === -4)).toBe(true);
  expect(built.doors.some((d) => d.axis === 'x' && d.z === 4)).toBe(true);
  await expect(page.locator('.build-price')).toContainText('4916 coins');
});

test('Undo reverses door and erase edits but never removes later purchases or placed furniture', async ({
  page,
}, info) => {
  const touch = info.project.name === 'mobile';
  await open(page, false, []);
  const original = await page.evaluate(() => window.buildTest.snapshot().build);
  await chooseTool(page, 'room');
  await tap(page, -11, -4, touch);
  await tap(page, -5, 4, touch);
  await expect(page.locator('[data-build="undo"]')).toBeEnabled();
  const room = await page.evaluate(() => window.buildTest.snapshot().build);
  await chooseTool(page, 'door');
  await tap(page, -5, -2.5, touch);
  await page.locator('[data-build="place"]').click();
  expect(
    (await page.evaluate(() => window.buildTest.snapshot().build)).doors,
  ).toHaveLength(2);
  await page.locator('[data-build="undo"]').click();
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    room,
  );
  await chooseTool(page, 'erase');
  await tap(page, -11, -4, touch);
  await tap(page, -10, 4, touch);
  // Erasing still reviews the marked floor before removal.
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    room,
  );
  await expect(page.locator('[data-build="place"]')).toHaveText('Remove floor');
  await page.locator('[data-build="place"]').click();
  expect(
    (await page.evaluate(() => window.buildTest.snapshot().build)).tiles,
  ).toHaveLength(room.tiles.length - 8);
  await expect(page.getByTestId('coins')).toHaveText('4,856');
  await page.locator('[data-build="undo"]').click();
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    room,
  );
  await page.locator('[data-build="undo"]').click();
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    original,
  );
  await expect(page.getByTestId('coins')).toHaveText('5,000');
  await chooseTool(page, 'room');
  if (touch) {
    await tap(page, -11, -4, true);
    await tap(page, -5, 4, true);
  } else {
    for (const [x, z] of [
      [-11, -4],
      [-5, 4],
    ]) {
      const p = await page.evaluate(
        ({ x, z }) => window.buildTest.point(x, z, true),
        { x, z },
      );
      await page.mouse.move(p.x, p.y);
      await page.keyboard.press('c');
    }
  }
  await expect(page.locator('[data-build="undo"]')).toBeEnabled();
  // Use the global Shop entry, not just the editor's button: both must end history.
  await page.getByRole('button', { name: /Clinic shop/ }).click();
  await page.locator('[data-upgrade="lounge-chair"]').click();
  await page.getByRole('button', { name: 'Close shop', exact: true }).click();
  await expect(page.locator('[data-build="undo"]')).toBeDisabled();
  const purchased = await page.evaluate(
    () => window.buildTest.snapshot().build,
  );
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    purchased,
  );
  await expect(page.getByTestId('coins')).toHaveText('4,811');
  await chooseTool(page, 'items');
  await page
    .locator('.build-card[data-recipe="seat-5"] [data-build="pick"]')
    .click();
  await tap(page, -8, 0, touch);
  await expect(page.locator('#build-feedback')).toContainText('Lovely');
  const furnished = await page.evaluate(
    () => window.buildTest.snapshot().build,
  );
  await chooseTool(page, 'garden');
  await tap(page, -11, -3, touch);
  await tap(page, -15, 3, touch);
  await expect(page.getByTestId('coins')).toHaveText('4,739');
  await page.locator('[data-build="undo"]').click();
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    furnished,
  );
  await expect(page.getByTestId('coins')).toHaveText('4,811');
});

test('unaffordable releases stay unbuilt and can be redrawn directly', async ({
  page,
}, info) => {
  const touch = info.project.name === 'mobile';
  await open(page, false, [], false, [], 0);
  const before = await page.evaluate(() => window.buildTest.snapshot().build);
  await chooseTool(page, 'room');
  await tap(page, -11, -4, touch);
  await tap(page, -5, 4, touch);
  await expect(page.locator('#build-feedback')).toContainText('144 coins');
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    before,
  );
  await expect(page.locator('[data-build="place"]')).toHaveCount(0);
  await expect(page.locator('[data-build="undo"]')).toBeDisabled();
  // Replace the red rejected rectangle without a confirmation/cancel round trip.
  await tap(page, -6, -1, touch);
  await tap(page, -5, 1, touch);
  await expect(page.locator('#build-feedback')).toContainText('6 coins');
  expect(await page.evaluate(() => window.buildTest.preview().color)).toBe(
    0xd36f58,
  );
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    before,
  );
  await expect(page.getByTestId('coins')).toHaveText('0');
  await page.locator('[data-build="cancel"]').click();
  expect(await page.evaluate(() => window.buildTest.preview().visible)).toBe(
    false,
  );
});
