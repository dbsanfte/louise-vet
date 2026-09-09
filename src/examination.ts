import { addBowlWater } from './fishbowl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clinicalProfile, ecg } from './clinical';
import { toolInfo, type Visit, type Tool, type Zone } from './game';
import { dressPatient } from './fur';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export class Examination {
  private assets = new Map<string, THREE.Group>();
  private hudScene = new THREE.Scene();
  private anatomyScene = new THREE.Scene();
  private interiorScene = new THREE.Scene();
  private hudCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 3000);
  private detailCamera = new THREE.PerspectiveCamera();
  private interiorCamera = new THREE.PerspectiveCamera(48, 1, 0.01, 10);
  private target = new THREE.WebGLRenderTarget(512, 512);
  private instrument = new THREE.Group();
  private surface?: THREE.Mesh;
  private tool: Tool | null = null;
  private visit?: Visit;
  private contact: Zone | null = null;
  private point = new THREE.Vector2(0.55, 0.55);
  private active = false;
  private zoom = 3.5;
  private whole = false;
  private xrayZoom = 1.5;
  private lastTrace = -Infinity;
  private skeletonBounds = new THREE.Sphere();
  private skeletonBox = new THREE.Box3();
  private cleanupPatient = () => {};
  private patient?: THREE.Group;
  private skinIssue?: THREE.Object3D;
  private panel: HTMLDivElement;
  private trace: HTMLCanvasElement;
  private message: HTMLElement;
  private readout: HTMLElement;
  private onHeart: (bpm: number | null, now: number) => void;

  constructor(
    container: HTMLElement,
    environment: THREE.Texture | null,
    onHeart: (bpm: number | null, now: number) => void,
  ) {
    this.onHeart = onHeart;
    this.hudCamera.position.z = 1000;
    this.hudScene.environment = environment;
    this.hudScene.add(new THREE.HemisphereLight(0xffffff, 0x768f8a, 2));
    const lamp = new THREE.DirectionalLight(0xffffff, 3);
    lamp.position.set(-3, 5, 10);
    this.hudScene.add(lamp);
    this.anatomyScene.background = new THREE.Color(0x06111c);
    this.anatomyScene.add(new THREE.AmbientLight(0xabcfff, 2));
    const boneLight = new THREE.DirectionalLight(0xffffff, 3);
    boneLight.position.set(-3, 6, 4);
    this.anatomyScene.add(boneLight);
    this.interiorScene.background = new THREE.Color(0x190d12);
    this.interiorScene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const scopeLight = new THREE.PointLight(0xffeee4, 2.5, 6, 1.5);
    scopeLight.position.set(-0.1, 0.15, 1);
    this.interiorScene.add(scopeLight);
    this.interiorCamera.position.set(0, 0, 1.35);
    this.interiorCamera.lookAt(0, 0, -0.45);
    this.hudScene.add(this.instrument);
    this.panel = document.createElement('div');
    this.panel.className = 'examination-readout';
    this.panel.hidden = true;
    this.panel.innerHTML =
      '<div class="instrument-title"></div><p class="instrument-message"></p><div class="instrument-actions"><button data-action="instrument-zoom-out" aria-label="Reduce magnification">−</button><span class="instrument-zoom"></span><button data-action="instrument-zoom-in" aria-label="Increase magnification">+</button><button data-action="full-xray">Whole-body X-ray</button></div><canvas class="ecg-trace" width="520" height="140" aria-label="Live heartbeat ECG"></canvas><strong class="heart-reading"></strong><button class="heart-sound" data-action="sound">Listen with sound / mute</button>';
    container.append(this.panel);
    // On a small screen, keep controls below the animal so dragging a viewer
    // cannot accidentally press a button hidden beneath a finger.
    const compact = window.matchMedia('(max-width: 700px)');
    const arrange = () => {
      if (compact.matches) container.after(this.panel);
      else container.append(this.panel);
    };
    compact.addEventListener('change', arrange);
    arrange();
    this.trace = this.panel.querySelector('canvas')!;
    this.message = this.panel.querySelector('.instrument-message')!;
    this.readout = this.panel.querySelector('.heart-reading')!;
  }
  async load() {
    const tools = Object.keys(toolInfo).map((t) => 'tool-' + t);
    const anatomy = [
      'dog',
      'cat',
      'rabbit',
      'hamster',
      'gerbil',
      'goldfish',
      'bird',
      'rabbit-fracture',
      'dog-fracture',
      'cat-fracture',
    ].map((s) => 'skeleton-' + s);
    const interiors = [
      'ear-healthy',
      'ear-inflamed',
      ...['carnivore', 'rodent'].flatMap((f) =>
        ['healthy', 'tartar', 'cavity'].map((c) => `mouth-${f}-${c}`),
      ),
    ];
    const loader = new GLTFLoader();
    await Promise.all(
      [...tools, ...anatomy, ...interiors].map(async (name) => {
        const gltf = await loader.loadAsync(`/models/examination/${name}.glb`);
        if (name.startsWith('skeleton-')) {
          // Hundreds of authored bones become one draw call, retaining their
          // actual geometry, including the displaced fracture ends.
          const parts: THREE.BufferGeometry[] = [];
          let material: THREE.Material | THREE.Material[] | undefined;
          gltf.scene.updateMatrixWorld(true);
          gltf.scene.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              parts.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
              material ??= o.material;
              o.geometry.dispose();
            }
          });
          const geometry = mergeGeometries(parts);
          parts.forEach((p) => p.dispose());
          if (!geometry || !material)
            throw new Error(`Empty skeleton: ${name}`);
          gltf.scene.clear();
          gltf.scene.add(new THREE.Mesh(geometry, material));
        }
        this.assets.set(name, gltf.scene);
      }),
    );
  }
  private clone(name: string) {
    const asset = this.assets.get(name);
    if (!asset) throw new Error(`Missing examination model: ${name}`);
    return asset.clone(true);
  }
  setPatient(visit: Visit, animal: THREE.Group) {
    this.cleanupPatient();
    this.visit = visit;
    this.whole = false;
    this.contact = null;
    for (const scene of [this.anatomyScene, this.interiorScene]) {
      for (const obj of [...scene.children])
        if (obj instanceof THREE.Group) scene.remove(obj);
    }
    const profile = clinicalProfile(visit);
    const skeleton = this.clone(
      'skeleton-' + visit.species + (profile.fracture ? '-fracture' : ''),
    );
    skeleton.position.y = 1.28;
    this.anatomyScene.add(skeleton);
    this.skeletonBox
      .setFromObject(skeleton)
      .getBoundingSphere(this.skeletonBounds);
    const ghost = animal.clone(true);
    const ghostMaterial = new THREE.MeshBasicMaterial({
      color: 0x8ab1c7,
      transparent: true,
      opacity: 0.035,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    ghost.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = ghostMaterial;
    });
    this.anatomyScene.add(ghost);
    const cleanupWater =
      visit.species === 'goldfish'
        ? addBowlWater(animal, profile.water === 'cloudy')
        : () => {};
    const cleanupFur = dressPatient(animal, visit);
    this.patient = animal;
    this.skinIssue = undefined;
    animal.traverse((o) => {
      if (o.name === `clinical-${profile.skin}`) this.skinIssue = o;
    });
    this.cleanupPatient = () => {
      cleanupFur();
      cleanupWater();
      ghostMaterial.dispose();
    };
    this.panel.dataset.patient = visit.name;
  }
  select(tool: Tool | null, enabled: boolean) {
    this.active = enabled && tool !== null;
    this.panel.hidden = !this.active;
    if (this.tool === tool) {
      if (!this.active) this.onHeart(null, 0);
      return;
    }
    this.tool = tool;
    this.contact = null;
    this.whole = false;
    this.panel.dataset.whole = 'false';
    this.panel.dataset.contact = 'false';
    this.instrument.clear();
    this.surface?.geometry.dispose();
    if (this.surface) (this.surface.material as THREE.Material).dispose();
    this.surface = undefined;
    if (!tool) {
      this.onHeart(null, 0);
      return;
    }
    this.instrument.add(this.clone('tool-' + tool));
    if (['inspect', 'xray', 'ear', 'mouth'].includes(tool)) {
      const geometry =
        tool === 'inspect' || tool === 'mouth'
          ? new THREE.CircleGeometry(tool === 'mouth' ? 0.27 : 0.4, 64)
          : new THREE.PlaneGeometry(0.98, 0.78);
      this.surface = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          map: this.target.texture,
          toneMapped: false,
        }),
      );
      this.surface.position.z = tool === 'xray' || tool === 'ear' ? 0.1 : 0.004;
      this.instrument.add(this.surface);
    }
    const profile = this.visit ? clinicalProfile(this.visit) : null;
    for (const obj of [...this.interiorScene.children])
      if (obj instanceof THREE.Group) this.interiorScene.remove(obj);
    if (tool === 'ear' && profile)
      this.interiorScene.add(this.clone('ear-' + profile.ear));
    if (tool === 'mouth' && profile)
      this.interiorScene.add(
        this.clone(`mouth-${profile.dentalFamily}-${profile.teeth}`),
      );
    this.panel.querySelector('.instrument-title')!.textContent =
      toolInfo[tool].name;
    this.panel.querySelector<HTMLElement>('.instrument-actions')!.hidden = ![
      'inspect',
      'xray',
      'ear',
      'mouth',
    ].includes(tool);
    this.panel.querySelector<HTMLElement>('[data-action="full-xray"]')!.hidden =
      tool !== 'xray';
    this.trace.hidden = tool !== 'listen';
    this.readout.hidden = !['listen', 'thermometer', 'water-test'].includes(
      tool,
    );
    this.panel.querySelector<HTMLElement>('.heart-sound')!.hidden =
      tool !== 'listen';
    this.panel.dataset.tool = tool;
  }
  setContact(x: number, y: number, zone: Zone | null) {
    this.point.set(x, y);
    this.contact = zone;
    this.panel.dataset.zone = zone ?? '';
    this.panel.dataset.contact = String(Boolean(zone));
  }
  changeZoom(delta: number) {
    if (this.tool === 'xray') {
      this.whole = false;
      this.panel.dataset.whole = 'false';
      this.xrayZoom = THREE.MathUtils.clamp(this.xrayZoom + delta, 1, 4);
    } else this.zoom = THREE.MathUtils.clamp(this.zoom + delta, 1, 8);
  }
  toggleWhole() {
    this.whole = !this.whole;
    this.panel.dataset.whole = String(this.whole);
  }
  get selected() {
    return this.active ? this.tool : null;
  }
  issuePosition(zone: Zone) {
    if (this.skinIssue && this.visit?.zone === zone)
      return this.skinIssue.getWorldPosition(new THREE.Vector3());
    return null;
  }
  findingVisible(
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
  ) {
    if (
      !this.visit?.checks.some(
        (check) => check.tool === this.tool && check.zone === this.contact,
      )
    )
      return true;
    let point: THREE.Vector3 | undefined;
    if (this.tool === 'inspect' && this.skinIssue) {
      point = this.skinIssue.getWorldPosition(new THREE.Vector3());
      const direction = point.clone().sub(camera.position).normalize();
      const ray = new THREE.Raycaster(camera.position, direction);
      const hit = ray.intersectObject(this.patient!, true)[0];
      if (hit && hit.point.distanceTo(point) > 0.065) return false;
    } else if (this.tool === 'xray' && this.visit?.clinical?.fracture) {
      if (this.whole) return true;
      point = new THREE.Vector3(0.3, 1.69, 0.22);
    }
    if (!point) return true;
    point.project(camera);
    const scale = Math.min(250, width * 0.6);
    const zoom = this.tool === 'xray' ? this.xrayZoom : this.zoom;
    const dx = (((point.x + 1) / 2 - this.point.x) * width * zoom) / scale;
    const dy = (((1 - point.y) / 2 - this.point.y) * height * zoom) / scale;
    return this.tool === 'xray'
      ? Math.abs(dx) < 0.49 && Math.abs(dy) < 0.39
      : Math.hypot(dx, dy) < 0.38;
  }
  update(now: number) {
    if (!this.active || !this.tool || !this.visit) {
      this.onHeart(null, now);
      return;
    }
    const profile = clinicalProfile(this.visit);
    const valid =
      this.contact &&
      (this.tool === 'ear'
        ? this.contact === 'ear'
        : this.tool === 'mouth'
          ? this.contact === 'mouth'
          : this.tool === 'thermometer'
            ? this.contact === 'coat'
            : this.tool === 'water-test'
              ? this.contact === 'tank'
              : this.tool === 'listen'
                ? this.contact === 'chest'
                : true);
    const labels: Partial<Record<Tool, string>> = {
      xray: 'Drag across the head, spine, ribs and every leg.',
      inspect:
        this.visit.species === 'goldfish'
          ? 'Move the magnifier over the fish to look closely at its fins and scales.'
          : this.visit.species === 'bird'
            ? 'Look closely at the feathers, beak and feet.'
            : 'Drag slowly to inspect the fur and anything caught in the coat.',
      ear: 'Hold the lit scope at an ear to look down the canal.',
      mouth: 'Hold the mirror at the mouth to inspect teeth and gums.',
      thermometer: `Hold the pretend sensor at the ${this.visit.species === 'bird' ? 'feathers' : 'coat'} for a temperature check.`,
      listen: 'Hold the chestpiece against the chest and listen.',
      'water-test':
        'Dip the tester anywhere in the bowl water, or choose the Bowl water guide.',
    };
    const message =
      labels[this.tool] ?? 'Hold the tool against the spot in your care plan.';
    if (this.message.textContent !== message)
      this.message.textContent = message;
    const zoomLabel = `${this.tool === 'xray' ? (this.whole ? 'Full scan' : this.xrayZoom.toFixed(1) + '×') : this.zoom.toFixed(1) + '×'}`;
    const zoomElement = this.panel.querySelector('.instrument-zoom')!;
    if (zoomElement.textContent !== zoomLabel)
      zoomElement.textContent = zoomLabel;
    const view = valid
      ? this.tool === 'xray'
        ? 'skeleton'
        : this.tool === 'inspect'
          ? 'fur'
          : this.tool === 'ear'
            ? 'ear-' + profile.ear
            : this.tool === 'mouth'
              ? 'teeth-' + profile.teeth
              : this.tool === 'listen'
                ? 'ecg'
                : 'tool'
      : 'positioning';
    if (this.panel.dataset.view !== view) this.panel.dataset.view = view;
    if (this.tool === 'water-test') {
      this.panel.dataset.view = valid ? 'water' : 'positioning';
      this.readout.textContent = valid
        ? profile.water === 'cloudy'
          ? 'Water needs care · Outside the happy blue zone'
          : 'Comfortable water · In the happy blue zone'
        : 'Dip the tester in the bowl water';
    }
    if (this.tool === 'thermometer') {
      const reading = valid
        ? `${profile.temperature} · Storybook temperature`
        : `Place the sensor on the ${this.visit.species === 'bird' ? 'feathers' : 'coat'}`;
      this.panel.dataset.view = valid ? 'temperature' : 'positioning';
      if (this.readout.textContent !== reading)
        this.readout.textContent = reading;
    }
    if (this.tool === 'listen') {
      const bpm = valid ? profile.bpm : null;
      const reading = bpm
        ? `${bpm} BPM · ${profile.heart === 'fast' ? 'Faster than usual' : 'Steady, normal rhythm'}`
        : 'Place the chestpiece on the chest';
      if (this.readout.textContent !== reading) {
        this.readout.textContent = reading;
        this.readout.dataset.bpm = bpm ? String(bpm) : '';
      }
      this.onHeart(bpm, now);
      if (now - this.lastTrace < 1000 / 30) return;
      this.lastTrace = now;
      const ctx = this.trace.getContext('2d')!,
        w = this.trace.width,
        h = this.trace.height;
      ctx.fillStyle = '#071e22';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#173b3e';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.strokeStyle = '#80f7b4';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#80f7b4';
      ctx.shadowBlur = 5;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const phase = bpm
          ? (((((now - ((w - x) / w) * 2500) / 60000) * bpm) % 1) + 1) % 1
          : 0;
        const y = h * 0.64 - (bpm ? ecg(phase) * h * 0.46 : 0);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else this.onHeart(null, now);
  }
  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
  ) {
    if (!this.active || !this.tool || !this.visit) return;
    const scale =
      this.whole && this.tool === 'xray'
        ? Math.min(420, width * 0.7)
        : Math.min(250, width * 0.6) * (this.tool === 'mouth' ? 1.45 : 1);
    const px = this.whole
        ? THREE.MathUtils.clamp(
            this.point.x * width,
            scale * 0.6,
            width - scale * 0.85,
          )
        : this.point.x * width,
      py = this.whole
        ? THREE.MathUtils.clamp(
            this.point.y * height,
            scale * 0.5,
            height - scale * 0.55,
          )
        : this.point.y * height;
    const valid =
      this.contact &&
      (this.tool === 'ear'
        ? this.contact === 'ear'
        : this.tool === 'mouth'
          ? this.contact === 'mouth'
          : true);
    if (this.surface) {
      this.surface.visible = Boolean(valid);
      if (valid) {
        const interior = this.tool === 'ear' || this.tool === 'mouth';
        const screenW =
          (this.tool === 'inspect'
            ? 0.8
            : this.tool === 'mouth'
              ? 0.54
              : 0.98) * scale;
        const screenH =
          (this.tool === 'inspect'
            ? 0.8
            : this.tool === 'mouth'
              ? 0.54
              : 0.78) * scale;
        // Match the actual display density. Software WebGL otherwise shades
        // sixteen times more lens pixels than can appear on its canvas.
        const density = Math.min(2, Math.max(0.75, renderer.getPixelRatio()));
        this.target.setSize(
          Math.round(Math.min(screenW * density, 640)),
          Math.round(Math.min(screenH * density, 640)),
        );
        renderer.setRenderTarget(this.target);
        if (interior) {
          this.interiorCamera.aspect = screenW / screenH;
          // Sliding the scope changes the view direction inside the opening.
          this.interiorCamera.position.set(
            (this.point.x - 0.5) * 0.3,
            (0.5 - this.point.y) * 0.25,
            this.tool === 'ear' ? 1.25 : 1.35,
          );
          this.interiorCamera.zoom = this.zoom / 3.5;
          this.interiorCamera.lookAt(0, 0, -0.38);
          this.interiorCamera.updateProjectionMatrix();
          renderer.render(this.interiorScene, this.interiorCamera);
        } else {
          this.detailCamera.copy(camera);
          const zoom = this.tool === 'xray' ? this.xrayZoom : this.zoom;
          const sw = screenW / zoom;
          const sh = screenH / zoom;
          this.detailCamera.setViewOffset(
            width,
            height,
            (this.whole && this.tool === 'xray' ? width / 2 : px) - sw / 2,
            (this.whole && this.tool === 'xray' ? height / 2 : py) - sh / 2,
            sw,
            sh,
          );
          if (this.whole && this.tool === 'xray') {
            this.detailCamera.clearViewOffset();
            this.detailCamera.aspect = screenW / screenH;
            this.detailCamera.zoom = 1;
            const fov = THREE.MathUtils.degToRad(this.detailCamera.fov / 2);
            const halfAngle = Math.min(
              fov,
              Math.atan((Math.tan(fov) * screenW) / screenH),
            );
            this.detailCamera.position
              .copy(camera.position)
              .sub(this.skeletonBounds.center)
              .normalize()
              .multiplyScalar(
                (this.skeletonBounds.radius / Math.sin(halfAngle)) * 1.08,
              )
              .add(this.skeletonBounds.center);
            this.detailCamera.lookAt(this.skeletonBounds.center);
            this.detailCamera.updateProjectionMatrix();
            this.detailCamera.updateMatrixWorld();
            let extent = 0;
            for (const x of [this.skeletonBox.min.x, this.skeletonBox.max.x])
              for (const y of [this.skeletonBox.min.y, this.skeletonBox.max.y])
                for (const z of [
                  this.skeletonBox.min.z,
                  this.skeletonBox.max.z,
                ]) {
                  const p = new THREE.Vector3(x, y, z).project(
                    this.detailCamera,
                  );
                  extent = Math.max(extent, Math.abs(p.x), Math.abs(p.y));
                }
            this.detailCamera.zoom = 0.9 / extent;
            this.detailCamera.updateProjectionMatrix();
          }
          renderer.render(
            this.tool === 'xray' ? this.anatomyScene : scene,
            this.detailCamera,
          );
        }
        renderer.setRenderTarget(null);
      }
    }
    this.hudCamera.left = -width / 2;
    this.hudCamera.right = width / 2;
    this.hudCamera.top = height / 2;
    this.hudCamera.bottom = -height / 2;
    this.hudCamera.updateProjectionMatrix();
    this.instrument.scale.setScalar(scale);
    this.instrument.position.set(px - width / 2, height / 2 - py, 0);
    const clear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.hudScene, this.hudCamera);
    renderer.autoClear = clear;
  }
}
