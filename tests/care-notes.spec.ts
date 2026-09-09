import { test, expect } from '@playwright/test';
import { waitForExamination } from './browser-helpers';
test.setTimeout(120000);
test('new care notes stay in the notebook and older notes scroll without moving the page', async ({
  page,
}, info) => {
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await page.locator('[data-action="next"]').click();
  await waitForExamination(page);
  const notebook = page.getByRole('region', {
    name: 'Care notebook',
    exact: true,
  });
  const notes = notebook.getByRole('list', { name: 'Care notes', exact: true });
  for (const [tool, zone] of [
    ['Thermometer', 'Coat'],
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
    await expect(notes).toBeInViewport({ ratio: 1 });
    await expect(notes.locator('li').first()).toBeInViewport({ ratio: 1 });
    await expect(notes.locator('li').first()).toContainText(
      `${tool} · ${zone}`,
    );
  }
  await expect(notes.locator('li')).toHaveCount(6);
  await page.screenshot({ path: info.outputPath('care-notes-in-view.png') });
  const before = await page.evaluate(() => window.scrollY);
  await notes.focus();
  await page.keyboard.press('End');
  await expect(notes.locator('li').last()).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await page.getByRole('button', { name: /Key clues ·/ }).click();
  await expect(
    notebook.getByRole('region', { name: 'Key clues', exact: true }),
  ).toContainText('small pink bump');
  await expect(page.locator('[data-action="diagnose"]')).toBeInViewport({
    ratio: 1,
  });
  await page.getByRole('button', { name: /Care notes ·/ }).click();
  await expect(notes).toBeInViewport({ ratio: 1 });
});
