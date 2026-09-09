import { showPatient, showTownNews, showTownHome } from './browser-helpers';
import { waitForExamination } from './browser-helpers';
import { expect, test } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { TownSimulation } from '../src/town-simulation';
import { visits } from '../src/game';

test.setTimeout(90000);
test('actual house geometry responds to hovering or tapping its roof', async ({
  page,
}, info) => {
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await page.getByRole('button', { name: 'Hookville', exact: true }).click();
  await page
    .getByRole('button', {
      name: "Amelia, Luna and Scout's House",
      exact: true,
    })
    .click();
  const scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  for (const key of [
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'ArrowRight',
  ])
    await page.keyboard.press(key);
  expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual(
    scroll,
  );
  await page.locator('#world').scrollIntoViewIfNeeded();
  const box = (await page.locator('#world > canvas').boundingBox())!;
  // Pan the adjacent home into the narrow map, then select its actual roof.
  const camera = new PerspectiveCamera(45, box.width / box.height, 0.1, 200);
  const pan = new Vector3(14, 0, -9).normalize().multiplyScalar(4);
  camera.position.copy(new Vector3(-3, 14, 6).add(pan));
  camera.lookAt(new Vector3(-12, 0, -8).add(pan));
  camera.updateMatrixWorld();
  const roof = new Vector3(-4, 2.65, -8).project(camera);
  expect(Math.abs(roof.x)).toBeLessThan(0.95);
  expect(Math.abs(roof.y)).toBeLessThan(0.95);
  const x = box.x + ((roof.x + 1) * box.width) / 2;
  const y = box.y + ((1 - roof.y) * box.height) / 2;
  if (info.project.name === 'mobile') await page.touchscreen.tap(x, y);
  else await page.mouse.move(x, y);
  await expect(page.locator('#town-label')).toHaveText(
    "Oliver and Milo's House",
  );
});

test('kennel rest poses and neighbour chat bubbles render in their town locations', async ({
  page,
}, info) => {
  const s = new TownSimulation(visits, () => 0.5);
  const state = s.snapshot();
  state.time = 100;
  state.emergencies.due = 99999; // Keep the authored chat/kennel poses in place.
  state.catalogueCursor = visits.length;
  state.households.forEach((h) => {
    h.remaining = 60;
    h.nextCare = 900;
  });
  for (const [i, x] of [
    [1, 10],
    [2, 10.8],
  ]) {
    const h = state.households[i];
    h.routine = 'chat';
    h.position = { x, z: -3 };
    h.remaining = 15;
    h.facing = i === 1 ? Math.PI / 2 : -Math.PI / 2;
    h.route = [
      { x: 18, z: -3 },
      { x: 22, z: -3 },
    ];
  }
  state.households[1].companions = ['Milo'];
  state.households[2].companions = [];
  state.events = [{ pet: 'Milo', kind: 'home', at: 50 }];
  if (!s.restore(state)) throw new Error('Invalid visual fixture');
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
  await page.getByRole('button', { name: 'Hookville', exact: true }).click();
  await page
    .getByRole('button', {
      name: "Amelia, Luna and Scout's House",
      exact: true,
    })
    .click();
  await page.locator('#world').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('kennels.png') });
  await (await showTownNews(page, 'Oliver')).click();
  await expect(page.locator('#town-home')).toContainText(
    'Chatting with a neighbour',
  );
  await page.locator('#world').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('neighbour-chat.png') });
});

test('the clinic doorway joins the street and a served family visibly leaves into the same town', async ({
  page,
}, info) => {
  const s = new TownSimulation(visits, () => 0.5);
  const state = s.snapshot();
  state.catalogueCursor = visits.length;
  state.households.forEach((h) => {
    h.nextCare = 900;
    h.remaining = 90;
  });
  expect(s.restore(state)).toBe(true);
  expect(s.requestVisit('Luna', 'checkup')).toBe(true);
  const h = s.households[0];
  for (let i = 0; i < 600 && h.routine !== 'clinic-enter'; i++) s.update(0.1);
  expect(h.routine).toBe('clinic-enter');
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
  await page.locator('#world').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('street-to-reception.png') });
  await page.getByRole('button', { name: 'Hookville', exact: true }).click();
  await (await showTownHome(page, "Mia and Clover's Flat")).click();
  await expect(page.locator('#town-home h3')).toHaveText(
    "Mia and Clover's Flat",
  );
  await page.getByRole('button', { name: 'Zara', exact: true }).click();
  await expect(page.locator('#town-home h3')).toHaveText(
    "Zara and Waffles's Flat",
  );
  await page
    .getByRole('button', { name: 'Back to the clinic', exact: true })
    .click();
  await (await showPatient(page, 'Luna')).click();
  await waitForExamination(page);
  for (const [tool, zone] of [
    ['Thermometer', 'Coat'],
    ['Stethoscope', 'Chest'],
  ]) {
    await page.getByRole('button', { name: tool, exact: true }).click();
    await page
      .getByRole('button', { name: `${zone} on Luna`, exact: true })
      .click();
  }
  await page
    .getByRole('button', { name: 'Finish healthy checkup', exact: true })
    .click();
  await page.getByRole('button', { name: /Back to reception/ }).click();
  await page.locator('#world').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('leaving-reception.png') });
  await page.getByRole('button', { name: 'Hookville', exact: true }).click();
  await (await showTownHome(page, "Amelia, Luna and Scout's House")).click();
  await page
    .getByRole('button', { name: 'Follow Amelia', exact: true })
    .click();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'town');
  await expect(page.locator('#town-home')).toContainText(
    /heading home|Heading home/,
  );
  await page.locator('#world').scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath('same-family-heading-home.png'),
  });
});
