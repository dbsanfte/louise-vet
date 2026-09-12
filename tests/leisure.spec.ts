import { showPatient } from './browser-helpers';
import { test, expect, type Page } from '@playwright/test';
import { TownSimulation } from '../src/town-simulation';
import { examOwner } from '../src/town-map';
import { visits, upgrades, type UpgradeId } from '../src/game';
const owned = upgrades
  .filter((u) => u.id !== 'stock')
  .map((u) => u.id) as UpgradeId[];
const names = [
  'Luna',
  'Milo',
  'Peanut',
  'Sunny',
  'Hazel',
  'Cleo',
  'Pip',
  'Daisy',
];
function busy() {
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic(names.map((name) => visits.findIndex((v) => v.name === name)));
  s.configureClinic(8, 22);
  s.configureLeisure(owned);
  let best = s.snapshot(),
    score = 0;
  for (let i = 0; i < 1500; i++) {
    s.update(0.1);
    const playing = [...s.leisure.pets.values()].filter(
      (p) => p.phase === 'use',
    );
    const count =
      playing.length * 3 +
      [...s.leisure.owners.values()].filter(
        (a) => a.phase === 'read' || a.phase === 'game',
      ).length +
      Number(playing.some((p) => p.station === 'wheel')) * 4 +
      Number(playing.some((p) => p.station === 'scratch')) * 4;
    if (count > score) {
      score = count;
      best = s.snapshot();
    }
  }
  return best;
}
async function open(
  page: Page,
  town?: ReturnType<TownSimulation['snapshot']>,
  items: UpgradeId[] = [],
) {
  await page.addInitScript(
    ({ town, items }) => {
      if (!localStorage.getItem('louises-vet-office-v1'))
        localStorage.setItem(
          'louises-vet-office-v1',
          JSON.stringify({
            version: 1,
            coins: 2000,
            earned: 0,
            happiness: 100,
            treated: 0,
            stock: 3,
            upgrades: items,
            sound: false,
            town,
          }),
        );
    },
    { town, items },
  );
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
}
test.setTimeout(120000);
test('shop unlocks room kits and stored amusements once, then preserves the collection on reload', async ({
  page,
}, info) => {
  await open(page);
  await page.getByRole('button', { name: /Clinic shop/ }).click();
  await expect(page.locator('[data-upgrade="pet-room"]')).toBeDisabled();
  await expect(page.locator('[data-upgrade="wheel"]')).toContainText(
    'Buy Pet playground first',
  );
  for (const id of [
    'expansion',
    'pet-room',
    'books',
    'table-games',
    'bench',
    'scratch',
    'wheel',
    'carousel',
  ])
    await page.locator(`[data-upgrade="${id}"]`).click();
  await expect(page.locator('[data-upgrade="carousel"]')).toBeDisabled();
  await expect(page.getByTestId('coins')).toHaveText('820');
  await page.getByRole('button', { name: 'Close shop', exact: true }).click();
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  for (const id of [
    'seat-5',
    'toys',
    'books',
    'table-games',
    'bench',
    'scratch',
    'wheel',
    'carousel',
  ])
    await expect(
      page.locator(`[data-build="pick"][data-id="${id}"]`),
    ).toContainText('Stored');
  await expect(page.locator('.build-price')).toContainText(
    '132 free floor tiles',
  );
  await page.screenshot({ path: info.outputPath('clinic-collection.png') });
  await page.locator('[data-build="done"]').click();
  await page.reload();
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await expect(page.getByTestId('coins')).toHaveText('820');
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await expect(
    page.locator('[data-build="pick"][data-id="carousel"]'),
  ).toContainText('Stored');
  await expect(page.locator('.build-price')).toContainText(
    '132 free floor tiles',
  );
});
test('owners sit, read and play while pets queue for rendered moving amusements', async ({
  page,
}, info) => {
  await open(page, busy(), owned);
  await expect(page.locator('#clinic-leisure')).toContainText(
    /reading|board game/,
  );
  await page
    .getByRole('button', { name: 'While you wait', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Pet playground', exact: true })
    .click();
  await expect(page.locator('#clinic-leisure')).toContainText(/is playing/);
  await page.locator('#world').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('pet-playground.png') });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: info.outputPath('pet-playground-later.png') });
  await page
    .getByRole('button', { name: 'Customer lounge', exact: true })
    .click();
  await page.locator('#world').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('owners-in-lounge.png') });
  // A turn lasts up to twelve active seconds; wait for its saved completion,
  // rather than assuming screenshots took long enough for a pet to finish.
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const leisure = JSON.parse(
            localStorage.getItem('louises-vet-office-v1')!,
          ).town.leisure;
          return leisure.pets.some((p: { turns: number }) => p.turns > 0);
        }),
      { timeout: 15000 },
    )
    .toBe(true);
  await page.reload();
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await expect(page.locator('#clinic-leisure')).toContainText('Exercise wheel');
});
test('a called pet walks back from play and can still abort and restart its visit', async ({
  page,
}) => {
  const snapshot = busy();
  const playing = snapshot.leisure.pets.find((p) => p.phase === 'use')!;
  const name = snapshot.tickets.find((t) => t.id === playing.ticket)!.pet;
  await open(page, snapshot, owned);
  await (await showPatient(page, name)).click();
  await expect(page.locator('#app')).toHaveAttribute(
    'data-mode',
    /examine|place-vaccine/,
    { timeout: 45000 },
  );
  const inRoom = await page.evaluate((id) => {
    const town = JSON.parse(
      localStorage.getItem('louises-vet-office-v1')!,
    ).town;
    return town.households.find((h: { ticket?: number }) => h.ticket === id)
      .position;
  }, playing.ticket);
  expect(
    Math.hypot(inRoom.x - examOwner.x, inRoom.z - examOwner.z),
  ).toBeLessThan(0.08);
  await page.getByRole('button', { name: /Stop visit/ }).click();
  await expect(
    page.locator(`[data-action="patient"][aria-label="See ${name}"]`),
  ).toBeVisible();
  await expect(page.getByTestId('coins')).toHaveText('2,000');
});
