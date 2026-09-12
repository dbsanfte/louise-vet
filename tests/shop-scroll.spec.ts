import { expect, test } from '@playwright/test';
test('buying courtyard upgrades and decorations retains shop scroll position and saves purchases', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  if (info.project.name === 'desktop')
    await page.setViewportSize({ width: 900, height: 650 });
  await page.addInitScript(() => {
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
          sound: false,
          upgrades: ['expansion', 'pet-room', 'play-annex'],
        }),
      );
  });
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await page.getByRole('button', { name: /Clinic shop/ }).click();
  await expect(page.locator('[data-upgrade="bubbles"]')).toBeDisabled();
  for (const id of ['sun-courtyard', 'bubbles', 'wall-art']) {
    const button = page.locator(`[data-upgrade="${id}"]`);
    await button.scrollIntoViewIfNeeded();
    const before = await page
      .locator('.modal.shop')
      .evaluate((el) => el.scrollTop);
    expect(before).toBeGreaterThan(300);
    await button.click();
    await expect(button).toBeDisabled();
    const after = await page
      .locator('.modal.shop')
      .evaluate((el) => el.scrollTop);
    expect(Math.abs(after - before)).toBeLessThan(3);
  }
  await page.screenshot({ path: info.outputPath('shop-retains-place.png') });
  await page.getByRole('button', { name: 'Close shop', exact: true }).click();
  await page.getByRole('button', { name: 'Build', exact: true }).click();
  await expect(
    page.locator('[data-build="pick"][data-id="bubbles"]'),
  ).toContainText('Stored');
  await expect(page.locator('.build-price')).toContainText(
    '48 free floor tiles',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight + 2,
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  const owned = await page.evaluate(
    () => JSON.parse(localStorage.getItem('louises-vet-office-v1')!).upgrades,
  );
  expect(owned).toEqual(
    expect.arrayContaining(['sun-courtyard', 'bubbles', 'wall-art']),
  );
  await expect(page.getByTestId('coins')).toHaveText('4,420');
});
