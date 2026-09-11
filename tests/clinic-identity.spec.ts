import { expect, test, type Page } from '@playwright/test';
import { build } from 'vite';
import { TownSimulation } from '../src/town-simulation';
import { visits, upgrades } from '../src/game';
import { clinicAttractions, clinicFixtureNames } from '../src/clinic-identity';
const owned = upgrades.filter((u) => u.id !== 'stock').map((u) => u.id);
let script = '';
test.setTimeout(120000);
test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      lib: {
        entry: 'tests/fixtures/clinic-identity-harness.ts',
        formats: ['iife'],
        name: 'ClinicIdentityHarness',
      },
    },
  });
  for (const out of Array.isArray(result) ? result : [result])
    if ('output' in out)
      for (const chunk of out.output)
        if (chunk.type === 'chunk') script += chunk.code;
});
function waiting(ride = false) {
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic(
    ['Luna', 'Milo', 'Peanut', 'Sunny', 'Hazel', 'Cleo'].map((name) =>
      visits.findIndex((v) => v.name === name),
    ),
  );
  s.configureClinic(8, 22);
  s.configureLeisure(owned);
  const luna = visits.findIndex((v) => v.name === 'Luna');
  for (let i = 0; i < (ride ? 6000 : 200); i++) {
    s.update(0.1);
    const p = s.leisure.pets.get(luna);
    if (
      ride &&
      p?.phase === 'use' &&
      p.station === 'coaster' &&
      p.elapsed < 0.2
    )
      return s.snapshot();
  }
  if (ride) throw Error('No Luna coaster turn in the fixture');
  return s.snapshot();
}
async function open(page: Page, ride = false) {
  const index = await (await page.request.get('/')).text(),
    css = index.match(/href="([^"]+\.css)"/)![1];
  await page.addInitScript(
    ({ town, owned }) =>
      localStorage.setItem(
        'louises-vet-office-v1',
        JSON.stringify({
          version: 1,
          coins: 2000,
          earned: 0,
          happiness: 100,
          treated: 0,
          stock: 3,
          upgrades: owned,
          sound: false,
          town,
        }),
      ),
    { town: waiting(ride), owned },
  );
  await page.route('**/clinic-inspect-test.html', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${css}"><div id="app"></div>`,
    }),
  );
  // Routed fixture documents need their local resources fulfilled too, matching
  // the other browser fixtures on Chromium's private-network path.
  await page.route(/\/(assets|models|images)\//, async (route) =>
    route.fulfill({ response: await route.fetch() }),
  );
  await page.goto('/clinic-inspect-test.html');
  await page.addScriptTag({ content: script });
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
}
const card = (page: Page) => page.locator('.clinic-inspection:visible');
async function pointAt(page: Page, name: string, touch: boolean) {
  const point = await page.evaluate((name) => window.clinicTarget(name), name);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.move(point.x, point.y);
  await expect(card(page).locator('.inspection-name')).toHaveText(name);
  return point;
}
test('clinic people, pets and attractions identify their visible models without calling a patient', async ({
  page,
}, info) => {
  await open(page);
  const touch = info.project.name === 'mobile';
  for (const name of [
    'Louise',
    'Amelia',
    'Luna',
    'Scout',
    'Sunny',
    ...Object.values(clinicFixtureNames),
  ])
    await pointAt(page, name, touch);
  await expect(page.locator('#clinic-call')).toHaveAttribute(
    'data-stage',
    'idle',
  );
  await expect(page.locator('.call-next')).toBeVisible();
  await page.screenshot({
    path: info.outputPath('clinic-attraction-name.png'),
  });
  if (touch)
    await card(page).getByRole('button', { name: 'Close clinic info' }).tap();
  else await page.keyboard.press('Escape');
  await expect(card(page)).toHaveCount(0);
  await expect(page.locator('.patient-list')).toBeVisible();
  const hiddenPoint = await pointAt(page, 'Books and magazines', touch);
  await page.evaluate(() => window.clinicHideNamed('Books and magazines'));
  if (touch) await page.touchscreen.tap(hiddenPoint.x, hiddenPoint.y);
  else await page.mouse.move(hiddenPoint.x, hiddenPoint.y);
  await expect(
    card(page)
      .locator('.inspection-name')
      .filter({ hasText: 'Books and magazines' }),
  ).toHaveCount(0);
  const point = await pointAt(page, 'Louise', touch);
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...point, id: 0 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: point.x + 60, y: point.y, id: 0 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ ...point, id: 0 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    await page.mouse.down();
    await page.mouse.move(point.x + 60, point.y, { steps: 5 });
    await page.mouse.move(point.x, point.y, { steps: 5 });
    await page.mouse.up();
  }
  await expect(card(page)).toHaveCount(0);
});
test('a riding pet shares its current feeling, companions stay distinct, and short layouts keep controls clear', async ({
  page,
}, info) => {
  await open(page, true);
  const touch = info.project.name === 'mobile';
  if (touch) {
    const point = await page.evaluate(() => window.clinicTarget('Luna'));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...point, id: 0 }],
    });
    // The coaster has moved by release: the tap must retain the pet that was
    // beneath the finger initially, not switch to the empty track underneath.
    await page.evaluate(() => window.clinicAdvance(2));
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await cdp.detach();
    await expect(card(page).locator('.inspection-name')).toHaveText('Luna');
  } else await pointAt(page, 'Luna', false);
  await expect(card(page).locator('.inspection-feeling')).toHaveText(
    clinicAttractions.coaster.feeling,
  );
  expect(
    await page.evaluate(() => window.clinicInspectNamed('Scout')),
  ).toMatchObject({ name: 'Scout', description: 'Amelia’s dog' });
  expect(
    (await page.evaluate(() => window.clinicInspectNamed('Scout')))?.feeling,
  ).toBeUndefined();
  await page.screenshot({ path: info.outputPath('happy-coaster-pet.png') });
  await page.evaluate(() => window.clinicFinishTurn('Luna'));
  await expect(
    page.locator('.clinic-inspection:visible .inspection-feeling:visible'),
  ).toHaveCount(0);
  // Exercise the real UI callback with each reaction on a very short viewport.
  // Geometric picking above is independent of this layout/content coverage.
  for (const size of [
    { width: 360, height: 640 },
    { width: 1280, height: 650 },
  ]) {
    await page.setViewportSize(size);
    for (const attraction of Object.values(clinicAttractions)) {
      await page.evaluate(
        (feeling) =>
          window.clinicInfoPreview({
            name: 'Luna',
            description: 'Amelia’s dog',
            feeling,
          }),
        attraction.feeling,
      );
      const problems = await page.evaluate(() => {
        const card = document.querySelector<HTMLElement>(
          '.office-patients .clinic-inspection',
        )!;
        const bounds = card.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollHeight - innerHeight,
          clipped: [...card.children]
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return (
                r.top < bounds.top ||
                r.bottom > bounds.bottom ||
                r.left < bounds.left ||
                r.right > bounds.right
              );
            })
            .map((e) => e.className),
        };
      });
      expect(problems).toEqual({ overflow: 0, clipped: [] });
    }
    await page.screenshot({
      path: info.outputPath(`clinic-info-${size.width}.png`),
    });
  }
});
