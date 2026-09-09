import { showPatient } from './browser-helpers';
import { expect, test } from '@playwright/test';
import { TownSimulation } from '../src/town-simulation';
import { visits } from '../src/game';
import { waitForExamination } from './browser-helpers';
test.setTimeout(120000);
test('a customer arriving with a small patient and a second dog brings both inside, including after reload', async ({
  page,
}, info) => {
  // Keep software-rendered scene captures within the same budget as other town tests.
  if (info.project.name === 'desktop')
    await page.setViewportSize({ width: 900, height: 650 });
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic([]);
  const h = s.households.find((h) => h.owner === 'Isla')!;
  h.routine = 'walk';
  h.companions = ['Maple'];
  expect(s.requestVisit('Sunny', 'authored')).toBe(true);
  for (
    let i = 0;
    i < 1200 && s.households[h.id].routine !== 'clinic-enter';
    i++
  )
    s.update(0.1);
  expect(h.routine).toBe('clinic-enter');
  expect(h.companions).toEqual(['Maple', 'Sunny']);
  await page.addInitScript((town) => {
    if (!localStorage.getItem('louises-vet-office-v1'))
      localStorage.setItem(
        'louises-vet-office-v1',
        JSON.stringify({
          version: 1,
          coins: 120,
          earned: 0,
          happiness: 100,
          treated: 0,
          stock: 3,
          upgrades: [],
          sound: false,
          town,
        }),
      );
  }, s.snapshot());
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await page.locator('#world').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('two-pets-entering.png') });
  await page
    .getByRole('button', { name: 'While you wait', exact: true })
    .click();
  await expect(
    page
      .locator('#clinic-leisure li')
      .filter({ has: page.locator('strong', { hasText: /^Isla$/ }) }),
  ).toContainText('sitting comfortably', { timeout: 30000 });
  await page.screenshot({ path: info.outputPath('two-pets-waiting.png') });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: info.outputPath('two-pets-idling.png') });
  await (await showPatient(page, 'Sunny')).click();
  await waitForExamination(page);
  await page.getByRole('button', { name: /Stop visit/ }).click();
  await page.reload();
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await page
    .getByRole('button', { name: 'While you wait', exact: true })
    .click();
  await expect(
    page
      .locator('#clinic-leisure li')
      .filter({ has: page.locator('strong', { hasText: /^Isla$/ }) }),
  ).toContainText('sitting comfortably', { timeout: 30000 });
  await page.locator('#world').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('two-pets-after-reload.png') });
  const companions = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem('louises-vet-office-v1')!,
      ).town.households.find((h: { owner: string }) => h.owner === 'Isla')
        .companions,
  );
  expect(companions).toEqual(['Maple', 'Sunny']);
  await expect(page.getByTestId('coins')).toHaveText('120');
  expect(errors).toEqual([]);
});
