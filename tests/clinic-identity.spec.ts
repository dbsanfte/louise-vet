import { expect, test, type Page } from '@playwright/test';
import { build } from 'vite';
import { TownSimulation } from '../src/town-simulation';
import { visits, upgrades } from '../src/game';
import { clinicAttractions, clinicFixtureNames } from '../src/clinic-identity';
import { messagesFor } from '../src/character-voices';
import { characterFeeling } from '../src/character-feelings';
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
const bubble = (page: Page) =>
  page.locator('.world-bubble[data-source="inspect"]:visible');
async function pointAt(page: Page, name: string, touch: boolean) {
  const point = await page.evaluate((name) => window.clinicTarget(name), name);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.move(point.x, point.y);
  await expect(bubble(page).locator('.bubble-name')).toHaveText(name);
  await expect(page.locator('.patient-list')).toBeVisible();
  await expect(page.locator('.world-bubble')).toHaveCount(1);
  return point;
}
test('head bubbles identify people, companions and every attraction without replacing the patient menu', async ({
  page,
}, info) => {
  await open(page);
  const touch = info.project.name === 'mobile';
  const menu = await page.locator('.patient-list').boundingBox();
  for (const name of [
    'Louise',
    'Amelia',
    'Luna',
    'Scout',
    'Sunny',
    ...Object.values(clinicFixtureNames),
  ]) {
    await pointAt(page, name, touch);
    expect(await page.locator('.patient-list').boundingBox()).toEqual(menu);
  }
  await expect(page.locator('#clinic-call')).toHaveAttribute(
    'data-stage',
    'idle',
  );
  await expect(page.locator('.call-next')).toBeVisible();
  await page.screenshot({ path: info.outputPath('attraction-bubble.png') });
  const hidden = await pointAt(page, 'Books and magazines', touch);
  await page.evaluate(() => window.clinicHideNamed('Books and magazines'));
  if (touch) await page.touchscreen.tap(hidden.x, hidden.y);
  else await page.mouse.move(hidden.x, hidden.y);
  await expect(
    bubble(page)
      .locator('.bubble-name')
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
  await expect(bubble(page)).toHaveCount(0);
});
test('one bubble follows its rider, changes feeling when the turn ends, and leaves short-screen controls visible', async ({
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
    await page.evaluate(() => window.clinicAdvance(2));
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await cdp.detach();
    await expect(bubble(page).locator('.bubble-name')).toHaveText('Luna');
  } else await pointAt(page, 'Luna', false);
  await expect(bubble(page).locator('.bubble-feeling')).toContainText(
    clinicAttractions.coaster.feeling,
  );
  const before = await bubble(page).getAttribute('data-anchor-x');
  await page.evaluate(() => window.clinicAdvance(1));
  await expect(bubble(page)).not.toHaveAttribute('data-anchor-x', before!);
  expect(
    (await page.evaluate(() => window.clinicInspectNamed('Scout')))?.feeling,
  ).not.toContain('Wheee');
  await page.screenshot({ path: info.outputPath('moving-pet-bubble.png') });
  await page.evaluate(() => window.clinicFinishTurn('Luna'));
  await expect(bubble(page).locator('.bubble-feeling')).not.toContainText(
    'Wheee',
  );
  for (const size of [
    { width: 360, height: 640 },
    { width: 1280, height: 650 },
  ]) {
    await page.setViewportSize(size);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await pointAt(page, 'Amelia', touch);
    const problems = await page.evaluate(() => {
      const b = document.querySelector<HTMLElement>('.world-bubble')!,
        r = b.getBoundingClientRect();
      const world = document.querySelector('#world')!.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollHeight - innerHeight,
        inside:
          r.top >= world.top &&
          r.bottom <= world.bottom &&
          r.left >= world.left &&
          r.right <= world.right,
        interactive: getComputedStyle(b).pointerEvents,
      };
    });
    expect(problems).toEqual({
      overflow: 0,
      inside: true,
      interactive: 'none',
    });
    await expect(page.locator('.patient-list')).toBeVisible();
    await expect(page.locator('.call-next')).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`bubble-${size.width}.png`),
    });
  }
});
test('messages vary, replace each other immediately, and expire after five seconds even under the mouse', async ({
  page,
}, info) => {
  await open(page, true);
  const touch = info.project.name === 'mobile';
  const spoken: string[] = [];
  for (let i = 0; i < 5; i++) {
    await pointAt(page, 'Luna', touch);
    spoken.push((await bubble(page).locator('.bubble-feeling').textContent())!);
  }
  expect(new Set(spoken).size).toBe(5);
  await pointAt(page, 'Amelia', touch);
  await expect(page.locator('.world-bubble:visible')).toHaveCount(1);
  await expect(bubble(page).locator('.bubble-name')).toHaveText('Amelia');
  await expect(bubble(page)).toHaveCount(0, { timeout: 6500 });
  await expect(page.locator('.patient-list')).toBeVisible();
  await page.waitForTimeout(300);
  await expect(bubble(page)).toHaveCount(0);
  await pointAt(page, 'Louise', touch);
  await page.getByRole('button', { name: /Clinic shop/ }).click();
  await expect(page.locator('.world-bubble:visible')).toHaveCount(0);
});

test('Hookville rescue feelings appear automatically above the actual owners and pets', async ({
  page,
}, info) => {
  await open(page);
  await page.getByRole('button', { name: 'Hookville', exact: true }).click();
  for (const [name, kind, phase] of [
    ['Milo', 'lost', 'climb'],
    ['Pico', 'lost', 'handover'],
    ['Luna', 'fire', 'exit-house'],
  ] as const) {
    const s = new TownSimulation(visits, () => 0.5);
    s.households.forEach((h) => {
      h.remaining = 290;
      h.nextCare = 9999;
    });
    const h = s.households.find((h) => h.pets.some((p) => p.name === name))!;
    expect(s.emergencies.start(kind, h, s.households, 0, () => 0.5)).toBe(true);
    if (kind === 'lost') s.emergencies.active!.pets = [name];
    for (
      let i = 0;
      i < 4500 &&
      !(
        s.emergencies.active?.phase === phase &&
        s.emergencies.active.elapsed > 1
      );
      i++
    )
      s.update(0.1);
    expect(s.emergencies.active?.phase).toBe(phase);
    await page.evaluate(
      ({ snapshot, name }) => window.clinicTownSnapshot(snapshot, name),
      { snapshot: s.snapshot(), name },
    );
    const speech = page.locator(
      '.world-bubble[data-source="reaction"]:visible',
    );
    await expect(speech).toBeVisible({ timeout: 10000 });
    const speaker = (await speech.locator('.bubble-name').textContent())!;
    const family = s.households.find(
      (h) => h.owner === speaker || h.pets.some((p) => p.name === speaker),
    )!;
    const feeling = characterFeeling(
      s,
      family,
      family.pets.find((p) => p.name === speaker),
    );
    expect(feeling.priority).toBe(4);
    expect(messagesFor(speaker, feeling.text, true)).toContain(
      await speech.locator('.bubble-feeling').textContent(),
    );
    await expect(page.locator('.world-bubble:visible')).toHaveCount(1);
    await page.screenshot({
      path: info.outputPath(`town-bubble-${name}-${phase}.png`),
    });
  }
});
