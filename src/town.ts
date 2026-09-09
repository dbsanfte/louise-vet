import { TownSurfaces } from './town-surfaces';
import { shadeTrees } from './town-weather';
import { StreetScenery } from './street-scenery';
import { trafficModels, TrafficVehicle } from './traffic-vehicle';
import { EmergencyScenery, rescuePetPose } from './emergency-scenery';
import { parkPetPose } from './park';
import { ParkScenery } from './park-scenery';
import { petAsset } from './pet-appearance';
import { turnToward } from './movement';
import { ridePose, isCabinRide } from './pet-rides';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Character } from './character';
import { OwnerTrail } from './owner-trail';
import type { Visit } from './game';
import { TownSimulation } from './town-simulation';
import { ClinicFurniture } from './clinic-furniture';
import { clinicPlan, clinicPetRest, interiorRoute } from './clinic-leisure';
import { enrichmentPose, isEnrichment } from './clinic-enrichment';
import { walkRoute } from './movement';
import type { UpgradeId } from './game';
import { layout, garden, localToTown, distance } from './town-map';

export type TownPick = number | { label: string } | undefined;

/** The town owns one shared simulation; switching views never recreates it. */
export class Town {
  readonly group = new THREE.Group();
  readonly surfaces = new TownSurfaces();
  private furniture = new ClinicFurniture();
  setUpgrades(ids: UpgradeId[]) {
    this.furniture.configure(ids);
  }

  private residents: {
    owner: THREE.Group;
    trail: OwnerTrail;
    ownerAnimation: Character;
    book: THREE.Group;
    pets: {
      model: THREE.Group;
      animation: Character;
      visit: Visit;
      bubble: THREE.Sprite;
      placed: boolean;
      perch?: THREE.Group;
    }[];
    bubble: THREE.Sprite;
  }[] = [];
  private contactShadows?: THREE.InstancedMesh;
  private shadowPose = new THREE.Object3D();
  private parkScenery?: ParkScenery;
  private emergencyScenery?: EmergencyScenery;
  private cars: TrafficVehicle[] = [];
  private streetScenery?: StreetScenery;
  private homes: THREE.Object3D[] = [];
  private namedActors: THREE.Object3D[] = [];
  private clinic?: THREE.Group;
  setOfficeView(inside: boolean) {
    if (this.clinic) this.clinic.visible = !inside;
  }
  registerClinic(clinic: THREE.Object3D) {
    clinic.userData.homeId = -1;
    this.homes.push(clinic);
  }

  private incidentMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1, 32),
    new THREE.MeshBasicMaterial({ color: 0xf7c76e, side: THREE.DoubleSide }),
  );
  private bubbleTexture: THREE.CanvasTexture;
  private sleepTexture: THREE.CanvasTexture;
  constructor(
    private cloneCharacter: (name: string) => THREE.Group,
    readonly simulation: TownSimulation,
    private softwareGraphics = false,
  ) {
    if (softwareGraphics) {
      const clone = cloneCharacter;
      this.cloneCharacter = (name) => {
        const model = clone(name);
        model.traverse((o) => {
          if (o instanceof THREE.Mesh) o.castShadow = false;
        });
        return model;
      };
    }
    const makeBubble = (label: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 80;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fffdf1';
      ctx.beginPath();
      ctx.roundRect(4, 4, 120, 58, 25);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(35, 55);
      ctx.lineTo(32, 78);
      ctx.lineTo(60, 55);
      ctx.fill();
      ctx.fillStyle = '#36584c';
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, 64, 39);
      return new THREE.CanvasTexture(canvas);
    };
    this.bubbleTexture = makeBubble('...');
    this.sleepTexture = makeBubble('Z z');
    this.incidentMarker.rotation.x = -Math.PI / 2;
    this.incidentMarker.visible = false;
    this.group.add(this.incidentMarker);
  }
  async load() {
    const loader = new GLTFLoader();
    const assets = new Map<string, THREE.Group>();
    await Promise.all(
      [
        'neighbourhood',
        'shade-tree',
        'park',
        'duck',
        ...layout.lots.map((l) => l.asset),
        'clinic-exterior',
        'doghouse',
        ...trafficModels,
        'lamppost',
        'hydrant',
        'dog-poo',
        'cleanup-bag',
        'fire-station',
        'police-station',
        'fire-engine',
        'rescue-ladder',
        'firefighter-kit',
        'police-kit',
      ].map(async (name) => {
        const gltf = await loader.loadAsync(`/models/town/${name}.glb`);
        gltf.scene.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.castShadow =
              name !== 'neighbourhood' &&
              !(
                this.softwareGraphics &&
                [
                  'duck',
                  ...trafficModels,
                  'fire-engine',
                  'rescue-ladder',
                  'firefighter-kit',
                  'police-kit',
                  'dog-poo',
                  'cleanup-bag',
                ].includes(name)
              );
            o.receiveShadow = true;
          }
        });
        this.surfaces.apply(gltf.scene);
        assets.set(name, gltf.scene);
      }),
    );
    const clone = (name: string) => assets.get(name)!.clone(true);
    this.group.add(clone('neighbourhood'));
    for (const p of shadeTrees) {
      const tree = clone('shade-tree');
      tree.position.set(p.x, 0.15, p.z);
      tree.userData.shadeTree = true;
      this.group.add(tree);
    }
    this.streetScenery = new StreetScenery(
      clone,
      this.simulation.households.length,
    );
    this.group.add(this.streetScenery.group);
    this.emergencyScenery = new EmergencyScenery(clone, this.cloneCharacter);
    this.group.add(this.emergencyScenery.group);
    this.parkScenery = new ParkScenery(clone('park'), clone('duck'));
    this.group.add(this.parkScenery.group);
    const clinic = clone('clinic-exterior');
    clinic.position.set(layout.clinic.x, 0.15, layout.clinic.z);
    clinic.scale.setScalar(layout.clinic.scale);
    clinic.rotation.y = layout.clinic.rotation;
    this.clinic = clinic;
    clinic.userData.homeId = -1;
    this.homes.push(clinic);
    this.group.add(clinic);
    for (const lot of layout.lots) {
      const building = clone(lot.asset);
      building.position.set(lot.x, 0.15, lot.z);
      building.rotation.y = lot.facing;
      building.userData.homeId = this.simulation.households.find(
        (h) => h.lot === lot.id,
      )!.id;
      this.homes.push(building);
      this.group.add(building);
    }
    await this.furniture.load();
    this.group.add(this.furniture.group);
    this.furniture.group.userData.homeId = -1;
    this.homes.push(this.furniture.group);
    for (const h of this.simulation.households) {
      const lot = layout.lots[h.lot];
      h.pets
        .filter((p) => p.species === 'dog')
        .forEach((_pet, dogIndex) => {
          const kennel = clone('doghouse');
          kennel.scale.set(0.7, 0.9, 1);
          const spot = garden(
            lot,
            2.75,
            -1.4 + (_pet.name.length % 2) + dogIndex * 2.1,
          );
          kennel.position.set(spot.x, 0.15, spot.z);
          kennel.rotation.y = lot.facing;
          this.group.add(kennel);
        });
      const owner = this.cloneCharacter(h.pets[0].ownerModel);
      owner.userData.ownerName = h.owner;
      owner.userData.townLabel = `${h.owner} · ${h.pets.map((p) => p.name).join(' & ')}’s owner`;
      owner.scale.setScalar(0.602);
      const ownerAnimation = new Character(owner, h.id * 0.31);
      const book = this.furniture.book();
      book.position.set(0, 0.97, 0.38);
      book.rotation.x = -0.35;
      book.visible = false;
      owner.add(book);
      this.group.add(owner);
      const pets = h.pets.map((visit, i) => {
        const model = this.cloneCharacter(petAsset(visit));
        model.userData.petName = visit.name;
        model.userData.townLabel = `${visit.name} · ${h.owner}’s ${visit.species}`;
        model.scale.setScalar(0.4);
        const animation = new Character(model, i * 0.31);
        const bubble = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.sleepTexture,
            depthTest: false,
          }),
        );
        bubble.scale.set(0.85, 0.55, 1);
        bubble.visible = false;
        let perch: THREE.Group | undefined;
        if (visit.species === 'bird') {
          perch = new THREE.Group();
          const wood = new THREE.MeshStandardMaterial({
            color: '#bb9166',
            roughness: 0.85,
          });
          const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.035, 0.26, 8),
            wood,
          );
          pole.position.y = 0.13;
          const bar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.023, 0.023, 0.3, 8),
            wood,
          );
          bar.rotation.z = Math.PI / 2;
          bar.position.y = 0.27;
          const base = new THREE.Mesh(
            new THREE.CylinderGeometry(0.14, 0.16, 0.035, 12),
            wood,
          );
          perch.add(pole, bar, base);
          this.group.add(perch);
        }
        this.group.add(model, bubble);
        return { model, animation, visit, bubble, placed: false, perch };
      });
      const bubble = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.bubbleTexture, depthTest: false }),
      );
      bubble.scale.set(1.5, 0.95, 1);
      bubble.visible = false;
      this.group.add(bubble);
      const trail = new OwnerTrail(
        h.inClinic && h.routine === 'clinic-wait'
          ? { x: h.position.x - 0.28, z: h.position.z + 0.12 }
          : h.position,
      );
      this.residents.push({ owner, ownerAnimation, book, pets, bubble, trail });
    }
    if (this.softwareGraphics) {
      this.contactShadows = new THREE.InstancedMesh(
        new THREE.CircleGeometry(1, 12),
        new THREE.MeshBasicMaterial({
          color: 0x344535,
          transparent: true,
          opacity: 0.17,
          depthWrite: false,
        }),
        this.residents.reduce((n, r) => n + 1 + r.pets.length, 0),
      );
      this.contactShadows.frustumCulled = false;
      this.contactShadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(this.contactShadows);
    }
    for (const [i, car] of this.simulation.cars.entries()) {
      const model = clone(trafficModels[i % trafficModels.length]);
      model.userData.trafficSlot = i;
      const vehicle = new TrafficVehicle(model);
      vehicle.update(car, 0);
      this.group.add(model);
      this.cars.push(vehicle);
    }
  }
  pick(raycaster: THREE.Raycaster): TownPick {
    if (!this.namedActors.length)
      this.group.traverse((o) => {
        if (o.userData.townLabel) this.namedActors.push(o);
      });
    const hit = raycaster
      .intersectObjects([...this.homes, ...this.namedActors], true)
      .find((hit) => {
        for (let o: THREE.Object3D | null = hit.object; o; o = o.parent)
          if (!o.visible) return false;
        return true;
      });
    let object: THREE.Object3D | null = hit?.object ?? null;
    while (
      object &&
      object.userData.homeId === undefined &&
      !object.userData.townLabel
    )
      object = object.parent;
    return object?.userData.townLabel
      ? { label: object.userData.townLabel }
      : object?.userData.homeId;
  }
  recordOwnerPaths() {
    this.residents.forEach((r, i) =>
      r.trail.update(this.simulation.households[i].position),
    );
  }
  update(dt: number, visible: boolean) {
    this.recordOwnerPaths();
    if (!visible) return;
    this.surfaces.weather(this.simulation.weather.wetness);
    this.furniture.update(this.simulation.leisure);
    const t = this.simulation.time;
    this.parkScenery?.update(t, this.simulation.park);
    const incident = this.simulation.incident;
    this.incidentMarker.visible = incident?.phase === 'scene';
    if (incident)
      this.incidentMarker.position.set(
        incident.origin.x,
        0.17,
        incident.origin.z,
      );
    this.simulation.households.forEach((h, i) => {
      const r = this.residents[i];
      if (!r) return;
      r.owner.visible =
        h.routine !== 'garden' || this.simulation.emergencies.locked(h.id);
      const activity = this.simulation.leisure.owners.get(h.id);
      const station =
        activity && clinicPlan.stations.find((s) => s.id === activity.station);
      const parkVisit = this.simulation.park.visits.get(h.id);
      const parkSeated = Boolean(parkVisit?.seated);
      const seated =
        parkSeated ||
        (activity &&
          station?.kind !== 'standing' &&
          (['sit', 'read', 'game'].includes(activity.phase) ||
            (activity.phase === 'wait' &&
              station &&
              distance(h.position, localToTown(station.x, station.z)) < 0.1)));
      const ownerDistance = distance(r.owner.position, h.position);
      r.owner.position.set(
        h.position.x,
        THREE.MathUtils.lerp(
          r.owner.position.y,
          parkSeated ? 0.33 : seated ? 0.348 : 0.2,
          Math.min(1, dt * 10),
        ),
        h.position.z,
      );
      r.book.visible = activity?.phase === 'read';
      r.owner.rotation.y = turnToward(r.owner.rotation.y, h.facing, dt);
      if (!activity)
        r.ownerAnimation.setMotion(
          parkSeated
            ? this.simulation.park.chatting(h.id, t)
              ? 'Play'
              : 'Sit'
            : ownerDistance > 0.001
              ? 'Walk'
              : 'Idle',
        );
      if (activity)
        r.ownerAnimation.setMotion(
          (ownerDistance > 0.001 &&
            ['walk', 'desk'].includes(activity.phase)) ||
            (activity.phase === 'escort' &&
              this.simulation.escort.phase === 'lead' &&
              this.simulation.escort.ownerRoute.length > 0)
            ? 'Walk'
            : activity.phase === 'read'
              ? 'Read'
              : activity.phase === 'game'
                ? 'Play'
                : seated
                  ? 'Sit'
                  : 'Idle',
        );
      r.ownerAnimation.setWalkSpeed(ownerDistance / Math.max(dt, 0.001), 0.62);
      r.ownerAnimation.update(dt);
      const dogBreak = this.simulation.dogWalks.active.get(h.id);
      if (dogBreak?.phase === 'collect' && !dogBreak.ownerRoute.length)
        r.owner.traverse((o) => {
          if (o.name.startsWith('torso_joint')) {
            // Bend at the hips, preserving their position above the planted legs.
            const hip = new THREE.Vector3(0, 0.76, 0);
            const before = hip.clone().applyQuaternion(o.quaternion);
            o.rotation.x += 0.85 * Math.min(1, dogBreak.elapsed * 4);
            o.position.add(before.sub(hip.applyQuaternion(o.quaternion)));
          }
        });
      r.bubble.visible =
        (['chat', 'incident'].includes(h.routine) ||
          this.simulation.park.chatting(h.id, t)) &&
        !h.inClinic;
      r.bubble.position.set(h.position.x, 3.2, h.position.z);
      r.pets.forEach((p, index) => {
        const wasPlaced = p.placed;
        const previous = { x: p.model.position.x, z: p.model.position.z };
        const previousFacing = p.model.rotation.y;
        const previousHeight = p.model.position.y;
        p.model.scale.setScalar(0.4);
        const ticket =
          h.ticket === undefined
            ? undefined
            : this.simulation.tickets.get(h.ticket);
        const attending = ticket?.pet === p.visit.name;
        p.model.visible = !(ticket?.status === 'examining' && attending);
        const roaming = p.visit.species === 'dog' || p.visit.species === 'cat';
        const following = h.companions.includes(p.visit.name);
        const wantsSleep =
          !following &&
          p.visit.species === 'dog' &&
          Math.sin(t * 0.08 + i + index) > 0.35;
        let sleeping = false;
        const incident = this.simulation.incident;
        const carrying =
          attending && (ticket?.reason === 'accident' || !roaming);
        if (
          attending &&
          incident &&
          incident.ticket === h.ticket &&
          incident.phase === 'scene'
        ) {
          p.model.position.set(incident.origin.x, 0.43, incident.origin.z);
          p.model.rotation.set(0, h.facing, Math.PI / 2);
        } else if (following && roaming && !carrying) {
          const spot = r.trail.sample(0.65 + index * 0.2);
          p.model.position.set(spot.x, 0.2, spot.z);
          if (distance(previous, spot) > 0.001)
            p.model.rotation.set(
              0,
              Math.atan2(spot.x - previous.x, spot.z - previous.z),
              0,
            );
        } else if (following) {
          p.model.position.set(
            h.position.x + (carrying || !roaming ? 0.18 : 0.65 + index * 0.35),
            carrying || !roaming ? 0.95 : 0.2,
            h.position.z + 0.25,
          );
          p.model.rotation.set(0, h.facing, 0);
        } else if (wantsSleep) {
          const dogIndex = h.pets
            .filter((p) => p.species === 'dog')
            .findIndex((pet) => pet.name === p.visit.name);
          const spot = garden(
            layout.lots[h.lot],
            2.75,
            -0.55 + (p.visit.name.length % 2) + dogIndex * 2.1,
          );
          const gap = distance(previous, spot),
            step = p.placed
              ? Math.min(1, (dt * 0.65) / Math.max(gap, 0.001))
              : 1;
          p.model.position.set(
            previous.x + (spot.x - previous.x) * step,
            0.2,
            previous.z + (spot.z - previous.z) * step,
          );
          sleeping = distance(p.model.position, spot) < 0.05;
          p.model.rotation.set(
            0,
            sleeping
              ? layout.lots[h.lot].facing
              : Math.atan2(spot.x - previous.x, spot.z - previous.z),
            0,
          );
        } else {
          const phase = t * 0.3 + index * 2 + i;
          const spot = garden(
            layout.lots[h.lot],
            roaming ? Math.sin(phase) * 1.7 : -0.9,
            2.35 + (roaming ? Math.cos(phase) * 0.45 : 0.2),
          );
          const gap = distance(previous, spot),
            step =
              p.placed && roaming
                ? Math.min(1, (dt * 0.65) / Math.max(gap, 0.001))
                : 1;
          p.model.position.set(
            previous.x + (spot.x - previous.x) * step,
            0.2,
            previous.z + (spot.z - previous.z) * step,
          );
          p.model.rotation.set(
            0,
            Math.atan2(spot.x - previous.x, spot.z - previous.z),
            0,
          );
        }
        const play = attending
          ? this.simulation.leisure.pets.get(h.ticket!)
          : undefined;
        if (following && !attending && h.inClinic && seated && roaming) {
          const route = (p.model.userData.clinicRestRoute ??= interiorRoute(
            previous,
            clinicPetRest(h, 1 + index),
          ));
          const point = { ...previous };
          const facing = walkRoute(point, route, dt, 1.4);
          p.model.position.set(point.x, 0.2, point.z);
          if (facing !== undefined) p.model.rotation.y = facing;
        } else delete p.model.userData.clinicRestRoute;
        if (!play)
          p.animation.setMotion(
            sleeping
              ? 'Sit'
              : roaming &&
                  !carrying &&
                  distance(previous, {
                    x: p.model.position.x,
                    z: p.model.position.z,
                  }) > 0.001
                ? 'Walk'
                : 'Idle',
          );
        if (play) {
          const station = clinicPlan.stations.find(
            (s) => s.id === play.station,
          );
          const using = play.phase === 'use';
          p.model.position.set(
            activity?.phase === 'escort'
              ? h.position.x + 0.42
              : play.position.x,
            using && station && isCabinRide(station.kind)
              ? 0.15 +
                  (ridePose(station.kind, play.elapsed).y + 0.06) *
                    layout.clinic.scale
              : using && station?.kind === 'carousel'
                ? 0.38
                : 0.2,
            activity?.phase === 'escort'
              ? h.position.z + 0.12
              : play.position.z,
          );
          p.model.rotation.set(0, play.facing, 0);
          if (using && station?.kind === 'scratch') {
            p.model.rotateX(-0.45);
            p.model.position.y = 0.3;
          }
          if (using && station?.kind === 'wheel') {
            p.model.scale.setScalar(0.3);
            p.model.position.y = 0.23;
            p.model.rotation.y = layout.clinic.rotation;
          } else
            p.model.scale.setScalar(
              using && isCabinRide(station?.kind ?? '') ? 0.3 : 0.4,
            );
          if (using && station && isEnrichment(station.kind)) {
            const pose = enrichmentPose(
              station.kind,
              play.elapsed,
              p.visit.species,
            );
            p.model.position.y = 0.2 + pose.y * layout.clinic.scale;
            if (station.kind === 'water-dispenser')
              p.model.rotation.x = 0.1 + Math.sin(play.elapsed * 2) * 0.06;
            p.animation.setMotion(pose.motion);
          } else
            p.animation.setMotion(
              ['walk', 'board', 'return'].includes(play.phase) ||
                activity?.phase === 'desk' ||
                (activity?.phase === 'escort' &&
                  this.simulation.escort.phase === 'lead' &&
                  this.simulation.escort.ownerRoute.length > 0)
                ? 'Walk'
                : using
                  ? station?.kind === 'wheel'
                    ? 'Walk'
                    : station?.kind === 'carousel' ||
                        isCabinRide(station?.kind ?? '')
                      ? 'Idle'
                      : 'Play'
                  : 'Idle',
            );
        }
        sleeping ||= play?.station === 'cat-nook' && play.phase === 'use';
        p.model.userData.sleeping = sleeping;
        p.placed = true;
        p.model.rotation.y = turnToward(previousFacing, p.model.rotation.y, dt);
        let petDistance = distance(previous, p.model.position);
        if (p.visit.species === 'bird') {
          const healthy =
            !ticket ||
            (!this.simulation.visit(h.ticket!).clinical?.fever &&
              !['accident', 'rescue', 'paw-adventure', 'post-fire'].includes(
                ticket.reason,
              ));
          let flying = false;
          if (play) {
            const station = clinicPlan.stations.find(
              (s) => s.id === play.station,
            );
            if (play.phase === 'use' && station && isEnrichment(station.kind)) {
              const pose = enrichmentPose(station.kind, play.elapsed, 'bird');
              flying = pose.motion === 'Fly';
              p.model.position.y = 0.2 + pose.y * layout.clinic.scale;
              p.animation.setMotion(pose.motion);
            } else {
              flying =
                healthy &&
                (['walk', 'board', 'return'].includes(play.phase) ||
                  (play.phase !== 'use' && petDistance > 0.001));
              p.model.position.y = THREE.MathUtils.lerp(
                previousHeight,
                flying ? 1.15 : 0.45,
                Math.min(1, dt * 5),
              );
              // Keep beating wings during the descent, until the perch supports it.
              flying ||= healthy && p.model.position.y > 0.47;
              p.animation.setMotion(flying ? 'Fly' : 'Idle');
            }
          } else if (following) {
            const spot = r.trail.sample(0.4 + index * 0.2);
            flying = healthy;
            p.model.position.set(
              healthy ? spot.x : h.position.x + 0.18,
              THREE.MathUtils.lerp(
                previousHeight,
                healthy ? 1.15 + Math.sin(t * 4) * 0.04 : 0.99,
                Math.min(1, dt * 5),
              ),
              healthy ? spot.z : h.position.z,
            );
            if (distance(previous, spot) > 0.001)
              p.model.rotation.y = turnToward(
                previousFacing,
                Math.atan2(spot.x - previous.x, spot.z - previous.z),
                dt,
              );
            p.animation.setMotion(flying ? 'Fly' : 'Idle');
          } else {
            const phase = (t + i * 2) % 18;
            flying = phase < 10;
            if (flying) {
              const a = (phase / 10) * Math.PI * 2;
              p.model.position.x += Math.sin(a) * 0.6;
              p.model.position.z += (Math.cos(a) - 1) * 0.6;
              p.model.position.y =
                0.45 + Math.sin((phase / 10) * Math.PI) * 0.9;
              p.model.rotation.y = Math.PI / 2 - a;
            } else p.model.position.y = 0.45;
            p.animation.setMotion(flying ? 'Fly' : 'Idle');
          }
          p.model.userData.flying = flying;
          if (p.perch) {
            p.perch.visible =
              p.model.visible &&
              !flying &&
              (!following || Boolean(play?.phase === 'rest'));
            p.perch.position.set(p.model.position.x, 0.2, p.model.position.z);
          }
        }
        const parkPet = parkVisit?.pets.find(
          (pet) => pet.name === p.visit.name,
        );
        if (parkPet) {
          const pose = parkPetPose(parkPet);
          p.model.position.set(pose.x, pose.y, pose.z);
          p.model.rotation.set(
            pose.tilt,
            turnToward(previousFacing, pose.facing, dt),
            0,
          );
          if (
            p.visit.species === 'bird' &&
            ['walk', 'return'].includes(parkPet.phase)
          ) {
            p.model.position.y = THREE.MathUtils.lerp(
              previousHeight,
              1.05,
              Math.min(1, dt * 5),
            );
            p.animation.setMotion('Fly');
            p.model.userData.flying = true;
          } else {
            if (p.visit.species === 'bird')
              p.model.position.y = THREE.MathUtils.lerp(
                previousHeight,
                pose.y,
                Math.min(1, dt * 5),
              );
            p.animation.setMotion(pose.motion);
            if (p.visit.species === 'bird') {
              const landing = p.model.position.y > pose.y + 0.02;
              p.model.userData.flying = landing;
              if (landing) p.animation.setMotion('Fly');
            }
          }
          p.bubble.visible = false;
          if (p.perch) p.perch.visible = false;
          p.model.userData.parkActivity = parkPet.station ?? parkPet.phase;
        } else delete p.model.userData.parkActivity;
        const emergency = this.simulation.emergencies.active;
        const rescue = emergency
          ? rescuePetPose(emergency, p.visit.name, this.simulation.households)
          : null;
        if (rescue) {
          p.model.position.set(rescue.x, rescue.y, rescue.z);
          p.model.rotation.set(
            0,
            turnToward(previousFacing, rescue.facing, dt),
            0,
          );
          p.model.visible = rescue.visible;
          p.animation.setMotion(rescue.motion);
          p.model.userData.flying = rescue.motion === 'Fly';
          if (p.perch) p.perch.visible = false;
        }
        if (
          !h.inClinic &&
          h.routine === 'clinic-wait' &&
          following &&
          roaming &&
          !carrying
        ) {
          const spot = this.simulation.entrance.petSpot(h, index);
          const gap = wasPlaced ? distance(previous, spot) : 0,
            amount = wasPlaced
              ? Math.min(1, (dt * 1.5) / Math.max(gap, 0.001))
              : 1;
          p.model.position.set(
            previous.x + (spot.x - previous.x) * amount,
            0.2,
            previous.z + (spot.z - previous.z) * amount,
          );
          p.model.rotation.y = turnToward(
            previousFacing,
            gap > 0.04
              ? Math.atan2(spot.x - previous.x, spot.z - previous.z)
              : -Math.PI / 2,
            dt,
          );
          petDistance = distance(previous, p.model.position);
          p.animation.setMotion(gap > 0.04 ? 'Walk' : 'Idle');
        }
        const shelter = this.simulation.weather.active.get(h.id);
        if (shelter?.pet === p.visit.name) {
          p.model.position.set(
            shelter.petPosition.x,
            0.2,
            shelter.petPosition.z,
          );
          p.model.rotation.set(
            0,
            turnToward(previousFacing, shelter.facing, dt),
            0,
          );
          p.animation.setMotion(shelter.petRoute.length ? 'Walk' : 'Idle');
          p.model.userData.rainShelter = shelter.phase;
          petDistance = distance(previous, p.model.position);
        } else delete p.model.userData.rainShelter;
        if (dogBreak?.pet === p.visit.name) {
          p.model.position.set(
            dogBreak.petPosition.x,
            0.2,
            dogBreak.petPosition.z,
          );
          p.model.rotation.set(
            0,
            turnToward(previousFacing, dogBreak.facing, dt),
            0,
          );
          p.model.visible = true;
          p.model.userData.dogWalk = dogBreak.phase;
          p.animation.setMotion(
            dogBreak.petRoute.length
              ? 'Walk'
              : dogBreak.kind === 'poo' && dogBreak.phase === 'toilet'
                ? 'Sit'
                : 'Idle',
          );
        } else delete p.model.userData.dogWalk;
        p.animation.setWalkSpeed(
          parkPet?.phase === 'use' ? 0.8 : petDistance / Math.max(dt, 0.001),
          0.4,
        );
        p.animation.update(dt);
        if (dogBreak?.pet === p.visit.name)
          p.model.traverse((o) => {
            if (dogBreak.phase === 'sniff' && o.name.startsWith('head_joint'))
              o.rotation.x += 0.35;
            if (
              dogBreak.kind === 'wee' &&
              dogBreak.phase === 'toilet' &&
              o.name.startsWith('leg_joint') &&
              o.position.x > 0 &&
              o.position.z < 0
            )
              o.rotation.z += 0.9;
          });
        p.bubble.visible =
          !rescue &&
          !parkPet &&
          sleeping &&
          p.model.visible &&
          (!h.inClinic || play?.station === 'cat-nook');
        p.bubble.position
          .copy(p.model.position)
          .add(new THREE.Vector3(0, 1.2, 0));
      });
    });
    this.streetScenery?.update(
      this.simulation.dogWalks,
      this.simulation.households,
    );
    this.emergencyScenery?.update(
      this.simulation.emergencies,
      this.simulation.households,
      t,
      dt,
    );
    if (this.contactShadows) {
      let index = 0;
      for (const r of this.residents)
        for (const actor of [r.owner, ...r.pets.map((p) => p.model)]) {
          this.shadowPose.position.set(
            actor.position.x,
            0.19,
            actor.position.z,
          );
          this.shadowPose.rotation.set(-Math.PI / 2, 0, 0);
          this.shadowPose.scale.set(
            actor.visible ? 0.3 : 0,
            actor.visible ? 0.22 : 0,
            1,
          );
          this.shadowPose.updateMatrix();
          this.contactShadows.setMatrixAt(index++, this.shadowPose.matrix);
        }
      this.contactShadows.instanceMatrix.needsUpdate = true;
    }
    this.simulation.cars.forEach((car, i) => this.cars[i]?.update(car, dt));
  }
}
