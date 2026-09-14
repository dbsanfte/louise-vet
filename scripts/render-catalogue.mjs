import { build } from 'vite';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Start the web container first. Only the generated catalogue portraits are written.
const prefabsOnly = process.argv.includes('--prefabs');
const baseURL = process.env.CATALOGUE_BASE_URL ?? 'http://web:8080';
const result = await build({
  configFile: false,
  logLevel: 'silent',
  build: {
    write: false,
    target: 'esnext',
    lib: {
      entry: prefabsOnly
        ? 'scripts/prefab-preview.ts'
        : 'scripts/catalogue-preview.ts',
      formats: ['es'],
    },
  },
});
const script = (Array.isArray(result) ? result : [result])
  .flatMap((r) => r.output)
  .find((c) => c.type === 'chunk').code;
const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // The synthetic development page needs same-origin model responses on Docker DNS.
  await page.route('**/models/**', async (r) =>
    r.fulfill({ response: await r.fetch() }),
  );
  await page.route('**/catalogue-render.html', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><script type="module" src="/catalogue-render.js"></script>',
    }),
  );
  await page.route('**/catalogue-render.js', (r) =>
    r.fulfill({ contentType: 'application/javascript', body: script }),
  );
  await page.goto(`${baseURL}/catalogue-render.html`);
  await page.waitForFunction(() => window.catalogueImages, undefined, {
    timeout: 45000,
  });
  if (errors.length) throw new Error(errors.join('\n'));
  const images = await page.evaluate(() => window.catalogueImages);
  await mkdir('public/images/catalogue', { recursive: true });
  for (const [id, data] of Object.entries(images))
    await writeFile(
      `public/images/catalogue/${id}.webp`,
      Buffer.from(data.split(',')[1], 'base64'),
    );
  console.log(
    `Rendered ${Object.keys(images).length} catalogue portraits from the game models.`,
  );
} finally {
  await browser.close();
}
