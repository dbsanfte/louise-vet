import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  visits,
  type Species,
  type Zone,
  type UpgradeId,
  type Visit,
  type Tool,
} from './game';
import { Character } from './character';
import { Examination } from './examination';

const assetNames = [
  'clinic',
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
] as const;
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
  private reception = new THREE.Group();
  private treatment = new THREE.Group();
  private guests = new THREE.Group();
  private decoration = new THREE.Group();
  private assets = new Map<Asset, THREE.Group>();
  private animal?: THREE.Group;
  private patientAnimation?: Character;
  private louiseAnimation?: Character;
  private mode: 'reception' | 'treatment' = 'reception';
  private species: Species = 'dog';
  private raycaster = new THREE.Raycaster();
  private pointerStart = { x: 0, y: 0 };
  private people: {
    id: number;
    group: THREE.Group;
    target: THREE.Vector3;
    waypoints: THREE.Vector3[];
    wait: number;
    ownerAnimation: Character;
    petAnimation: Character;
  }[] = [];
  private width = 1;
  private height = 1;
  private observer: ResizeObserver;
  private onPick: (zone: Zone | null, findingVisible: boolean) => void;
  private softwareGraphics = false;
  private needsRender = true;
  private lastRender = -Infinity;
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
  ) {
    this.onPick = onPick;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    const gl = this.renderer.getContext();
    const rendererInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const softwareGraphics =
      rendererInfo &&
      /swiftshader|llvmpipe|softpipe|software/i.test(
        String(gl.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL)),
      );
    this.softwareGraphics = Boolean(softwareGraphics);
    // Keep the same scene and controls usable when no graphics card is available.
    this.renderer.setPixelRatio(
      softwareGraphics ? 0.5 : Math.min(window.devicePixelRatio, 1.75),
    );
    this.renderer.shadowMap.enabled = true;
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
    this.scene.add(light);
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
    this.ortho.position.set(11, 13, 16);
    this.ortho.lookAt(0, 0.3, 0);
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
    this.scene.add(this.reception, this.treatment);
    this.treatment.visible = false;
    this.reception.add(this.guests, this.decoration);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      this.pointerStart = { x: e.clientX, y: e.clientY };
      if (this.examination.selected) {
        this.examining = true;
        this.sampled = false;
        this.hoverSince = performance.now();
        this.renderer.domElement.setPointerCapture(e.pointerId);
        this.moveInstrument(e);
      }
    });
    this.renderer.domElement.addEventListener('pointermove', (e) =>
      this.moveInstrument(e),
    );
    this.renderer.domElement.addEventListener('pointercancel', () => {
      this.examining = false;
    });
    this.renderer.domElement.addEventListener('pointerup', (e) => {
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
    louise.position.set(-1.3, 0, -2.75);
    this.reception.add(louise);
    this.louiseAnimation = new Character(louise);
    this.treatment.add(this.clone('table'));
    this.container.dataset.ready = 'true';
    this.needsRender = true;
  }

  private clone(name: Asset) {
    const asset = this.assets.get(name);
    if (!asset) throw new Error(`Missing model: ${name}`);
    return asset.clone(true);
  }

  setQueue(queue: number[]) {
    if (!this.assets.size) return;
    this.needsRender = true;
    const existing = new Map(this.people.map((person) => [person.id, person]));
    for (const person of this.people) {
      if (!queue.includes(person.id)) {
        person.ownerAnimation.dispose();
        person.petAnimation.dispose();
      }
    }
    this.guests.clear();
    this.people = [];
    const places = [
      [-1.3, -0.1],
      [-0.8, 1.15],
      [0.55, 1.8],
      [2.15, 2.0],
      [2.7, -0.7],
      [1.25, -0.45],
    ];
    queue.forEach((id, i) => {
      const previous = existing.get(id);
      const group = previous?.group ?? new THREE.Group();
      let ownerAnimation = previous?.ownerAnimation;
      let petAnimation = previous?.petAnimation;
      if (!previous) {
        const person = this.clone(visits[id % visits.length].ownerModel);
        person.scale.setScalar(0.86);
        const pet = this.clone(visits[id % visits.length].species);
        pet.scale.setScalar(
          visits[id % visits.length].species === 'goldfish' ? 0.42 : 0.48,
        );
        pet.position.set(-0.52, 0, 0.3);
        group.add(person, pet);
        ownerAnimation = new Character(person, id * 0.37);
        petAnimation = new Character(pet, id * 0.51);
        group.position.set(5.65 + i * 0.5, 0, 1.65);
        group.rotation.y = -Math.PI / 2;
      }
      this.guests.add(group);
      this.people.push({
        id,
        group,
        target: new THREE.Vector3(places[i][0], 0, places[i][1]),
        waypoints: previous?.waypoints ?? [new THREE.Vector3(3.45, 0, 1.65)],
        wait: previous?.wait ?? i * 0.65,
        ownerAnimation: ownerAnimation!,
        petAnimation: petAnimation!,
      });
    });
  }

  setUpgrades(ids: UpgradeId[]) {
    this.needsRender = true;
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
      for (const x of [2.4, 4.35]) {
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
    if (ids.includes('bench')) {
      box([1.8, 0.28, 0.7], [3.65, 0.55, 1.7], 0xd59180);
      box([1.8, 0.7, 0.15], [3.65, 0.9, 1.98], 0x639881);
      for (const x of [2.95, 4.3])
        box([0.12, 0.45, 0.5], [x, 0.22, 1.7], 0x98704e);
    }
    if (ids.includes('poster')) {
      box([0.8, 1.15, 0.1], [1.7, 2.1, -3.7], 0xf6d479);
      box([0.5, 0.12, 0.12], [1.7, 2.25, -3.62], 0x679683);
      box([0.32, 0.12, 0.12], [1.7, 1.94, -3.62], 0x679683);
    }
    if (ids.includes('expansion')) {
      box([2.4, 0.25, 3.2], [6.1, -0.2, 0], 0xe4d9bf);
      box([0.15, 1.3, 3.2], [7.25, 0.55, 0], 0xa7c3ad);
      box([1.7, 0.22, 0.75], [6, 0.6, -0.9], 0xc9986b);
      box([1.7, 0.65, 0.12], [6, 0.98, -1.22], 0x8faf97);
    }
  }

  showReception() {
    this.examination.select(null, false);
    this.examining = false;
    this.hoverZone = null;
    this.mode = 'reception';
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
    this.animal = this.clone(species);
    this.animal.position.y = 1.28;
    this.treatment.add(this.animal);
    this.patientAnimation = new Character(this.animal);
    this.examination.setPatient(visit, this.animal);
    this.orbitMode = false;
    this.mode = 'treatment';
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
    const hit = this.raycaster.intersectObject(this.animal, true)[0];
    let zone: Zone | null = null;
    if (hit) {
      // Identify the surface itself before falling back to guide proximity.
      // Both ears and all paws must work after orbiting to the other side.
      let part: THREE.Object3D | null = hit.object;
      while (part && part !== this.animal && !zone) {
        const name = part.name;
        if (/^(ear|inner_ear)/.test(name)) zone = 'ear';
        else if (/^paw/.test(name)) zone = 'paw';
        else if (/^(muzzle|nose)/.test(name)) zone = 'mouth';
        else if (/^chest/.test(name)) zone = 'chest';
        else if (/^bowl/.test(name)) zone = 'tank';
        else if (/^fin/.test(name)) zone = 'fin';
        else if (/^(body|tail)/.test(name))
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
    return this.species === 'goldfish'
      ? ['tank', 'fin']
      : ['ear', 'chest', 'paw', 'coat', 'mouth'];
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
    const h = Math.max(5.9, 7.25 / aspect);
    this.ortho.left = -h * aspect;
    this.ortho.right = h * aspect;
    this.ortho.top = h;
    this.ortho.bottom = -h;
    this.ortho.updateProjectionMatrix();
    this.perspective.aspect = aspect;
    this.perspective.updateProjectionMatrix();
  }
  draw(time: number, dt: number) {
    if (this.mode === 'reception') {
      this.louiseAnimation?.update(dt);
      this.people.forEach((person) => {
        const { group, target, waypoints, ownerAnimation, petAnimation } =
          person;
        ownerAnimation.update(dt);
        petAnimation.update(dt);
        if (person.wait > 0) {
          person.wait -= dt;
          ownerAnimation.setWalking(false);
          petAnimation.setWalking(false);
          return;
        }
        const destination = waypoints[0] ?? target;
        const direction = destination.clone().sub(group.position);
        direction.y = 0;
        const distance = direction.length();
        if (distance > 0.04) {
          ownerAnimation.setWalking(true);
          petAnimation.setWalking(true);
          group.position.addScaledVector(
            direction.normalize(),
            Math.min(distance, dt * 2),
          );
          group.rotation.y = Math.atan2(direction.x, direction.z);
        } else if (waypoints.length) {
          waypoints.shift();
        } else {
          ownerAnimation.setWalking(false);
          petAnimation.setWalking(false);
          const facing = Math.atan2(-1.3 - target.x, -2.75 - target.z);
          group.position.y = 0;
          group.rotation.y = facing;
        }
      });
    } else {
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
      time - this.lastRender < 250
    )
      return;
    this.lastRender = time;
    this.needsRender = false;
    this.renderer.render(
      this.scene,
      this.mode === 'reception' ? this.ortho : this.perspective,
    );
    if (this.mode === 'treatment')
      this.examination.render(
        this.renderer,
        this.scene,
        this.perspective,
        this.width,
        this.height,
      );
  }
}
