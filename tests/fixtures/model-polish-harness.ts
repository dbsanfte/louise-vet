// Asset inspection fixture, excluded from the shipped game.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Character, type Motion } from '../../src/character';
import { dressPatient } from '../../src/fur';
import { visits } from '../../src/game';
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(800, 600);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.style.margin = '0';
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#ece7dd');
scene.add(new THREE.HemisphereLight(0xfff3e5, 0x728f91, 2));
const light = new THREE.DirectionalLight(0xfff4e5, 3);
light.position.set(-3, 5, 4);
scene.add(light);
const camera = new THREE.PerspectiveCamera(36, 4 / 3, 0.1, 30);
let model: THREE.Group | undefined, animation: Character | undefined;
let cleanFur: (() => void) | undefined;
const draw = () => renderer.render(scene, camera);
declare global {
  interface Window {
    inspectModel: (
      name: string,
      fur?: boolean,
    ) => Promise<{
      fuzz: number;
      needles: number;
      findings: number;
      textured: number;
    }>;
    poseModel: (motion: Motion, seconds: number) => void;
    removeFur: () => { fuzz: number; findings: number; restored: boolean };
  }
}
let originalMaterials: THREE.Material[] = [];
window.inspectModel = async (name, fur = false) => {
  cleanFur?.();
  animation?.dispose();
  if (model) scene.remove(model);
  const gltf = await new GLTFLoader().loadAsync(`/models/${name}.glb`);
  model = gltf.scene;
  model.animations = gltf.animations;
  scene.add(model);
  originalMaterials = [];
  model.traverse((o) => {
    if (o instanceof THREE.Mesh)
      originalMaterials.push(
        ...(Array.isArray(o.material) ? o.material : [o.material]),
      );
  });
  cleanFur = fur
    ? dressPatient(model, { ...visits[0], clinical: { skin: 'splinter' } })
    : undefined;
  animation = new Character(model);
  animation.update(0.3);
  const human = !name.includes('pets/');
  camera.position.set(human ? 2.3 : 2.4, human ? 2.15 : 1.9, human ? 4.0 : 3.0);
  camera.lookAt(0, human ? 1.02 : 0.75, 0);
  draw();
  let fuzz = 0,
    needles = 0,
    findings = 0,
    textured = 0;
  model.traverse((o) => {
    if (
      o instanceof THREE.Mesh &&
      o.material instanceof THREE.MeshStandardMaterial &&
      o.material.map &&
      o.material.bumpMap
    )
      textured++;
    if (o.name === 'soft coat fuzz') fuzz++;
    if (o instanceof THREE.LineSegments) needles++;
    if (o.name === 'wooden splinter') findings++;
  });
  return { fuzz, needles, findings, textured };
};
window.poseModel = (motion, seconds) => {
  animation!.setMotion(motion);
  for (let t = 0; t < seconds; t += 1 / 60) animation!.update(1 / 60);
  draw();
};
window.removeFur = () => {
  cleanFur?.();
  cleanFur?.(); // Closing an already closed view is safe.
  let fuzz = 0,
    findings = 0,
    restored = true;
  model!.traverse((o) => {
    if (o.name === 'soft coat fuzz') fuzz++;
    if (o.name.startsWith('clinical-')) findings++;
    if (o instanceof THREE.Mesh)
      restored &&= (
        Array.isArray(o.material) ? o.material : [o.material]
      ).every((m) => originalMaterials.includes(m));
  });
  draw();
  return { fuzz, findings, restored };
};
