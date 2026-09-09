import { completeCareSkill } from './browser-helpers';
import { showPatient, showTownNews } from './browser-helpers';
import { waitForExamination } from './browser-helpers';
import { expect, test, type Page } from '@playwright/test';
import { TownSimulation } from '../src/town-simulation';
import { visits } from '../src/game';

test.setTimeout(150000);
async function openSaved(page: Page, simulation: TownSimulation) {
  await page.addInitScript((snapshot) => {
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
          town: snapshot,
        }),
      );
  }, simulation.snapshot());
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
}
function town() {
  const s = new TownSimulation(visits, () => 0.5);
  const state = s.snapshot();
  state.catalogueCursor = visits.length;
  state.households.forEach((h) => {
    h.nextCare = 900;
  });
  if (!s.restore(state)) throw new Error('Invalid community fixture');
  return s;
}

for (const name of ['Luna', 'Milo'])
  test(`${name} travels from a road accident, receives matching fracture care, and returns home`, async ({
    page,
  }, info) => {
    const s = town();
    const state = s.snapshot();
    state.time = 101;
    state.accidentDue = 100;
    // Exercise this road contact without an unrelated automatic rescue taking priority.
    state.emergencies.due = 99999;
    const pet = visits.find((p) => p.name === name)!;
    const h = state.households.find((h) => h.owner === pet.owner)!;
    h.position = { x: 18, z: 3 };
    h.routine = 'walk';
    h.route = [{ x: 18, z: -3 }];
    h.returning = false;
    state.cars[2].x = 19.5;
    if (!s.restore(state)) throw new Error('Invalid incident fixture');
    s.update(0.1);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openSaved(page, s);
    await page.getByRole('button', { name: 'Hookville', exact: true }).click();
    await expect(page.locator('.town-news')).toContainText(
      `${name} was bumped by a car`,
    );
    await (await showTownNews(page, pet.owner)).click();
    await page.locator('#world').scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`${name}-road-scene.png`) });
    await page
      .getByRole('button', { name: 'Back to the clinic', exact: true })
      .click();
    await (await showPatient(page, name)).click();
    await waitForExamination(page);
    await expect(page.locator('.owner-note')).toContainText(
      `A car bumped ${name}`,
    );
    await page.getByRole('button', { name: 'X-ray', exact: true }).click();
    await page
      .getByRole('button', { name: `Front paw on ${name}`, exact: true })
      .click();
    await expect(page.locator('#clue-summary')).toContainText('displaced ends');
    await page
      .locator('#world > canvas')
      .screenshot({ path: info.outputPath(`${name}-fracture.png`) });
    await page
      .getByRole('button', { name: 'Stethoscope', exact: true })
      .click();
    await page
      .getByRole('button', { name: `Chest on ${name}`, exact: true })
      .click();
    await page.locator('[data-action="diagnose"]').click();
    await page
      .getByRole('button', { name: 'Broken bone', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Soft bandage', exact: true })
      .click();
    await page
      .getByRole('button', { name: `Front paw on ${name}`, exact: true })
      .click();
    await completeCareSkill(page);
    await expect(
      page.getByRole('heading', { name: `${name} feels better!`, exact: true }),
    ).toBeVisible();
    const balance = await page.getByTestId('coins').textContent();
    await page.getByRole('button', { name: 'Back to reception' }).click();
    await page.getByRole('button', { name: 'Hookville', exact: true }).click();
    await expect(page.locator('.town-news')).toContainText(
      `${name} is safely home`,
      { timeout: 45000 },
    );
    await page.reload();
    await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
      timeout: 45000,
    });
    await expect(page.getByTestId('coins')).toHaveText(balance!);
    await expect(
      page.locator(`[data-action="patient"][aria-label="See ${name}"]`),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  });

test('routine checkup finishes with healthy findings and survives a reload without duplicate rewards', async ({
  page,
}) => {
  const s = town();
  s.requestVisit('Cleo', 'checkup');
  for (let i = 0; i < 600; i++) s.update(0.1);
  await openSaved(page, s);
  await (await showPatient(page, 'Cleo')).click();
  await waitForExamination(page);
  await expect(page.locator('[data-action="diagnose"]')).toHaveCount(0);
  await expect(page.locator('[data-action="finish-checkup"]')).toBeDisabled();
  await page.getByRole('button', { name: 'Thermometer', exact: true }).click();
  await page.getByRole('button', { name: 'Coat on Cleo', exact: true }).click();
  await expect(page.locator('.heart-reading')).toContainText('Comfortable');
  await page.getByRole('button', { name: 'Stethoscope', exact: true }).click();
  await page
    .getByRole('button', { name: 'Chest on Cleo', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Finish healthy checkup', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Cleo has a healthy checkup!',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('meter')).toHaveCount(0);
  const coins = await page.getByTestId('coins').textContent();
  await page.reload();
  await expect(page.getByTestId('coins')).toHaveText(coins!);
  await expect(
    page.locator('[data-action="patient"][aria-label="See Cleo"]'),
  ).toHaveCount(0);
});

// Each new species/household combination uses real healthy findings and rewards.
for (const name of [
  'Daisy',
  'Biscuit',
  'Clover',
  'Nibbles',
  'Mochi',
  'Teddy',
  'Pebble',
  'Coral',
  'Waffles',
  'Ziggy',
]) {
  test(`${name}'s new household can complete a healthy checkup`, async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== 'desktop',
      'The shared checkup flow is also covered on mobile.',
    );
    const s = town();
    s.requestVisit(name, 'checkup');
    const h = s.households.find((h) => h.pets.some((p) => p.name === name))!;
    for (
      let i = 0;
      i < 1200 && (!h.inClinic || h.routine !== 'clinic-wait');
      i++
    )
      s.update(0.1);
    expect(h.inClinic).toBe(true);
    await openSaved(page, s);
    await (await showPatient(page, name)).click();
    await waitForExamination(page);
    const { toolInfo, zoneNames } = await import('../src/game');
    const visit = s.visit(h.ticket!);
    for (const check of visit.checks) {
      await page
        .getByRole('button', { name: toolInfo[check.tool].name, exact: true })
        .click();
      await page
        .getByRole('button', {
          name: `${zoneNames[check.zone]} on ${name}`,
          exact: true,
        })
        .click();
    }
    await page
      .getByRole('button', { name: 'Finish healthy checkup', exact: true })
      .click();
    await expect(
      page.getByRole('heading', {
        name: `${name} has a healthy checkup!`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole('meter')).toHaveCount(0);
  });
}
