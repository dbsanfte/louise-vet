import { expect, test, type Page } from '@playwright/test';
import { build } from 'vite';
import { TownSimulation } from '../src/town-simulation';
import { visits, upgrades, type UpgradeId } from '../src/game';
import { touchCamera } from './touch-camera';
import { furnitureType } from '../src/clinic-build';
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
    ({ town, owned }) => {
      if (!localStorage.getItem('louises-vet-office-v1'))
        localStorage.setItem(
          'louises-vet-office-v1',
          JSON.stringify({
            version: 1,
            coins: 5000,
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
    { town: legacy ? legacyTown : town, owned: items },
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
  const items = (await page.evaluate(() => window.buildTest.snapshot())).build
    .items;
  const type = furnitureType(items.find((i) => i.id === id)!.recipe);
  const copies = items.filter(
    (i) => furnitureType(i.recipe) === type && i.placement,
  );
  for (let n = 0; n < copies.length; n++) {
    await page.locator(`[data-build="move"][data-recipe="${type}"]`).click();
    if (await page.evaluate((id) => window.buildTest.selection() === id, id))
      return;
    await page.evaluate(() => window.buildTest.step(45));
  }
  throw new Error(`Could not select the placed copy ${id}`);
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
  const kits = page.locator('.build-room-kit');
  await expect(kits).toHaveCount(4);
  await expect(page.locator('.build-list > article').nth(0)).toHaveAttribute(
    'data-kit',
    'expansion',
  );
  await expect(page.locator('.build-list > article').nth(3)).toHaveAttribute(
    'data-kit',
    'sun-courtyard',
  );
  await expect(page.locator('.build-list > article').nth(4)).toHaveAttribute(
    'data-recipe',
    'seat-5',
  );
  const before = await page.evaluate(() => window.buildTest.snapshot().build);
  await kits.locator('[data-id="expansion"]').click();
  await expect(
    page.locator('[data-build="tool"][data-value="room"]'),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-build="tool"][data-value="items"]').click();
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
  await expect(page.locator('.build-room-kit')).toHaveCount(4);
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
      await page.locator('[data-build="tool"][data-value="garden"]').click();
      await page.locator('[data-build="boundary"][data-value="open"]').click();
      await tap(page, -12, -3, info.project.name === 'mobile');
      await tap(page, -12, -1, info.project.name === 'mobile');
      await page.locator('[data-build="place"]').click();
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
  await page.locator('[data-build="tool"][data-value="garden"]').click();
  await page.locator('[data-build="boundary"][data-value="open"]').click();
  await tap(page, -18, -7, touch);
  await tap(page, -18, 0, touch);
  await page.locator('[data-build="place"]').click();
  await expect(page.locator('#build-feedback')).toContainText('ready');
  let state = await page.evaluate(() => window.buildTest.snapshot().build);
  expect(
    state.tiles
      .filter((t) => t.x === -18 && t.z >= -7 && t.z <= -1)
      .every((t) => t.surface === 'garden'),
  ).toBe(true);
  await page.locator('[data-build="tool"][data-value="room"]').click();
  await page.locator('[data-build="boundary"][data-value="open"]').click();
  await tap(page, -18, -7, touch);
  await tap(page, -18, 0, touch);
  await page.locator('[data-build="place"]').click();
  state = await page.evaluate(() => window.buildTest.snapshot().build);
  expect(
    state.tiles
      .filter((t) => t.x === -18 && t.z >= -7 && t.z <= -1)
      .every((t) => t.surface === 'room'),
  ).toBe(true);
  await page.locator('[data-build="tool"][data-value="items"]').click();
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
  await expect(chair).toHaveCount(1);
  await expect(chair).toContainText('0 available');
  await expect(chair).toContainText('3 placed');
  await expect(chair.locator('[data-build="pick"]')).toBeDisabled();
  await expect(chair.locator('[data-build="move"]')).toBeEnabled();
  await expect(page.locator('.build-card[data-recipe="wheel"]')).toHaveCount(0);
  const ownedTypes = await page.evaluate(() =>
    window.buildTest.snapshot().build!.items.map((item) => item.recipe),
  );
  expect(
    await cards.evaluateAll((cards) =>
      cards.map((c) => (c as HTMLElement).dataset.recipe).sort(),
    ),
  ).toEqual([...new Set(ownedTypes.map(furnitureType))].sort());

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
  expect(availability.slice(2).every((count) => count === 0)).toBe(true);
  await expect(chair.locator('[data-build="pick"]')).toBeEnabled();
  await expect(page.locator('#toast')).not.toHaveClass(/show/);
  await chair.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('illustrated-build.png') });

  // Every card's image, words and move button have their own space. Its internal
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
        const move = card
          .querySelector('[data-build="move"]')
          ?.getBoundingClientRect();
        if (
          img.right > words.left + 1 ||
          words.right > pick.right + 1 ||
          words.bottom > pick.bottom + 1 ||
          (move && pick.bottom > move.top + 1)
        )
          errors.push(card.dataset.recipe!);
      }
      const list = document
        .querySelector('.build-list')!
        .getBoundingClientRect();
      const tools = document
        .querySelector('.build-tools')!
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
    await page.locator('[data-build="tool"][data-value="camera"]').click();
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
  // The non-pointer Move placed action can reach every existing chair without
  // duplicating catalogue rows or showing internal instance numbers.
  await movePlaced(page, 'seat-7');
  await page.evaluate(() => window.buildTest.step(20));
  await expect(chair).toHaveCount(1);
  await page.locator('[data-build="store"]').click();
  await expect(chair).toContainText('3 available');
  await expect(chair).toContainText('2 placed');
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
  await page.locator('[data-build="tool"][data-value="room"]').click();
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
  await expect(page.locator('.space-guide h3')).toHaveText('Ready to build');
  await expect(page.locator('[data-build="place"]')).toBeEnabled();
  await expect(page.locator('[data-build="next-door"]')).toHaveCount(0);
  await expect(page.locator('.build-nudges')).toBeHidden();
  expect(await page.evaluate(() => window.buildTest.scenery().hints)).toBe(1);
  const planned = await page.evaluate(() => window.buildTest.preview());
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
  expect(await page.evaluate(() => window.buildTest.preview())).toEqual(
    planned,
  );
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    before,
  );
  await expect(page.locator('[data-build="place"]')).toBeEnabled();
  await page.screenshot({ path: info.outputPath('room-door-plan.png') });
  await page.locator('[data-build="place"]').click();
  await expect(page.locator('#build-feedback')).toContainText('ready');
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
  await page.locator('[data-build="tool"][data-value="door"]').click();
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
  await page.locator('[data-build="tool"][data-value="garden"]').click();
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
  await expect(page.locator('[data-build="place"]')).toBeDisabled();
  await page.locator('[data-build="cancel"]').click();
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    before,
  );
  await expect(page.locator('.build-price')).toContainText('5000 coins');
});

test('tapping outside a proposed floor cancels it without spending and allows a new plan', async ({
  page,
}, info) => {
  const touch = info.project.name === 'mobile';
  await open(page, false, []);
  const before = await page.evaluate(() => window.buildTest.snapshot().build);
  await page.locator('[data-build="tool"][data-value="room"]').click();
  await tap(page, -11, -4, touch);
  await tap(page, -5, 4, touch);
  await expect(page.locator('.space-guide h3')).toHaveText('Ready to build');
  await tap(page, 1, 1, touch);
  await expect(page.locator('.space-guide h3')).toHaveText(
    'Draw or drop a space',
  );
  expect(await page.evaluate(() => window.buildTest.preview().visible)).toBe(
    false,
  );
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    before,
  );
  await expect(page.locator('.build-price')).toContainText('5000 coins');
  await tap(page, -11, -4, touch);
  await tap(page, -5, 4, touch);
  await expect(page.locator('[data-build="place"]')).toBeEnabled();
  await page.locator('[data-build="place"]').click();
  expect(
    (await page.evaluate(() => window.buildTest.snapshot().build)).tiles.length,
  ).toBe(before.tiles.length + 48);
});

test('a second finger interrupts drawing and the remaining finger cannot build accidentally', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'Real multi-touch input');
  await page.setViewportSize({ width: 360, height: 640 });
  await open(page, false, []);
  const before = await page.evaluate(() => window.buildTest.snapshot().build);
  await page.locator('[data-build="tool"][data-value="room"]').click();
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
  await expect(page.locator('.space-guide h3')).toHaveText(
    'Draw or drop a space',
  );
  await tap(page, -11, -4, true);
  await tap(page, -5, 4, true);
  await expect(page.locator('[data-build="place"]')).toBeEnabled();
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
  // An unused room kit leads the collection and can be dragged directly.
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
  await page.locator('[data-build="tool"][data-value="door"]').click();
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
  await page.locator('[data-build="tool"][data-value="room"]').click();
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
  await expect(page.locator('.space-guide h3')).toHaveText(
    'Draw or drop a space',
  );
  expect(await page.evaluate(() => window.buildTest.snapshot().build)).toEqual(
    before,
  );
  await page.locator('[data-build="tool"][data-value="garden"]').click();
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
