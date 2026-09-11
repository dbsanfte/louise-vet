// Boots the real application while retaining its World for deterministic pointer
// targeting. This fixture is bundled only by Playwright, never by the game.
import { World } from '../../src/world';
import type { ClinicInfo } from '../../src/clinic-identity';
import {
  Box3,
  Vector2,
  Vector3,
  Raycaster,
  type Object3D,
  type OrthographicCamera,
} from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
let world: World;
let advance: (dt: number) => void;
const load = World.prototype.load;
World.prototype.load = function () {
  world = this;
  return load.call(this).then(() => {
    const simulation = world.town!.simulation;
    advance = simulation.update.bind(simulation);
    // Inspect repeatable poses with the real UI and pointer handlers. Tests
    // advance the simulation explicitly, including between touch down/up.
    simulation.update = () => {};
  });
};
const draw = World.prototype.draw;
World.prototype.draw = function (time) {
  return draw.call(this, time, 0);
};
void import('../../src/main');

declare global {
  interface Window {
    clinicTarget: (name: string) => { x: number; y: number };
    clinicFinishTurn: (name: string) => void;
    clinicInspectNamed: (name: string) => ClinicInfo | undefined;
    clinicHideNamed: (name: string) => void;
    clinicAdvance: (seconds: number) => void;
    clinicTownSnapshot: (snapshot: unknown, name: string) => void;
  }
}
function named(name: string) {
  let target: Object3D | undefined;
  world.scene.traverse((o) => {
    if (o.userData.clinicInfo?.name === name) target = o;
  });
  if (!target) throw Error('Missing clinic object: ' + name);
  return target;
}
window.clinicInspectNamed = (name) => world.town!.describeClinic(named(name));
window.clinicTownSnapshot = (snapshot, name) => {
  if (!world.town!.simulation.restore(snapshot))
    throw Error('Invalid town bubble snapshot');
  world.town!.update(0.1, true);
  const target = named(name);
  const position = target.getWorldPosition(new Vector3());
  world.focusEmergency({ x: position.x, z: position.z });
  world.clearClinicPick();
  world.draw(performance.now() + 300, 0);
};
window.clinicHideNamed = (name) => {
  named(name).visible = false;
};
window.clinicAdvance = (seconds) => {
  for (let i = 0; i < seconds * 10; i++) advance(0.1);
  world.draw(performance.now() + 300, 0);
};
window.clinicFinishTurn = (name) => {
  const simulation = world.town!.simulation;
  const h = simulation.households.find((h) =>
    h.pets.some((p) => p.name === name),
  )!;
  for (
    let i = 0;
    i < 150 && simulation.leisure.pets.get(h.ticket!)?.phase === 'use';
    i++
  )
    advance(0.1);
  world.draw(performance.now() + 300, 0.01);
};
window.clinicTarget = (name) => {
  const target = named(name);
  world.clearClinicPick();
  world.town!.update(0.1, true);
  world.scene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(target),
    centre = box.getCenter(new Vector3());
  const inspected = world as unknown as {
    ortho: OrthographicCamera;
    clinicControls: OrbitControls;
    reception: Object3D;
  };
  const camera = inspected.ortho,
    controls = inspected.clinicControls;
  const canvas = world.renderer.domElement;
  const rect = canvas.getBoundingClientRect();
  // Frame real mesh surfaces, allowing the same orbit angles as the player.
  for (const angle of [0.6, 1.8, 3.5, 5.1]) {
    controls.enableDamping = false;
    controls.target.copy(centre);
    camera.position.set(
      centre.x + Math.sin(angle) * 8,
      centre.y + 8,
      centre.z + Math.cos(angle) * 8,
    );
    camera.zoom = 2;
    camera.updateProjectionMatrix();
    controls.update();
    camera.updateMatrixWorld(true);
    if (rect.height < 260) {
      // On a short phone the room controls occupy the lower scene. Pan the
      // subject into the open upper strip, as a player can with two fingers.
      const pan = new Vector3(
        0,
        (-0.28 * (camera.top - camera.bottom)) / camera.zoom,
        0,
      ).applyQuaternion(camera.quaternion);
      camera.position.add(pan);
      controls.target.add(pan);
      controls.update();
      camera.updateMatrixWorld(true);
    }
    world.renderer.getContext().finish();
    world.draw(performance.now() + 300, 0.01);
    world.renderer.getContext().finish();
    world.scene.updateMatrixWorld(true);
    box.setFromObject(target);
    const size = box.getSize(new Vector3()),
      ray = new Raycaster();
    for (const y of [0.8, 0.5, 0.2, 0.95])
      for (const x of [-0.3, 0, 0.3])
        for (const z of [-0.3, 0, 0.3]) {
          const p = box
            .getCenter(new Vector3())
            .add(new Vector3(x * size.x, (y - 0.5) * size.y, z * size.z))
            .project(camera);
          ray.setFromCamera(new Vector2(p.x, p.y), camera);
          const pixel = {
            x: rect.left + ((p.x + 1) * rect.width) / 2,
            y: rect.top + ((1 - p.y) * rect.height) / 2,
          };
          if (
            world.town!.pickClinic(ray, inspected.reception) === target &&
            document.elementFromPoint(pixel.x, pixel.y) === canvas
          ) {
            // Touch coordinates round to CSS pixels. Avoid a grazing ray that
            // only hits a moving ear/tail at a fraction of a pixel.
            const solid = [
              [-2, 0],
              [2, 0],
              [0, -2],
              [0, 2],
            ].every(([dx, dy]) => {
              ray.setFromCamera(
                new Vector2(
                  p.x + (dx * 2) / rect.width,
                  p.y - (dy * 2) / rect.height,
                ),
                camera,
              );
              return (
                world.town!.pickClinic(ray, inspected.reception) === target
              );
            });
            if (!solid) continue;
            controls.enableDamping = true;
            return pixel;
          }
        }
  }
  controls.enableDamping = true;
  throw Error('No visible clinic surface: ' + name);
};
