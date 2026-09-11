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
  private anchors = new WeakMap<
    THREE.Object3D,
    {
      head: { object: THREE.Object3D; point: THREE.Vector3 };
      mouth: { object: THREE.Object3D; point: THREE.Vector3 };
    }
  >();
  private content = '';
  private candidates: BubbleCandidate<THREE.Object3D>[] = [];
  private checkedAt = -Infinity;
  private camera?: THREE.Camera;
  constructor(private container: HTMLElement) {
    this.element.className = 'world-bubble';
    this.element.hidden = true;
    this.element.setAttribute('role', 'status');
    this.element.setAttribute('aria-label', 'Character information');
    this.element.innerHTML = `<svg class="bubble-cloud" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M12 80 C0 81 -1 58 6 48 C-2 32 6 14 19 17 C22 1 37 -2 47 7 C58 -3 76 1 79 15 C94 9 104 30 95 43 C106 56 101 77 89 80 C88 96 70 103 59 94 C47 105 31 101 27 92 C16 98 8 91 12 80 Z"/></svg>
      <svg class="bubble-link" aria-hidden="true"><path/><circle r="4.5"/><circle r="3"/><circle r="1.7"/></svg>
      <strong class="bubble-name"></strong><span class="bubble-description"></span><span class="bubble-feeling"></span>`;
    container.append(this.element);
  }
  clear() {
    this.director.clear(performance.now());
    this.element.hidden = true;
  }
  inspect(target: THREE.Object3D, info: ClinicInfo) {
    this.director.inspect(target, info, performance.now());
  }
  private project(
    target: THREE.Object3D,
    camera: THREE.Camera,
    kind: 'head' | 'mouth' = 'head',
  ) {
    for (let p: THREE.Object3D | null = target; p; p = p.parent)
      if (!p.visible) return undefined;
    let anchors = this.anchors.get(target);
    if (!anchors) {
      target.updateWorldMatrix(true, true);
      let head: THREE.Object3D | undefined, mouth: THREE.Object3D | undefined;
      target.traverse((part) => {
        if (!head && part.name.startsWith('head_joint')) head = part;
        if (!mouth && /smile|mouth|beak/.test(part.name)) mouth = part;
      });
      const above = head ?? target;
      this.box.setFromObject(above);
      if (this.box.isEmpty()) this.box.setFromObject(target);
      const top = this.box.getCenter(new THREE.Vector3());
      top.y = this.box.max.y + 0.08;
      const lips = this.box.getCenter(new THREE.Vector3());
      lips.y -= (this.box.max.y - this.box.min.y) * 0.22;
      if (mouth) {
        this.box.setFromObject(mouth);
        if (this.box.isEmpty()) mouth.getWorldPosition(lips);
        else this.box.getCenter(lips);
      }
      anchors = {
        head: { object: above, point: above.worldToLocal(top) },
        mouth: {
          object: mouth ?? above,
          point: (mouth ?? above).worldToLocal(lips),
        },
      };
      this.anchors.set(target, anchors);
    }
    const anchor = anchors[kind];
    this.point.copy(anchor.point);
    anchor.object.localToWorld(this.point);
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
    const kind = info.bubble ?? (info.feeling ? 'speech' : 'label');
    this.element.dataset.kind = kind;
    this.element.setAttribute(
      'aria-label',
      `${info.name}${kind === 'thought' ? ' thinks' : kind === 'speech' ? ' says' : ' information'}`,
    );
    this.element.hidden = false;
    this.element.dataset.source = bubble.source;
    const width = this.element.offsetWidth,
      height = this.element.offsetHeight;
    const x = Math.max(
      6 + width / 2,
      Math.min(this.container.clientWidth - width / 2 - 6, position.x),
    );
    const y = Math.max(4, position.y - height - 25);
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
    const tip =
      kind === 'speech'
        ? this.project(bubble.target, camera, 'mouth')
        : position;
    const link = this.element.querySelector<SVGSVGElement>('.bubble-link')!;
    const tx = tip ? tip.x - x + width / 2 : 0,
      ty = tip ? tip.y - y : 0;
    // On a very short/cropped viewport the bubble may occupy the head's pixel;
    // do not draw a pointer back through the text.
    link.style.display =
      kind === 'label' || !tip || ty < height + 4 ? 'none' : '';
    const attach = Math.max(20, Math.min(width - 20, tx - 14));
    link
      .querySelector('path')!
      .setAttribute(
        'd',
        `M ${attach - 7} ${height - 2} L ${tx} ${ty} L ${attach + 8} ${height - 2}`,
      );
    link.querySelectorAll('circle').forEach((circle, i) => {
      const t = (i + 1) / 3.4;
      circle.setAttribute('cx', String(attach + (tx - attach) * t));
      circle.setAttribute('cy', String(height + 3 + (ty - height - 3) * t));
    });
    this.element.dataset.tipX = String(tip?.x ?? position.x);
    this.element.dataset.tipY = String(tip?.y ?? position.y);
    this.element.dataset.anchorX = String(position.x);
    this.element.dataset.anchorY = String(position.y);
  }
}
