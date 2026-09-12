import { ClinicBuildScenery } from './clinic-build-scenery';
import { buildRecipes, type ClinicBuild } from './clinic-build';
import { TownSurfaces } from './town-surfaces';
import { ridePose } from './pet-rides';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clinicPlan, type ClinicLeisure } from './clinic-leisure';
import { layout } from './town-map';
import type { UpgradeId } from './game';
import { clinicFixtureNames } from './clinic-identity';
export class ClinicFurniture {
  readonly group = new THREE.Group();
  readonly scenery = new ClinicBuildScenery();
  readonly itemModels = new Map<string, THREE.Group>();
  private base?: THREE.Object3D;
  private build?: ClinicBuild;
  private lastRevision = -1;
  private assets = new Map<string, THREE.Group>();
  private fixtures: {
    model: THREE.Group;
    upgrade: string;
    inverse?: boolean;
  }[] = [];
  private rides = new Map<string, THREE.Group>();
  async load() {
    const surfaces = new TownSurfaces();
    const names = [
      'sun-courtyard',
      'puzzle-table',
      'bubbles',
      'cat-nook',
      'bird-chimes',
      'flower-border',
      'bunting',
      'cosy-rug',
      'wall-art',
      'lounge',
      'playroom',
      'door',
      'bench',
      'books',
      'reading-book',
      'table-games',
      'scratch',
      'wheel',
      'carousel',
      'toys',
      'coaster',
      'ferris',
      'play-annex',
      'treat-dispenser',
      'water-dispenser',
      'toy-box',
      'yarn',
      'aviary',
      'play-tree',
    ];
    const loader = new GLTFLoader();
    await Promise.all(
      names.map(async (name) => {
        const gltf = await loader.loadAsync(`/models/clinic/${name}.glb`);
        gltf.scene.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        surfaces.apply(gltf.scene);
        this.assets.set(name, gltf.scene);
      }),
    );
    this.group.position.set(layout.clinic.x, 0.15, layout.clinic.z);
    this.group.rotation.y = layout.clinic.rotation;
    this.group.scale.setScalar(layout.clinic.scale);
    this.group.add(this.scenery.group);
    const add = (
      name: string,
      x: number,
      z: number,
      upgrade: string,
      inverse = false,
    ) => {
      const model = this.assets.get(name)!.clone(true);
      if (clinicFixtureNames[name])
        model.userData.clinicInfo = {
          name: clinicFixtureNames[name],
          description: 'Clinic attraction',
        };
      if (name === 'bunting' || name === 'wall-art') {
        const r = buildRecipes.find((r) => r.id === name)!;
        for (const child of model.children) {
          child.position.x -= r.x;
          child.position.z -= r.z;
        }
      }
      model.position.set(x, 0, z);
      this.group.add(model);
      this.fixtures.push({ model, upgrade, inverse });
      if (buildRecipes.some((r) => r.id === name))
        this.itemModels.set(name, model);
      return model;
    };
    add('door', -5.14, 0, 'expansion', true);
    for (const room of clinicPlan.rooms)
      add(
        room.id === 'expansion'
          ? 'lounge'
          : room.id === 'pet-room'
            ? 'playroom'
            : room.id,
        room.x,
        room.z,
        room.id,
      );
    const door = add('door', -11, 0, 'pet-room', true);
    door.userData.requiresLounge = true;
    const gardenDoor = add('door', -8, -4, 'play-annex', true);
    gardenDoor.rotation.y = Math.PI / 2;
    gardenDoor.userData.requiresLounge = true;
    const courtyardDoor = add('door', -11.95, -12, 'sun-courtyard', true);
    courtyardDoor.rotation.y = Math.PI / 2;
    courtyardDoor.userData.requiresPlayroom = true;
    add('puzzle-table', -14.8, -13.6, 'puzzle-table');
    add('flower-border', -14, -16, 'flower-border');
    add('bunting', 0, 0, 'bunting');
    add('cosy-rug', -2.5, 1.05, 'cosy-rug');
    add('wall-art', 0, 0, 'wall-art');
    add('bench', 3.025, 2.75, 'bench');
    add('books', 0.7, 2.7, 'books');
    add('table-games', -8.2, -2.1, 'table-games');
    for (const s of clinicPlan.stations.filter((s) => s.audience === 'pet'))
      this.rides.set(s.id, add(s.kind, s.x, s.z, s.upgrade));
    const chairSource = this.assets.get('lounge')!;
    for (const r of buildRecipes.filter((r) => r.asset === 'chair')) {
      let source: THREE.Object3D | undefined;
      chairSource.traverse((o) => {
        if (!source && /lounge[ _]chair/.test(o.name)) source = o;
      });
      const model = new THREE.Group();
      const chair = source!.clone(true);
      chair.position.set(0, 0, 0);
      model.add(chair);
      this.group.add(model);
      this.itemModels.set(r.id, model);
    }
    for (const f of this.fixtures)
      if (f.upgrade === 'expansion' && !f.inverse)
        f.model.traverse((o) => {
          if (/lounge[ _]chair/.test(o.name)) o.visible = false;
        });
    for (const r of buildRecipes.filter(
      (r) => r.asset === 'plant' || r.asset === 'poster',
    )) {
      const model = new THREE.Group();
      const box = (
        w: number,
        h: number,
        d: number,
        y: number,
        color: number,
      ) => {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          new THREE.MeshStandardMaterial({ color }),
        );
        m.position.y = y;
        model.add(m);
      };
      if (r.asset === 'plant') {
        box(0.35, 0.4, 0.35, 0.2, 0xc8876c);
        const leaf = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.45, 1),
          new THREE.MeshStandardMaterial({ color: 0x6f9555 }),
        );
        leaf.position.y = 0.85;
        leaf.scale.y = 1.4;
        model.add(leaf);
      } else {
        box(0.8, 1.15, 0.1, 2.1, 0xf6d479);
        box(0.5, 0.12, 0.12, 2.25, 0x679683);
      }
      this.itemModels.set(r.id, model);
      this.group.add(model);
    }
    this.configure([]);
  }
  registerBase(base: THREE.Object3D) {
    this.base = base;
    const filters: Record<string, (o: THREE.Object3D) => boolean> = {
      'welcome-bench': (o) => /bench|cushion/.test(o.name),
      shelf: (o) =>
        /^(shop[ _]|food[ _]tin|toy[ _]ball|treat[ _]bag)/.test(o.name),
      'base-plant-0': (o) =>
        /^(terracotta[ _]pot|leaf)/.test(o.name) && o.position.x < 0,
      'base-plant-1': (o) =>
        /^(terracotta[ _]pot|leaf)/.test(o.name) && o.position.x > 0,
      'round-rug': (o) => /^round[ _]rug/.test(o.name),
      'welcome-mat': (o) => /^welcome[ _]mat/.test(o.name),
      'paw-picture': (o) => /^(picture|paw[ _]print)/.test(o.name),
    };
    for (const [id, match] of Object.entries(filters)) {
      const model = new THREE.Group(),
        r = buildRecipes.find((r) => r.id === id)!;
      base.traverse((o) => {
        if (o instanceof THREE.Mesh && match(o)) {
          const part = o.clone();
          part.position.x -= r.x;
          part.position.z -= r.z;
          part.visible = true;
          model.add(part);
          o.visible = false;
        }
      });
      this.group.add(model);
      this.itemModels.set(id, model);
    }
    this.lastRevision = -1;
  }

  applyBuild(build: ClinicBuild, ids: UpgradeId[]) {
    if (this.build === build && this.lastRevision === build.revision) return;
    this.build = build;
    this.lastRevision = build.revision;
    this.configure(ids);
    this.scenery.update(build);
    for (const f of this.fixtures) {
      const room = clinicPlan.rooms.find((r) => r.id === f.upgrade);
      if (room && !f.inverse && !this.itemModels.has(f.upgrade))
        f.model.visible =
          !build.state.floorEdited &&
          build.contains(room) &&
          ids.includes(f.upgrade as UpgradeId);
      if (f.inverse && !build.state.floorEdited && room)
        f.model.visible = !build.contains(room);
      if (f.inverse && build.state.floorEdited) f.model.visible = false;
    }
    this.base?.traverse((o) => {
      if (
        o instanceof THREE.Mesh &&
        /^(floor|foundation|left[ _]|connecting[ _]|side[ _]wall|back[ _]wall|back[ _]dado|back[ _]trim)/.test(
          o.name,
        )
      )
        o.visible = !build.state.floorEdited;
    });
    for (const r of buildRecipes) {
      const model = this.itemModels.get(r.id);
      if (!model) continue;
      const p = build.placement(r.id);
      model.visible = Boolean(p);
      model.userData.buildItem = r.id;
      model.userData.clinicInfo = {
        name: r.name,
        description: r.stations.length
          ? 'Clinic furniture'
          : 'Clinic decoration',
      };
      if (p) {
        model.position.set(p.x, 0, p.z);
        model.rotation.y = p.rotation;
      }
    }
  }
  book() {
    return this.assets.get('reading-book')!.clone(true);
  }
  configure(ids: UpgradeId[]) {
    for (const f of this.fixtures) {
      f.model.visible = f.inverse
        ? !ids.includes(f.upgrade as UpgradeId)
        : ids.includes(f.upgrade as UpgradeId);
      if (f.model.userData.requiresPlayroom)
        f.model.visible &&= ids.includes('pet-room');
      if (f.model.userData.requiresLounge)
        f.model.visible &&= ids.includes('expansion');
    }
  }
  update(leisure: ClinicLeisure) {
    this.applyBuild(leisure.build, leisure.build.state.unlocked as UpgradeId[]);
    for (const [id, model] of this.rides) {
      const rider = [...leisure.pets.values()].find(
        (p) => p.station === id && p.phase === 'use',
      );
      const wheel = model.getObjectByName('WheelRotor'),
        carousel = model.getObjectByName('CarouselRotor');
      if (wheel && rider) wheel.rotation.x = rider.elapsed * 4;
      if (carousel && rider) carousel.rotation.y = -rider.elapsed * 0.65;
      const flow = model.getObjectByName('DispenserFlow');
      if (flow)
        flow.visible = Boolean(rider && Math.sin(rider.elapsed * 3) > -0.4);
      const ball = model.getObjectByName('PlayBall');
      if (ball) {
        ball.position.set(
          rider ? Math.sin(rider.elapsed * 1.7 + 0.4) * 0.6 : 0,
          0.27,
          0.55,
        );
        ball.rotation.z = rider ? -rider.elapsed * 2 : 0;
      }
      for (let i = 0; i < 7; i++) {
        const bubble = model.getObjectByName('Bubble' + i);
        if (bubble) {
          const t = ((rider?.elapsed ?? 0) * 0.7 + i / 7) % 1;
          bubble.visible = Boolean(rider);
          bubble.position.set(
            Math.sin(i * 2 + t * 3) * 0.7,
            0.35 + t * 1.1,
            Math.cos(i + t * 2) * 0.6,
          );
          bubble.scale.setScalar(0.5 + Math.sin(t * Math.PI) * 0.5);
        }
      }
      const chimes = model.getObjectByName('Chimes');
      if (chimes)
        chimes.rotation.z = rider ? Math.sin(rider.elapsed * 5) * 0.18 : 0;
      const swing = model.getObjectByName('BirdSwing');
      if (swing)
        swing.rotation.x = rider ? Math.sin(rider.elapsed * 2) * 0.15 : 0;
      if (id === 'coaster') {
        const car = model.getObjectByName('CoasterCar')!;
        const pose = ridePose(id, rider?.elapsed ?? 0);
        car.position.set(pose.x, pose.y, pose.z);
        car.rotation.y = pose.facing;
      }
      if (id === 'ferris') {
        const elapsed = rider?.elapsed ?? 0;
        model.getObjectByName('FerrisRotor')!.rotation.z =
          (elapsed / 12) * Math.PI * 2;
        for (let i = 0; i < 4; i++) {
          const cabin = model.getObjectByName(`FerrisCabin${i}`)!;
          const pose = ridePose(id, (elapsed + i * 3) % 12);
          cabin.position.set(pose.x, pose.y, pose.z);
        }
      }
    }
  }
}
