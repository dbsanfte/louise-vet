import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import type { Visit } from './game';

let texture: THREE.CanvasTexture | undefined;
function furTexture() {
  if (texture) return texture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#d8d2c5';
  ctx.fillRect(0, 0, 1024, 1024);
  let seed = 9381;
  const random = () =>
    (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 40000; i++) {
    const x = random() * 1024,
      y = random() * 1024,
      shade = Math.floor(125 + random() * 120);
    ctx.strokeStyle = `rgb(${shade},${shade},${shade})`;
    ctx.lineWidth = 0.6 + random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + 3,
      y + 5,
      x + (random() - 0.5) * 6,
      y + 8 + random() * 16,
    );
    ctx.stroke();
  }
  texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
export function dressPatient(animal: THREE.Group, visit: Visit) {
  const owned: { dispose(): void }[] = [];
  const cleanup = () => owned.forEach((o) => o.dispose());
  if (visit.species === 'goldfish') return cleanup;
  const meshes: THREE.Mesh[] = [];
  animal.traverse((o) => {
    if (
      o instanceof THREE.Mesh &&
      /^(body|head|chest|paw|ear|tail|muzzle)([._]|\d|$)/.test(o.name)
    )
      meshes.push(o);
  });
  for (const mesh of meshes) {
    const original = Array.isArray(mesh.material)
      ? mesh.material[0]
      : mesh.material;
    if (!(original instanceof THREE.MeshStandardMaterial)) continue;
    const mat = original.clone();
    mat.map = furTexture();
    mat.bumpMap = furTexture();
    mat.bumpScale = 0.025;
    mat.roughness = 0.92;
    mesh.material = mat;
    owned.push(mat);
    const points: number[] = [],
      colors: number[] = [];
    const p = new THREE.Vector3(),
      n = new THREE.Vector3();
    const sampler = new MeshSurfaceSampler(mesh).build();
    for (let i = 0; i < 1100; i++) {
      sampler.sample(p, n);
      const q = p.clone().addScaledVector(n, 0.035 + (i % 7) * 0.004);
      points.push(...p.toArray(), ...q.toArray());
      const color = original.color
        .clone()
        .multiplyScalar(0.65 + (i % 11) * 0.055);
      colors.push(
        ...color.toArray(),
        ...color.clone().multiplyScalar(1.15).toArray(),
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(points, 3),
    );
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const hair = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.68,
      }),
    );
    hair.name = 'fur fibres';
    hair.raycast = () => {};
    mesh.add(hair);
    owned.push(geometry, hair.material);
  }
  const issue = visit.clinical?.skin;
  if (!issue) return cleanup;
  const target = meshes.find((m) =>
    issue === 'fleas' || issue === 'tangle'
      ? m.name.startsWith('body')
      : m.name.startsWith('paw') && m.position.x > 0 && m.position.z > 0,
  );
  if (!target) return cleanup;
  const lesion = new THREE.Group();
  lesion.name = `clinical-${issue}`;
  // Sphere meshes have unit-radius local coordinates, so this remains on the coat.
  lesion.position
    .set(
      ...((issue === 'fleas' || issue === 'tangle'
        ? [0.92, 0.38, -0.18]
        : [0.55, 0.52, 0.65]) as [number, number, number]),
    )
    .normalize()
    .multiplyScalar(1.02);
  target.add(lesion);
  const normal = lesion.position.clone().normalize();
  lesion.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  const bump = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 24, 16),
    new THREE.MeshStandardMaterial({
      color: issue === 'fleas' ? 0x4b2818 : 0xd98582,
      roughness: 0.65,
    }),
  );
  bump.scale.z = 0.2;
  lesion.add(bump);
  if (issue === 'splinter') {
    const splinter = new THREE.Mesh(
      new THREE.ConeGeometry(0.025, 0.48, 5),
      new THREE.MeshStandardMaterial({ color: 0x79502c, roughness: 0.85 }),
    );
    splinter.rotation.x = 0.7;
    splinter.position.set(0.025, 0.1, 0.13);
    splinter.name = 'wooden splinter';
    lesion.add(splinter);
    const grain = new THREE.Mesh(
      new THREE.ConeGeometry(0.007, 0.42, 4),
      new THREE.MeshStandardMaterial({ color: 0xcca26e }),
    );
    grain.position.x = 0.014;
    splinter.add(grain);
  } else if (issue === 'fleas') {
    bump.visible = false;
    for (let i = 0; i < 8; i++) {
      const flea = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x2c150b, roughness: 0.5 }),
      );
      flea.scale.y = 1.9;
      flea.position.set(Math.sin(i * 4) * 0.24, Math.cos(i * 3) * 0.2, 0.02);
      flea.name = 'flea';
      lesion.add(flea);
    }
  } else if (issue === 'tangle') {
    bump.material.dispose();
    bump.material = new THREE.MeshStandardMaterial({
      color: 0x765536,
      roughness: 1,
    });
    for (let i = 0; i < 12; i++) {
      const strand = new THREE.Mesh(
        new THREE.TorusGeometry(0.05 + i * 0.006, 0.007, 5, 16),
        new THREE.MeshStandardMaterial({ color: 0x9e764f }),
      );
      strand.rotation.set(i, 0.2 * i, 0.4 * i);
      lesion.add(strand);
    }
  }
  lesion.traverse((o) => {
    if (o instanceof THREE.Mesh)
      owned.push(
        o.geometry,
        ...(Array.isArray(o.material) ? o.material : [o.material]),
      );
  });
  return cleanup;
}
