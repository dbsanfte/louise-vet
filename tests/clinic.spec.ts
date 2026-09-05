import { expect, test, type Page } from '@playwright/test';

test.setTimeout(90000);
async function openClinic(page: Page) {
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
}
async function applyInGreen(page: Page) {
  // Click the real care control when its visible moving meter is in the green.
  await page.waitForFunction(
    () => {
      const meter = document.querySelector('[role="meter"]');
      const value = Number(meter?.getAttribute('aria-valuenow'));
      if (meter && value >= 40 && value <= 60) {
        document
          .querySelector<HTMLButtonElement>('[data-action="apply"]')!
          .click();
        return true;
      }
      return false;
    },
    {},
    { timeout: 15000 },
  );
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
  await applyInGreen(page);
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
    'In your clinic',
  );
  await expect(page.getByTestId('coins')).toHaveText('60');
});

test('a patient can return to the queue without claiming a reward', async ({
  page,
}) => {
  await openClinic(page);
  await page.locator('[data-action="next"]').click();
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

test('all ten visits are playable and every pet can receive care', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop',
    'Full case coverage runs once; the core loop also runs on mobile.',
  );
  test.setTimeout(480000);
  const { visits, toolInfo, zoneNames } = await import('../src/game');
  await openClinic(page);
  for (const visit of visits) {
    // The primary control stays available if a timed arrival replaces the
    // empty-queue invitation while the click is being delivered.
    await page.locator('.call-next').click();
    if ((await page.locator('#app').getAttribute('data-mode')) === 'reception')
      await page.locator('.call-next').click();
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
      await page.waitForFunction(() => {
        const value = Number(
          document
            .querySelector('[role="meter"]')
            ?.getAttribute('aria-valuenow'),
        );
        if (value > 85) {
          document
            .querySelector<HTMLButtonElement>('[data-action="apply"]')!
            .click();
          return true;
        }
        return false;
      });
      await expect(page.getByRole('status')).toContainText(
        'No vaccine given yet',
      );
      await expect(page.getByRole('meter')).toBeVisible();
      await expect(page.getByTestId('coins')).toHaveText(coinsBefore!);
      await page.getByRole('button', { name: 'Stop visit' }).click();
      await expect(page.locator('#app')).toHaveAttribute(
        'data-mode',
        'reception',
      );
      await expect(page.getByRole('meter')).toHaveCount(0);
      await expect(page.getByTestId('coins')).toHaveText(coinsBefore!);
      await page
        .getByRole('button', { name: `See ${visit.name}`, exact: true })
        .first()
        .click();
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
        page.getByRole('button', { name: 'Give vaccine', exact: false }),
      ).toBeVisible();
    }
    await applyInGreen(page);
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
