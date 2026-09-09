import { test, expect, type Page } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { TownSimulation } from '../src/town-simulation';
import { visits } from '../src/game';
import { waitForExamination } from './browser-helpers';

test.setTimeout(120000);
async function openRoutine(page: Page, name: string) {
  const sim = new TownSimulation(visits, () => 0.5);
  sim.seedClinic([visits.findIndex((v) => v.name === name)]);
  sim.tickets.get(sim.queue[0])!.reason = 'checkup';
  await page.addInitScript((town) => {
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
    const signals: string[] = [];
    Object.assign(window, { clueSignals: signals });
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          for (const button of node.querySelectorAll('.clue-discovered'))
            signals.push(button.textContent!);
        }
    }).observe(document, { childList: true, subtree: true });
  }, sim.snapshot());
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await page.locator('[data-action=next]').click();
  await waitForExamination(page);
}
async function waterPoint(page: Page, point: Vector3) {
  const rect = await page.locator('#world > canvas').boundingBox();
  const camera = new PerspectiveCamera(40, rect!.width / rect!.height, 0.1, 80);
  camera.position.set(3.1, 3.4, 4.7);
  camera.lookAt(0, 1.95, 0);
  camera.updateMatrixWorld();
  point.project(camera);
  return {
    x: rect!.x + ((point.x + 1) / 2) * rect!.width,
    y: rect!.y + ((1 - point.y) / 2) * rect!.height,
  };
}

test('fish routine explains both checks, accepts visible water, and celebrates new clues once', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openRoutine(page, 'Bubbles');
  const list = page.getByRole('list', { name: 'Standard checks' });
  await expect(list).toContainText('bowl water');
  await expect(list).toContainText('fins');
  const clues = page.locator('[data-tab=clues]');
  await expect(clues).toContainText('0/2');
  await expect(clues).not.toHaveClass(/clues-complete/);
  await expect(page.locator('[data-action=finish-checkup]')).toBeDisabled();
  await list.getByRole('button', { name: /Check the water/ }).click();
  await page.locator('#world').scrollIntoViewIfNeeded();
  // Both points lie inside the visible water volume, away from the bowl guide.
  for (const point of [
    new Vector3(0.62, 1.94, 0.5),
    new Vector3(-0.35, 2.38, 0.25),
  ]) {
    const p = await waterPoint(page, point);
    if (info.project.name === 'mobile') await page.touchscreen.tap(p.x, p.y);
    else await page.mouse.click(p.x, p.y);
    await expect(clues).toContainText('1/2');
    await expect(page.locator('.heart-reading')).toContainText(
      'Comfortable water',
    );
  }
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { clueSignals: string[] }).clueSignals.some((s) =>
          s.includes('1/2'),
        ),
      ),
    )
    .toBe(true);
  await expect(clues).not.toHaveClass(/clue-discovered/);
  await page.evaluate(() => {
    (window as unknown as { clueSignals: string[] }).clueSignals.length = 0;
  });
  await page
    .getByRole('button', { name: 'Bowl water on Bubbles', exact: true })
    .click();
  expect(
    await page.evaluate(
      () => (window as unknown as { clueSignals: string[] }).clueSignals,
    ),
  ).toEqual([]);
  await list.getByRole('button', { name: /Look at the fins/ }).click();
  await page
    .getByRole('button', { name: 'Fin on Bubbles', exact: true })
    .click();
  await expect(clues).toContainText('2/2');
  await expect(clues).toHaveClass(/clues-complete/);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { clueSignals: string[] }).clueSignals.some((s) =>
          s.includes('2/2'),
        ),
      ),
    )
    .toBe(true);
  await expect(clues).not.toHaveClass(/clue-discovered/);
  for (const tab of ['clues', 'notes']) {
    await page.locator(`[data-tab=${tab}]`).click();
    await expect(clues).toHaveCSS('background-color', 'rgb(201, 232, 192)');
  }
  await page.screenshot({ path: info.outputPath('fish-routine-ready.png') });
  await page.locator('[data-action=finish-checkup]').click();
  await expect(
    page.getByRole('heading', { name: 'Bubbles has a healthy checkup!' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('bird routine explains feather and chest checks and respects reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openRoutine(page, 'Pico');
  const list = page.getByRole('list', { name: 'Standard checks' });
  await expect(list).toContainText('Thermometer at the feathers');
  await expect(list).toContainText('Stethoscope at the chest');
  await list.getByRole('button', { name: /Check temperature/ }).click();
  await page
    .getByRole('button', { name: 'Feathers on Pico', exact: true })
    .click();
  const clues = page.locator('[data-tab=clues]');
  await expect(clues).toContainText('1/2');
  await expect(clues).toHaveCSS('animation-name', 'none');
  await expect(list).toContainText('Done');
  await expect(page.locator('[data-action=finish-checkup]')).toBeDisabled();
  await page.getByRole('button', { name: 'Stop visit' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'reception');
});
