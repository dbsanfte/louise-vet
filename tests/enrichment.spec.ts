import { test, expect } from '@playwright/test';
import { TownSimulation } from '../src/town-simulation';
import { visits, upgrades, type UpgradeId } from '../src/game';
const additions = [
  'treat-dispenser',
  'water-dispenser',
  'toy-box',
  'yarn',
  'aviary',
  'play-tree',
];
const owned = upgrades
  .filter((u) => u.id !== 'stock')
  .map((u) => u.id) as UpgradeId[];
function furnishedClinic() {
  const s = new TownSimulation(visits, () => 0.5);
  s.configureClinic(8, 22);
  s.configureLeisure(owned);
  s.seedClinic(
    ['Luna', 'Milo', 'Peanut', 'Pico', 'Pepper', 'Melody', 'Hazel', 'Cleo'].map(
      (name) => visits.findIndex((v) => v.name === name),
    ),
  );
  let best = s.snapshot(),
    score = -1;
  for (let i = 0; i < 1800; i++) {
    s.update(0.1);
    const current = [...s.leisure.pets.values()]
      .filter((p) => p.phase === 'use')
      .reduce(
        (n, p) =>
          n + (p.station === 'aviary' || p.station === 'play-tree' ? 5 : 1),
        0,
      );
    if (current > score) {
      score = current;
      best = s.snapshot();
    }
  }
  best.accidentDue = 10000;
  best.households.forEach((h) => (h.nextCare = 10000));
  best.catalogueCursor = visits.length;
  return best;
}
test.setTimeout(120000);
test('new garden purchases require space and persist with their room control', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('louises-vet-office-v1'))
      localStorage.setItem(
        'louises-vet-office-v1',
        JSON.stringify({
          version: 1,
          coins: 4000,
          earned: 0,
          happiness: 100,
          treated: 0,
          stock: 3,
          upgrades: [],
          sound: false,
        }),
      );
  });
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await page.getByRole('button', { name: /Clinic shop/ }).click();
  for (const id of additions)
    await expect(page.locator(`[data-upgrade="${id}"]`)).toBeDisabled();
  for (const id of ['expansion', 'pet-room', 'play-annex', ...additions])
    await page.locator(`[data-upgrade="${id}"]`).click();
  await expect(page.getByTestId('coins')).toHaveText('2,440');
  await page.getByRole('button', { name: 'Close shop', exact: true }).click();
  await page.getByRole('button', { name: 'Play garden', exact: true }).click();
  await page.reload();
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await expect(
    page.getByRole('button', { name: 'Play garden', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('coins')).toHaveText('2,440');
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('louises-vet-office-v1')!),
  );
  for (const id of additions) expect(saved.upgrades).toContain(id);
});
test('furnished lounge and active garden fit a short viewport and keep animating', async ({
  page,
}, info) => {
  await page.setViewportSize(
    info.project.name === 'mobile'
      ? { width: 360, height: 640 }
      : { width: 1280, height: 650 },
  );
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(
    ({ town, owned }) =>
      localStorage.setItem(
        'louises-vet-office-v1',
        JSON.stringify({
          version: 1,
          coins: 2000,
          earned: 0,
          happiness: 100,
          treated: 0,
          stock: 3,
          upgrades: owned,
          sound: false,
          town,
        }),
      ),
    { town: furnishedClinic(), owned },
  );
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await page
    .getByRole('button', { name: 'Customer lounge', exact: true })
    .click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: info.outputPath('lounge-seating.png') });
  await page.getByRole('button', { name: 'Play garden', exact: true }).click();
  await page.waitForTimeout(900);
  const result = await page.evaluate(() => {
    const outside = [
      ...document.querySelectorAll<HTMLElement>(
        '.clinic-views button, .bottom-bar button',
      ),
    ]
      .filter((e) => e.checkVisibility())
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return (
          r.top < 0 ||
          r.bottom > innerHeight + 1 ||
          r.left < 0 ||
          r.right > innerWidth + 1
        );
      })
      .map((e) => e.textContent);
    const r = document
      .querySelector('#world > canvas')!
      .getBoundingClientRect();
    return {
      outside,
      scroll: document.documentElement.scrollHeight > innerHeight + 1,
      clip: { x: r.x, y: r.y, width: r.width, height: r.height },
    };
  });
  expect(result.outside).toEqual([]);
  expect(result.scroll).toBe(false);
  const before = await page.screenshot({
    clip: result.clip,
    path: info.outputPath('play-garden.png'),
  });
  await page.waitForTimeout(700);
  const after = await page.screenshot({ clip: result.clip });
  expect(before.equals(after)).toBe(false);
  expect(errors).toEqual([]);
});
