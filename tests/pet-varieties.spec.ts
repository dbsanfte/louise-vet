import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { petLooks } from '../src/pet-appearance';
import { visits } from '../src/game';
import { TownSimulation } from '../src/town-simulation';
import { showPatient, waitForExamination } from './browser-helpers';

test('breed gallery renders original silhouettes and articulated animation', async ({
  page,
}, info) => {
  // The synthetic gallery document has no network address-space metadata.
  // Fetch real served assets through the fixture on Docker hostnames as well.
  await page.route('**/models/pets/*.glb', async (route) => {
    await route.fulfill({ response: await route.fetch() });
  });
  await page.route('**/__modules/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(
      '/__modules/',
      '',
    );
    await route.fulfill({
      body: await readFile(resolve('node_modules', path)),
      contentType: 'text/javascript',
    });
  });
  await page.route('**/__pet-gallery', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><style>body{margin:0;background:#e9ede0}canvas{display:block}#labels{position:absolute;inset:0;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(3,1fr);pointer-events:none;font:16px sans-serif;color:#234c40}span{align-self:end;text-align:center;padding-bottom:10px}</style><script type="importmap">{"imports":{"three":"/__modules/three/build/three.module.js","three/addons/":"/__modules/three/examples/jsm/"}}</script><div id="labels">${petLooks.map((l) => `<span>${l.breed}</span>`).join('')}</div><script type="module">
import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setClearColor('#e9ede0');document.body.prepend(renderer.domElement);
const scene=new T.Scene();scene.add(new T.HemisphereLight(0xffffff,0x6a7550,2.3));const light=new T.DirectionalLight(0xfff5d8,2);light.position.set(-3,8,8);scene.add(light);
const camera=new T.PerspectiveCamera(38,1,.1,100);camera.position.set(1.8,1.65,3.4);camera.lookAt(0,.65,0);
const loader=new GLTFLoader();const models=await Promise.all(${JSON.stringify(petLooks)}.map(async look=>loader.loadAsync('/models/pets/'+look.id+'.glb')));
renderer.setScissorTest(true);for(let i=0;i<models.length;i++){
const gltf=models[i];scene.add(gltf.scene);const mixer=new T.AnimationMixer(gltf.scene);mixer.clipAction(gltf.animations.find(c=>c.name==='Walk')).play();mixer.update(.2);
renderer.setViewport((i%4)*300,(2-Math.floor(i/4))*300,300,300);renderer.setScissor((i%4)*300,(2-Math.floor(i/4))*300,300,300);renderer.render(scene,camera);scene.remove(gltf.scene);
}document.body.dataset.ready='true';
</script></html>`,
    }),
  );
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/__pet-gallery');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.screenshot({ path: info.outputPath('breed-gallery.png') });
});

test('bird checkup uses feathers, keeps care controls visible, and completes for rewards', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const simulation = new TownSimulation(visits, () => 0.5);
  simulation.seedClinic([visits.findIndex((v) => v.name === 'Pico')]);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(
    (snapshot) =>
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
          town: snapshot,
        }),
      ),
    simulation.snapshot(),
  );
  await page.goto('/');
  await expect(page.locator('#world')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await (await showPatient(page, 'Pico')).click();
  await waitForExamination(page);
  await expect(
    page.getByRole('button', { name: 'Ear scope', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Thermometer', exact: true }).click();
  await page
    .getByRole('button', { name: 'Feathers on Pico', exact: true })
    .click();
  await expect(page.locator('#clue-summary')).toContainText('No fever');
  await page.getByRole('button', { name: 'Stethoscope', exact: true }).click();
  await page
    .getByRole('button', { name: 'Chest on Pico', exact: true })
    .click();
  await expect(page.locator('#clue-summary')).toContainText('steady heartbeat');
  await page.screenshot({ path: info.outputPath('bird-checkup.png') });
  const finish = page.locator('[data-action="finish-checkup"]');
  await expect(finish).toBeVisible();
  await finish.click();
  await expect(
    page.getByRole('heading', { name: 'Pico has a healthy checkup!' }),
  ).toBeVisible();
  await expect(page.locator('.receipt-total')).toContainText('Coins earned');
  expect(errors).toEqual([]);
});
