import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import type { Visit } from './game';

let texture: THREE.CanvasTexture | undefined;
function furTexture() {
  if (texture) return texture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 1024, 1024);
  let seed = 9381;
  const random = () =>
    (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 40000; i++) {
    const x = random() * 1024,
      y = random() * 1024,
      shade = Math.floor(96 + random() * 64);
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
  // Height data stays linear; the original coat supplies its colour.
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}
let coatTexture: THREE.CanvasTexture | undefined;
function coatFibres() {
  if (coatTexture) return coatTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1024, 1024);
  let seed = 7919;
  const random = () =>
    (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  // Small overlapping wisps lie along the coat, rather than projecting as spikes.
  // Neutral colour multiplies the breed's own colour, preserving its markings.
  for (let i = 0; i < 11000; i++) {
    const x = random() * 1024,
      y = random() * 1024;
    const length = 12 + random() * 26;
    const curve = (random() - 0.5) * 12;
    const shade = Math.floor(175 + random() * 65);
    ctx.lineWidth = 1.2 + random() * 1.4;
    ctx.lineCap = 'round';
    // Wrap strokes at the UV seam so a coat has no straight texture edge.
    for (const dx of [-1024, 0, 1024])
      for (const dy of [-1024, 0, 1024]) {
        if (
          x + dx < -8 ||
          x + dx > 1032 ||
          y + dy + length < 0 ||
          y + dy > 1024
        )
          continue;
        const fade = ctx.createLinearGradient(
          x + dx,
          y + dy,
          x + dx,
          y + dy + length,
        );
        fade.addColorStop(0, 'rgba(255,255,255,0)');
        fade.addColorStop(0.3, `rgba(${shade},${shade},${shade},0.65)`);
        fade.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = fade;
        ctx.beginPath();
        ctx.moveTo(x + dx, y + dy);
        ctx.quadraticCurveTo(
          x + curve + dx,
          y + length * 0.5 + dy,
          x + curve * 0.5 + dx,
          y + length + dy,
        );
        ctx.stroke();
      }
  }
  coatTexture = new THREE.CanvasTexture(canvas);
  coatTexture.wrapS = coatTexture.wrapT = THREE.RepeatWrapping;
  coatTexture.colorSpace = THREE.SRGBColorSpace;
  return coatTexture;
}
let fuzz: THREE.CanvasTexture | undefined;
function fuzzTexture() {
  if (fuzz) return fuzz;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const fade = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  fade.addColorStop(0, 'rgba(255,255,255,0.8)');
  fade.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 32, 32);
  fuzz = new THREE.CanvasTexture(canvas);
  return fuzz;
}
export function dressPatient(animal: THREE.Group, visit: Visit) {
  const owned: { dispose(): void }[] = [];
  const restore: (() => void)[] = [];
  const cleanup = () => {
    restore.splice(0).forEach((undo) => undo());
    owned.splice(0).forEach((o) => o.dispose());
  };
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
    if (visit.species === 'bird') continue;
    const original = Array.isArray(mesh.material)
      ? mesh.material[0]
      : mesh.material;
    if (!(original instanceof THREE.MeshStandardMaterial)) continue;
    const mat = new THREE.MeshPhysicalMaterial();
    THREE.MeshStandardMaterial.prototype.copy.call(mat, original);
    mat.map = original.map ?? coatFibres();
    mat.bumpMap = furTexture();
    mat.bumpScale = 0.012;
    mat.roughness = 0.96;
    mat.sheen = 0.65;
    mat.sheenRoughness = 1;
    mat.sheenColor.copy(original.color).lerp(new THREE.Color(0xfff4df), 0.2);
    const previousMaterial = mesh.material;
    mesh.material = mat;
    restore.push(() => {
      mesh.material = previousMaterial;
    });
    owned.push(mat);
    const points: number[] = [],
      colors: number[] = [];
    const p = new THREE.Vector3(),
      n = new THREE.Vector3();
    const sampler = new MeshSurfaceSampler(mesh).build();
    for (let i = 0; i < 3600; i++) {
      sampler.sample(p, n);
      // A close, softly fading nap, with no long straight silhouette spikes.
      p.addScaledVector(n, 0.004 + (i % 7) * 0.002);
      points.push(...p.toArray());
      colors.push(
        ...original.color
          .clone()
          .multiplyScalar(0.92 + (i % 9) * 0.02)
          .toArray(),
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(points, 3),
    );
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const hair = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        map: fuzzTexture(),
        size: 0.022,
        depthWrite: false,
        alphaTest: 0.01,
        vertexColors: true,
        transparent: true,
        opacity: 0.22,
      }),
    );
    hair.name = 'soft coat fuzz';
    hair.raycast = () => {};
    mesh.add(hair);
    restore.push(() => mesh.remove(hair));
    owned.push(geometry, hair.material);
  }
  const issue = visit.clinical?.skin;
  if (!issue) return cleanup;
  const target = meshes.find((m) =>
    issue === 'fleas' || issue === 'tangle' || issue === 'burn'
      ? m.name.startsWith('body')
      : m.name.startsWith('paw') &&
        (m.userData.clinicalPaw || (m.position.x > 0 && m.position.z > 0)),
  );
  if (!target) return cleanup;
  const lesion = new THREE.Group();
  lesion.name = `clinical-${issue}`;
  // Sphere meshes have unit-radius local coordinates, so this remains on the coat.
  lesion.position
    .set(
      ...((issue === 'fleas' || issue === 'tangle' || issue === 'burn'
        ? [0.92, 0.38, -0.18]
        : [0.55, 0.52, 0.65]) as [number, number, number]),
    )
    .normalize()
    .multiplyScalar(1.02);
  target.add(lesion);
  restore.push(() => target.remove(lesion));
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
