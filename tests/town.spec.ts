import { waitForExamination } from './browser-helpers';
import { expect, test } from '@playwright/test';

test.setTimeout(120000);
test('browse Hookville homes and return to the same clinic', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  const coins = await page.getByTestId('coins').textContent();
  await page.getByRole('button', { name: 'Hookville', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'town');
  await expect(page.locator('.household-list button')).toHaveCount(18);
  await page
    .getByRole('button', {
      name: "Amelia, Luna and Scout's House",
      exact: true,
    })
    .click();
  await expect(page.locator('#town-home')).toContainText('At Louise’s clinic');
  await page.getByRole('button', { name: 'Whole town', exact: true }).click();
  await page
    .getByRole('button', { name: 'Pan town right', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Zoom into town', exact: true })
    .click();
  await page.locator('#world').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('hookville.png') });
  await page
    .getByRole('button', { name: 'Back to the clinic', exact: true })
    .click();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'reception');
  await expect(
    page.locator('[data-action="patient"][data-id="0"]'),
  ).toBeVisible();
  await expect(page.getByTestId('coins')).toHaveText(coins!);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});

test('temperature contact and key discoveries remain visible through long notes', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await page.locator('[data-action="next"]').click();
  await waitForExamination(page);
  await page.getByRole('button', { name: 'Thermometer', exact: true }).click();
  await page.getByRole('button', { name: 'Ear on Luna', exact: true }).click();
  await expect(page.locator('.heart-reading')).toContainText(
    'Place the sensor',
  );
  await page.getByRole('button', { name: 'Coat on Luna', exact: true }).click();
  await expect(page.locator('.heart-reading')).toContainText('Comfortable');
  for (const [tool, zone] of [
    ['Ear scope', 'Ear'],
    ['Mouth mirror', 'Mouth'],
    ['Magnifier', 'Coat'],
    ['Magnifier', 'Front paw'],
    ['Stethoscope', 'Chest'],
  ]) {
    await page.getByRole('button', { name: tool, exact: true }).click();
    await page
      .getByRole('button', { name: `${zone} on Luna`, exact: true })
      .click();
  }
  await page.getByRole('button', { name: /Key clues ·/ }).click();
  await expect(
    page.getByRole('region', { name: 'Key clues', exact: true }),
  ).toContainText('small pink bump');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator('#clue-summary')).toBeInViewport({ ratio: 1 });
  await expect(
    page
      .getByRole('region', { name: 'Key clues', exact: true })
      .locator('li')
      .last(),
  ).toBeInViewport({
    ratio: 1,
  });
  await expect(page.locator('[data-action="diagnose"]')).toBeInViewport({
    ratio: 1,
  });
});
