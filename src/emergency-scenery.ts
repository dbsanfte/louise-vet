import * as THREE from 'three';
import { Character } from './character';
import { stations, rescueTrees } from './emergency-map';
import type { Emergencies, RescueActor, RescueEvent } from './emergencies';
import type { Household } from './town-simulation';
import { turnToward } from './movement';
export class EmergencyScenery {
  group = new THREE.Group();
  private engine: THREE.Group;
  private ladder: THREE.Group;
  private stowed: THREE.Group;
  private responders: { model: THREE.Group; animation: Character }[] = [];
  private flames: THREE.InstancedMesh;
  private smoke: THREE.InstancedMesh;
  private water: THREE.Points;
  private dummy = new THREE.Object3D();
  private beacons: THREE.Mesh[] = [];
  constructor(
    clone: (name: string) => THREE.Group,
    human: (name: string) => THREE.Group,
  ) {
    for (const [kind, station] of Object.entries(stations)) {
      const model = clone(kind + '-station');
      model.position.set(station.x, 0.15, station.z);
      model.rotation.y = station.facing;
      this.group.add(model);
      const sign = document.createElement('canvas');
      sign.width = 512;
      sign.height = 100;
      const ctx = sign.getContext('2d')!;
      ctx.fillStyle = '#fffbef';
      ctx.beginPath();
      ctx.roundRect(0, 0, 512, 100, 25);
      ctx.fill();
      ctx.fillStyle = kind === 'fire' ? '#a92e29' : '#264c7d';
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        kind === 'fire' ? 'Fire & Rescue' : 'Hookville Police',
        256,
        66,
      );
      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sign) }),
      );
      label.position.set(station.x, 5, station.z);
      label.scale.set(7, 1.4, 1);
      this.group.add(label);
    }
    const branchMaterial = new THREE.MeshStandardMaterial({
      color: 0x8c6747,
      roughness: 1,
    });
    for (const tree of rescueTrees) {
      const start = new THREE.Vector3(tree.x, 2.1, tree.z),
        end = new THREE.Vector3(tree.x + 1, 2.8, tree.z + 1);
      const branch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.095, start.distanceTo(end), 8),
        branchMaterial,
      );
      branch.position.copy(start).lerp(end, 0.5);
      branch.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        end.sub(start).normalize(),
      );
      this.group.add(branch);
    }
    this.engine = clone('fire-engine');
    this.group.add(this.engine);
    this.ladder = clone('rescue-ladder');
    this.group.add(this.ladder);
    this.stowed = clone('rescue-ladder');
    this.stowed.rotation.x = Math.PI / 2;
    this.stowed.position.set(0, 2.02, -1.5);
    this.engine.add(this.stowed);
    for (const x of [-0.6, 0.6]) {
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0x368fff }),
      );
      light.position.set(x, 2.35, 1.45);
      this.engine.add(light);
      this.beacons.push(light);
    }
    for (const [name, kit] of [
      ['visitor-ponytail', 'police-kit'],
      ['visitor', 'firefighter-kit'],
      ['visitor-bob', 'firefighter-kit'],
      ['visitor', ''],
    ]) {
      const model = human(name);
      model.userData.townLabel =
        kit === 'police-kit'
          ? 'Police officer'
          : kit
            ? 'Firefighter'
            : 'Driver';
      model.scale.setScalar(0.602);
      if (kit) {
        model.add(clone(kit));
        model.traverse((o) => {
          if (
            o instanceof THREE.Mesh &&
            o.material instanceof THREE.MeshStandardMaterial &&
            ['pink', 'plum', 'blue'].some((n) => o.material.name.startsWith(n))
          ) {
            o.material = o.material.clone();
            o.material.color.set(kit === 'police-kit' ? 0x254b7e : 0x65583b);
          }
        });
      }
      this.responders.push({ model, animation: new Character(model) });
      this.group.add(model);
    }
    this.flames = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshStandardMaterial({
        color: 0xff912b,
        emissive: 0xff4a08,
        emissiveIntensity: 2,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      }),
      28,
    );
    this.smoke = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 10, 8),
      new THREE.MeshBasicMaterial({
        color: 0x72737b,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
      20,
    );
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(90 * 3), 3),
    );
    this.water = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        color: 0xc2f5ff,
        size: 0.11,
        transparent: true,
        opacity: 0.85,
      }),
    );
    this.flames.frustumCulled = this.smoke.frustumCulled = false;
    this.group.add(this.flames, this.smoke, this.water);
  }
  private pose(
    index: number,
    a: RescueActor,
    dt: number,
    visible: boolean,
    motion?: 'Walk' | 'Idle' | 'Play',
  ) {
    const r = this.responders[index];
    r.model.visible = visible;
    r.model.position.set(a.x, a.y, a.z);
    r.model.rotation.y = turnToward(r.model.rotation.y, a.facing, dt);
    r.animation.setMotion(motion ?? (a.route.length ? 'Walk' : 'Idle'));
    r.animation.update(dt);
  }
  update(
    state: Emergencies,
    households: Household[],
    time: number,
    dt: number,
  ) {
    const e = state.active;
    this.engine.position.set(
      e?.engine.x ?? stations.fire.door.x,
      0.2,
      e?.engine.z ?? stations.fire.door.z,
    );
    this.engine.rotation.y = turnToward(
      this.engine.rotation.y,
      e?.engine.facing ?? Math.PI,
      dt,
    );
    this.flames.visible = this.smoke.visible = Boolean(
      e?.kind === 'fire' && e.fire > 0,
    );
    this.water.visible = Boolean(
      e?.phase === 'extinguish' && !e.partner?.route.length,
    );
    this.ladder.visible = Boolean(
      e &&
      ['ladder', 'climb', 'rescue', 'descend', 'handover'].includes(e.phase) &&
      e.trapped,
    );
    this.stowed.visible = !this.ladder.visible;
    this.beacons.forEach((b, i) => {
      b.visible = Boolean(
        e?.phase === 'dispatch' && Math.floor(time * 7 + i) % 2 === 0,
      );
    });
    const resting = (p: { x: number; z: number }) => ({
      ...p,
      y: 0.2,
      facing: 0,
      route: [],
    });
    this.pose(0, e?.police ?? resting(stations.police.door), dt, true);
    const out = Boolean(
      e &&
      ![
        'wander',
        'report',
        'search',
        'dispatch',
        'driver-out',
        'summon',
        'collect',
        'driver-return',
      ].includes(e.phase) &&
      !(e.phase === 'return' && !e.firefighter.route.length),
    );
    this.pose(
      1,
      e?.firefighter ?? resting(stations.fire.door),
      dt,
      out,
      e && ['climb', 'descend'].includes(e.phase)
        ? 'Walk'
        : e?.phase === 'rescue'
          ? 'Play'
          : undefined,
    );
    this.pose(
      2,
      e?.partner ?? resting(stations.fire.door),
      dt,
      Boolean(
        e?.partner &&
        !['dispatch', 'unload'].includes(e.phase) &&
        !(e.phase === 'return' && !e.partner.route.length),
      ),
      e?.phase === 'extinguish' && !e.partner?.route.length
        ? 'Play'
        : undefined,
    );
    this.pose(
      3,
      e?.driver ?? resting(stations.police.door),
      dt,
      Boolean(
        e &&
        ['driver-out', 'summon', 'collect', 'driver-return'].includes(e.phase),
      ),
      e?.phase === 'driver-out' ? 'Play' : undefined,
    );
    if (!e) return;
    this.group.userData.phase = e.phase;
    if (
      this.ladder.visible &&
      e.phase === 'ladder' &&
      e.firefighter.route.length
    ) {
      this.ladder.position.set(
        e.firefighter.x + 0.2,
        e.firefighter.y + 0.6,
        e.firefighter.z,
      );
      this.ladder.rotation.set(Math.PI / 2, e.firefighter.facing, 0);
    } else if (this.ladder.visible) {
      this.ladder.position.set(e.tree.x + 1.55, 0.2, e.tree.z + 1.65);
      this.ladder.rotation.set(0.24, Math.atan2(-0.55, -0.65), 0);
    }
    if (['climb', 'descend', 'exit-house'].includes(e.phase))
      this.responders[1].model.traverse((o) => {
        if (o.name.startsWith('arm_joint'))
          o.rotation.x =
            e.phase === 'exit-house' ||
            (e.phase === 'descend' && o.position.x > 0)
              ? -1.1
              : -1.8 +
                Math.sin(time * 6 + (o.position.x > 0 ? Math.PI : 0)) * 0.3;
      });
    if (e.kind === 'fire') {
      if (e.partner && !e.partner.route.length && e.phase !== 'return')
        this.responders[2].model.rotation.y = Math.atan2(
          households[e.household].home.x - e.partner.x,
          households[e.household].home.z - e.partner.z,
        );
      const home = households[e.household].home;
      for (let i = 0; i < 28; i++) {
        const t = (time * 1.1 + i * 0.37) % 1,
          angle = i * 2.399;
        this.dummy.position.set(
          home.x + Math.cos(angle) * (1.2 + (i % 3) * 0.45),
          0.8 + t * 3.1,
          home.z + Math.sin(angle) * (1.1 + (i % 4) * 0.35),
        );
        this.dummy.scale.setScalar((0.28 + (1 - t) * 0.4) * e.fire);
        this.dummy.scale.y *= 2.4;
        this.dummy.updateMatrix();
        this.flames.setMatrixAt(i, this.dummy.matrix);
        this.flames.setColorAt(
          i,
          new THREE.Color().setHSL(0.025 + t * 0.12, 1, 0.52 + t * 0.15),
        );
      }
      for (let i = 0; i < 20; i++) {
        const t = (time * 0.15 + i * 0.17) % 1;
        this.dummy.position.set(
          home.x + Math.sin(i * 4) * 1.5 + t,
          3 + t * 5,
          home.z + Math.cos(i * 3) * 1.2 + t * 0.7,
        );
        this.dummy.scale.setScalar((0.35 + t * 0.75) * e.fire);
        this.dummy.updateMatrix();
        this.smoke.setMatrixAt(i, this.dummy.matrix);
      }
      this.flames.instanceMatrix.needsUpdate =
        this.smoke.instanceMatrix.needsUpdate = true;
      if (this.flames.instanceColor)
        this.flames.instanceColor.needsUpdate = true;
      const hose = e.partner ?? e.firefighter;
      const positions = this.water.geometry.attributes.position;
      for (let i = 0; i < 90; i++) {
        const t = (i / 90 + time * 0.9) % 1;
        positions.setXYZ(
          i,
          hose.x + (home.x - hose.x) * t,
          1 + Math.sin(t * Math.PI) * 3,
          hose.z + (home.z - hose.z) * t,
        );
      }
      positions.needsUpdate = true;
      this.water.geometry.computeBoundingSphere();
    }
  }
}
export function rescuePetPose(
  e: RescueEvent,
  name: string,
  households: Household[],
) {
  if (e.chaserPet === name && e.chase)
    return {
      ...e.chase,
      visible: true,
      motion: e.chase.route.length ? ('Walk' as const) : ('Idle' as const),
    };
  if (e.delivered || !e.pets.includes(name)) return null;
  if (e.kind === 'fire') {
    const index = e.pets.indexOf(name),
      owner = households.find((h) => h.pets.some((p) => p.name === name))!;
    const carried = index === e.rescued - 1 && e.phase === 'exit-house';
    return {
      ...(carried
        ? {
            ...e.firefighter,
            x: e.firefighter.x + Math.sin(e.firefighter.facing) * 0.35,
            z: e.firefighter.z + Math.cos(e.firefighter.facing) * 0.35,
          }
        : owner.position),
      y: carried ? e.firefighter.y + 0.7 : 0.3,
      facing: e.owner.facing,
      visible: index < e.rescued,
      motion: 'Idle' as const,
    };
  }
  const bird =
    households[e.household].pets.find((p) => p.name === name)!.species ===
    'bird';
  return {
    ...e.pet,
    visible: true,
    motion:
      bird && e.pet.route.length
        ? ('Fly' as const)
        : e.pet.route.length ||
            (e.trapped &&
              e.pet.y < 2.8 &&
              [
                'wander',
                'report',
                'search',
                'dispatch',
                'unload',
                'ladder',
              ].includes(e.phase))
          ? ('Walk' as const)
          : ('Idle' as const),
  };
}
