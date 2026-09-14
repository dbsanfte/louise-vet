import * as THREE from 'three';
import { ClinicBuild } from '../src/clinic-build';
import { ClinicBuildScenery } from '../src/clinic-build-scenery';
import { clinicPrefabs } from '../src/clinic-prefabs';
import { rectangleWalls } from '../src/clinic-spaces';

// Original pictures of the exact floor shells, without unpurchased furniture.
const models = new Map<string, THREE.Object3D>();
for (const prefab of clinicPrefabs) {
  const build = new ClinicBuild();
  build.state.tiles = [];
  for (let x = 0; x < prefab.width; x++)
    for (let z = 0; z < prefab.depth; z++)
      build.state.tiles.push({ x, z, surface: prefab.surface });
  build.state.floorEdited = true;
  build.state.walls = rectangleWalls(
    { x: 0, z: 0 },
    { x: prefab.width, z: prefab.depth },
  );
  build.state.doors = [
    { x: Math.floor(prefab.width / 2), z: prefab.depth, axis: 'x' },
  ];
  const scenery = new ClinicBuildScenery();
  scenery.update(build);
  scenery.grid.removeFromParent();
  scenery.preview.removeFromParent();
  scenery.hints.removeFromParent();
  models.set(`prefab-${prefab.id}`, scenery.group);
}
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
