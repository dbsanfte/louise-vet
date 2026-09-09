import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, Mesh } from 'three';
import { clinicalProfile, ecg, heartbeatPhase } from '../src/clinical.ts';
import { communityVisit, examine, toolInfo, visits } from '../src/game.ts';

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
      : species === 'bird'
        ? ['cranium', 'beak', 'spine', 'rib', 'wing', 'leg', 'toe']
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
  assert.ok(clinicalProfile(scout).bpm! > normal.bpm!);
  assert.equal(normal.heart, 'normal');
  assert.ok(ecg(0.4) > 0.9, 'R peak');
  assert.ok(ecg(0.44) < 0, 'S wave');
  assert.ok(Math.abs(ecg(0)) < 0.001, 'baseline between beats');
});

test('awake heart rates fit species physiology, including dog size and all three bird types', () => {
  // Independently sourced bounds: see the design's heartbeat references.
  for (const [name, low, high] of [
    ['Luna', 70, 120],
    ['Scout', 90, 120],
    ['Maple', 70, 120],
    ['Milo', 150, 220],
    ['Pip', 180, 350],
    ['Peanut', 300, 600],
    ['Pico', 300, 500],
    ['Pepper', 250, 350],
    ['Melody', 500, 800],
  ] as const) {
    const pet = visits.find((v) => v.name === name);
    assert.ok(pet, name);
    const { bpm, heart } = clinicalProfile(communityVisit(pet, 'checkup'));
    assert.ok(bpm !== null && bpm >= low && bpm <= high, `${name}: ${bpm}`);
    assert.equal(heart, 'normal', 'a naturally fast small heart is healthy');
  }
  const gerbil = visits.find((v) => v.species === 'gerbil')!;
  assert.equal(clinicalProfile(communityVisit(gerbil, 'checkup')).bpm, 360);
  const rate = (name: string) =>
    clinicalProfile(
      communityVisit(
        visits.find((v) => v.name === name)!,
        'checkup',
      ),
    ).bpm!;
  assert.ok(
    rate('Scout') > rate('Luna'),
    'small terrier faster than retriever',
  );
  assert.ok(rate('Melody') > rate('Pico') && rate('Pico') > rate('Pepper'));
});

test('fever alone raises every mammal and bird rate, without stacking a worry multiplier', () => {
  for (const pet of visits.filter((v) => v.species !== 'goldfish')) {
    const healthy = clinicalProfile({ ...pet, clinical: {} });
    const worried = clinicalProfile({ ...pet, clinical: { heart: 'fast' } });
    const fever = clinicalProfile({ ...pet, clinical: { fever: true } });
    const scheduled = clinicalProfile(communityVisit(pet, 'fever'));
    assert.ok(
      healthy.bpm! < worried.bpm! && worried.bpm! < fever.bpm!,
      pet.name,
    );
    assert.equal(fever.heart, 'fast');
    assert.equal(fever.temperature, 'Fever');
    assert.equal(
      scheduled.bpm,
      fever.bpm,
      'fever and fast flags do not double-count',
    );
    assert.ok(fever.bpm! <= 720, 'no extreme across-species multiplier');
    assert.deepEqual(clinicalProfile(communityVisit(pet, 'checkup')), healthy);
  }
  const maple = visits.find((v) => v.name === 'Maple')!;
  assert.equal(
    clinicalProfile(maple).bpm,
    150,
    'authored fever uses the same model',
  );
  const fish = visits.find((v) => v.species === 'goldfish')!;
  assert.equal(
    clinicalProfile(fish).bpm,
    null,
    'no invented chest ECG for a fish',
  );
  assert.equal(
    clinicalProfile({ ...fish, clinical: { fever: true } }).bpm,
    null,
  );
});

test('ECG cycles really match the displayed BPM from dog through fevered canary', () => {
  for (const bpm of [90, 150, 180, 240, 300, 360, 450, 540, 600, 720]) {
    let peaks = 0,
      above = false;
    for (let now = 0; now < 10000; now += 0.25) {
      const next = ecg(heartbeatPhase(now, bpm)) > 0.75;
      if (next && !above) peaks++;
      above = next;
    }
    assert.equal(peaks, Math.round(bpm / 6), `${bpm} BPM over ten seconds`);
    assert.ok(
      heartbeatPhase(-123, bpm) >= 0,
      'trace history wraps before time zero',
    );
  }
});

test('every species gets explicit, usable routine checks, with water and fins for fish', async () => {
  const { communityVisit, checkInstruction, zonesFor } =
    await import('../src/game.ts');
  for (const species of [
    'dog',
    'cat',
    'rabbit',
    'hamster',
    'gerbil',
    'goldfish',
    'bird',
  ] as const) {
    const visit = communityVisit(
      visits.find((v) => v.species === species)!,
      'checkup',
    );
    assert.equal(visit.checks.length, 2);
    for (const check of visit.checks) {
      assert.ok(zonesFor(species).includes(check.zone));
      assert.ok(
        checkInstruction(check, species).includes(toolInfo[check.tool].name),
      );
      const result = examine(visit, check.tool, check.zone);
      assert.equal(result.kind, 'finding');
      assert.ok(result.kind === 'finding' && result.clueIndex >= 0);
    }
    if (species === 'goldfish')
      assert.deepEqual(
        visit.checks.map((c) => [c.tool, c.zone]),
        [
          ['water-test', 'tank'],
          ['inspect', 'fin'],
        ],
      );
    if (species === 'bird')
      assert.match(checkInstruction(visit.checks[0], species), /feathers/);
  }
});

test('water tools hit the whole visible bowl while optical tools can reach the fish', async () => {
  const THREE = await import('three');
  const { addBowlWater, instrumentHit } = await import('../src/fishbowl.ts');
  const bytes = await readFile(
    new URL('../public/models/goldfish.glb', import.meta.url),
  );
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
    '',
  );
  const fish = gltf.scene;
  fish.position.y = 1.28;
  const clean = addBowlWater(fish, false);
  fish.updateMatrixWorld(true);
  for (const [x, y, z] of [
    [-0.55, 1.8, 3],
    [0.55, 1.8, 3],
    [0, 4, 0],
    [3, 1.9, 0.3],
  ]) {
    const origin = new THREE.Vector3(x, y, z);
    const target = new THREE.Vector3(
      x === 3 ? 0 : x,
      y === 4 ? 2 : y,
      z === 3 ? 0 : z,
    );
    const hits = new THREE.Raycaster(
      origin,
      target.sub(origin).normalize(),
    ).intersectObject(fish, true);
    for (const tool of ['water-test', 'water-care'] as const)
      assert.equal(instrumentHit(hits, tool)?.object.name, 'bowl_water');
  }
  const ray = new THREE.Raycaster(
    new THREE.Vector3(0, 1.93, 4),
    new THREE.Vector3(0, 0, -1),
  );
  const hits = ray.intersectObject(fish, true);
  assert.equal(instrumentHit(hits, 'water-test')?.object.name, 'bowl_water');
  const fin = instrumentHit(hits, 'inspect');
  assert.ok(
    fin && !fin.object.userData.bowlWater,
    'transparent water never blocks inspecting the animal',
  );
  assert.equal(
    instrumentHit(
      new THREE.Raycaster(
        new THREE.Vector3(3, 2, 4),
        new THREE.Vector3(0, 0, -1),
      ).intersectObject(fish, true),
      'water-test',
    ),
    undefined,
    'points outside the bowl do not give a reading',
  );
  clean();
  assert.equal(fish.getObjectByName('bowl_water'), undefined);
});
