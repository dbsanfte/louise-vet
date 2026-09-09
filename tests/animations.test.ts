import { petAsset } from '../src/pet-appearance.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Vector3, type Object3D } from 'three';
import { Character } from '../src/character.ts';
import { visits } from '../src/game.ts';

function pose(object: Object3D) {
  return [...object.position, ...object.quaternion, ...object.scale];
}

test('every person and pet has looping Blender clips that move its parts', async () => {
  const names = new Set([
    'louise',
    ...visits.map((v) => v.ownerModel),
    ...visits.map(petAsset),
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
      name.includes('budgie') ||
        name.includes('cockatiel') ||
        name.includes('canary')
        ? ['Fly', 'Idle', 'Play', 'Read', 'Sit', 'Walk']
        : ['Idle', 'Play', 'Read', 'Sit', 'Walk'],
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
    if (name.startsWith('pets/')) {
      gltf.scene.updateMatrixWorld(true);
      const head = parts.find(
        (p) => p.name.startsWith('head') && 'isMesh' in p,
      )!;
      const centre = head.getWorldPosition(new Vector3());
      const eyes = parts.filter(
        (p) => /^eye([._]|[0-9]|$)/.test(p.name) && 'isMesh' in p,
      );
      assert.equal(eyes.length, 2, `${name}: has two attached eyes`);
      for (const eye of eyes)
        assert.ok(
          eye.getWorldPosition(new Vector3()).distanceTo(centre) < 0.55,
          `${name}: animated eyes stay on the face`,
        );
      for (const zone of name.includes('bird-')
        ? ['coat', 'chest', 'paw', 'mouth']
        : ['ear', 'coat', 'chest', 'paw', 'mouth'])
        assert.ok(
          parts.some((p) => p.name.startsWith(`spot_${zone}`)),
          `${name}: preserves ${zone} targeting`,
        );
    }
    character.setWalking(false);
    character.update(0.3);
    if (name.includes('bird-')) {
      const wing = parts.find((p) => p.name.startsWith('wing_joint'))!;
      assert.ok(wing, `${name}: has an articulated wing`);
      const samples: number[] = [];
      // Clinic routing chooses a generic walking pose before the bird override.
      // These repeated requests must not reset Fly to its first frame every tick.
      for (let frame = 0; frame < 90; frame++) {
        character.setMotion(frame % 2 ? 'Walk' : 'Idle');
        character.setMotion('Fly');
        character.update(1 / 60);
        if (frame > 30) samples.push(wing.quaternion.z);
      }
      assert.ok(
        Math.max(...samples) - Math.min(...samples) > 0.15,
        `${name}: wings keep flapping while flight overrides routing`,
      );
      character.setMotion('Idle');
      character.update(0.4);
      assert.ok(
        Math.abs(wing.quaternion.z) < 0.3,
        `${name}: folds wings at rest`,
      );
    }
    if (name === 'louise' || name.startsWith('visitor')) {
      const head = parts.find(
        (p) => /^head([._]|[0-9]|$)/.test(p.name) && 'isMesh' in p,
      )!;
      const eyes = parts.filter((p) => p.name.startsWith('eye_white'));
      assert.equal(eyes.length, 2, `${name}: has two layered eyes`);
      const knee = parts.find((p) => p.name.startsWith('knee_joint'))!;
      const elbow = parts.find((p) => p.name.startsWith('elbow_joint'))!;
      const ankle = parts.find((p) => p.name.startsWith('ankle_joint'))!;
      assert.ok(knee && elbow && ankle, `${name}: has articulated limbs`);
      character.setMotion('Walk');
      character.update(0.4);
      const joints = [knee, elbow, ankle];
      const before = joints.map(pose);
      character.update(0.24);
      joints.forEach((part, i) =>
        assert.notDeepEqual(
          pose(part),
          before[i],
          `${name}: ${part.name} moves during a stride`,
        ),
      );
      gltf.scene.updateMatrixWorld(true);
      for (const eye of eyes)
        assert.ok(
          eye
            .getWorldPosition(new Vector3())
            .distanceTo(head.getWorldPosition(new Vector3())) < 0.35,
          `${name}: eyes follow the animated head`,
        );
    }
    character.dispose();
  }
});
