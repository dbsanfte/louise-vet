import { World } from '../../src/world';
import { ClinicBuildEditor } from '../../src/clinic-build-editor';
import { toClinic } from '../../src/clinic-build';
import { examRoom, localToTown } from '../../src/town-map';
import { visits } from '../../src/game';
import {
  Vector3,
  Box3,
  InstancedMesh,
  Mesh,
  Raycaster,
  BasicShadowMap,
  PCFShadowMap,
  type OrthographicCamera,
} from 'three';
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
  fish: () => {
    const result: {
      name: string;
      trolley: boolean;
      swimming: number[];
      submerged: boolean;
      hoop: boolean;
      bubbles: number;
    }[] = [];
    world.scene.updateMatrixWorld(true);
    world.scene.traverse((o) => {
      if (o.name !== 'SwimmingInsideBowl') return;
      let model = o.parent!;
      while (model.parent && !model.userData.petName) model = model.parent;
      const b = new Box3()
        .setFromObject(o)
        .applyMatrix4(o.parent!.matrixWorld.clone().invert());
      const visible = (part: import('three').Object3D) => {
        let p: import('three').Object3D | null = part;
        while (p) {
          if (!p.visible) return false;
          p = p.parent;
        }
        return true;
      };
      result.push({
        name: model.userData.petName,
        trolley: Boolean(model.getObjectByName('BowlTrolley')?.visible),
        swimming: [...o.position.toArray(), o.rotation.y],
        submerged:
          b.min.y > 0.09 &&
          b.max.y < 1.24 &&
          b.min.x > -0.94 &&
          b.max.x < 0.94 &&
          b.min.z > -0.96 &&
          b.max.z < 0.96,
        hoop: Boolean(o.parent!.getObjectByName('UnderwaterReefHoop')?.visible),
        bubbles: o.parent!.children.filter(
          (c) => c.name === 'UnderwaterPlayBubble' && visible(c),
        ).length,
      });
    });
    return result;
  },
  examFloor: (closeUp = false, angle = 0, filteredShadows = false) => {
    world.renderer.shadowMap.type = filteredShadows
      ? PCFShadowMap
      : BasicShadowMap;
    if (closeUp) {
      world.showTreatment(visits.find((v) => v.name === 'Luna')!);
      world.rotate(angle);
    } else {
      world.showReception();
      world.focusClinic('exam');
      world.rotateClinicCamera(angle);
    }
    world.town!.furniture.applyBuild(world.town!.simulation.build, []);
    world.scene.updateMatrixWorld(true);
    const floors: Mesh[] = [];
    world.scene.traverseVisible((o) => {
      if (
        o instanceof Mesh &&
        (/^room_tile/.test(o.name) ||
          (!Array.isArray(o.material) && o.material.name === 'floor tile'))
      )
        floors.push(o);
    });
    // Sample away from tile seams. Count distinct visible surfaces at the top
    // height; coplanar meshes compete for depth even if one wins this frame.
    const layers: number[] = [];
    for (const x of [-1.7, -0.7, 0.3, 1.3, 2.3])
      for (const z of [-2.3, -1.3, -0.3, 0.7, 1.7, 2.7]) {
        const p = closeUp
          ? { x, z }
          : localToTown(x + examRoom.x, z + examRoom.z);
        const hits = new Raycaster(
          new Vector3(p.x, 1, p.z),
          new Vector3(0, -1, 0),
        ).intersectObjects(floors, false);
        layers.push(
          new Set(
            hits
              .filter((h) => h.distance - hits[0].distance < 0.005)
              .map((h) => `${h.object.uuid}:${h.instanceId}`),
          ).size,
        );
      }
    return {
      layers,
      authored: floors.filter((o) => /^room_tile/.test(o.name)).length,
    };
  },
  occupyForErase: () => {
    const s = world.town!.simulation;
    const pet = [...s.leisure.pets.values()][0];
    const owner = s.households.find((h) => h.ticket === pet.ticket)!;
    Object.assign(owner.position, localToTown(-8, 0));
    const activity = s.leisure.owners.get(owner.id)!;
    activity.station = 'seat-5';
    activity.phase = 'sit';
    activity.route = [];
    pet.station = s.build.itemStations('coaster')[0];
    pet.phase = 'use';
    pet.elapsed = 4;
    Object.assign(pet.position, localToTown(-15, -8));
    world.town!.update(0, true);
    return { owner: owner.id, ticket: pet.ticket };
  },
  occupantsSafe: () => {
    const s = world.town!.simulation;
    return (
      [...s.leisure.pets.values()].every((p) => {
        const station = s.build.stations.find((st) => st.id === p.station);
        return (
          (station &&
            s.leisure.available(station) &&
            ['use', 'board'].includes(p.phase)) ||
          s.build.canStand(toClinic(p.position))
        );
      }) &&
      s.households
        .filter((h) => h.inClinic)
        .every((h) => {
          const activity = s.leisure.owners.get(h.id),
            station =
              activity &&
              s.build.stations.find((st) => st.id === activity.station);
          return (
            (station &&
              s.leisure.available(station) &&
              ['sit', 'read', 'game'].includes(activity!.phase)) ||
            s.build.canStand(toClinic(h.position))
          );
        })
    );
  },
  itemPoint: (id: string) => {
    world.focusBuildItem(id);
    world.draw(performance.now(), 0);
    world.scene.updateMatrixWorld(true);
    const camera = (world as unknown as { ortho: OrthographicCamera }).ortho;
    camera.updateMatrixWorld(true);
    const box = new Box3().setFromObject(
        world.town!.furniture.itemModels.get(id)!,
      ),
      rect = world.buildCanvas.getBoundingClientRect();
    // Find a visible point on the real model, then the test uses actual input.
    for (const y of [0.5, 0.8, 0.2])
      for (const x of [0.5, 0.25, 0.75])
        for (const z of [0.5, 0.25, 0.75]) {
          const p = new Vector3(
            box.min.x + (box.max.x - box.min.x) * x,
            box.min.y + (box.max.y - box.min.y) * y,
            box.min.z + (box.max.z - box.min.z) * z,
          ).project(camera);
          const screen = {
            x: rect.left + ((p.x + 1) * rect.width) / 2,
            y: rect.top + ((1 - p.y) * rect.height) / 2,
          };
          if (world.buildHit(screen.x, screen.y).id === id) return screen;
        }
    throw new Error(`No visible hit point for ${id}`);
  },
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
      fish: () => {
        name: string;
        trolley: boolean;
        swimming: number[];
        submerged: boolean;
        hoop: boolean;
        bubbles: number;
      }[];
      examFloor: (
        closeUp?: boolean,
        angle?: number,
        filteredShadows?: boolean,
      ) => { layers: number[]; authored: number };
      occupyForErase: () => { owner: number; ticket: number };
      occupantsSafe: () => boolean;
      itemPoint: (id: string) => { x: number; y: number };
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
