import type { World } from './world';
type Finger = { x: number; y: number };
/** Two fingers always navigate. A surviving finger never becomes a build click. */
export class BuildTouchNavigation {
  private fingers = new Map<number, Finger>();
  private navigating = false;
  private transferring = false;
  private cameraTap?: { id: number; x: number; y: number; moved: boolean };
  constructor(
    private world: World,
    active: () => boolean,
    cameraTool: () => boolean,
    suspend: () => void,
    tap: (x: number, y: number) => void,
  ) {
    const canvas = world.buildCanvas;
    const consume = (e: PointerEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (
          !active() ||
          e.pointerType !== 'touch' ||
          document.querySelector('[role="dialog"]')
        )
          return;
        if (
          e.target !== canvas &&
          !(e.target as Element).closest('[data-prefab] .catalogue-image')
        )
          return;
        this.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.fingers.size > 1) this.cameraTap = undefined;
        else if (cameraTool() && !this.navigating)
          this.cameraTap = {
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            moved: false,
          };
        if (this.fingers.size >= 2 || this.navigating || cameraTool()) {
          if (!this.navigating) {
            this.transferring = true;
            suspend();
            this.navigating = true;
            for (const id of this.fingers.keys()) canvas.setPointerCapture(id);
            this.transferring = false;
          } else canvas.setPointerCapture(e.pointerId);
          consume(e);
        }
      },
      { capture: true },
    );
    document.addEventListener(
      'pointermove',
      (e) => {
        const before = this.fingers.get(e.pointerId);
        if (!before) return;
        if (this.cameraTap)
          this.cameraTap.moved ||=
            Math.hypot(
              e.clientX - this.cameraTap.x,
              e.clientY - this.cameraTap.y,
            ) > 8;
        const previous = this.pair();
        this.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (!this.navigating) return;
        consume(e);
        const next = this.pair();
        if (previous && next) {
          const angle = Math.atan2(
            Math.sin(next.angle - previous.angle),
            Math.cos(next.angle - previous.angle),
          );
          world.gestureClinicCamera(
            next.x - previous.x,
            next.y - previous.y,
            next.span / previous.span,
            angle,
          );
        } else if (cameraTool() && this.fingers.size === 1) {
          const scale = (2 * Math.PI) / canvas.clientHeight;
          world.gestureClinicCamera(
            0,
            0,
            1,
            (e.clientX - before.x) * scale,
            (e.clientY - before.y) * scale,
          );
        }
      },
      { capture: true },
    );
    const end = (e: PointerEvent) => {
      if (!this.fingers.has(e.pointerId)) return;
      const owned = this.navigating;
      this.fingers.delete(e.pointerId);
      if (!this.fingers.size) this.navigating = false;
      if (owned) {
        consume(e);
        if (
          e.type === 'pointerup' &&
          this.cameraTap?.id === e.pointerId &&
          !this.cameraTap.moved
        )
          tap(e.clientX, e.clientY);
        this.cameraTap = undefined;
        if (canvas.hasPointerCapture(e.pointerId))
          canvas.releasePointerCapture(e.pointerId);
      }
    };
    document.addEventListener('pointerup', end, { capture: true });
    document.addEventListener('pointercancel', end, { capture: true });
    canvas.addEventListener('lostpointercapture', (e) => {
      if (
        !this.transferring &&
        this.navigating &&
        this.fingers.has(e.pointerId) &&
        !canvas.hasPointerCapture(e.pointerId)
      )
        this.reset();
    });
    window.addEventListener('blur', () => {
      if (active()) suspend();
      this.reset();
    });
  }
  private pair() {
    const [a, b] = [...this.fingers.values()];
    if (!a || !b) return;
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      span: Math.max(16, Math.hypot(b.x - a.x, b.y - a.y)),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }
  reset() {
    const ids = [...this.fingers.keys()];
    this.fingers.clear();
    this.navigating = false;
    this.cameraTap = undefined;
    for (const id of ids)
      if (this.world.buildCanvas.hasPointerCapture(id))
        this.world.buildCanvas.releasePointerCapture(id);
  }
}
