import { test, expect } from '@playwright/test';
import { TownSimulation } from '../src/town-simulation';
import { visits, upgrades, type UpgradeId } from '../src/game';
import { showPatient } from './browser-helpers';
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
  s.configureClinic(8, 22);
  s.configureLeisure(owned);
  s.seedClinic(names.map((name) => visits.findIndex((v) => v.name === name)));
  for (let i = 0; i < 600; i++) s.update(0.1);
  const snapshot = s.snapshot();
  snapshot.accidentDue = 3600;
  return snapshot;
}
test.setTimeout(120000);
test('office controls stay inside short, full clinics without page scrolling', async ({
  page,
}, info) => {
  await page.setViewportSize(
    info.project.name === 'mobile'
      ? { width: 360, height: 640 }
      : { width: 1280, height: 650 },
  );
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
    { town: busy(), owned },
  );
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  async function fits() {
    const problems = await page.evaluate(() => {
      const root = document.documentElement,
        bad: string[] = [];
      if (
        root.scrollHeight > innerHeight + 1 ||
        root.scrollWidth > innerWidth + 1
      )
        bad.push('document scrolls');
      for (const el of document.querySelectorAll<HTMLElement>(
        '#app > .topbar button, #stats > .stat, .shelf-summary, #sidebar button, .clinic-views button, #scene-controls button, .bottom-bar button',
      )) {
        if (!el.checkVisibility()) continue;
        const r = el.getBoundingClientRect();
        if (
          r.top < 0 ||
          r.bottom > innerHeight + 1 ||
          r.left < 0 ||
          r.right > innerWidth + 1
        )
          bad.push(el.textContent || el.ariaLabel || 'button');
        const hit = document.elementFromPoint(
          r.x + r.width / 2,
          r.y + r.height / 2,
        );
        if (el instanceof HTMLButtonElement && !el.contains(hit))
          bad.push('covered: ' + (el.textContent || el.ariaLabel));
      }
      return bad;
    });
    expect(problems).toEqual([]);
  }
  await fits();
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole('button', { name: 'Next patients', exact: true })
      .click();
    await fits();
  }
  await page
    .getByRole('button', { name: 'While you wait', exact: true })
    .click();
  do {
    await fits();
    const next = page.getByRole('button', {
      name: 'Next activities',
      exact: true,
    });
    if (!(await next.isEnabled())) break;
    await next.click();
  } while (true);
  await page
    .getByRole('button', { name: 'Pet playground', exact: true })
    .click();
  await page.screenshot({
    path: info.outputPath('playground-short-window.png'),
  });
  await (await showPatient(page, 'Luna')).click();
  await expect(page.locator('[data-action="cancel-call"]')).toBeVisible();
  await expect(page.locator('.call-next')).toBeHidden();
  await fits();
  await page.getByRole('button', { name: 'Cancel call', exact: true }).click();
  await expect(page.locator('.call-next')).toBeVisible();
  await page.getByRole('button', { name: /Clinic shop/ }).click();
  await expect(page.locator('[data-upgrade="coaster"]')).toHaveText(
    /In your collection/,
  );
  await expect(page.locator('[data-upgrade="ferris"]')).toHaveText(
    /In your collection/,
  );
});
test('coaster and Ferris wheel purchases remain in the collection after reload', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
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
  await expect(page.locator('[data-upgrade="coaster"]')).toBeDisabled();
  await expect(page.locator('[data-upgrade="ferris"]')).toContainText(
    'Buy Pet playground first',
  );
  for (const id of ['expansion', 'pet-room', 'coaster', 'ferris'])
    await page.locator(`[data-upgrade="${id}"]`).click();
  await expect(page.getByTestId('coins')).toHaveText('980');
  await expect(page.locator('[data-upgrade="coaster"]')).toBeDisabled();
  await page.getByRole('button', { name: 'Close shop', exact: true }).click();
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  for (const id of ['coaster', 'ferris'])
    await expect(
      page.locator(`[data-build="pick"][data-id="${id}"]`),
    ).toContainText('Stored');
  await page.screenshot({ path: info.outputPath('new-rides.png') });
  await page.locator('[data-build="done"]').click();
  await page.reload();
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await expect(page.getByTestId('coins')).toHaveText('980');
  await page.getByRole('button', { name: /Clinic shop/ }).click();
  for (const id of ['coaster', 'ferris'])
    await expect(page.locator(`[data-upgrade="${id}"]`)).toHaveText(
      /In your collection/,
    );
});
