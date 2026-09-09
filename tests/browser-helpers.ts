import { expect, type Page } from '@playwright/test';
/** Wait for the visible recall and escorted walk, not a faster test-only entry. */
export async function waitForExamination(page: Page) {
  await expect(page.locator('#app')).toHaveAttribute(
    'data-mode',
    /examine|place-vaccine/,
    { timeout: 45000 },
  );
}

/** Use the same patient paging controls as a player. */
export async function showPatient(page: Page, name: string) {
  await page.getByRole('button', { name: /^Patients ·/ }).click();
  await expect(
    page.locator(`[data-action="patient"][aria-label="See ${name}"]`),
  ).toBeAttached({ timeout: 60000 });
  const previous = page.getByRole('button', {
    name: 'Previous patients',
    exact: true,
  });
  while (await previous.isEnabled()) await previous.click();
  const patient = page.locator(
    `[data-action="patient"][aria-label="See ${name}"]`,
  );
  for (let i = 0; i < 4 && !(await patient.isVisible()); i++) {
    const next = page.getByRole('button', {
      name: 'Next patients',
      exact: true,
    });
    if (!(await next.isEnabled())) break;
    await next.click();
  }
  await expect(patient).toBeVisible();
  return patient;
}

export async function showTownNews(page: Page, owner: string) {
  await page.getByRole('button', { name: 'Town news', exact: true }).click();
  const newer = page.getByRole('button', { name: 'Newer news', exact: true });
  while (await newer.isEnabled()) await newer.click();
  const target = page
    .getByRole('button', { name: `Find ${owner}`, exact: true })
    .first();
  for (let i = 0; i < 4 && !(await target.isVisible()); i++) {
    const older = page.getByRole('button', { name: 'Older news', exact: true });
    if (!(await older.isEnabled())) break;
    await older.click();
  }
  await expect(target).toBeVisible();
  return target;
}

/** Complete the visible care activity through its normal controls. */
export async function completeCareSkill(page: Page) {
  const dialog = page.locator('.skill-dialog');
  await expect(dialog).toBeVisible();
  const start = dialog.locator('[data-skill-start]');
  if (await start.isVisible()) await start.click();
  const kind = await dialog.getAttribute('data-skill');
  if (kind === 'spread' || kind === 'wrap')
    for (let i = 0; i < 6; i++)
      await dialog.locator(`[data-cell="${i}"]`).click();
  else if (kind === 'comb' || kind === 'brush')
    for (let i = 0; i < 6; i++)
      await dialog.locator('#skill-position').press(i % 2 ? 'Home' : 'End');
  else if (kind === 'aim' || kind === 'pull' || kind === 'steady') {
    if (kind === 'pull') await dialog.locator('[data-skill-action]').click();
    // Follow the displayed guide using the same input events as a dragged slider.
    await page.waitForFunction(
      () => {
        const d = document.querySelector<HTMLElement>('.skill-dialog')!;
        if (d.dataset.complete === 'true') return true;
        const target = Number(
          d.querySelector<HTMLElement>('.skill-target')!.dataset.target,
        );
        const input = d.querySelector<HTMLInputElement>('#skill-position')!;
        input.value = String(Math.round(target * 100));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (d.dataset.skill === 'aim')
          d.querySelector<HTMLButtonElement>('[data-skill-action]')!.click();
        return d.dataset.complete === 'true';
      },
      undefined,
      { timeout: 15000 },
    );
  } else {
    await dialog.locator('[data-skill-action]').click();
    await page.waitForFunction(
      () => {
        const d = document.querySelector<HTMLElement>('.skill-dialog')!;
        const value = Number(
          d.querySelector('[role="meter"]')!.getAttribute('aria-valuenow'),
        );
        if (value >= (d.dataset.skill === 'pour' ? 62 : 49)) {
          d.querySelector<HTMLButtonElement>('[data-skill-action]')!.click();
          return true;
        }
        return false;
      },
      undefined,
      { timeout: 15000 },
    );
  }
  await expect(dialog).toHaveAttribute('data-complete', 'true');
  await dialog.locator('[data-skill-finish]').click();
}
