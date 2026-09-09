import { expect, test } from '@playwright/test';
import { TownSimulation } from '../src/town-simulation';
import { visits } from '../src/game';
import type { RescueKind, RescuePhase } from '../src/emergencies';
import {
  showPatient,
  waitForExamination,
  completeCareSkill,
} from './browser-helpers';
test.setTimeout(120000);
function scene(kind: RescueKind, name: string, phase: RescuePhase) {
  const s = new TownSimulation(visits, () => 0.5);
  const state = s.snapshot();
  state.catalogueCursor = visits.length;
  state.households.forEach((h) => {
    h.remaining = 290;
    h.nextCare = 9999;
  });
  expect(s.restore(state)).toBe(true);
  const h = s.households.find((h) => h.pets.some((p) => p.name === name))!;
  expect(s.emergencies.start(kind, h, s.households, s.time, () => 0.5)).toBe(
    true,
  );
  if (kind === 'lost') s.emergencies.active!.pets = [name];
  for (let i = 0; i < 4000 && s.emergencies.active?.phase !== phase; i++) {
    for (const f of s.households) if (f.routine === 'garden') f.remaining = 290;
    s.update(0.1);
  }
  expect(s.emergencies.active?.phase).toBe(phase);
  expect(new TownSimulation(visits).restore(s.snapshot())).toBe(true);
  return s;
}
async function save(page: import('@playwright/test').Page, s: TownSimulation) {
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
for (const [kind, name, phase] of [
  ['fire', 'Milo', 'extinguish'],
  ['lost', 'Pico', 'climb'],
] as const)
  test(`${kind}: visible rescue, stations and viewport controls`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await save(page, scene(kind, name, phase));
    await page.getByRole('button', { name: 'Hookville', exact: true }).click();
    await page.getByRole('button', { name: 'Town news', exact: true }).click();
    await page
      .getByRole('button', { name: 'Watch rescue', exact: true })
      .click();
    await expect(page.locator('.emergency-status')).toContainText(
      kind === 'fire'
        ? /fire|inside|carried|Safe/
        : /Climbing|hands|ladder|Safe/,
    );
    await page.screenshot({ path: info.outputPath(`${kind}-rescue.png`) });
    for (const label of ['Fire station', 'Police station']) {
      const button = page.getByRole('button', { name: label, exact: true });
      await button.click();
      await page.screenshot({
        path: info.outputPath(`${label.replace(' ', '-')}.png`),
      });
    }
    const bounds = await page.evaluate(() => ({
      height: innerHeight,
      width: innerWidth,
      scroll: document.documentElement.scrollHeight,
      buttons: [
        ...document.querySelectorAll<HTMLElement>(
          '.emergency-services button,#stage-footer button',
        ),
      ].map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      }),
    }));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.height + 2);
    for (const b of bounds.buttons) {
      expect(b.top).toBeGreaterThanOrEqual(0);
      expect(b.bottom).toBeLessThanOrEqual(bounds.height);
      expect(b.right).toBeLessThanOrEqual(bounds.width);
      expect(b.left).toBeGreaterThanOrEqual(0);
    }
    await page
      .getByRole('button', { name: 'Back to the clinic', exact: true })
      .click();
    await expect(page.locator('#app')).toHaveAttribute(
      'data-mode',
      'reception',
    );
    expect(errors).toEqual([]);
  });

test('a rescued pet gets smoke and skin checks, cooling care and a completed visit', async ({
  page,
}) => {
  const s = scene('fire', 'Milo', 'return');
  for (let i = 0; i < 1000 && !s.queue.length; i++) s.update(0.1);
  await save(page, s);
  await (await showPatient(page, 'Milo')).click();
  await waitForExamination(page);
  for (const [tool, zone] of [
    ['Stethoscope', 'Chest'],
    ['Magnifier', 'Coat'],
  ]) {
    await page.getByRole('button', { name: tool, exact: true }).click();
    await page
      .getByRole('button', { name: `${zone} on Milo`, exact: true })
      .click();
  }
  await page
    .getByRole('button', { name: 'Choose a diagnosis', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: 'Smoke irritation and a mild burn',
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: 'Cooling pad', exact: true }).click();
  await page.getByRole('button', { name: 'Coat on Milo', exact: true }).click();
  await completeCareSkill(page);
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'result');
  await page.getByRole('button', { name: /Back to reception/ }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'reception');
});

test('emergency news and its paging controls fit a short phone window', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await save(page, scene('fire', 'Milo', 'extinguish'));
  await page.getByRole('button', { name: 'Hookville', exact: true }).click();
  await page.getByRole('button', { name: 'Town news', exact: true }).click();
  const bad = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        '#sidebar button,#sidebar p,#sidebar h3,#scene-controls button,#stage-footer button',
      ),
    ]
      .filter((e) => e.checkVisibility())
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return (
          r.bottom > innerHeight ||
          r.top < 0 ||
          r.right > innerWidth ||
          r.left < 0 ||
          (e instanceof HTMLButtonElement &&
            !e.contains(
              document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
            ))
        );
      })
      .map((e) => e.textContent),
  );
  await page.screenshot({ path: info.outputPath('short-phone-news.png') });
  expect(bad).toEqual([]);
});

test('an upcoming automatic story appears in town news without a manual rescue trigger', async ({
  page,
}) => {
  const s = new TownSimulation(visits, () => 0.5);
  const state = s.snapshot();
  state.time = 34;
  state.catalogueCursor = visits.length;
  state.households.forEach((h) => {
    h.remaining = 100;
    h.nextCare = 9999;
  });
  expect(s.restore(state)).toBe(true);
  expect(s.emergencies.active).toBeUndefined();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await save(page, s);
  await page.getByRole('button', { name: 'Hookville', exact: true }).click();
  await page.getByRole('button', { name: 'Town news', exact: true }).click();
  await expect(page.locator('.emergency-status')).toBeVisible({
    timeout: 15000,
  });
  const watch = page.getByRole('button', { name: 'Watch rescue', exact: true });
  await expect(watch).toBeEnabled();
  await watch.click();
  await expect(
    page.getByRole('button', { name: 'Back to the clinic', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
