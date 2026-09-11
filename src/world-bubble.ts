import * as THREE from 'three';
import { BubbleDirector, type BubbleCandidate } from './speech-bubbles';
import type { ClinicInfo } from './clinic-identity';

/** A single DOM bubble stays crisp at town zoom levels and ignores pointer input. */
export class WorldBubble {
  readonly director = new BubbleDirector<THREE.Object3D>();
  readonly element = document.createElement('div');
  private box = new THREE.Box3();
  private point = new THREE.Vector3();
  private base = new THREE.Vector3();
  private anchors = new WeakMap<THREE.Object3D, THREE.Vector3>();
  private content = '';
  private candidates: BubbleCandidate<THREE.Object3D>[] = [];
  private checkedAt = -Infinity;
  private camera?: THREE.Camera;
  constructor(private container: HTMLElement) {
    this.element.className = 'world-bubble';
    this.element.hidden = true;
    this.element.setAttribute('role', 'status');
    this.element.setAttribute('aria-label', 'Character information');
    this.element.innerHTML =
      '<strong class="bubble-name"></strong><span class="bubble-description"></span><span class="bubble-feeling"></span>';
    container.append(this.element);
  }
  clear() {
    this.director.clear(performance.now());
    this.element.hidden = true;
  }
  inspect(target: THREE.Object3D, info: ClinicInfo) {
    this.director.inspect(target, info, performance.now());
  }
  private project(target: THREE.Object3D, camera: THREE.Camera) {
    for (let p: THREE.Object3D | null = target; p; p = p.parent)
      if (!p.visible) return undefined;
    let anchor = this.anchors.get(target);
    if (!anchor) {
      target.updateWorldMatrix(true, true);
      let head: THREE.Object3D | undefined;
      target.traverse((part) => {
        if (!head && part.name.startsWith('head_joint')) head = part;
      });
      this.box.setFromObject(head ?? target);
      if (this.box.isEmpty()) this.box.setFromObject(target);
      anchor = this.box.getCenter(new THREE.Vector3());
      anchor.y = this.box.max.y + 0.18;
      target.worldToLocal(anchor);
      this.anchors.set(target, anchor);
    }
    this.point.copy(anchor);
    target.localToWorld(this.point);
    this.point.project(camera);
    if (this.point.y > 1) {
      // A visible torso/ride can have its top cropped by a short viewport.
      // Keep its label at the top edge if the model's base is still in view.
      target.getWorldPosition(this.base).project(camera);
      if (
        Math.abs(this.base.y) <= 1 &&
        Math.abs(this.base.x) <= 1 &&
        Math.abs(this.base.z) <= 1
      )
        this.point.y = 1;
    }
    if (
      this.point.z < -1 ||
      this.point.z > 1 ||
      Math.abs(this.point.x) > 1 ||
      Math.abs(this.point.y) > 1
    )
      return undefined;
    return {
      x: ((this.point.x + 1) * this.container.clientWidth) / 2,
      y: ((1 - this.point.y) * this.container.clientHeight) / 2,
    };
  }
  update(
    camera: THREE.Camera,
    candidates: () => BubbleCandidate<THREE.Object3D>[],
    describe: (target: THREE.Object3D) => ClinicInfo | undefined,
  ) {
    const now = performance.now();
    if (now - this.checkedAt >= 250 || camera !== this.camera) {
      this.candidates = candidates();
      this.checkedAt = now;
      this.camera = camera;
    }
    const visible = this.candidates.filter((c) =>
      this.project(c.target, camera),
    );
    this.director.update(now, visible);
    const bubble = this.director.current;
    if (!bubble) {
      this.element.hidden = true;
      return;
    }
    const position = this.project(bubble.target, camera);
    const currentInfo =
      bubble.source === 'inspect' ? describe(bubble.target) : bubble.info;
    if (currentInfo && bubble.source === 'inspect')
      this.director.refresh(currentInfo);
    const info = currentInfo ? bubble.info : undefined;
    if (!position || !info) {
      this.element.hidden = true;
      return;
    }
    const key = JSON.stringify(info);
    if (key !== this.content) {
      this.content = key;
      for (const [selector, value] of [
        ['.bubble-name', info.name],
        ['.bubble-description', info.description],
        ['.bubble-feeling', info.feeling],
      ]) {
        const field = this.element.querySelector<HTMLElement>(selector!)!;
        field.textContent = value ?? '';
        field.hidden = !value;
      }
    }
    this.element.hidden = false;
    this.element.dataset.source = bubble.source;
    const width = this.element.offsetWidth,
      height = this.element.offsetHeight;
    const x = Math.max(
      6 + width / 2,
      Math.min(this.container.clientWidth - width / 2 - 6, position.x),
    );
    const y = Math.max(4, position.y - height - 12);
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
    this.element.style.setProperty(
      '--bubble-tail',
      `${Math.max(12, Math.min(width - 12, position.x - x + width / 2))}px`,
    );
    this.element.dataset.anchorX = String(position.x);
    this.element.dataset.anchorY = String(position.y);
  }
}
