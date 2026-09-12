import { World } from '../../src/world';
import { ClinicBuildEditor } from '../../src/clinic-build-editor';
import { localToTown } from '../../src/town-map';
import { Vector3, type OrthographicCamera } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
let world: World, editor: ClinicBuildEditor, advance: (dt: number) => void;
const load = World.prototype.load,
  enter = ClinicBuildEditor.prototype.enter;
World.prototype.load = function () {
  world = this;
  return load.call(this).then(() => {
    advance = world.town!.simulation.update.bind(world.town!.simulation);
    world.town!.simulation.update = () => {};
  });
};
ClinicBuildEditor.prototype.enter = function () {
  editor = this;
  enter.call(this);
};
void import('../../src/main');
window.buildTest = {
  snapshot: () => world.town!.simulation.snapshot(),
  step: (seconds: number) => {
    for (let i = 0; i < seconds * 10; i++) {
      if (editor?.active) editor.update(0.1);
      else advance(0.1);
    }
    world.draw(performance.now(), 0.1);
  },
  point: (x: number, z: number, frame = false) => {
    const p = localToTown(x, z),
      inspected = world as unknown as {
        ortho: OrthographicCamera;
        clinicControls: OrbitControls;
      };
    if (frame) {
      const target = new Vector3(p.x, 0.22, p.z);
      inspected.clinicControls.enableDamping = false;
      inspected.clinicControls.target.copy(target);
      inspected.ortho.position.copy(target).add(new Vector3(-8, 14, 9));
      inspected.ortho.zoom = 1.3;
      inspected.ortho.updateProjectionMatrix();
      inspected.clinicControls.update();
    }
    world.draw(performance.now(), 0);
    world.scene.updateMatrixWorld(true);
    inspected.ortho.updateMatrixWorld(true);
    const point = new Vector3(p.x, 0.22, p.z).project(inspected.ortho),
      r = world.buildCanvas.getBoundingClientRect();
    return {
      x: r.left + ((point.x + 1) * r.width) / 2,
      y: r.top + ((1 - point.y) * r.height) / 2,
    };
  },
  models: () =>
    [...world.town!.furniture.itemModels].map(([id, o]) => ({
      id,
      visible: o.visible,
      parts: o.children.length,
      x: o.position.x,
      z: o.position.z,
      rotation: o.rotation.y,
    })),
};
declare global {
  interface Window {
    buildTest: {
      snapshot: () => ReturnType<
        import('../../src/town-simulation').TownSimulation['snapshot']
      >;
      step: (seconds: number) => void;
      point: (
        x: number,
        z: number,
        frame?: boolean,
      ) => { x: number; y: number };
      models: () => {
        id: string;
        visible: boolean;
        parts: number;
        x: number;
        z: number;
        rotation: number;
      }[];
    };
  }
}
