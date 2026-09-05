import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Object3D } from 'three';
import { Character } from '../src/character.ts';
import { visits } from '../src/game.ts';

function pose(object: Object3D) {
  return [...object.position, ...object.quaternion, ...object.scale];
}

test('every person and pet has looping Blender clips that move its parts', async () => {
  const names = new Set([
    'louise',
    ...visits.map((v) => v.ownerModel),
    ...visits.map((v) => v.species),
  ]);
  for (const name of names) {
    const bytes = await readFile(
      process.env.VET_GAME_MODEL_DIR
        ? resolve(process.env.VET_GAME_MODEL_DIR, `${name}.glb`)
        : new URL(`../public/models/${name}.glb`, import.meta.url),
    );
    const gltf = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    gltf.scene.animations = gltf.animations;
    assert.deepEqual(
      gltf.animations.map((c) => c.name).sort(),
      ['Idle', 'Walk'],
      name,
    );
    for (const clip of gltf.animations) {
      assert.ok(clip.duration > 0, `${name}: ${clip.name} has a duration`);
      for (const track of clip.tracks) {
        const size = track.getValueSize();
        for (let i = 0; i < size; i++) {
          assert.ok(
            Math.abs(
              track.values[i] - track.values[track.values.length - size + i],
            ) < 0.0001,
            `${name}: ${clip.name} loops smoothly`,
          );
        }
      }
    }
    const parts: Object3D[] = [];
    gltf.scene.traverse((o) => {
      if (o !== gltf.scene) parts.push(o);
    });
    const character = new Character(gltf.scene);
    const still = parts.map(pose);
    character.update(0.4);
    assert.ok(
      parts.some(
        (part, i) => JSON.stringify(pose(part)) !== JSON.stringify(still[i]),
      ),
      `${name}: idle changes a part's pose`,
    );
    const limb = parts.find((p) => /^(leg_joint|paw|tail)/.test(p.name));
    assert.ok(limb, `${name}: has walking limbs or a swimming tail`);
    const bowl = parts.find((p) => p.name.startsWith('bowl_base'));
    const bowlPose = bowl ? pose(bowl) : null;
    character.setWalking(true);
    character.update(0.25);
    const beforeStep = pose(limb);
    character.update(0.19);
    assert.notDeepEqual(pose(limb), beforeStep, `${name}: walk moves a limb`);
    if (bowl)
      assert.deepEqual(
        pose(bowl),
        bowlPose,
        'the fish swims while its bowl stays still',
      );
    character.setWalking(false);
    character.update(0.3);
    character.dispose();
  }
});
