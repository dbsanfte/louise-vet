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

/** Find a home through the same paged directory used on phones and desktop. */
export async function showTownHome(page: Page, label: string) {
  await page.getByRole('button', { name: 'Homes', exact: true }).click();
  const previous = page.getByRole('button', {
    name: 'Previous homes',
    exact: true,
  });
  while (await previous.isEnabled()) await previous.click();
  const home = page.getByRole('button', { name: label, exact: true });
  for (let i = 0; i < 4 && !(await home.isVisible()); i++) {
    await page.getByRole('button', { name: 'Next homes', exact: true }).click();
  }
  await expect(home).toBeVisible();
  return home;
}

/** Complete the visible care activity through contact, guides and pressure controls. */
export async function exerciseCareSkill(page: Page) {
  const dialog = page.locator('.skill-dialog');
  await expect(dialog).toHaveAttribute('data-ready', 'true');
  const start = dialog.locator('[data-skill-start]');
  if (await start.isVisible()) await start.click();
  const kind = await dialog.getAttribute('data-skill');
  const board = dialog.locator('.skill-canvas');
  const box = (await board.boundingBox())!;
  const target = async () =>
    dialog.locator('.care-target').evaluate((e) => ({
      x: Number((e as HTMLElement).dataset.x),
      y: Number((e as HTMLElement).dataset.y),
    }));
  const point = async (p: { x: number; y: number }, down = false) => {
    await page.mouse.move(box.x + p.x * box.width, box.y + p.y * box.height);
    if (down) await page.mouse.down();
  };
  if (kind === 'wrap') {
    const path = await dialog.locator('.care-wrap-path').getAttribute('d');
    const points = path!.split(' ').map((p) => {
      const [x, y] = p.slice(1).split(',').map(Number);
      return { x, y };
    });
    await point(points[0], true);
    for (const p of points.slice(1)) await point(p);
    await page.mouse.up();
  } else if (kind === 'spread' || kind === 'brush' || kind === 'comb') {
    const count = kind === 'brush' ? 3 : 6;
    for (let i = 0; i < count; i++) {
      const mark = dialog.locator(`[data-care-mark="${i}"]`);
      if (!(await mark.isVisible())) continue;
      const p = await mark.evaluate((e) => ({
        x: Number((e as HTMLElement).dataset.x),
        y: Number((e as HTMLElement).dataset.y),
      }));
      await point({ x: p.x + 0.035, y: p.y }, true);
      // Continuous pointer motion follows the visible flea or circles the visible patch.
      await page.evaluate(
        async ({ i, kind }) => {
          const d = document.querySelector<HTMLElement>('.skill-dialog')!,
            board = d.querySelector<HTMLElement>('.skill-canvas')!,
            mark = d.querySelector<HTMLElement>(`[data-care-mark="${i}"]`)!;
          let angle = 0;
          for (let n = 0; n < 180 && !mark.hidden; n++) {
            const b = board.getBoundingClientRect();
            angle += 0.16;
            const x =
                Number(mark.dataset.x) +
                (kind === 'comb'
                  ? 0.015 * Math.sin(angle)
                  : Math.cos(angle) * 0.035),
              y =
                Number(mark.dataset.y) +
                (kind === 'comb' ? 0.01 : Math.sin(angle) * 0.035);
            board.dispatchEvent(
              new PointerEvent('pointermove', {
                bubbles: true,
                pointerId: 1,
                isPrimary: true,
                buttons: 1,
                pressure: 0.5,
                clientX: b.x + x * b.width,
                clientY: b.y + y * b.height,
              }),
            );
            await new Promise((r) => setTimeout(r, 40));
          }
        },
        { i, kind },
      );
      await page.mouse.up();
      await expect(mark).toBeHidden();
    }
  } else {
    await point(await target(), true);
    if (kind === 'pressure' || kind === 'aim') await page.waitForTimeout(650);
    if (kind !== 'steady') await page.mouse.up();
    if (kind === 'pressure' || kind === 'pull')
      await dialog.locator('[data-skill-action]').click();
    if (kind === 'pull') await point({ x: 0.35, y: 0.65 }, true);
    await page.evaluate(async (kind) => {
      const d = document.querySelector<HTMLElement>('.skill-dialog')!,
        board = d.querySelector<HTMLElement>('.skill-canvas')!,
        t = d.querySelector<HTMLElement>('.care-target')!;
      let x = kind === 'pull' ? 0.35 : Number(t.dataset.x),
        y = kind === 'pull' ? 0.65 : Number(t.dataset.y);
      for (let n = 0; n < 400 && d.dataset.complete !== 'true'; n++) {
        const b = board.getBoundingClientRect(),
          tx = Number(t.dataset.x),
          ty = Number(t.dataset.y),
          dx = tx - x,
          dy = ty - y,
          length = Math.hypot(dx, dy),
          step = Math.min(1, 0.012 / Math.max(0.001, length));
        x += dx * step;
        y += dy * step;
        if (kind === 'pull' || kind === 'steady')
          board.dispatchEvent(
            new PointerEvent('pointermove', {
              bubbles: true,
              pointerId: 1,
              isPrimary: true,
              buttons: 1,
              pressure: 0.5,
              clientX: b.x + x * b.width,
              clientY: b.y + y * b.height,
            }),
          );
        if (kind === 'aim')
          d.querySelector<HTMLButtonElement>('[data-skill-action]')!.click();
        const input = d.querySelector<HTMLInputElement>('#skill-position');
        if (input) {
          const fill = Number(
            d
              .querySelector('.skill-step')!
              .textContent!.match(/Water level (\d+)/)?.[1] ?? 0,
          );
          input.value = kind === 'pour' && fill >= 64 ? '0' : '46';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await new Promise((r) => setTimeout(r, 40));
      }
    }, kind);
    await page.mouse.up();
  }
  await expect(dialog).toHaveAttribute('data-complete', 'true');
}
export async function completeCareSkill(page: Page) {
  await exerciseCareSkill(page);
  await page.locator('[data-skill-finish]').click();
}
