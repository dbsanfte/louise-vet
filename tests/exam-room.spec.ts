import { test, expect, type Page } from '@playwright/test';
import { waitForExamination } from './browser-helpers';
import { TownSimulation } from '../src/town-simulation';
import { visits } from '../src/game';
import { examOwner } from '../src/town-map';
test.setTimeout(120000);
async function open(page: Page, name = 'Luna') {
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic([visits.findIndex((v) => v.name === name)]);
  await page.addInitScript(
    (town) =>
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
      ),
    s.snapshot(),
  );
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
}
test('the furnished room is visible and Louise leads the family there before close-up care', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await page.locator('#world').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('reception-and-room.png') });
  await page.getByRole('button', { name: 'Exam room', exact: true }).click();
  await page.screenshot({ path: info.outputPath('furnished-room.png') });
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#clinic-call')).toHaveAttribute(
    'data-stage',
    'lead',
    { timeout: 30000 },
  );
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'reception');
  await page.locator('#world').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('family-escort.png') });
  await waitForExamination(page);
  const position = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem('louises-vet-office-v1')!,
      ).town.households.find((h: { owner: string }) => h.owner === 'Amelia')
        .position,
  );
  expect(
    Math.hypot(position.x - examOwner.x, position.z - examOwner.z),
  ).toBeLessThan(0.05);
  await page.locator('#world').scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath('matching-examination-view.png'),
  });
  await page.getByRole('button', { name: 'Ear scope', exact: true }).click();
  await page.getByRole('button', { name: 'Ear on Luna', exact: true }).click();
  await expect(page.locator('.findings')).toContainText('ear looks clear');
  await page.getByRole('button', { name: /Stop visit/ }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'reception');
  expect(errors).toEqual([]);
});
test('cancelling an escort keeps the family waiting and vaccination still skips diagnosis', async ({
  page,
}) => {
  await open(page, 'Hazel');
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#clinic-call')).toHaveAttribute(
    'data-stage',
    'lead',
    { timeout: 30000 },
  );
  await page.getByRole('button', { name: 'Cancel call', exact: true }).click();
  await expect(page.locator('#clinic-call')).toHaveAttribute(
    'data-stage',
    'idle',
  );
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'reception');
  await expect(page.getByTestId('coins')).toHaveText('120');
  await page.locator('[data-action="next"]').click();
  await waitForExamination(page);
  await expect(page.locator('#app')).toHaveAttribute(
    'data-mode',
    'place-vaccine',
  );
  await expect(page.locator('[data-action="diagnose"]')).toHaveCount(0);
  await expect(page.locator('.case-steps')).not.toContainText('Diagnose');
});
