// Deterministic visual inspection of the real world renderer; never shipped.
import { World } from '../../src/world';
import { TownSimulation } from '../../src/town-simulation';
import { visits } from '../../src/game';
import { stations } from '../../src/emergency-map';
const container = document.createElement('div');
container.style.cssText = 'width:900px;height:650px;background:#eee9dd';
document.body.style.margin = '0';
document.body.append(container);
const simulation = new TownSimulation(visits);
const world = new World(
  container,
  () => {},
  () => {},
  simulation,
);
const ready = world.load().then(() => world.showTown());
declare global {
  interface Window {
    inspectRescue: (
      snapshot: unknown,
      focus?: 'fire' | 'police',
    ) => Promise<{ phase?: string; activePets: number; raised: number }>;
  }
}
window.inspectRescue = async (snapshot, focus) => {
  await ready;
  if (!simulation.restore(snapshot))
    throw Error('Invalid rescue visual fixture');
  const e = simulation.emergencies.active!;
  world.focusEmergency(
    focus
      ? stations[focus]
      : e.kind === 'fire'
        ? simulation.households[e.household].home
        : e.tree,
  );
  world.draw(performance.now() + 100, 0.1);
  // Wait for the one rendered frame before replacing it with the next pose.
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  return { phase: e.phase, activePets: e.pets.length, raised: e.firefighter.y };
};

declare global {
  interface Window {
    inspectTraffic: (
      snapshot: unknown,
      advance?: number,
    ) => Promise<{ slot: number; kind: string; wheels: number[] }[]>;
  }
}
window.inspectTraffic = async (snapshot, advance = 0) => {
  await ready;
  if (!simulation.restore(snapshot)) throw Error('Invalid traffic fixture');
  for (let i = 0; i < advance * 10; i++) simulation.update(0.1);
  world.focusEmergency({ x: 0, z: -1 });
  world.draw(performance.now() + 100, 1);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const vehicles: { slot: number; kind: string; wheels: number[] }[] = [];
  world.town!.group.traverse((o) => {
    if (typeof o.userData.trafficSlot !== 'number') return;
    let kind = '';
    const wheels: number[] = [];
    o.traverse((part) => {
      if (part.userData.vehicleKind) kind = part.userData.vehicleKind;
      if (part.userData.wheelRadius) wheels.push(part.rotation.x);
    });
    vehicles.push({ slot: o.userData.trafficSlot, kind, wheels });
  });
  return vehicles;
};

declare global {
  interface Window {
    inspectDogWalk: (
      snapshot: unknown,
      focus: { x: number; z: number },
    ) => Promise<{
      fixtures: number;
      props: string[];
      pets: { name: string; phase: string; head: number; leg: number }[];
      bentOwners: string[];
    }>;
  }
}
window.inspectDogWalk = async (snapshot, focus) => {
  await ready;
  if (!simulation.restore(snapshot)) throw Error('Invalid dog walk fixture');
  world.focusEmergency(focus);
  world.zoomTown(0.4);
  // Two poses settle the clip blend and heading, without advancing simulation.
  world.draw(performance.now(), 0.3);
  world.draw(performance.now() + 300, 0.3);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  let fixtures = 0;
  const props: string[] = [],
    pets: { name: string; phase: string; head: number; leg: number }[] = [],
    bentOwners: string[] = [];
  world.town!.group.traverse((o) => {
    if (o.userData.streetDetail) fixtures++;
    if (o.userData.dogProp && o.visible) props.push(o.userData.dogProp);
    if (o.userData.ownerName)
      o.traverse((p) => {
        if (p.name.startsWith('torso_joint') && p.rotation.x > 0.5)
          bentOwners.push(o.userData.ownerName);
      });
    if (o.userData.dogWalk) {
      let head = 0,
        leg = 0;
      o.traverse((p) => {
        if (p.name.startsWith('head_joint')) head = p.rotation.x;
        if (
          p.name.startsWith('leg_joint') &&
          p.position.x > 0 &&
          p.position.z < 0
        )
          leg = p.rotation.z;
      });
      pets.push({
        name: o.userData.petName,
        phase: o.userData.dogWalk,
        head,
        leg,
      });
    }
  });
  return { fixtures, props, pets, bentOwners };
};

declare global {
  interface Window {
    inspectNamed: (
      snapshot: unknown,
      label: string,
    ) => Promise<{ x: number; y: number }>;
  }
}
const identity = document.createElement('output');
identity.id = 'identity';
identity.hidden = true;
identity.style.cssText =
  'position:fixed;bottom:10px;left:10px;padding:8px;background:white;font:20px sans-serif';
document.body.append(identity);
world.onTownPick = (pick) => {
  identity.textContent = typeof pick === 'object' ? pick.label : '';
  identity.hidden = !identity.textContent;
};
window.inspectNamed = async (snapshot, label) => {
  await ready;
  if (!simulation.restore(snapshot)) throw Error('Invalid identity fixture');
  // Inspect the rendered models and use their actual surfaces for pointer targets.
  world.town!.update(0.3, true);
  world.scene.updateMatrixWorld(true);
  let model: import('three').Object3D | undefined;
  world.town!.group.traverse((o) => {
    if (o.userData.townLabel === label) model = o;
  });
  if (!model) throw Error('Missing named actor: ' + label);
  const { Box3, Vector2, Vector3, Raycaster } = await import('three');
  const box = new Box3().setFromObject(model);
  const centre = box.getCenter(new Vector3());
  world.focusEmergency({ x: centre.x, z: centre.z });
  world.zoomTown(0.4);
  // Flush the previous software frame before rendering this newly focused camera.
  world.renderer.getContext().finish();
  world.draw(performance.now() + 300, 0.3);
  const camera = (world as unknown as { townCamera: import('three').Camera })
    .townCamera;
  box.setFromObject(model);
  const size = box.getSize(new Vector3());
  const ray = new Raycaster();
  for (const y of [0.2, 0.5, 0.8])
    for (const x of [-0.3, 0, 0.3])
      for (const z of [-0.3, 0, 0.3]) {
        const p = box
          .getCenter(new Vector3())
          .add(new Vector3(x * size.x, (y - 0.5) * size.y, z * size.z))
          .project(camera);
        ray.setFromCamera(new Vector2(p.x, p.y), camera);
        const picked = world.town!.pick(ray);
        if (typeof picked === 'object' && picked.label === label) {
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
          return { x: (p.x + 1) * 450, y: (1 - p.y) * 325 };
        }
      }
  throw Error('No visible pickable surface for ' + label);
};

declare global {
  interface Window {
    inspectEntrance: (snapshot: unknown) => Promise<{
      owners: { name: string; x: number; z: number }[];
      pets: { name: string; x: number; z: number }[];
    }>;
  }
}
window.inspectEntrance = async (snapshot) => {
  await ready;
  if (!simulation.restore(snapshot)) throw Error('Invalid entrance fixture');
  // A restored queue must place pets beside their owners on the first frame,
  // without walking across town from the models' uninitialized origins.
  world.town!.update(0.1, true);
  world.focusEmergency({ x: -19, z: -3 });
  world.zoomTown(0.75);
  world.renderer.getContext().finish();
  world.draw(performance.now() + 300, 0.3);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const outside = simulation.households.filter(
    (h) => !h.inClinic && h.routine === 'clinic-wait',
  );
  const owners: { name: string; x: number; z: number }[] = [],
    pets: { name: string; x: number; z: number }[] = [];
  world.town!.group.traverse((o) => {
    if (!o.visible) return;
    if (outside.some((h) => h.owner === o.userData.ownerName))
      owners.push({
        name: o.userData.ownerName,
        x: o.position.x,
        z: o.position.z,
      });
    if (outside.some((h) => h.companions.includes(o.userData.petName)))
      pets.push({ name: o.userData.petName, x: o.position.x, z: o.position.z });
  });
  return { owners, pets };
};

declare global {
  interface Window {
    inspectPolish: (
      snapshot: unknown,
      upgrades: import('../../src/game').UpgradeId[],
      view: 'town' | 'courtyard' | 'reception',
    ) => Promise<{
      surfaces: string[];
      glossy: number;
      rain: boolean;
      sheltering: string[];
      activities: string[];
    }>;
  }
}
window.inspectPolish = async (snapshot, upgrades, view) => {
  await ready;
  simulation.configureLeisure(upgrades);
  simulation.configureClinic(8, 22);
  if (!simulation.restore(snapshot)) throw Error('Invalid polish fixture');
  world.setUpgrades(upgrades);
  if (view === 'town') {
    await world.showTown();
    world.focusEmergency({ x: -6, z: -3 });
    world.zoomTown(0.75);
  } else {
    world.showReception();
    world.focusClinic(view);
  }
  world.renderer.getContext().finish();
  world.draw(performance.now() + 300, 0.3);
  world.renderer.getContext().finish();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const { Mesh, MeshStandardMaterial, MeshPhysicalMaterial } =
    await import('three');
  const surfaces = new Set<string>(),
    sheltering: string[] = [],
    activities: string[] = [];
  let glossy = 0,
    rain = false;
  world.scene.traverse((o) => {
    if (o instanceof Mesh && o.material instanceof MeshStandardMaterial) {
      if (o.material.map && o.material.userData.surface)
        surfaces.add(o.material.userData.surface);
      if (
        o.material instanceof MeshPhysicalMaterial &&
        o.material.clearcoat === 1
      )
        glossy++;
    }
    if (o.userData.rainShelter) sheltering.push(o.userData.petName);
    if (o.userData.weatherEffect === 'rain') rain = o.parent!.visible;
  });
  for (const p of simulation.leisure.pets.values())
    if (p.phase === 'use') activities.push(p.station);
  return { surfaces: [...surfaces], glossy, rain, sheltering, activities };
};
