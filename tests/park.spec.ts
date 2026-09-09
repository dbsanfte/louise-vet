import { test, expect } from '@playwright/test';
import { TownSimulation } from '../src/town-simulation';
import { visits } from '../src/game';
import { parkSeat, parkRest } from '../src/park';
test('a busy park has separated families, active pets, ducks, and visible camera controls after reload', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const sim = new TownSimulation(visits, () => 0.5);
  for (const h of sim.households) {
    const seat = parkSeat(h.id);
    h.position = { x: seat.x, z: seat.z };
    h.facing = seat.facing;
    h.routine = 'park';
    h.remaining = 240;
    h.nextCare = 10000;
    h.companions = h.pets.map((p) => p.name);
    sim.park.enter(h);
    const v = sim.park.visits.get(h.id)!;
    v.seated = true;
    v.route = [];
    v.pets.forEach((p, i) => (p.position = parkRest(h.id, i)));
  }
  for (let i = 0; i < 120; i++) sim.update(0.1);
  const snapshot = sim.snapshot();
  snapshot.catalogueCursor = visits.length;
  const errors: string[] = [];
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
  await page.getByRole('button', { name: 'Pet park', exact: true }).click();
  const layout = await page.evaluate(() => {
    const rect = document
      .querySelector('#world > canvas')!
      .getBoundingClientRect();
    return {
      canvas: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      height: innerHeight,
      buttons: ['town-park', 'town-reset', 'reception'].map((action) => {
        const button = document.querySelector<HTMLButtonElement>(
          `#scene-controls [data-action="${action}"],#stage-footer [data-action="${action}"]`,
        )!;
        const r = button.getBoundingClientRect();
        return { action, visible: button.checkVisibility(), bottom: r.bottom };
      }),
    };
  });
  for (const button of layout.buttons) {
    expect(button.visible).toBe(true);
    expect(button.bottom).toBeLessThanOrEqual(layout.height + 1);
  }
  const before = await page.screenshot({
    clip: layout.canvas,
    path: info.outputPath('busy-pet-park.png'),
  });
  await page.waitForTimeout(700);
  expect((await page.screenshot({ clip: layout.canvas })).equals(before)).toBe(
    false,
  );
  // Saved activity positions and family seats survive the actual page lifecycle.
  await page.reload();
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  const state = await page.evaluate(
    () => JSON.parse(localStorage.getItem('louises-vet-office-v1')!).town,
  );
  expect(state.park.length).toBe(18);
  expect(new Set(state.park.map((v: { owner: number }) => v.owner)).size).toBe(
    18,
  );
  expect(
    state.park.some((v: { pets: { station?: string }[] }) =>
      v.pets.some((p) => p.station),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
