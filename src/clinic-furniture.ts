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
      model.position.set(x, 0, z);
      this.group.add(model);
      this.fixtures.push({ model, upgrade, inverse });
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
    this.configure([]);
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
