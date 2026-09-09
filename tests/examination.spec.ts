import { showPatient } from './browser-helpers';
import { waitForExamination } from './browser-helpers';
import { expect, test, type Page } from '@playwright/test';

test.setTimeout(120000);
async function openPatient(page: Page, name: string) {
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await (await showPatient(page, name)).click();
  await waitForExamination(page);
}
async function point(page: Page, zone: string) {
  await page.locator('#world').scrollIntoViewIfNeeded();
  return page.locator(`[data-point="${zone}"]`).evaluate((e) => {
    const bounds = document.getElementById('world')!.getBoundingClientRect();
    return {
      x: bounds.left + Number(e.getAttribute('cx')),
      y: bounds.top + Number(e.getAttribute('cy')),
    };
  });
}

test('drag the real X-ray across the patient, zoom, and orbit a whole skeleton', async ({
  page,
}, info) => {
  await openPatient(page, 'Pip');
  await page.getByRole('button', { name: 'X-ray', exact: true }).click();
  const readout = page.locator('.examination-readout');
  const images: Buffer[] = [];
  const touch =
    info.project.name === 'mobile'
      ? await page.context().newCDPSession(page)
      : null;
  for (const zone of ['chest', 'paw', 'coat', 'mouth']) {
    const p = await point(page, zone);
    if (touch) {
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [p],
      });
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: p.x + 3, y: p.y + 2 }],
      });
    } else {
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.move(p.x + 3, p.y + 2, { steps: 4 });
    }
    await expect(readout).toHaveAttribute('data-view', 'skeleton');
    // Capture inside the viewer, not merely its frame or DOM label.
    images.push(
      await page.screenshot({
        clip: { x: p.x - 35, y: p.y - 35, width: 70, height: 70 },
      }),
    );
    if (touch)
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
    else await page.mouse.up();
  }
  expect(images.every((img, i) => i === 0 || !img.equals(images[i - 1]))).toBe(
    true,
  );
  await page
    .getByRole('button', { name: 'Front paw on Pip', exact: true })
    .click();
  await expect(page.locator('.findings')).toContainText('gap and an offset');
  await page.getByRole('button', { name: 'Whole-body X-ray' }).click();
  await expect(readout).toHaveAttribute('data-whole', 'true');
  const canvas = page.locator('#world > canvas');
  const front = await canvas.screenshot();
  await test
    .info()
    .attach('whole skeleton', { body: front, contentType: 'image/png' });
  await page.getByRole('button', { name: 'Rotate animal right' }).click();
  expect((await canvas.screenshot()).equals(front)).toBe(false);
  await page.getByRole('button', { name: 'Increase magnification' }).click();
  await expect(page.locator('.instrument-zoom')).toHaveText('2.0×');
  await expect(readout).toHaveAttribute('data-whole', 'false');
  await page.getByRole('button', { name: 'Look around', exact: true }).click();
  await expect(readout).toBeHidden();
  await page.getByRole('button', { name: 'Stop visit' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'reception');
});

test('stethoscope contact drives a live ECG and audible heartbeats, stopping off the chest', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = window as typeof window & {
      heartSounds: { hz: number; at: number; running: boolean }[];
    };
    state.heartSounds = [];
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const oscillator = create.call(this),
        start = oscillator.start.bind(oscillator),
        context = this;
      let scheduledHz = 0;
      const setFrequency = oscillator.frequency.setValueAtTime.bind(
        oscillator.frequency,
      );
      oscillator.frequency.setValueAtTime = (hz: number, at: number) => {
        scheduledHz = hz;
        return setFrequency(hz, at);
      };
      oscillator.start = (when?: number) => {
        state.heartSounds.push({
          hz: scheduledHz || oscillator.frequency.value,
          at: performance.now(),
          running: context.state === 'running',
        });
        start(when);
      };
      return oscillator;
    };
  });
  await openPatient(page, 'Pip');
  await page
    .getByRole('button', { name: 'Turn sound on', exact: true })
    .click();
  await page.getByRole('button', { name: 'Stethoscope', exact: true }).click();
  await page.getByRole('button', { name: 'Chest on Pip', exact: true }).click();
  const reading = page.locator('.heart-reading');
  await expect(reading).toHaveText('261 BPM · Faster than usual');
  const trace = page.locator('.ecg-trace');
  const first = await trace.screenshot();
  await expect
    .poll(async () => (await trace.screenshot()).equals(first))
    .toBe(false);
  const sounds = () =>
    page.evaluate(
      () =>
        (
          window as typeof window & {
            heartSounds: { hz: number; at: number; running: boolean }[];
          }
        ).heartSounds.filter((s) => s.hz <= 100 && s.running).length,
    );
  await expect.poll(sounds).toBeGreaterThanOrEqual(4);
  await page
    .getByRole('button', { name: 'Turn sound off', exact: true })
    .click();
  const count = await sounds();
  await page.waitForTimeout(600);
  expect(await sounds()).toBe(count);
  const world = await page.locator('#world').boundingBox();
  await page.mouse.move(
    world!.x + world!.width / 2,
    world!.y + world!.height - 100,
  );
  await expect(reading).toHaveText('Place the chestpiece on the chest');
  await page.getByRole('button', { name: 'Stop visit' }).click();
  await page
    .getByRole('button', { name: 'See Luna', exact: true })
    .first()
    .click();
  await waitForExamination(page);
  await page.getByRole('button', { name: 'Stethoscope', exact: true }).click();
  await page
    .getByRole('button', { name: 'Chest on Luna', exact: true })
    .click();
  await expect(reading).toHaveText('88 BPM · Steady, normal rhythm');
});

test('the magnifier follows the fur surface and discovers the visible sore spot during a drag', async ({
  page,
}) => {
  await openPatient(page, 'Luna');
  await page.getByRole('button', { name: 'Magnifier', exact: true }).click();
  const coat = await point(page, 'coat');
  await page.mouse.move(coat.x, coat.y);
  await page.mouse.down();
  await expect(page.locator('.examination-readout')).toHaveAttribute(
    'data-view',
    'fur',
  );
  await expect(page.locator('.findings')).toContainText('fur looks tidy');
  await expect(page.locator('[data-action=diagnose]')).toBeDisabled();
  const coatImage = await page.screenshot({
    clip: { x: coat.x - 30, y: coat.y - 30, width: 60, height: 60 },
  });
  const paw = await point(page, 'paw');
  await page.mouse.move(paw.x, paw.y, { steps: 12 });
  await expect(page.locator('.findings')).toContainText('small pink bump');
  const pawImage = await page.screenshot({
    clip: { x: paw.x - 30, y: paw.y - 30, width: 60, height: 60 },
  });
  expect(pawImage.equals(coatImage)).toBe(false);
  await page.mouse.up();
  await page.getByRole('button', { name: 'Increase magnification' }).click();
  await expect(page.locator('.instrument-zoom')).toHaveText('4.0×');
  await page.getByRole('button', { name: 'Stop visit' }).click();
  await expect(page.locator('.examination-readout')).toBeHidden();
  await expect(page.getByTestId('coins')).toHaveText('120');
});
