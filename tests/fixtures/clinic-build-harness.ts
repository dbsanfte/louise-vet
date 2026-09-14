import { World } from '../../src/world';
import { ClinicBuildEditor } from '../../src/clinic-build-editor';
import { localToTown } from '../../src/town-map';
import { Vector3, InstancedMesh, type OrthographicCamera } from 'three';
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
  selection: () => (editor as unknown as { selected?: string }).selected,
  camera: () => {
    const w = world as unknown as {
      ortho: OrthographicCamera;
      clinicControls: OrbitControls;
    };
    return {
      position: w.ortho.position.toArray(),
      target: w.clinicControls.target.toArray(),
      zoom: w.ortho.zoom,
    };
  },
  snapshot: () => world.town!.simulation.snapshot(),
  scenery: () => {
    const scenery = world.town!.furniture.scenery;
    let doors = 0,
      walls = 0;
    scenery.group.traverse((o) => {
      if (!(o instanceof InstancedMesh) || Array.isArray(o.material)) return;
      if (o.material.name === 'wood open doors') doors += o.count;
      if (o.material.name === 'plaster') walls += o.count;
    });
    return {
      doors,
      walls,
      hints: scenery.hints.visible ? scenery.hintEdges.length : 0,
      renderedAt: (world as unknown as { lastRender: number }).lastRender,
    };
  },
  preview: () => {
    const preview = world.town!.furniture.scenery.preview;
    return {
      visible: preview.visible,
      x: preview.position.x,
      z: preview.position.z,
      width: preview.scale.x,
      depth: preview.scale.z,
      color: preview.material.color.getHex(),
      outlined: preview.children.length >= 4,
      depthTest: preview.material.depthTest,
    };
  },
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
      wheelRotation: o.getObjectByName('WheelRotor')?.rotation.x,
    })),
  doors: () =>
    world
      .town!.furniture.group.children.filter((o) => o.getObjectByName('door'))
      .map((o) => ({ visible: o.visible, x: o.position.x, z: o.position.z })),
};
declare global {
  interface Window {
    buildTest: {
      selection: () => string | undefined;
      camera: () => { position: number[]; target: number[]; zoom: number };
      snapshot: () => ReturnType<
        import('../../src/town-simulation').TownSimulation['snapshot']
      >;
      scenery: () => {
        doors: number;
        walls: number;
        hints: number;
        renderedAt: number;
      };
      preview: () => {
        visible: boolean;
        x: number;
        z: number;
        width: number;
        depth: number;
        color: number;
        outlined: boolean;
        depthTest: boolean;
      };
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
        wheelRotation?: number;
      }[];
      doors: () => { visible: boolean; x: number; z: number }[];
    };
  }
}
