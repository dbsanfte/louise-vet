import { expect, test, type Page } from '@playwright/test';
import { build } from 'vite';
import { TownSimulation } from '../src/town-simulation';
import { visits, upgrades, type UpgradeId } from '../src/game';
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
) {
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic(
    busy
      ? ['Luna', 'Milo', 'Peanut', 'Pico'].map((n) =>
          visits.findIndex((v) => v.name === n),
        )
      : [],
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
test('fresh clinics and unbuilt room kits have no doors standing outside the building', async ({
  page,
}, info) => {
  await open(page, false, []);
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
  expect(await visibleDoors(page)).toEqual([[-5.14, 0]]);
  await page.reload();
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  expect(await visibleDoors(page)).toEqual([[-5.14, 0]]);
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
  await page.locator('[data-build="pick"][data-id="plant-0"]').click();
  await page.evaluate(() => window.buildTest.step(20));
  await expect(page.locator('[data-build="store"]')).toBeEnabled();
  await page.locator('[data-build="store"]').click();
  await expect(
    page.locator('[data-build="pick"][data-id="plant-0"]'),
  ).toContainText('Stored');
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
  await tap(page, -18, -7, touch);
  await tap(page, -18, -1, touch);
  await expect(page.locator('#build-feedback')).toContainText('ready');
  let state = await page.evaluate(() => window.buildTest.snapshot().build);
  expect(
    state.tiles
      .filter((t) => t.x === -18 && t.z >= -7 && t.z <= -1)
      .every((t) => t.surface === 'garden'),
  ).toBe(true);
  await page.locator('[data-build="tool"][data-value="room"]').click();
  await tap(page, -18, -7, touch);
  await tap(page, -18, -1, touch);
  state = await page.evaluate(() => window.buildTest.snapshot().build);
  expect(
    state.tiles
      .filter((t) => t.x === -18 && t.z >= -7 && t.z <= -1)
      .every((t) => t.surface === 'room'),
  ).toBe(true);
  await page.locator('[data-build="pick"][data-id="bench"]').click();
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
  await page.locator(`[data-build="pick"][data-id="${item}"]`).click();
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
