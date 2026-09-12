import { showPatient } from './browser-helpers';
import { waitForExamination } from './browser-helpers';
import { expect, test, type Page } from '@playwright/test';
import { TownSimulation } from '../src/town-simulation';
import { visits } from '../src/game';

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
  await captureHeartAudio(page);
  await openPatient(page, 'Pip');
  await page
    .getByRole('button', { name: 'Turn sound on', exact: true })
    .click();
  await page.getByRole('button', { name: 'Stethoscope', exact: true }).click();
  await page.getByRole('button', { name: 'Chest on Pip', exact: true }).click();
  const reading = page.locator('.heart-reading');
  await expect(reading).toHaveText('280 BPM · Faster than usual');
  const trace = page.locator('.ecg-trace');
  const first = await trace.screenshot();
  await expect
    .poll(async () => (await trace.screenshot()).equals(first))
    .toBe(false);
  await expect.poll(() => activeHeartRate(page)).toBeCloseTo(280, 3);
  await page
    .getByRole('button', { name: 'Turn sound off', exact: true })
    .click();
  await expect.poll(() => activeHeartRate(page)).toBe(0);
  await page
    .getByRole('button', { name: 'Turn sound on', exact: true })
    .click();
  await expect.poll(() => activeHeartRate(page)).toBeCloseTo(280, 3);
  const world = await page.locator('#world').boundingBox();
  await page.mouse.move(
    world!.x + world!.width / 2,
    world!.y + world!.height - 100,
  );
  await expect(reading).toHaveText('Place the chestpiece on the chest');
  await expect.poll(() => activeHeartRate(page)).toBe(0);
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
  await expect(reading).toHaveText('90 BPM · Steady, normal rhythm');
  await expect.poll(() => activeHeartRate(page)).toBeCloseTo(90, 3);
  await page.getByRole('button', { name: 'Stop visit' }).click();
  await expect.poll(() => activeHeartRate(page)).toBe(0);
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

type HeartAudio = {
  bpm: number;
  running: boolean;
  stopped: boolean;
  audible: boolean;
};
async function captureHeartAudio(page: Page) {
  await page.addInitScript(() => {
    const state = window as typeof window & { heartSounds: HeartAudio[] };
    state.heartSounds = [];
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = create.call(this),
        start = source.start.bind(source),
        stop = source.stop.bind(source),
        context = this;
      let record: HeartAudio | undefined;
      source.start = (when?: number, offset?: number) => {
        record = {
          bpm: source.loop
            ? (60 * source.playbackRate.value) / source.buffer!.duration
            : 0,
          running: context.state === 'running',
          stopped: false,
          audible: source
            .buffer!.getChannelData(0)
            .some((sample) => Math.abs(sample) > 0.001),
        };
        state.heartSounds.push(record);
        start(when, offset);
      };
      source.stop = (when?: number) => {
        if (record) record.stopped = true;
        stop(when);
      };
      return source;
    };
  });
}
async function activeHeartRate(page: Page) {
  return page.evaluate(() => {
    const active = (
      window as typeof window & { heartSounds: HeartAudio[] }
    ).heartSounds.filter((s) => !s.stopped && s.running && s.audible);
    return active.length === 1 ? active[0].bpm : active.length === 0 ? 0 : -1;
  });
}

for (const [name, bpm] of [
  ['Maple', 150],
  ['Melody', 720],
] as const) {
  test(`${name}'s fever ECG and audio use species-appropriate elevated rates`, async ({
    page,
  }, info) => {
    const sim = new TownSimulation(visits, () => 0.5);
    sim.seedClinic([visits.findIndex((v) => v.name === name)]);
    sim.tickets.get(sim.queue[0])!.reason = 'fever';
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
    await captureHeartAudio(page);
    await openPatient(page, name);
    await page
      .getByRole('button', { name: 'Turn sound on', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Stethoscope', exact: true })
      .click();
    await page
      .getByRole('button', { name: `Chest on ${name}`, exact: true })
      .click();
    const reading = page.locator('.heart-reading');
    await expect(reading).toHaveText(`${bpm} BPM · Faster than usual`);
    await expect.poll(() => activeHeartRate(page)).toBeCloseTo(bpm, 3);
    // The label/audio update can precede the throttled canvas draw. Wait for
    // the actual bright ECG peaks across its 2.5-second window, not just BPM text.
    const peaks = () =>
      page.locator('.ecg-trace').evaluate((canvas: HTMLCanvasElement) => {
        const { width, height } = canvas;
        const data = canvas
          .getContext('2d')!
          .getImageData(0, 0, width, height).data;
        let count = 0,
          previous = false;
        for (let x = 0; x < width; x++) {
          let bright = false;
          for (let y = 0; y < height * 0.35; y++) {
            const i = (y * width + x) * 4;
            bright ||= data[i + 1] > 180 && data[i + 2] > 110;
          }
          if (bright && !previous) count++;
          previous = bright;
        }
        return count;
      });
    await expect
      .poll(async () => Math.abs((await peaks()) - (bpm * 2.5) / 60))
      .toBeLessThanOrEqual(1);
    await expect(reading).toBeInViewport();
    const clearOfNotes = async () => {
      const notes = await page.locator('#clue-summary').boundingBox();
      for (const element of [
        reading,
        page.locator('.ecg-trace'),
        page.locator('.heart-sound'),
      ]) {
        await expect(element).toBeInViewport({ ratio: 1 });
        const bounds = await element.boundingBox();
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(notes!.y);
      }
    };
    await clearOfNotes();
    await page.screenshot({ path: info.outputPath(`${name}-fever-ecg.png`) });
    await page
      .getByRole('button', { name: 'Thermometer', exact: true })
      .click();
    await expect.poll(() => activeHeartRate(page)).toBe(0);
    await page
      .getByRole('button', {
        name: `${name === 'Melody' ? 'Feathers' : 'Coat'} on ${name}`,
        exact: true,
      })
      .click();
    await expect(reading).toContainText('Fever');
    await expect(page.locator('[data-tab=clues]')).toContainText('2/2');
    await page
      .getByRole('button', { name: 'Stethoscope', exact: true })
      .click();
    await page
      .getByRole('button', { name: `Chest on ${name}`, exact: true })
      .click();
    await expect(reading).toHaveText(`${bpm} BPM · Faster than usual`);
    await clearOfNotes();
    if (info.project.name === 'mobile') {
      await page.setViewportSize({ width: 360, height: 640 });
      await clearOfNotes();
    }
  });
}
