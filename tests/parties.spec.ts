import { expect, test } from '@playwright/test';
import { build } from 'vite';
import { TownSimulation } from '../src/town-simulation';
import { visits } from '../src/game';
import { rescueTrees } from '../src/emergency-map';

function partyFixture() {
  const s = new TownSimulation(visits, () => 0.5);
  s.parties.due = 0;
  s.parties.cursor = 15;
  s.emergencies.due = 9999;
  for (const h of s.households) h.nextCare = 9999;
  for (let i = 0; i < 1800 && s.parties.active?.phase !== 'games'; i++)
    s.update(0.1);
  expect(s.parties.active?.phase).toBe('games');
  const saved = s.snapshot();
  saved.catalogueCursor = visits.length;
  return saved;
}

test('birthday parties are discoverable by touch/keyboard, fit the viewport, and resume after reload', async ({
  page,
}, info) => {
  const snapshot = partyFixture(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
  }, snapshot);
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await page.getByRole('button', { name: 'Hookville', exact: true }).click();
  await page.getByRole('button', { name: 'Town news', exact: true }).click();
  const button = page.getByRole('button', { name: 'Pet parties', exact: true });
  await expect(button).toBeInViewport();
  if (info.project.name === 'desktop') {
    await button.focus();
    await button.press('Enter');
  } else await button.tap();
  await expect(page.locator('#town-home')).toContainText('Mochi’s birthday');
  await expect(
    page.getByRole('button', { name: 'Watch the party hall' }),
  ).toBeInViewport();
  await expect(
    page.getByRole('button', { name: 'Back to the clinic' }),
  ).toBeInViewport();
  // Let the software renderer present the newly focused view before capturing it.
  await page.waitForTimeout(1200);
  await page.screenshot({ path: info.outputPath('birthday-party.png') });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight + 1,
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('louises-vet-office-v1')!).town,
  );
  expect(saved.parties.celebrated.Mochi).toBe(1);
  expect(saved.parties.active.pet).toBe('Mochi');
  await page.getByRole('button', { name: 'Hookville', exact: true }).click();
  await page.getByRole('button', { name: 'Town news', exact: true }).click();
  await page.setViewportSize({ width: 360, height: 640 });
  await expect(
    page.getByRole('button', { name: 'Pet parties', exact: true }),
  ).toBeInViewport();
  await page.getByRole('button', { name: 'Pet parties', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Watch the party hall' }),
  ).toBeInViewport();
  await expect(
    page.getByRole('button', { name: 'Back to the clinic' }),
  ).toBeInViewport();
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: info.outputPath('birthday-party-small-phone.png'),
  });
  expect(errors).toEqual([]);
});

let script = '';
test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: {
        entry: 'tests/fixtures/emergency-harness.ts',
        formats: ['iife'],
        name: 'EmergencyHarness',
      },
    },
  });
  for (const out of Array.isArray(result) ? result : [result])
    if ('output' in out)
      for (const c of out.output) if (c.type === 'chunk') script += c.code;
});
for (const graphics of ['software', 'standard'] as const)
  test(`party animals animate and construction clears trees (${graphics} graphics)`, async ({
    page,
  }, info) => {
    test.setTimeout(90000);
    if (graphics === 'standard')
      await page.addInitScript(() => {
        const original = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function (
          parameter: number,
        ) {
          return parameter === 37446
            ? 'Standard graphics test'
            : original.call(this, parameter);
        };
      });
    await page.setViewportSize({ width: 900, height: 650 });
    await page.route('**/party-test.html', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html><body></body></html>',
      }),
    );
    await page.route('**/models/**', async (r) =>
      r.fulfill({ response: await r.fetch() }),
    );
    await page.goto('/party-test.html');
    await page.addScriptTag({ content: script });
    const snapshot = partyFixture();
    const first = await page.evaluate((s) => window.inspectParty(s), snapshot);
    expect(first.label).toContain('Mochi’s birthday');
    expect(first.pets.map((p) => p.name).sort()).toEqual(
      snapshot.parties
        .active!.guests.flatMap((g) => g.pets.map((p) => p.name))
        .sort(),
    );
    expect(
      first.pets
        .filter((p) => ['Pico', 'Pepper', 'Melody'].includes(p.name))
        .every((p) => p.flying && p.wings.length === 2),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath('party-games-render.png') });
    const later = await page.evaluate(
      (s) => window.inspectParty(s, 0.5),
      snapshot,
    );
    expect(later.pets.find((p) => p.name === 'Pico')!.wings).not.toEqual(
      first.pets.find((p) => p.name === 'Pico')!.wings,
    );
    expect(later.pets.find((p) => p.name === 'Coral')!.x).toBe(
      first.pets.find((p) => p.name === 'Coral')!.x,
    );
    // Build a connected garden corridor to the previously blocked northern rescue tree.
    const s = new TownSimulation(visits, () => 0.5);
    expect(s.restore(snapshot)).toBe(true);
    const tree = rescueTrees[1];
    for (const [a, b] of [
      [
        { x: -11, z: -4 },
        { x: -5, z: 3 },
      ],
      [
        { x: -16, z: -10 },
        { x: -6, z: -3 },
      ],
      [
        { x: -17, z: -22 },
        { x: -15, z: -9 },
      ],
      [
        { x: -17, z: -30 },
        { x: -15, z: -21 },
      ],
    ])
      expect(
        s.build.autoSpace(a, b, 'garden', 100000, [], true).error,
      ).toBeUndefined();
    const built = await page.evaluate(
      (s) => window.inspectParty(s),
      s.snapshot(),
    );
    expect(
      built.trees.find((p) => p.x === tree.x && p.z === tree.z)?.visible,
    ).toBe(false);
  });
