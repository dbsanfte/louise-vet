import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ClinicFurniture } from '../src/clinic-furniture';
import { buildRecipes, furnitureType } from '../src/clinic-build';

// Development-only renderer. Exported images are shared by Shop and Build.
const loader = new GLTFLoader();
const furniture = new ClinicFurniture();
await furniture.load();
const base = (await loader.loadAsync('/models/clinic.glb')).scene;
furniture.registerBase(base);
const models = new Map<string, THREE.Object3D>();
for (const r of buildRecipes)
  if (furnitureType(r.id) === r.id)
    models.set(r.id, furniture.itemModels.get(r.id)!.clone(true));
for (const [id, file] of Object.entries({
  expansion: 'clinic/lounge',
  'pet-room': 'clinic/playroom',
  'play-annex': 'clinic/play-annex',
  'sun-courtyard': 'clinic/sun-courtyard',
  equipment: 'examination/tool-listen',
}))
  models.set(id, (await loader.loadAsync(`/models/${file}.glb`)).scene);
const stock = new THREE.Group();
base.traverse((o) => {
  if (o instanceof THREE.Mesh && /^(food[ _]tin|treat[ _]bag)/.test(o.name)) {
    const part = o.clone();
    part.visible = true;
    stock.add(part);
  }
});
models.set('stock', stock);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(256, 256);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xfff7e6, 0x698779, 1.6));
const light = new THREE.DirectionalLight(0xfff4df, 2);
light.position.set(4, 8, 6);
scene.add(light);
const fill = new THREE.DirectionalLight(0xe1efff, 0.7);
fill.position.set(-4, 3, -2);
scene.add(fill);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 200);
const images: Record<string, string> = {};
for (const [id, model] of models) {
  model.visible = true;
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  model.scale.setScalar(1);
  scene.add(model);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  if (box.isEmpty()) throw new Error(`Empty catalogue model: ${id}`);
  const centre = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length();
  const front = ['bench', 'seat-5', 'welcome-bench'].includes(id) ? -1.5 : 1.5;
  camera.position
    .copy(centre)
    .addScaledVector(
      new THREE.Vector3(1.15, 0.85, front).normalize(),
      radius * 2,
    );
  camera.lookAt(centre);
  camera.updateMatrixWorld(true);
  const viewBox = box.clone().applyMatrix4(camera.matrixWorldInverse);
  const size =
    Math.max(viewBox.max.x - viewBox.min.x, viewBox.max.y - viewBox.min.y) *
    0.58;
  camera.left = -size;
  camera.right = size;
  camera.top = size;
  camera.bottom = -size;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  images[id] = renderer.domElement.toDataURL('image/webp', 0.92);
  scene.remove(model);
}
renderer.dispose();
(window as unknown as { catalogueImages: typeof images }).catalogueImages =
  images;
