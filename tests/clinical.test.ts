import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, Mesh } from 'three';
import { clinicalProfile, ecg } from '../src/clinical.ts';
import { examine, toolInfo, visits } from '../src/game.ts';

async function model(name: string) {
  const bytes = await readFile(
    new URL(`../public/models/examination/${name}.glb`, import.meta.url),
  );
  return (
    await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    )
  ).scene;
}

test('every selectable instrument is a complete exported 3D model', async () => {
  for (const tool of Object.keys(toolInfo)) {
    const scene = await model(`tool-${tool}`);
    const box = new Box3().setFromObject(scene);
    assert.ok(box.max.y - box.min.y > 0.3, `${tool} has a body/grip`);
    assert.ok(box.max.z - box.min.z > 0.03, `${tool} has real depth`);
  }
});

test('full skeletons cover head, spine, ribs, limbs and tail; the fracture has displaced geometry', async () => {
  for (const species of new Set(visits.map((v) => v.species))) {
    const scene = await model(`skeleton-${species}`);
    const names: string[] = [];
    scene.traverse((o) => {
      if (o instanceof Mesh) names.push(o.name);
    });
    for (const part of species === 'goldfish'
      ? ['cranium', 'vertebra', 'rib', 'fin']
      : [
          'cranium',
          'vertebra',
          'rib',
          'humerus',
          'radius',
          'femur',
          'tibia',
          'phalange',
          'tail',
        ]) {
      assert.ok(
        names.some((n) => n.includes(part)),
        `${species} includes ${part}`,
      );
    }
    assert.ok(!names.some((n) => n.includes('fracture')));
  }
  const broken = await model('skeleton-rabbit-fracture');
  const proximal =
    broken.getObjectByName('fracture_proximal') ??
    broken.getObjectByName('fracture proximal');
  const distal =
    broken.getObjectByName('fracture_distal') ??
    broken.getObjectByName('fracture distal');
  assert.ok(proximal && distal, 'separate cortical fragments');
  const a = new Box3().setFromObject(proximal),
    b = new Box3().setFromObject(distal);
  assert.ok(a.min.y > b.max.y, 'an actual gap separates the bone fragments');
});

test('healthy interiors differ structurally from inflammation, tartar and cavities', async () => {
  for (const [healthy, abnormal, feature] of [
    ['ear-healthy', 'ear-inflamed', 'clinical_wax'],
    ['mouth-carnivore-healthy', 'mouth-carnivore-tartar', 'clinical_tartar'],
    ['mouth-carnivore-healthy', 'mouth-carnivore-cavity', 'clinical_cavity'],
  ]) {
    const has = async (name: string) => {
      let found = false;
      (await model(name)).traverse((o) => {
        found ||=
          o instanceof Mesh && o.name.replaceAll(' ', '_').startsWith(feature);
      });
      return found;
    };
    assert.equal(await has(healthy), false);
    assert.equal(await has(abnormal), true);
  }
});

test('clues need a visible finding; heartbeat readings distinguish normal and worried patients', () => {
  const pip = visits.find((v) => v.name === 'Pip')!;
  assert.equal(examine(pip, 'xray', 'paw', false).kind, 'guidance');
  assert.equal(examine(pip, 'xray', 'paw', true).kind, 'finding');
  const scout = visits.find((v) => v.name === 'Scout')!;
  assert.equal(examine(scout, 'inspect', 'paw', false).kind, 'guidance');
  assert.equal(examine(scout, 'inspect', 'paw', true).kind, 'finding');
  const normal = clinicalProfile({ ...scout, clinical: {} });
  assert.ok(clinicalProfile(scout).bpm > normal.bpm);
  assert.equal(normal.heart, 'normal');
  assert.ok(ecg(0.4) > 0.9, 'R peak');
  assert.ok(ecg(0.44) < 0, 'S wave');
  assert.ok(Math.abs(ecg(0)) < 0.001, 'baseline between beats');
});
