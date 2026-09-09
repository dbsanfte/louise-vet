import { WeatherScenery } from './weather-scenery';
import { instrumentHit } from './fishbowl';
import { petAsset, petLooks } from './pet-appearance';
import { zonesFor } from './game';
import { turnToward } from './movement';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  type Species,
  type Zone,
  type UpgradeId,
  type Visit,
  type Tool,
} from './game';
import { Character } from './character';
import { Examination } from './examination';
import { Town, type TownPick } from './town';
import { TownSimulation } from './town-simulation';
import { townToLocal } from './clinic-leisure';
import { layout, localToTown, examRoom } from './town-map';

const assetNames = [
  'clinic',
  'clinic/examination-room',
  'louise',
  'visitor',
  'visitor-ponytail',
  'visitor-bob',
  'table',
  'dog',
  'cat',
  'rabbit',
  'hamster',
  'gerbil',
  'goldfish',
  ...petLooks.map((look) => `pets/${look.id}`),
];
type Asset = (typeof assetNames)[number];
const fallbackZones: Record<Zone, THREE.Vector3> = {
  ear: new THREE.Vector3(0.36, 1.16, 0.48),
  chest: new THREE.Vector3(0, 0.66, 0.65),
  paw: new THREE.Vector3(0.28, 0.29, 0.28),
  coat: new THREE.Vector3(0.38, 0.8, -0.28),
  mouth: new THREE.Vector3(0, 0.87, 0.99),
  tank: new THREE.Vector3(-0.57, 0.6, 0.2),
  fin: new THREE.Vector3(0.35, 0.71, 0),
};

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  private ortho = new THREE.OrthographicCamera(-7, 7, 5, -5, 0.1, 80);
  private perspective = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
  private controls: OrbitControls;
  private townCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  private townControls: OrbitControls;
  town?: Town;
  private townLoading?: Promise<void>;
  private sunlight!: THREE.DirectionalLight;
  private followedFamily?: number;
  private followingRescue = false;
  private clinicZoom = 1;

  onTownPick: (id: TownPick) => void = () => {};
  private reception = new THREE.Group();
  private treatment = new THREE.Group();
  private decoration = new THREE.Group();
  private assets = new Map<Asset, THREE.Group>();
  private animal?: THREE.Group;
  private patientAnimation?: Character;
  private louiseAnimation?: Character;
  private louise?: THREE.Group;
  private examDoor?: THREE.Object3D;
  private mode: 'reception' | 'treatment' | 'town' = 'reception';
  private species: Species = 'dog';
  private raycaster = new THREE.Raycaster();
  private pointerStart = { x: 0, y: 0 };
  private width = 1;
  private height = 1;
  private observer: ResizeObserver;
  private onPick: (zone: Zone | null, findingVisible: boolean) => void;
  private softwareGraphics = false;
  private softwareIdleUntil = 0;
  private courtyardOwned = false;
  private weatherScenery: WeatherScenery;
  private pendingFrame: WebGLSync | null = null;
  private needsRender = true;
  private lastRender = -Infinity;
  private loaded = false;
  private examination: Examination;
  private examining = false;
  private hoverZone: Zone | null = null;
  private hoverSince = 0;
  private sampled = false;
  orbitMode = false;

  constructor(
    private container: HTMLElement,
    onPick: (zone: Zone | null, findingVisible: boolean) => void,
    onHeart: (bpm: number | null, now: number) => void,
    private simulation: TownSimulation,
  ) {
    this.onPick = onPick;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const rendererInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const softwareGraphics =
      rendererInfo &&
      /swiftshader|llvmpipe|softpipe|software/i.test(
        String(gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL)),
      );
    this.softwareGraphics = Boolean(softwareGraphics);
    this.weatherScenery = new WeatherScenery(this.softwareGraphics);
    this.scene.add(this.weatherScenery.group);
    // Keep the same scene and controls usable when no graphics card is available.
    this.renderer.setPixelRatio(
      softwareGraphics ? 0.5 : Math.min(window.devicePixelRatio, 1.75),
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.type = softwareGraphics
      ? THREE.BasicShadowMap
      : THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;
    this.renderer.domElement.setAttribute(
      'aria-label',
      '3D view of Louise’s veterinary clinic',
    );
    this.renderer.domElement.setAttribute('role', 'img');
    container.prepend(this.renderer.domElement);
    this.scene.background = new THREE.Color('#e9e8d9');
    this.scene.add(new THREE.HemisphereLight(0xfff9e7, 0x788778, 1.0));
    const light = new THREE.DirectionalLight(0xffe6c0, 2.0);
    light.position.set(-3, 10, 5);
    this.sunlight = light;
    light.castShadow = true;
    light.shadow.mapSize.set(
      softwareGraphics ? 512 : 1024,
      softwareGraphics ? 512 : 1024,
    );
    Object.assign(light.shadow.camera, {
      left: -9,
      right: 9,
      top: 9,
      bottom: -9,
      near: 0.5,
      far: 30,
    });
    light.shadow.normalBias = 0.035;
    light.shadow.bias = -0.0001;
    light.shadow.radius = 4;
    this.scene.add(light, light.target);
    this.setSun('reception');
    const fill = new THREE.DirectionalLight(0xe0f8ee, 0.4);
    fill.position.set(6, 4, -4);
    this.scene.add(fill);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    this.scene.environmentIntensity = 0.25;
    this.examination = new Examination(
      container,
      this.scene.environment,
      onHeart,
    );
    room.dispose();
    pmrem.dispose();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0xe5e4d5, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.39;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const officeCamera = localToTown(11, 16);
    this.ortho.position.set(
      officeCamera.x,
      13 * layout.clinic.scale,
      officeCamera.z,
    );
    this.ortho.lookAt(layout.clinic.x, 0.3, layout.clinic.z);
    this.reception.position.set(layout.clinic.x, 0.15, layout.clinic.z);
    this.reception.scale.setScalar(layout.clinic.scale);
    this.reception.rotation.y = layout.clinic.rotation;
    this.perspective.position.set(3.1, 3.4, 4.7);
    this.controls = new OrbitControls(
      this.perspective,
      this.renderer.domElement,
    );
    this.controls.target.set(0, 1.95, 0);
    this.controls.addEventListener('change', () => {
      this.needsRender = true;
    });
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 7;
    this.controls.minPolarAngle = 0.25;
    this.controls.maxPolarAngle = 1.48;
    this.controls.enabled = false;
    this.townControls = new OrbitControls(
      this.townCamera,
      this.renderer.domElement,
    );
    this.townControls.enableDamping = true;
    this.townControls.minDistance = 12;
    this.townControls.maxDistance = 145;
    this.townControls.maxPolarAngle = 1.25;
    this.townControls.minPolarAngle = 0.25;
    this.townControls.enabled = false;
    this.townControls.addEventListener('change', () => {
      this.needsRender = true;
    });
    this.scene.add(this.reception, this.treatment);
    this.treatment.visible = false;
    this.reception.add(this.decoration);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      if (this.mode === 'town') {
        this.followedFamily = undefined;
        this.onTownPick(undefined);
      }
      this.followingRescue = false;
      this.pointerStart = { x: e.clientX, y: e.clientY };
      if (this.examination.selected) {
        this.examining = true;
        this.sampled = false;
        this.hoverSince = performance.now();
        this.renderer.domElement.setPointerCapture(e.pointerId);
        this.moveInstrument(e);
      }
    });
    this.renderer.domElement.addEventListener('pointermove', (e) => {
      if (this.mode === 'town') {
        if (e.pointerType === 'mouse' && !e.buttons) this.pickTown(e);
      } else this.moveInstrument(e);
    });
    this.renderer.domElement.addEventListener('pointerleave', (e) => {
      if (this.mode === 'town' && e.pointerType === 'mouse')
        this.onTownPick(undefined);
    });
    this.renderer.domElement.addEventListener('pointercancel', () => {
      this.examining = false;
    });
    this.renderer.domElement.addEventListener('pointerup', (e) => {
      if (this.mode === 'town') {
        if (
          Math.hypot(
            e.clientX - this.pointerStart.x,
            e.clientY - this.pointerStart.y,
          ) < 8
        )
          this.pickTown(e);
        return;
      }
      if (this.examination.selected) {
        this.moveInstrument(e);
        if (!this.sampled && this.hoverZone) this.pick(this.hoverZone);
        this.examining = false;
        return;
      }
      if (
        this.mode !== 'treatment' ||
        !this.animal ||
        Math.hypot(
          e.clientX - this.pointerStart.x,
          e.clientY - this.pointerStart.y,
        ) > 6
      )
        return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.raycaster.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        this.perspective,
      );
      const hit = this.raycaster.intersectObject(this.animal, true)[0];
      if (!hit) return;
      let nearest: Zone | null = null;
      let distance = 0.85;
      for (const zone of this.availableZones()) {
        const d = this.zonePosition(zone).distanceTo(hit.point);
        if (d < distance) {
          distance = d;
          nearest = zone;
        }
      }
      this.pick(nearest);
    });
    this.resize();
  }

  async load() {
    const loader = new GLTFLoader();
    await Promise.all(
      assetNames.map(async (name) => {
        const gltf = await loader.loadAsync(`/models/${name}.glb`);
        gltf.scene.animations = gltf.animations;
        gltf.scene.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        this.assets.set(name, gltf.scene);
      }),
    );
    await this.examination.load();
    this.reception.add(this.clone('clinic'));
    const louise = this.clone('louise');
    this.louise = louise;
    louise.userData.townLabel = 'Louise · Vet';
    louise.position.set(-1.3, 0, -2.75);
    this.reception.add(louise);
    this.louiseAnimation = new Character(louise);
    const room = this.clone('clinic/examination-room');
    room.position.set(examRoom.x, 0, examRoom.z);
    this.reception.add(room);
    this.examDoor = room.getObjectByName('ExamDoorHinge');
    const officeTable = this.clone('table');
    officeTable.position.set(examRoom.x, 0, examRoom.z);
    this.reception.add(officeTable);
    const closeRoom = this.clone('clinic/examination-room');
    // The foreground door is cut away in the orbiting examination camera.
    closeRoom.getObjectByName('ExamDoorHinge')!.visible = false;
    this.treatment.add(closeRoom, this.clone('table'));
    this.focusClinic('reception');
    const town = new Town(
      (name) => this.clone(name as Asset),
      this.simulation,
      this.softwareGraphics,
    );
    await town.load();
    this.town = town;
    town.registerClinic(this.reception);
    this.scene.add(town.group);
    town.setOfficeView(true);
    this.container.dataset.ready = 'true';
    this.loaded = true;
    this.needsRender = true;
  }

  private setSun(view: 'town' | 'reception' | 'treatment') {
    const x = view === 'reception' ? layout.clinic.x : 0;
    const z = view === 'reception' ? layout.clinic.z : 0;
    const span = view === 'town' ? 55 : 10;
    this.sunlight.position.set(x - 10, view === 'town' ? 65 : 15, z + 12);
    this.sunlight.target.position.set(x, 0, z);
    Object.assign(this.sunlight.shadow.camera, {
      left: -span,
      right: span,
      top: span,
      bottom: -span,
      far: view === 'town' ? 150 : 55,
    });
    this.sunlight.shadow.camera.updateProjectionMatrix();
  }

  private clone(name: Asset) {
    const asset = this.assets.get(name);
    if (!asset) throw new Error(`Missing model: ${name}`);
    return asset.clone(true);
  }

  setQueue(_queue: number[]) {
    // Household positions, including the entrance and exit, belong to the shared simulation.
    this.needsRender = true;
  }

  setUpgrades(ids: UpgradeId[]) {
    this.courtyardOwned = ids.includes('sun-courtyard');
    this.needsRender = true;
    this.town?.setUpgrades(ids);
    this.decoration.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        materials.forEach((m) => m.dispose());
      }
    });
    this.decoration.clear();
    const box = (size: number[], pos: number[], color: number) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(...(size as [number, number, number])),
        new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
      );
      m.position.set(...(pos as [number, number, number]));
      m.castShadow = true;
      m.receiveShadow = true;
      this.decoration.add(m);
      return m;
    };
    if (ids.includes('plants')) {
      for (const x of [1.8, 4.35]) {
        box([0.35, 0.4, 0.35], [x, 0.2, 2.7], 0xc8876c);
        const leaf = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.45, 1),
          new THREE.MeshStandardMaterial({ color: 0x6f9555 }),
        );
        leaf.position.set(x, 0.85, 2.7);
        leaf.scale.y = 1.4;
        leaf.castShadow = true;
        this.decoration.add(leaf);
      }
    }
    if (ids.includes('poster')) {
      box([0.8, 1.15, 0.1], [-4.6, 2.1, -3.7], 0xf6d479);
      box([0.5, 0.12, 0.12], [-4.6, 2.25, -3.62], 0x679683);
      box([0.32, 0.12, 0.12], [-4.6, 1.94, -3.62], 0x679683);
    }
  }
  focusClinic(view: string) {
    const centre =
      view === 'lounge' || view === 'annex'
        ? -8
        : view === 'play' || view === 'courtyard'
          ? -14
          : view === 'exam'
            ? examRoom.x
            : view === 'all'
              ? this.simulation.leisure.stations('pet').length
                ? -6
                : -1
              : 0;
    const depth =
      view === 'courtyard'
        ? -16
        : view === 'annex'
          ? -8
          : view === 'exam'
            ? examRoom.z
            : view === 'play'
              ? -5
              : view === 'all' || view === 'escort' || view === 'reception'
                ? view === 'all' && this.courtyardOwned
                  ? -7
                  : -2
                : 0;
    this.clinicZoom =
      view === 'all'
        ? this.courtyardOwned
          ? 2.75
          : 2.15
        : view === 'play'
          ? 1.4
          : view === 'escort' || view === 'reception'
            ? 1.25
            : 1;
    const camera = localToTown(centre + 11, depth + 16),
      target = localToTown(centre, depth);
    this.ortho.position.set(camera.x, 13 * layout.clinic.scale, camera.z);
    this.ortho.lookAt(target.x, 0.3, target.z);
    this.resize();
  }

  async showTown() {
    if (!this.town && !this.townLoading) {
      const town = new Town(
        (name) => this.clone(name as Asset),
        this.simulation,
        this.softwareGraphics,
      );
      this.townLoading = town
        .load()
        .then(() => {
          this.town = town;
          this.scene.add(town.group);
        })
        .catch((error) => {
          this.townLoading = undefined;
          throw error;
        });
    }
    await this.townLoading;
    this.examination.select(null, false);
    this.mode = 'town';
    this.setSun('town');
    this.reception.visible = true;
    this.treatment.visible = false;
    this.town!.group.visible = true;
    this.town!.setOfficeView(false);
    this.controls.enabled = false;
    this.townControls.enabled = true;
    this.scene.background = new THREE.Color('#d3e8da');
    this.resetTownCamera();
    this.resize();
  }
  private pickTown(e: PointerEvent) {
    if (!this.town) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((e.clientY - rect.top) / rect.height) * 2,
      ),
      this.townCamera,
    );
    this.onTownPick(this.town.pick(this.raycaster));
  }
  focusHome(id: number) {
    this.followedFamily = undefined;
    this.followingRescue = false;
    const h = this.town?.simulation.households[id];
    const x = h?.home.x ?? -24,
      z = h?.home.z ?? -6;
    this.townControls.target.set(x, 0, z);
    // Approach each home's front garden from the street, not behind its roof.
    const facing = h ? layout.lots[h.lot].facing : 0;
    this.townCamera.position.set(
      x + Math.sin(facing) * 14 + Math.cos(facing) * 9,
      14,
      z + Math.cos(facing) * 14 - Math.sin(facing) * 9,
    );
    this.townControls.update();
    this.onTownPick(id);
  }
  focusFamily(id: number) {
    this.followingRescue = false;
    this.followedFamily = id;
    const h = this.simulation.households[id];
    this.townControls.target.set(h.position.x, 0, h.position.z);
    this.townCamera.position.set(h.position.x + 7, 11, h.position.z + 12);
    this.townControls.update();
  }
  focusEmergency(p: { x: number; z: number; facing?: number }, follow = false) {
    this.followedFamily = undefined;
    this.followingRescue = follow;
    this.townControls.target.set(p.x, 1, p.z);
    const facing = p.facing ?? 0;
    this.townCamera.position.set(
      p.x + Math.sin(facing) * 14 + Math.cos(facing) * 10,
      12,
      p.z + Math.cos(facing) * 14 - Math.sin(facing) * 10,
    );
    this.townControls.update();
  }
  focusPark() {
    this.followedFamily = undefined;
    this.followingRescue = false;
    this.townControls.target.set(21, 0, -10);
    this.townCamera.position.set(26, 13, 4);
    this.townControls.update();
    this.onTownPick(undefined);
  }
  resetTownCamera() {
    this.followedFamily = undefined;
    this.followingRescue = false;
    this.townCamera.position.set(43, 67, 76);
    this.townControls.target.set(0, 0, 0);
    this.townControls.update();
  }
  panTownCamera(x: number, y: number) {
    const away = this.townCamera.position.clone().sub(this.townControls.target);
    away.y = 0;
    away.normalize();
    const right = new THREE.Vector3(away.z, 0, -away.x);
    const offset = right.multiplyScalar(x).addScaledVector(away, y);
    this.moveTownCamera(offset.x, offset.z);
    this.onTownPick(undefined);
  }
  moveTownCamera(x: number, z: number) {
    this.followedFamily = undefined;
    this.followingRescue = false;
    const offset = new THREE.Vector3(x, 0, z);
    this.townCamera.position.add(offset);
    this.townControls.target.add(offset);
    this.townControls.update();
  }
  zoomTown(amount: number) {
    this.townCamera.position
      .sub(this.townControls.target)
      .multiplyScalar(amount)
      .add(this.townControls.target);
    this.townControls.update();
  }
  showReception() {
    this.examination.select(null, false);
    this.examining = false;
    this.hoverZone = null;
    if (this.town) {
      this.town.group.visible = true;
      this.town.setOfficeView(true);
    }
    this.townControls.enabled = false;
    this.mode = 'reception';
    this.setSun('reception');
    this.reception.visible = true;
    this.treatment.visible = false;
    this.controls.enabled = false;
    this.scene.background = new THREE.Color('#e9e8d9');
    this.resize();
  }
  showTreatment(visit: Visit) {
    const species = visit.species;
    this.patientAnimation?.dispose();
    if (this.animal) this.treatment.remove(this.animal);
    this.species = species;
    this.animal = this.clone(petAsset(visit));
    this.animal.position.y = 1.28;
    this.treatment.add(this.animal);
    this.patientAnimation = new Character(this.animal);
    this.examination.setPatient(visit, this.animal);
    this.orbitMode = false;
    if (this.town) this.town.group.visible = false;
    this.townControls.enabled = false;
    this.mode = 'treatment';
    this.setSun('treatment');
    this.reception.visible = false;
    this.treatment.visible = true;
    this.controls.enabled = true;
    this.scene.background = new THREE.Color('#e1e8dc');
    this.resetCamera();
    this.resize();
  }
  resetCamera() {
    this.perspective.position.set(3.1, 3.4, 4.7);
    this.controls.target.set(0, 1.95, 0);
    this.controls.update();
  }
  rotate(amount: number) {
    const offset = this.perspective.position.clone().sub(this.controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), amount);
    this.perspective.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }
  setInstrument(tool: Tool | null, active: boolean) {
    if (tool === 'xray' && active && this.examination.selected !== 'xray')
      this.patientAnimation?.holdStill();
    this.examination.select(tool, active && !this.orbitMode);
    this.controls.enabled =
      this.mode === 'treatment' && (!active || !tool || this.orbitMode);
    this.needsRender = true;
  }
  toggleOrbit() {
    this.orbitMode = !this.orbitMode;
  }
  changeInstrumentZoom(delta: number) {
    this.examination.changeZoom(delta);
    this.needsRender = true;
  }
  toggleFullXray() {
    this.examination.toggleWhole();
    this.needsRender = true;
  }
  placeInstrument(zone: Zone) {
    const p = this.projectZone(zone);
    this.examination.setContact(p.x / this.width, p.y / this.height, zone);
    this.needsRender = true;
    this.pick(zone);
  }
  private pick(zone: Zone | null) {
    this.onPick(
      zone,
      this.examination.findingVisible(
        this.perspective,
        this.width,
        this.height,
      ),
    );
  }
  private moveInstrument(e: PointerEvent) {
    if (!this.examination.selected || !this.animal) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width,
      y = (e.clientY - rect.top) / rect.height;
    this.raycaster.setFromCamera(
      new THREE.Vector2(x * 2 - 1, 1 - y * 2),
      this.perspective,
    );
    const hit = instrumentHit(
      this.raycaster.intersectObject(this.animal, true),
      this.examination.selected,
    );
    let zone: Zone | null = null;
    if (hit) {
      // Identify the surface itself before falling back to guide proximity.
      // Both ears and all paws must work after orbiting to the other side.
      let part: THREE.Object3D | null = hit.object;
      while (part && part !== this.animal && !zone) {
        const name = part.name;
        if (/^(ear|inner_ear)/.test(name)) zone = 'ear';
        else if (/^paw/.test(name)) zone = 'paw';
        else if (/^(muzzle|nose|beak)/.test(name)) zone = 'mouth';
        else if (/^chest/.test(name)) zone = 'chest';
        else if (/^bowl/.test(name)) zone = 'tank';
        else if (/^fin/.test(name)) zone = 'fin';
        else if (/^(body|tail|wing)/.test(name))
          zone = this.species === 'goldfish' ? 'fin' : 'coat';
        part = part.parent;
      }
      let distance = Infinity;
      for (const candidate of zone ? [] : this.availableZones()) {
        const d = this.zonePosition(candidate).distanceTo(hit.point);
        if (d < distance) {
          distance = d;
          zone = candidate;
        }
      }
    }
    if (zone !== this.hoverZone) {
      this.hoverZone = zone;
      this.hoverSince = performance.now();
      this.sampled = false;
    }
    this.examination.setContact(x, y, zone);
    this.needsRender = true;
  }
  availableZones(): Zone[] {
    return zonesFor(this.species);
  }
  zonePosition(zone: Zone) {
    const fallback = fallbackZones[zone].clone();
    if (!this.animal) return fallback;
    this.animal.updateWorldMatrix(true, true);
    const issue = this.examination.issuePosition(zone);
    if (issue) return issue;
    let spot: THREE.Object3D | undefined;
    this.animal.traverse((o) => {
      if (o.name.startsWith(`spot_${zone}`)) spot = o;
    });
    this.animal.updateWorldMatrix(true, true);
    const position = spot
      ? spot.getWorldPosition(new THREE.Vector3())
      : this.animal.localToWorld(fallback);
    // Keep interaction targets steady while the pet gently breathes.
    position.y =
      this.animal.position.y +
      (position.y - this.animal.position.y) / this.animal.scale.y;
    return position;
  }
  projectZone(zone: Zone) {
    const p = this.zonePosition(zone).project(this.perspective);
    return {
      x: (p.x * 0.5 + 0.5) * this.width,
      y: (-0.5 * p.y + 0.5) * this.height,
      visible: p.z < 1 && p.x > -1 && p.x < 1 && p.y > -1 && p.y < 1,
    };
  }
  private resize() {
    this.needsRender = true;
    this.width = Math.max(1, this.container.clientWidth);
    this.height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(this.width, this.height);
    const aspect = this.width / this.height;
    const h =
      Math.max(5.9, 7.25 / aspect) * layout.clinic.scale * this.clinicZoom;
    this.ortho.left = -h * aspect;
    this.ortho.right = h * aspect;
    this.ortho.top = h;
    this.ortho.bottom = -h;
    this.ortho.updateProjectionMatrix();
    this.townCamera.aspect = aspect;
    this.townCamera.updateProjectionMatrix();
    this.perspective.aspect = aspect;
    this.perspective.updateProjectionMatrix();
  }
  recordOwnerPaths() {
    this.town?.recordOwnerPaths();
  }
  draw(time: number, dt: number) {
    // The opaque loading screen needs no 3D frames. Leave CPU time for parsing
    // and preparing the models instead of competing with their initial load.
    if (!this.loaded) return;
    this.town?.update(dt, this.mode !== 'treatment');
    const wet = this.mode === 'town' ? this.simulation.weather.wetness : 0;
    this.sunlight.intensity = 2 - wet * 1.35;
    this.sunlight.color.set(0xffe6c0).lerp(new THREE.Color(0xd0ddea), wet);
    if (this.mode === 'town')
      (this.scene.background as THREE.Color)
        .set(0xd3e8da)
        .lerp(new THREE.Color(0x8dabb8), wet);
    this.weatherScenery.update(
      this.simulation.weather,
      this.simulation.time,
      this.mode === 'town',
    );
    if (this.mode === 'town') {
      const e = this.simulation.emergencies.active;
      if (this.followingRescue && e) {
        const p = this.simulation.emergencies.focus(
          this.simulation.households,
        )!;
        const target = new THREE.Vector3(p.x, 1, p.z);
        const offset = target
          .sub(this.townControls.target)
          .multiplyScalar(Math.min(1, dt * 3));
        this.townCamera.position.add(offset);
        this.townControls.target.add(offset);
      }
      if (this.followedFamily !== undefined) {
        const h = this.simulation.households[this.followedFamily];
        const offset = new THREE.Vector3(h.position.x, 0, h.position.z).sub(
          this.townControls.target,
        );
        this.townCamera.position.add(offset);
        this.townControls.target.add(offset);
      }
      this.townControls.update();
    }
    const escort = this.simulation.escort;
    if (this.louise) {
      const p = townToLocal(escort.position);
      this.louise.position.set(p.x, 0, p.z);
      this.louise.rotation.y = turnToward(
        this.louise.rotation.y,
        escort.facing - layout.clinic.rotation,
        dt,
      );
      this.louiseAnimation?.setWalking(escort.route.length > 0);
      this.louiseAnimation?.update(dt);
    }
    if (this.examDoor) {
      const crossing = this.simulation.households.some(
        (h) => h.inClinic && townToLocal(h.position).z < -3,
      );
      const open = escort.phase !== 'idle' || crossing;
      this.examDoor.rotation.y = THREE.MathUtils.lerp(
        this.examDoor.rotation.y,
        open ? Math.PI / 2 : 0,
        Math.min(1, dt * 5),
      );
    }
    if (this.mode === 'treatment') {
      // Hold the radiograph pose steady; other examinations retain breathing,
      // blinking and the pet's gentle authored idle motion.
      if (this.examination.selected !== 'xray')
        this.patientAnimation?.update(dt);
    }
    this.examination.update(time);
    if (
      this.examining &&
      this.hoverZone &&
      !this.sampled &&
      time - this.hoverSince > 500 &&
      this.examination.findingVisible(this.perspective, this.width, this.height)
    ) {
      this.sampled = true;
      this.pick(this.hoverZone);
    }
    this.controls.update();
    // Software WebGL keeps the same clips, at a lighter display cadence.
    // Camera changes redraw immediately; hardware graphics animate every frame.
    if (
      this.softwareGraphics &&
      !this.needsRender &&
      time - this.lastRender < 1000 / 24
    )
      return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (this.softwareGraphics && time < this.softwareIdleUntil) return;
    if (this.softwareGraphics && this.pendingFrame) {
      // Never build a queue of costly software frames behind input and readback.
      if (gl.clientWaitSync(this.pendingFrame, 0, 0) === gl.TIMEOUT_EXPIRED)
        return;
      gl.deleteSync(this.pendingFrame);
      this.pendingFrame = null;
      // Software rendering shares the CPU with input and browser compositing.
      // A completed expensive frame needs breathing room before another starts.
      this.softwareIdleUntil =
        time + Math.min(250, Math.max(32, time - this.lastRender));
      return;
    }
    const sceneChanged = this.needsRender;
    this.lastRender = time;
    this.needsRender = false;
    // The magnifier reuses the main view's shadow map in its second pass.
    this.renderer.shadowMap.needsUpdate =
      !this.softwareGraphics ||
      this.mode === 'treatment' ||
      sceneChanged ||
      this.simulation.escort.phase !== 'idle' ||
      [...this.simulation.leisure.pets.values()].some((p) => p.phase === 'use');
    this.renderer.render(
      this.scene,
      this.mode === 'town'
        ? this.townCamera
        : this.mode === 'reception'
          ? this.ortho
          : this.perspective,
    );
    if (this.mode === 'treatment')
      this.examination.render(
        this.renderer,
        this.scene,
        this.perspective,
        this.width,
        this.height,
      );
    if (this.softwareGraphics) {
      this.pendingFrame = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
    }
  }
}
