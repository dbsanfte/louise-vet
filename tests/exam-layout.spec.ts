import { expect, test, type Page } from '@playwright/test';
import { showPatient, waitForExamination } from './browser-helpers';
import { TownSimulation } from '../src/town-simulation';
import { visits } from '../src/game';

test.setTimeout(120000);

async function openVisit(page: Page, name: string) {
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await (await showPatient(page, name)).click();
  await waitForExamination(page);
}

/** Check actual occupied space and hit targets, not merely CSS visibility. */
async function expectCompactLayout(page: Page) {
  await expect(page.locator('#app')).toHaveAttribute(
    'data-compact-exam',
    'true',
  );
  const problems = await page.evaluate(() => {
    const problems: string[] = [];
    if (
      document.documentElement.scrollHeight > innerHeight + 1 ||
      document.documentElement.scrollWidth > innerWidth + 1
    )
      problems.push('The browser page scrolls');
    const regions = [
      '#world',
      '#exam-camera',
      '#exam-guides',
      '#instrument-dock',
      '.case-work',
      '#clue-summary',
      '#visit-actions',
    ];
    const boxes = regions.flatMap((selector) => {
      const element = document.querySelector<HTMLElement>(selector)!;
      if (!element.checkVisibility()) return [];
      const rect = element.getBoundingClientRect();
      if (
        rect.top < -1 ||
        rect.left < -1 ||
        rect.bottom > innerHeight + 1 ||
        rect.right > innerWidth + 1
      )
        problems.push(`${selector} leaves the screen`);
      if (
        selector === '.case-work' &&
        element.scrollHeight > element.clientHeight + 1
      )
        problems.push('Tools or care choices require scrolling');
      if (
        selector === '#instrument-dock' &&
        element.scrollHeight > element.clientHeight + 1
      )
        problems.push('Instrument readings or controls require scrolling');
      return [{ selector, rect }];
    });
    for (let i = 0; i < boxes.length; i++)
      for (const b of boxes.slice(i + 1)) {
        const a = boxes[i];
        if (
          Math.min(a.rect.right, b.rect.right) -
            Math.max(a.rect.left, b.rect.left) >
            1 &&
          Math.min(a.rect.bottom, b.rect.bottom) -
            Math.max(a.rect.top, b.rect.top) >
            1
        )
          problems.push(`${a.selector} overlaps ${b.selector}`);
      }
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      '.case-work button, #exam-guides button, #scene-controls button, #clue-summary button, #visit-actions button, .instrument-dock button',
    )) {
      if (!button.checkVisibility()) continue;
      const b = button.getBoundingClientRect();
      const hit = document.elementFromPoint(
        b.x + b.width / 2,
        b.y + b.height / 2,
      );
      if (!hit || !button.contains(hit))
        problems.push(`${button.textContent} cannot be tapped`);
    }
    return problems;
  });
  expect(problems).toEqual([]);
}

test('mobile examination keeps tools, ECG and notes separate across phone and tablet rotation', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'Compact touch layout');
  await openVisit(page, 'Luna');
  for (const [tool, zone] of [
    ['Ear scope', 'Ear'],
    ['Mouth mirror', 'Mouth'],
    ['Thermometer', 'Coat'],
    ['Magnifier', 'Coat'],
    ['Magnifier', 'Front paw'],
    ['Stethoscope', 'Chest'],
  ]) {
    await page.getByRole('button', { name: tool, exact: true }).tap();
    await page
      .getByRole('button', { name: `${zone} on Luna`, exact: true })
      .tap();
    await expectCompactLayout(page);
  }
  await expect(page.locator('.findings li')).toHaveCount(6);
  await expect(page.locator('.heart-reading')).toContainText('90 BPM');
  for (const viewport of [
    { width: 360, height: 640 },
    { width: 740, height: 360 },
    { width: 820, height: 1180 },
    { width: 1024, height: 768 },
    { width: 412, height: 839 },
  ]) {
    await page.setViewportSize(viewport);
    await expectCompactLayout(page);
    await page.getByRole('button', { name: 'X-ray', exact: true }).tap();
    await expectCompactLayout(page);
    await page.getByRole('button', { name: 'Increase magnification' }).tap();
    await page.getByRole('button', { name: 'Stethoscope', exact: true }).tap();
    await page
      .getByRole('button', { name: 'Chest on Luna', exact: true })
      .tap();
    await expectCompactLayout(page);
    await page.screenshot({
      path: info.outputPath(`exam-${viewport.width}.png`),
    });
  }
  const notes = page.getByRole('list', { name: 'Care notes', exact: true });
  await notes.focus();
  await page.keyboard.press('End');
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await expectCompactLayout(page);
  await page.getByRole('button', { name: 'About Luna’s visit' }).tap();
  await expect(page.getByRole('dialog')).toContainText('Luna’s person');
  await page.getByRole('button', { name: 'Close visit', exact: true }).tap();
  await page.locator('[data-action="diagnose"]').tap();
  await expectCompactLayout(page);
  await page.getByRole('button', { name: 'Bee sting', exact: true }).tap();
  await expectCompactLayout(page);
  await page.getByRole('button', { name: 'Soothing cream', exact: true }).tap();
  await page.getByRole('button', { name: 'Coat on Luna', exact: true }).tap();
  await expect(page.locator('.visit-feedback')).toContainText('care plan');
  await expectCompactLayout(page);
  await page
    .getByRole('button', { name: 'Front paw on Luna', exact: true })
    .tap();
  await expect(page.locator('.skill-dialog')).toBeVisible();
  await page
    .getByRole('button', { name: 'Cancel care activity', exact: true })
    .tap();
  await expectCompactLayout(page);
  // Cross the desktop breakpoint with a live visit, then return to touch mode.
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('#world > #scene-controls')).toBeVisible();
  await expect(page.locator('#world > .examination-readout')).toBeVisible();
  await expect(page.locator('#zones .body-spot')).toHaveCount(5);
  await page.setViewportSize({ width: 360, height: 640 });
  await expectCompactLayout(page);
  await page.getByRole('button', { name: 'Stop visit' }).tap();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'reception');
  await expect(page.locator('.body-spot')).toHaveCount(0);
  await expect(page.locator('#world > #scene-controls')).toBeVisible();
});

test('small-phone vaccination keeps guidance and exit visible without a diagnostic notebook', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'Compact touch layout');
  await page.setViewportSize({ width: 360, height: 640 });
  const sim = new TownSimulation(visits, () => 0.5);
  sim.seedClinic([visits.findIndex((visit) => visit.name === 'Hazel')]);
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
  }, sim.snapshot());
  await openVisit(page, 'Hazel');
  await expect(page.locator('#app')).toHaveAttribute(
    'data-mode',
    'place-vaccine',
  );
  await expect(page.locator('#clue-summary')).toBeHidden();
  await expectCompactLayout(page);
  await page
    .getByRole('button', { name: 'Front paw on Hazel', exact: true })
    .tap();
  await expect(page.locator('.care-plan')).toContainText(
    'Nothing has been given',
  );
  await expectCompactLayout(page);
  await page.getByRole('button', { name: 'Coat on Hazel', exact: true }).tap();
  await expect(page.locator('.skill-dialog')).toBeVisible();
  await page
    .getByRole('button', { name: 'Cancel care activity', exact: true })
    .tap();
  await expectCompactLayout(page);
  await page.getByRole('button', { name: 'Stop visit' }).tap();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'reception');
  await expect(page.locator('.body-spot')).toHaveCount(0);
});
