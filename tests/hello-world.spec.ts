import { expect, test } from '@playwright/test';

test('the game loads and responds to keyboard input without browser errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await expect(page).toHaveTitle('Vet Game');
  await expect(
    page.getByRole('heading', { name: 'Hello, world!' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Say hello' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toHaveText(
    'Hello, future vet! Your adventure is on its way.',
  );
  await expect(page.getByRole('button', { name: 'Hello again' })).toBeVisible();
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
  expect(errors).toEqual([]);
});
