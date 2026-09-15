import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Visit } from './game';
import { petAsset } from './pet-appearance';
import { dressPatient } from './fur';
import { addBowlWater } from './fishbowl';
import { CareSkill } from './care-skill';
import type { TracePoint } from './bandage-pattern';
export type CareModels = {
  patient: THREE.Group;
  tool: THREE.Group;
  detail?: THREE.Group;
  visit: Visit;
};
const cache = new Map<string, Promise<THREE.Group>>();
/** Also used by the isolated browser fixture; production reuses loaded World models. */
export async function loadCareModels(visit: Visit): Promise<CareModels> {
  const model = (path: string) => {
    if (!cache.has(path))
      cache.set(
        path,
        new GLTFLoader().loadAsync(`/models/${path}.glb`).then((g) => g.scene),
      );
    return cache.get(path)!.then((g) => g.clone(true));
  };
  const [patient, tool, detail] = await Promise.all([
    model(petAsset(visit)),
    model('examination/tool-' + visit.treatment),
    visit.zone === 'mouth'
      ? model(
          `examination/mouth-${['dog', 'cat'].includes(visit.species) ? 'carnivore' : 'rodent'}-${visit.clinical?.teeth ?? 'healthy'}`,
        )
      : undefined,
  ]);
  return { patient, tool, detail, visit };
}
/** A close-up of the actual Blender patient, with contact and wrapped geometry. */
export class CareScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 30);
  readonly scene = new THREE.Scene();
  readonly wraps: THREE.Vector3[] = [];
  private ribbon?: THREE.Mesh;
  private focus = new THREE.Vector3();
  private span = 0.8;
  private normal = new THREE.Vector3();
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();
  private prop: THREE.Group;
  private patient: THREE.Group;
  private effects = new THREE.Group();
  private drops: THREE.Mesh[] = [];
  private patches: THREE.Mesh[] = [];
  private fleas: THREE.Mesh[] = [];
  private water?: THREE.Mesh;
  private stream?: THREE.Mesh;
  private splinter?: THREE.Mesh;
  private plungers: { part: THREE.Object3D; y: number }[] = [];
  private owned: { dispose(): void }[] = [];
  private cleanup: () => void;
  private width = 0;
  private height = 0;
  private lastFrame = -Infinity;
  private softwareIdleUntil = 0;
  private ray = new THREE.Raycaster();
  private contactMeshes: THREE.Object3D[] = [];
  private framePending: WebGLSync | null = null;
  private software: boolean;
  constructor(
    private mount: HTMLElement,
    readonly skill: CareSkill,
    readonly models: CareModels,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const gl = this.renderer.getContext(),
      debug = gl.getExtension('WEBGL_debug_renderer_info');
    this.software = Boolean(
      debug &&
      /swiftshader|llvmpipe|software/i.test(
        String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)),
      ),
    );
    this.renderer.setPixelRatio(
      this.software ? 0.5 : Math.min(devicePixelRatio, 1.75),
    );
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.domElement.setAttribute(
      'aria-label',
      `${models.visit.name}: ${skill.zone === 'paw' ? 'paw close-up' : 'treatment close-up'}`,
    );
    mount.prepend(this.renderer.domElement);
    this.scene.background = new THREE.Color('#e2e8d7');
    this.scene.add(new THREE.HemisphereLight(0xfff6e5, 0x739589, 2));
    const light = new THREE.DirectionalLight(0xfff3df, 2.4);
    light.position.set(3, 5, 4);
    this.scene.add(light);
    this.patient = models.detail ?? models.patient;
    this.scene.add(this.patient);
    this.cleanup = dressPatient(models.patient, models.visit);
    if (models.visit.species === 'goldfish') {
      const cleanupWater = addBowlWater(
        this.patient,
        Boolean(models.visit.clinical?.water),
      );
      this.water = this.patient.getObjectByName('bowl_water') as THREE.Mesh;
      const cleanup = this.cleanup;
      this.cleanup = () => {
        cleanup();
        cleanupWater();
      };
    }
    this.patient.traverse((o) => {
      if (
        o instanceof THREE.Mesh &&
        o.name !== 'soft coat fuzz' &&
        !o.name.startsWith('clinical-')
      )
        this.contactMeshes.push(o);
      if (skill.tool === 'comb' && o.name === 'clinical-fleas')
        o.visible = false;
    });
    this.patient.updateMatrixWorld(true);
    const defaultSpots: Record<string, THREE.Vector3> = {
      paw: new THREE.Vector3(0.28, 0.26, 0.28),
      coat: new THREE.Vector3(0.38, 0.8, -0.28),
      ear: new THREE.Vector3(0.36, 1.16, 0.48),
      mouth: new THREE.Vector3(0, 0.85, 0.9),
      tank: new THREE.Vector3(0, 0.6, 0),
    };
    this.focus.copy(defaultSpots[skill.zone] ?? defaultSpots.coat);
    this.patient.traverse((o) => {
      if (o.name.startsWith('spot_' + skill.zone))
        o.getWorldPosition(this.focus);
    });
    if (models.detail) {
      new THREE.Box3().setFromObject(models.detail).getCenter(this.focus);
      this.span = 1.4;
    } else
      this.span =
        skill.zone === 'tank' ? 2 : skill.zone === 'coat' ? 1.05 : 0.7;
    if (skill.zone === 'paw') {
      const paw = this.nearestPaw();
      if (paw) {
        const bounds = new THREE.Box3().setFromObject(paw);
        bounds.getCenter(this.focus);
        this.span =
          Math.max(...bounds.getSize(new THREE.Vector3()).toArray()) * 2.2;
      }
    }
    if (skill.tool === 'bandage') this.makeWrap();
    this.normal
      .copy(
        skill.zone === 'coat'
          ? new THREE.Vector3(2.8, 1, 0.7)
          : new THREE.Vector3(0.18, 0.18, 2),
      )
      .normalize();
    if (skill.zone === 'tank') this.normal.set(0.4, 0.55, 1).normalize();
    if (models.detail) this.normal.set(0, 0, 1);
    this.camera.position.copy(this.focus).addScaledVector(this.normal, 4);
    this.camera.lookAt(this.focus);
    this.camera.updateMatrixWorld(true);
    this.right.setFromMatrixColumn(this.camera.matrixWorld, 0);
    this.up.setFromMatrixColumn(this.camera.matrixWorld, 1);
    this.prop = new THREE.Group();
    this.prop.name = 'CareTool';
    const tool = models.tool;
    tool.scale.setScalar(this.span * 0.26);
    tool.rotation.x = Math.PI / 2;
    tool.rotation.z = -0.35;
    tool.traverse((part) => {
      if (/^(plunger|thumb pad)/.test(part.name))
        this.plungers.push({ part, y: part.position.y });
    });
    this.prop.add(tool);
    this.scene.add(this.prop, this.effects);
    const dot = (color: number, radius: number) => {
      const geometry = new THREE.SphereGeometry(radius, 12, 8),
        material = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      this.owned.push(geometry, material);
      const mesh = new THREE.Mesh(geometry, material);
      this.effects.add(mesh);
      return mesh;
    };
    for (let i = 0; i < 6; i++) {
      this.patches.push(dot(0xe39992, this.span * 0.035));
      this.fleas.push(dot(0x4b352b, this.span * 0.018));
    }
    for (let i = 0; i < 3; i++)
      this.drops.push(dot(0x73c1d3, this.span * 0.018));
    if (skill.tool === 'water-care') {
      this.stream = dot(0x85cbd9, this.span * 0.013);
      this.stream.scale.set(1, 12, 1);
    }
    if (skill.tool === 'forceps') {
      this.splinter = dot(0x79502c, this.span * 0.01);
      this.splinter.name = 'CareSplinter';
      this.splinter.scale.set(0.6, 6, 0.6);
      this.splinter.rotation.z = -0.7;
      const original = this.patient.getObjectByName('wooden splinter');
      if (original) original.visible = false;
    }
    this.resize();
    this.draw(true);
  }
  private nearestPaw() {
    const candidates: THREE.Mesh[] = [];
    this.patient.traverse((o) => {
      if (o instanceof THREE.Mesh && /^paw([._]|\d|$)/.test(o.name))
        candidates.push(o);
    });
    candidates.sort((a, b) => {
      const ca = new THREE.Box3()
          .setFromObject(a)
          .getCenter(new THREE.Vector3()),
        cb = new THREE.Box3().setFromObject(b).getCenter(new THREE.Vector3());
      return ca.distanceTo(this.focus) - cb.distanceTo(this.focus);
    });
    return candidates[0];
  }
  private makeWrap() {
    const paw = this.nearestPaw();
    if (!paw) throw new Error('This patient has no paw for wrapping.');
    const box = new THREE.Box3().setFromObject(paw),
      size = box.getSize(new THREE.Vector3());
    box.getCenter(this.focus);
    const height = Math.max(0.18, size.y * 0.85),
      rx = size.x * 0.54,
      rz = size.z * 0.54;
    this.span = Math.max(size.x, size.z, height) * 1.75;
    const positions: number[] = [],
      indices: number[] = [];
    for (let i = 0; i <= 96; i++) {
      const angle = Math.PI + (i / 96) * Math.PI * 6;
      const p = new THREE.Vector3(
        this.focus.x + Math.cos(angle) * rx,
        this.focus.y + height * (0.5 - i / 96),
        this.focus.z + Math.sin(angle) * rz,
      );
      this.wraps.push(p);
      positions.push(
        p.x,
        p.y - height * 0.18,
        p.z,
        p.x,
        p.y + height * 0.18,
        p.z,
      );
      if (i < 96) {
        const j = i * 2;
        indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.setDrawRange(0, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0xfff7df,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    this.ribbon = new THREE.Mesh(geometry, material);
    this.ribbon.name = 'BandageWrappedAroundPaw';
    this.scene.add(this.ribbon);
    this.owned.push(geometry, material);
  }
  private resize() {
    const width = Math.max(1, this.mount.clientWidth),
      height = Math.max(1, this.mount.clientHeight);
    if (width === this.width && height === this.height) return false;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    this.camera.left = -this.span * 0.5 * Math.max(1, aspect);
    this.camera.right = -this.camera.left;
    this.camera.top = this.span * 0.5 * Math.max(1, 1 / aspect);
    this.camera.bottom = -this.camera.top;
    this.camera.updateProjectionMatrix();
    if (this.wraps.length)
      this.skill.setWrapPath(this.wraps.map((p) => this.project(p)));
    return true;
  }
  project(point: THREE.Vector3): TracePoint {
    const p = point.clone().project(this.camera);
    return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
  }
  private onPlane(p: TracePoint, depth = 0) {
    return this.focus
      .clone()
      .addScaledVector(
        this.right,
        (p.x - 0.5) * (this.camera.right - this.camera.left),
      )
      .addScaledVector(
        this.up,
        (0.5 - p.y) * (this.camera.top - this.camera.bottom),
      )
      .addScaledVector(this.normal, this.span * 0.24 + depth);
  }
  private onSurface(p: TracePoint, depth = 0) {
    this.ray.setFromCamera(
      new THREE.Vector2(p.x * 2 - 1, 1 - p.y * 2),
      this.camera,
    );
    const hit = this.ray
      .intersectObjects(this.contactMeshes, false)
      .find((h) => h.object.visible && !h.object.userData.bowlWater);
    return hit
      ? hit.point.addScaledVector(this.normal, depth + this.span * 0.005)
      : this.onPlane(p, depth);
  }
  draw(force = false) {
    const resized = this.resize(),
      now = performance.now(),
      gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (
      !force &&
      !resized &&
      now - this.lastFrame < (this.software ? 1000 / 24 : 1000 / 60)
    )
      return;
    if (this.software && now < this.softwareIdleUntil) return;
    if (this.framePending) {
      if (gl.clientWaitSync(this.framePending, 0, 0) === gl.TIMEOUT_EXPIRED)
        return;
      gl.deleteSync(this.framePending);
      this.framePending = null;
      this.softwareIdleUntil =
        now + Math.min(120, Math.max(16, now - this.lastFrame));
      if (!force) return;
    }
    this.lastFrame = now;
    const s = this.skill,
      kind = s.spec.kind;
    this.patient.rotation.z = s.startled ? Math.sin(now * 0.009) * 0.025 : 0;
    this.prop.visible = s.started && !s.complete && !s.startled;
    if (kind === 'wrap') {
      const i = Math.min(95, Math.floor(s.wrapProgress)),
        t = s.wrapProgress - i;
      this.prop.position
        .copy(this.wraps[i])
        .lerp(this.wraps[i + 1], t)
        .addScaledVector(this.normal, 0.015);
      this.ribbon!.geometry.setDrawRange(0, Math.floor(s.wrapProgress) * 6);
    } else this.prop.position.copy(this.onSurface(s.position, 0.03));
    this.prop.rotation.z =
      kind === 'pour'
        ? -s.value * 0.9
        : kind === 'pressure'
          ? -s.value * 0.1
          : 0;
    for (const { part, y } of this.plungers)
      part.position.y =
        y - (kind === 'pressure' && s.gripped ? s.progress * 0.35 : 0);
    if (this.splinter) {
      this.splinter.visible = !s.complete;
      this.splinter.position.copy(
        s.gripped ? this.prop.position : this.onSurface({ x: 0.35, y: 0.65 }),
      );
    }
    if (this.stream) {
      this.stream.visible =
        s.value > 0 &&
        Math.hypot(
          s.position.x - s.targetPoint.x,
          s.position.y - s.targetPoint.y,
        ) < s.tolerance;
      this.stream.position
        .copy(this.prop.position)
        .addScaledVector(this.up, -this.span * 0.07);
      this.stream.quaternion.copy(this.camera.quaternion);
    }
    this.patches.forEach((p, i) => {
      p.visible =
        (kind === 'spread' || kind === 'brush') && (kind === 'spread' || i < 3);
      p.position.copy(this.onSurface(s.patchPoint(i)));
      p.scale.set(1.8, 1, 0.3);
      p.quaternion.copy(this.camera.quaternion);
      (p.material as THREE.MeshStandardMaterial).color.set(
        s.coverage[i] >= 1 ? 0xf9f2dc : kind === 'brush' ? 0xc5a25a : 0xe39992,
      );
      if (kind === 'brush' && s.coverage[i] >= 1) p.visible = false;
    });
    this.fleas.forEach((p, i) => {
      p.visible = kind === 'comb' && !s.covered.has(i);
      const f = s.fleaPosition(i);
      p.position.copy(this.onSurface(f, f.hop * this.span * 0.05));
      p.scale.set(1, 1.4, 0.7);
    });
    this.drops.forEach((p, i) => {
      p.visible = kind === 'aim' && i < s.stage;
      p.position.copy(
        this.onPlane({ x: 0.49 + i * 0.012, y: 0.5 + i * 0.025 }),
      );
    });
    const lesion = this.patient.getObjectByName(
      'clinical-' + this.models.visit.clinical?.skin,
    );
    if (lesion && kind !== 'comb') lesion.visible = !s.complete;
    if (s.tool === 'brush' && s.complete && this.models.detail)
      this.models.detail.traverse((part) => {
        if (part.name.startsWith('clinical tartar')) part.visible = false;
      });
    if (this.water) {
      this.water.scale.y = 0.93 + s.waterLevel * 0.08;
      this.water.position.y = 0.13 + 0.55 * this.water.scale.y;
    }
    this.renderer.render(this.scene, this.camera);
    if (this.software) {
      this.framePending = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
    }
  }
  dispose() {
    if (this.framePending)
      (this.renderer.getContext() as WebGL2RenderingContext).deleteSync(
        this.framePending,
      );
    this.cleanup();
    this.owned.forEach((r) => r.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
