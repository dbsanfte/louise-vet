import { test, expect } from '@playwright/test';
import { TownSimulation } from '../src/town-simulation';
import { visits } from '../src/game';
test.setTimeout(120000);
test('all Hookville homes, shared flats, news and clinic return fit short windows', async ({
  page,
}, info) => {
  await page.setViewportSize(
    info.project.name === 'mobile'
      ? { width: 360, height: 640 }
      : { width: 1280, height: 650 },
  );
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic([0, 1, 2]);
  const town = s.snapshot();
  town.events = [
    { pet: 'Luna', kind: 'home', at: 0 },
    { pet: 'Milo', kind: 'home', at: 0 },
    { pet: 'Pip', kind: 'home', at: 0 },
    { pet: 'Peanut', kind: 'home', at: 0 },
  ];
  town.accidentDue = 3600;
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
    town,
  );
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await page.getByRole('button', { name: 'Hookville', exact: true }).click();
  async function fits() {
    expect(
      await page.evaluate(() => {
        const bad: string[] = [];
        if (
          document.documentElement.scrollHeight > innerHeight + 1 ||
          document.documentElement.scrollWidth > innerWidth + 1
        )
          bad.push('page scrolls');
        for (const el of document.querySelectorAll<HTMLElement>(
          '#sidebar button, #sidebar h3, #sidebar p, #stats > .stat, #scene-controls button, #stage-footer button, .bottom-bar button',
        )) {
          if (!el.checkVisibility()) continue;
          const r = el.getBoundingClientRect();
          if (
            r.top < 0 ||
            r.bottom > innerHeight + 1 ||
            r.left < 0 ||
            r.right > innerWidth + 1
          )
            bad.push(el.textContent || 'element');
          if (
            el instanceof HTMLButtonElement &&
            !el.contains(
              document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
            )
          )
            bad.push('covered: ' + el.textContent);
        }
        const hint = document
          .getElementById('town-label')!
          .getBoundingClientRect();
        const map = document.getElementById('world')!.getBoundingClientRect();
        if (hint.top < map.top || hint.bottom > map.bottom)
          bad.push(
            `home label outside map: ${hint.top}–${hint.bottom}, map ${map.top}–${map.bottom}`,
          );
        for (const button of document.querySelectorAll(
          '#scene-controls button',
        )) {
          const r = button.getBoundingClientRect();
          if (
            hint.left < r.right &&
            hint.right > r.left &&
            hint.top < r.bottom &&
            hint.bottom > r.top
          )
            bad.push('home label overlaps map controls');
        }
        return bad;
      }),
    ).toEqual([]);
  }
  const seen = new Set<string>();
  for (let p = 0; p < 5; p++) {
    await fits();
    const ids = await page
      .locator('.household-list button:visible')
      .evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.id!));
    for (const id of ids) {
      const home = page.locator(`.household-list [data-id="${id}"]`);
      const label = await home.textContent();
      seen.add(label!);
      await home.click();
      await expect(page.locator('#town-home')).toBeVisible();
      await expect(page.locator('#town-home h3')).toHaveText(label!);
      await fits();
      await page.getByRole('button', { name: 'Homes', exact: true }).click();
    }
    if (p < 4)
      await page
        .getByRole('button', { name: 'Next homes', exact: true })
        .click();
  }
  expect(seen.size).toBe(18);
  await page.getByRole('button', { name: 'Town news', exact: true }).click();
  for (let i = 0; i < 4; i++) {
    await fits();
    await expect(page.locator('#town-news li:visible')).toHaveCount(1);
    if (i < 3)
      await page
        .getByRole('button', { name: 'Older news', exact: true })
        .click();
  }
  await page.getByRole('button', { name: 'Homes', exact: true }).click();
  await page.screenshot({ path: info.outputPath('bounded-hookville.png') });
  await page
    .getByRole('button', { name: 'Back to the clinic', exact: true })
    .click();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'reception');
  await expect(page.getByTestId('coins')).toHaveText('120');
});
