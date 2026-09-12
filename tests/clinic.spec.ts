import { completeCareSkill } from './browser-helpers';
import { showPatient } from './browser-helpers';
import { waitForExamination } from './browser-helpers';
import { expect, test, type Page } from '@playwright/test';

test.setTimeout(90000);
async function openClinic(page: Page) {
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
}

test('examine, diagnose, place treatment, earn rewards, and keep progress', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await openClinic(page);
  await expect(page).toHaveTitle("Louise's Vet Office");
  await page.locator('[data-action="next"]').click();
  await waitForExamination(page);
  await expect(page.locator('[data-action="diagnose"]')).toBeDisabled();
  await page.getByRole('button', { name: 'Ear scope', exact: true }).click();
  await page
    .getByRole('button', { name: 'Front paw on Luna', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText(
    'Ear scope works at ear',
  );
  await page.getByRole('button', { name: 'Ear on Luna', exact: true }).click();
  await expect(page.locator('.findings')).toContainText(
    'ear looks clear and comfortable',
  );
  await expect(page.locator('[data-action="diagnose"]')).toBeDisabled();
  await page.getByRole('button', { name: 'Ear on Luna', exact: true }).click();
  await expect(page.locator('.findings li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Magnifier', exact: true }).click();
  await page
    .getByRole('button', { name: 'Front paw on Luna', exact: true })
    .click();
  await expect(page.locator('.findings')).toContainText('small pink bump');
  await page.getByRole('button', { name: 'Stethoscope', exact: true }).click();
  await page
    .getByRole('button', { name: 'Chest on Luna', exact: true })
    .click();
  const diagnose = page.locator('[data-action="diagnose"]');
  await expect(diagnose).toBeInViewport({ ratio: 1 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(diagnose).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Stop visit' })).toBeInViewport(
    { ratio: 1 },
  );
  await diagnose.click();
  await page.getByRole('button', { name: 'Fleas', exact: true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'diagnose');
  await page.getByRole('button', { name: 'Bee sting', exact: true }).click();
  await page
    .getByRole('button', { name: 'Soothing cream', exact: true })
    .click();
  await page.getByRole('button', { name: 'Coat on Luna', exact: true }).click();
  await expect(page.getByRole('meter')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Front paw on Luna', exact: true })
    .click();
  await expect(page.getByRole('meter')).toBeVisible();
  await completeCareSkill(page);
  await expect(
    page.getByRole('heading', { name: 'Luna feels better!' }),
  ).toBeVisible();
  const balance = await page.getByTestId('coins').textContent();
  expect(Number(balance)).toBeGreaterThan(120);
  await page.getByRole('button', { name: 'Back to reception' }).click();
  await page.reload();
  await expect(page.getByTestId('coins')).toHaveText(balance!);
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
});

test('upgrades charge once and remain owned after reloading', async ({
  page,
}) => {
  await openClinic(page);
  await page.getByRole('button', { name: /Clinic shop/ }).click();
  await page.locator('[data-upgrade="plants"]').click();
  await expect(page.getByTestId('coins')).toHaveText('60');
  await expect(page.locator('[data-upgrade="plants"]')).toBeDisabled();
  await expect(page.locator('[data-upgrade="equipment"]')).toBeDisabled();
  await page.getByRole('button', { name: 'Close shop' }).click();
  await page.reload();
  await page.getByRole('button', { name: /Clinic shop/ }).click();
  await expect(page.locator('[data-upgrade="plants"]')).toHaveText(
    'In your collection',
  );
  await expect(page.getByTestId('coins')).toHaveText('60');
});

test('a patient can return to the queue without claiming a reward', async ({
  page,
}) => {
  await openClinic(page);
  await page.locator('[data-action="next"]').click();
  await waitForExamination(page);
  const canvas = page.locator('#world > canvas');
  const beforeRotation = await canvas.screenshot();
  await page.getByRole('button', { name: 'Rotate animal right' }).click();
  expect((await canvas.screenshot()).equals(beforeRotation)).toBe(false);
  await page.getByRole('button', { name: 'Reset camera' }).click();
  await page.getByRole('button', { name: 'Stop visit', exact: false }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'reception');
  await expect(page.locator('[data-action="next"]')).toHaveText('See Luna');
  await expect(page.getByTestId('coins')).toHaveText('120');
});

test('all authored visits are playable and every pet can receive care', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop',
    'Full case coverage runs once; the core loop also runs on mobile.',
  );
  const {
    authoredVisits: visits,
    toolInfo,
    zoneNames,
  } = await import('../src/game');
  // Each visit includes real town travel, clinic escort and instrument activity.
  // Keep the same per-visit allowance as the individual integration tests.
  test.setTimeout(visits.length * 90000);
  // This sweep verifies authored conditions. Random accidents have their own
  // journey/care tests and must not replace Maple's fever during the long run.
  const { TownSimulation } = await import('../src/town-simulation');
  const { visits: roster } = await import('../src/game');
  const simulation = new TownSimulation(roster, () => 0.5);
  simulation.seedClinic();
  const town = simulation.snapshot();
  town.accidentDue = 3600;
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
  }, town);
  await openClinic(page);
  for (const visit of visits) {
    // Families now walk from their homes before joining the waiting room.
    await (await showPatient(page, visit.name)).click();
    await waitForExamination(page);
    await expect(
      page.getByRole('heading', { name: visit.name, exact: true }),
    ).toBeVisible();
    const vaccination = visit.treatment === 'vaccine';
    if (vaccination) {
      await expect(page.locator('#toast')).toBeEmpty();
      await expect(page.locator('#app')).toHaveAttribute(
        'data-mode',
        'place-vaccine',
      );
      await expect(page.locator('[data-action="diagnose"]')).toHaveCount(0);
      await expect(page.locator('.case-steps')).not.toContainText('Diagnose');
      await page
        .getByRole('button', { name: `Ear on ${visit.name}`, exact: true })
        .click();
      await expect(page.getByRole('meter')).toHaveCount(0);
      await expect(page.getByRole('status')).toContainText(
        'Nothing has been given yet',
      );
    } else {
      for (const check of visit.checks) {
        await page
          .getByRole('button', { name: toolInfo[check.tool].name, exact: true })
          .click();
        await page
          .getByRole('button', {
            name: `${zoneNames[check.zone]} on ${visit.name}`,
            exact: true,
          })
          .click();
        if (
          ['inspect', 'ear', 'mouth', 'xray', 'listen'].includes(check.tool)
        ) {
          await expect(
            page.locator('.examination-readout'),
          ).not.toHaveAttribute('data-view', 'positioning');
          await testInfo.attach(`${visit.name}-${check.tool}`, {
            body: await page.locator('#world > canvas').screenshot({
              path: testInfo.outputPath(`${visit.name}-${check.tool}.png`),
            }),
            contentType: 'image/png',
          });
        }
      }
      await page.locator('[data-action="diagnose"]').click();
      await page
        .getByRole('button', { name: visit.diagnosis, exact: true })
        .click();
      await page
        .getByRole('button', {
          name: toolInfo[visit.treatment].name,
          exact: true,
        })
        .click();
    }
    await page
      .getByRole('button', {
        name: `${zoneNames[visit.zone]} on ${visit.name}`,
        exact: true,
      })
      .click();
    if (vaccination) {
      const coinsBefore = await page.getByTestId('coins').textContent();
      // A miss must leave the vaccine unapplied, and stopping during timing
      // must return the same patient with no reward or lingering treatment.
      await page.getByRole('button', { name: 'Start when ready' }).click();
      await page
        .getByRole('button', { name: 'Give vaccine', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Pause vaccine', exact: true })
        .click();
      await expect(page.locator('.skill-feedback')).toContainText(
        'No vaccine given',
      );
      await expect(page.getByRole('meter')).toBeVisible();
      await expect(page.getByTestId('coins')).toHaveText(coinsBefore!);
      await page
        .locator('.skill-dialog')
        .getByRole('button', { name: 'Stop visit' })
        .click();
      await expect(page.locator('#app')).toHaveAttribute(
        'data-mode',
        'reception',
      );
      await expect(page.getByRole('meter')).toHaveCount(0);
      await expect(page.getByTestId('coins')).toHaveText(coinsBefore!);
      await (await showPatient(page, visit.name)).click();
      await waitForExamination(page);
      await expect(page.locator('#app')).toHaveAttribute(
        'data-mode',
        'place-vaccine',
      );
      await page
        .getByRole('button', {
          name: `${zoneNames[visit.zone]} on ${visit.name}`,
          exact: true,
        })
        .click();
      await expect(
        page.getByRole('button', { name: 'Start when ready', exact: true }),
      ).toBeVisible();
    }
    await completeCareSkill(page);
    await expect(
      page.getByRole('heading', {
        name: `${visit.name} ${vaccination ? 'is all set' : 'feels better'}!`,
      }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Back to reception' }).click();
  }
  await expect(page.locator('.clinic-total')).toContainText(
    `${visits.length} friends helped`,
  );
  const happiness = parseInt(
    (await page.getByTestId('happiness').textContent())!,
  );
  expect(happiness).toBeGreaterThanOrEqual(96);
  expect(happiness).toBeLessThanOrEqual(100);
});

test('vaccination pressure can be cancelled, retried and confirmed for exactly one reward', async ({
  page,
}) => {
  const { TownSimulation } = await import('../src/town-simulation');
  const { visits } = await import('../src/game');
  const s = new TownSimulation(visits, () => 0.5);
  const id = visits.findIndex((v) => v.treatment === 'vaccine');
  s.seedClinic([id]);
  const town = s.snapshot();
  town.catalogueCursor = visits.length;
  town.accidentDue = 10000;
  await page.addInitScript((town) => {
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
          town,
        }),
      );
  }, town);
  await openClinic(page);
  await (await showPatient(page, visits[id].name)).click();
  await waitForExamination(page);
  await expect(page.locator('#app')).toHaveAttribute(
    'data-mode',
    'place-vaccine',
  );
  await page
    .getByRole('button', { name: `Coat on ${visits[id].name}`, exact: true })
    .click();
  await page.getByRole('button', { name: 'Start when ready' }).click();
  await page.getByRole('button', { name: 'Give vaccine', exact: true }).click();
  await page
    .getByRole('button', { name: 'Pause vaccine', exact: true })
    .click();
  await expect(page.locator('.skill-feedback')).toContainText(
    'No vaccine given',
  );
  await expect(page.getByTestId('coins')).toHaveText('120');
  await page.getByRole('button', { name: 'Cancel care activity' }).click();
  await expect(page.locator('#app')).toHaveAttribute(
    'data-mode',
    'place-vaccine',
  );
  await page
    .getByRole('button', { name: `Coat on ${visits[id].name}`, exact: true })
    .click();
  await completeCareSkill(page);
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'result');
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('louises-vet-office-v1')!),
  );
  expect(saved.treated).toBe(1);
  expect(saved.coins).toBeGreaterThan(120);
  await page.reload();
  await expect(page.getByTestId('coins')).toHaveText(String(saved.coins));
  const reloaded = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('louises-vet-office-v1')!),
  );
  expect(reloaded.treated).toBe(1);
});
