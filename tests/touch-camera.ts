import type { Page } from '@playwright/test';

/** Real touch input on the visible game canvas, away from its room shortcuts. */
export async function touchCamera(
  page: Page,
  gesture: 'orbit' | 'pan-zoom' | 'twist',
) {
  const box = (await page.locator('#world > canvas').boundingBox())!;
  const x = box.x + box.width * 0.5,
    y = box.y + box.height * 0.4;
  const cdp = await page.context().newCDPSession(page);
  const points = (step: number) =>
    gesture === 'orbit'
      ? [{ x: x + step * 10, y, id: 0 }]
      : gesture === 'twist'
        ? [
            {
              x: x - 40 * Math.cos(step * 0.08),
              y: y - 40 * Math.sin(step * 0.08),
              id: 0,
            },
            {
              x: x + 40 * Math.cos(step * 0.08),
              y: y + 40 * Math.sin(step * 0.08),
              id: 1,
            },
          ]
        : [
            { x: x - 35 - step * 3, y: y + step * 2, id: 0 },
            { x: x + 35 + step * 7, y: y + step * 2, id: 1 },
          ];
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: points(0),
    });
    for (let step = 1; step <= 6; step++)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: points(step),
      });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  } finally {
    await cdp.detach();
  }
}
