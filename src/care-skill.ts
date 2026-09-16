import type { Tool, Zone } from './game.ts';
import { FishCare } from './fish-care.ts';
import {
  bandagePattern,
  bandagePoint,
  projectBandage,
  type TracePoint,
} from './bandage-pattern.ts';
export const careSkills = {
  cream: {
    kind: 'spread',
    title: 'Soothe the sore patch',
    hint: 'Drag the cream in slow little circles over each pink patch. Watch the discomfort meter. Lift your finger to give your pet a break.',
    action: 'Spread gently',
  },
  bandage: {
    kind: 'wrap',
    title: 'Wrap this little paw',
    hint: 'Start at the roll. Follow the wide blue guide to the next number. If you drift away, return to the glowing ring. Your finished wrapping stays put. Lift to pause.',
    action: 'Wrap the paw',
  },
  comb: {
    kind: 'comb',
    title: 'Catch the itchy visitors',
    hint: 'Brush the comb over the little fleas as they hop around the fur. Catch all six. Keep your eyes on the ones that jump!',
    action: 'Comb and catch',
  },
  brush: {
    kind: 'brush',
    title: 'Little cleaning circles',
    hint: 'Drag the brush in small, gentle circles over each marked tooth. Clean every patch without scrubbing too fast.',
    action: 'Brush gently',
  },
  drops: {
    kind: 'aim',
    title: 'Aim above the ear',
    hint: 'Drag the dropper tip onto the ring above the ear. Hold it steady until the ring fills, then release a storybook drop. Place three drops.',
    action: 'Release a drop',
  },
  forceps: {
    kind: 'pull',
    title: 'Ease the splinter out',
    hint: 'Place the forceps on the splinter and grip it. Drag slowly along the dotted line. Pause at each mark. Pulling sideways or too fast makes the paw uncomfortable.',
    action: 'Grip splinter',
  },
  cooling: {
    kind: 'steady',
    title: 'A cool, comfortable patch',
    hint: 'Drag the pad onto the warm patch and hold it lightly. Follow the small movements as your pet breathes. Lift to pause.',
    action: 'Hold the pad',
  },
  vaccine: {
    kind: 'pressure',
    title: 'A gentle vaccine',
    hint: 'Aim at the marked fur patch and hold steady. Then ease the plunger into the striped pressure range and keep it there. Too much pressure startles your pet.',
    action: 'Begin gentle press',
  },
  'water-care': {
    kind: 'timing',
    title: 'Watch the swimming fish',
    hint: 'Watch the fish swim away from the ring. Tap the bowl to release one drop, then wait for it to land. Add five drops without splashing the fish.',
    action: 'Release a water drop',
  },
} as const;
export type CareTool = keyof typeof careSkills;
export const isCareTool = (tool: Tool): tool is CareTool => tool in careSkills;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const distance = (a: TracePoint, b: TracePoint) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export const carePatches: readonly TracePoint[] = [
  { x: 0.32, y: 0.38 },
  { x: 0.5, y: 0.38 },
  { x: 0.68, y: 0.38 },
  { x: 0.32, y: 0.62 },
  { x: 0.5, y: 0.62 },
  { x: 0.68, y: 0.62 },
];
/** Fictional care interactions; seconds and normalized positions, never medical doses. */
export class CareSkill {
  readonly spec;
  readonly surface: 'teeth' | 'fur';
  started = false;
  complete = false;
  startled = false;
  stage = 0;
  value = 0;
  elapsed = 0;
  stable = 0;
  holding = false;
  gripped = false;
  engaged = false;
  misses = 0;
  pain = 0;
  covered = new Set<number>();
  coverage = Array(6).fill(0) as number[];
  position: TracePoint = { x: 0.5, y: 0.5 };
  wrapPath = [...bandagePattern];
  wrapProgress = 0;
  wrapping = false;
  wrapRecovering = false;
  wrapPosition = bandagePoint(0);
  private wrapScale: TracePoint = { x: 1, y: 1 };
  private wrapPixels = Infinity;
  message =
    'Take your time reading. Touch the tool or use the arrow keys or Space to begin.';
  private movement = 0;
  private movementAge = 0;
  private pressure = 0.5;
  private dose = 0;
  readonly fishCare?: FishCare;
  readonly tool: CareTool;
  readonly assisted: boolean;
  readonly zone: Zone;
  constructor(tool: CareTool, assisted = false, zone: Zone = 'mouth') {
    this.tool = tool;
    if (tool === 'water-care') {
      this.fishCare = new FishCare();
      this.message =
        'Take your time reading. Tap the bowl or press Space when you are ready for the first drop.';
    }
    this.assisted = assisted;
    this.zone = zone;
    this.surface = zone === 'mouth' ? 'teeth' : 'fur';
    this.spec =
      tool === 'brush' && this.surface === 'fur'
        ? {
            ...careSkills.brush,
            title: 'Untangle the soft fur',
            hint: 'Use small, slow brushing circles on each tangle. Lift and rest if your pet feels uncomfortable.',
          }
        : careSkills[tool];
  }
  get tolerance() {
    return this.assisted ? 0.115 : 0.08;
  }
  get wrapTolerance() {
    return Math.max(this.assisted ? 0.1 : 0.075, 12 / this.wrapPixels);
  }
  private wrapDistance(a: TracePoint, b: TracePoint) {
    return Math.hypot(
      (a.x - b.x) * this.wrapScale.x,
      (a.y - b.y) * this.wrapScale.y,
    );
  }
  get targetPoint(): TracePoint {
    if (this.spec.kind === 'pull') {
      const t = this.gripped ? Math.min(1, (this.stage + 1) / 3) : 0;
      return { x: 0.35 + t * 0.35, y: 0.65 - t * 0.38 };
    }
    if (this.spec.kind === 'steady')
      return {
        x: 0.5 + Math.sin(this.elapsed * 0.85) * 0.12,
        y: 0.5 + Math.cos(this.elapsed * 0.7) * 0.055,
      };
    if (this.spec.kind === 'aim')
      return { x: 0.5 + Math.sin(this.elapsed * 0.7) * 0.055, y: 0.43 };
    if (this.spec.kind === 'wrap')
      return bandagePoint(Math.min(96, this.wrapProgress + 3), this.wrapPath);
    return { x: 0.5, y: 0.5 };
  }
  get progress() {
    if (this.complete) return 1;
    switch (this.spec.kind) {
      case 'spread':
        return this.coverage.reduce((a, b) => a + b, 0) / 6;
      case 'comb':
        return this.covered.size / 6;
      case 'brush':
        return this.coverage.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
      case 'wrap':
        return this.wrapProgress / 96;
      case 'aim':
      case 'pull':
        return this.stage / 3;
      case 'steady':
        return this.stable / 4;
      case 'pressure':
        return this.dose / 3;
      case 'timing':
        return this.fishCare!.drops / 5;
    }
  }
  patchPoint(i: number) {
    const p = carePatches[i];
    return this.tool === 'cream' && this.zone === 'paw'
      ? { x: 0.5 + (p.x - 0.5) * 0.55, y: 0.5 + (p.y - 0.5) * 0.55 }
      : p;
  }
  fleaPosition(i: number) {
    const cycle = (this.elapsed * 0.55 + i * 0.17) % 1;
    const hop = cycle > 0.62 ? Math.sin(((cycle - 0.62) / 0.38) * Math.PI) : 0;
    return {
      x: 0.25 + (i % 3) * 0.24 + Math.sin(this.elapsed * 0.9 + i * 2) * 0.07,
      y: 0.43 + Math.floor(i / 3) * 0.22 - hop * 0.17,
      hop,
    };
  }
  start() {
    if (!this.started) {
      this.started = true;
      this.message = this.spec.hint;
    }
  }
  restart() {
    if (!this.startled) return;
    this.startled = false;
    this.pain = 0;
    this.stage = 0;
    this.stable = 0;
    this.value = 0;
    this.dose = 0;
    this.covered.clear();
    this.coverage.fill(0);
    this.gripped = false;
    this.holding = false;
    this.movement = 0;
    this.movementAge = 0;
    this.message =
      'Your pet has settled. Try again with a lighter, slower touch.';
  }
  private finish() {
    this.complete = true;
    this.holding = false;
    this.wrapping = false;
    this.value = 0;
    this.message =
      'Care complete. Your pet is comfortable. Finish care when you are ready.';
  }
  private discomfort(amount: number) {
    this.pain = clamp(this.pain + amount);
    if (this.pain >= 1 && !this.startled) {
      this.misses++;
      this.startled = true;
      this.holding = false;
      this.gripped = false;
      this.value = 0;
      this.message =
        'That startled your pet. Let them settle, then try a gentler touch.';
    } else if (this.pain > 0.6)
      this.message =
        'A little too sore. Slow down or lift your tool for a break.';
  }
  press(point: TracePoint, pressure = 0.5) {
    if (
      !this.started ||
      this.complete ||
      this.startled ||
      !Number.isFinite(point.x + point.y)
    )
      return;
    if (this.fishCare) {
      this.fishCare.drop();
      this.engaged = true;
      return;
    }
    this.position = { ...point };
    this.holding = true;
    this.engaged = true;
    this.pressure = pressure > 0 ? clamp(pressure) : 0.5;
    this.movement = 0;
    this.movementAge = 0;
  }
  move(point: TracePoint, pressure = 0.5) {
    if (
      !this.started ||
      this.complete ||
      this.startled ||
      !Number.isFinite(point.x + point.y)
    )
      return;
    if (this.fishCare) return;
    if (this.holding) this.movement += distance(this.position, point);
    this.position = { ...point };
    this.pressure = pressure > 0 ? clamp(pressure) : 0.5;
  }
  release() {
    this.holding = false;
    this.movement = 0;
    this.movementAge = 0;
    this.value = 0;
    this.releaseWrap();
  }
  /** The vaccine pressure slider is shared by pointer and keyboard controls. */
  input(value: number) {
    if (
      !this.started ||
      this.complete ||
      this.startled ||
      !Number.isFinite(value)
    )
      return;
    if (this.spec.kind !== 'pressure') return;
    this.value = clamp(value);
    this.engaged = true;
  }
  act() {
    if (!this.started || this.complete || this.startled) return;
    if (this.spec.kind === 'aim') {
      if (
        distance(this.position, this.targetPoint) > this.tolerance ||
        this.stable < 0.45
      ) {
        this.message = 'Hold the dropper over the ring until it fills.';
        return;
      }
      this.stage++;
      this.stable = 0;
      this.message = 'A gentle drop. Hold steady for the next one.';
      if (this.stage === 3) this.finish();
    } else if (this.spec.kind === 'pull' || this.spec.kind === 'pressure') {
      if (
        distance(this.position, this.targetPoint) > this.tolerance ||
        (this.spec.kind === 'pressure' && this.stable < 0.4)
      ) {
        this.message = 'Aim at the marked spot and hold steady first.';
        return;
      }
      this.gripped = true;
      this.stable = 0;
      this.message =
        this.spec.kind === 'pull'
          ? 'Grip held. Follow the dotted line slowly; pause at each mark.'
          : 'Ready. Ease the plunger into the striped range.';
    }
  }
  setWrapPath(path: TracePoint[], width?: number, height?: number) {
    this.wrapPath = path;
    if (width && height) {
      this.wrapPixels = Math.min(width, height);
      this.wrapScale = {
        x: width / this.wrapPixels,
        y: height / this.wrapPixels,
      };
    }
    this.wrapPosition = bandagePoint(this.wrapProgress, path);
  }
  beginWrap(point: TracePoint) {
    if (
      this.spec.kind !== 'wrap' ||
      !this.started ||
      this.complete ||
      !Number.isFinite(point.x + point.y)
    )
      return false;
    const roll = bandagePoint(this.wrapProgress, this.wrapPath);
    if (this.wrapDistance(point, roll) > this.wrapTolerance * 1.3) {
      this.message = 'Start at the glowing ring, then follow the blue guide.';
      return false;
    }
    this.wrapping = true;
    this.wrapRecovering = false;
    this.wrapPosition = roll;
    this.message =
      'Follow the blue guide to the next number. Lift whenever you need a break.';
    return true;
  }
  traceWrap(point: TracePoint) {
    if (!this.wrapping || this.complete || !Number.isFinite(point.x + point.y))
      return;
    if (this.wrapRecovering) {
      // Rejoining never draws a shortcut from the off-path pointer to a later coil.
      const roll = bandagePoint(this.wrapProgress, this.wrapPath);
      this.wrapPosition = point;
      if (this.wrapDistance(point, roll) <= this.wrapTolerance) {
        this.wrapRecovering = false;
        this.wrapPosition = roll;
        this.message = 'Back on track! Follow the blue guide.';
      }
      return;
    }
    const previousProgress = this.wrapProgress,
      from = this.wrapPosition,
      steps = Math.min(
        300,
        Math.max(1, Math.ceil(this.wrapDistance(point, from) / 0.008)),
      );
    for (let i = 1; i <= steps; i++) {
      const p = {
        x: from.x + ((point.x - from.x) * i) / steps,
        y: from.y + ((point.y - from.y) * i) / steps,
      };
      const projected = projectBandage(
        p,
        this.wrapProgress,
        this.wrapPath,
        this.wrapScale,
      );
      if (projected.distance > this.wrapTolerance) {
        this.wrapProgress = previousProgress;
        this.stage = Math.floor(previousProgress / 16);
        this.wrapRecovering = true;
        this.wrapPosition = point;
        this.misses++;
        this.message =
          'Your wrapping is safe. Move back to the glowing ring to carry on.';
        return;
      }
      this.wrapProgress = projected.progress;
      this.stage = Math.floor(this.wrapProgress / 16);
    }
    this.wrapPosition = point;
    if (
      this.wrapProgress >= 80 &&
      this.wrapDistance(point, this.wrapPath[96]) <= this.wrapTolerance
    ) {
      // Finish within the visible lane, rather than requiring a sub-pixel endpoint.
      // Measure the remaining curve too, so approaching across a coil cannot skip it.
      let remaining = 0,
        last = bandagePoint(this.wrapProgress, this.wrapPath);
      for (const p of this.wrapPath.slice(Math.floor(this.wrapProgress) + 1)) {
        remaining += this.wrapDistance(last, p);
        last = p;
      }
      if (remaining > this.wrapTolerance) return;
      this.wrapProgress = 96;
      this.stage = 6;
      this.finish();
    }
  }
  releaseWrap() {
    this.wrapping = false;
    this.wrapRecovering = false;
    this.wrapPosition = bandagePoint(this.wrapProgress, this.wrapPath);
  }
  update(dt: number) {
    if (
      !this.started ||
      this.complete ||
      this.startled ||
      !Number.isFinite(dt) ||
      dt <= 0
    )
      return;
    dt = Math.min(dt, 0.1);
    this.elapsed += dt;
    this.movementAge = Math.min(0.15, this.movementAge + dt);
    const speed = this.movement / this.movementAge,
      kind = this.spec.kind,
      near = distance(this.position, this.targetPoint) <= this.tolerance;
    const moving = this.movement > 0.0002;
    if (!this.holding && this.value === 0)
      this.pain = Math.max(0, this.pain - dt * 0.3);
    if (kind === 'spread' || kind === 'brush') {
      if (this.holding && moving) {
        if (speed > 1.15 || this.pressure > 0.82)
          this.discomfort(dt * (0.45 + Math.max(0, speed - 1.15) * 0.4));
        else {
          const patches =
            kind === 'spread'
              ? carePatches.map((_, i) => this.patchPoint(i))
              : [this.patchPoint(0), this.patchPoint(1), this.patchPoint(2)];
          const nearest = patches
            .map((p, i) => ({ i, distance: distance(p, this.position) }))
            .filter((p) => !this.covered.has(p.i) && p.distance < 0.08)
            .sort((a, b) => a.distance - b.distance)[0];
          const index = nearest?.i ?? -1;
          if (index >= 0) {
            this.coverage[index] = clamp(
              this.coverage[index] + this.movement / 0.12,
            );
            if (this.coverage[index] >= 1) this.covered.add(index);
          }
          this.pain = Math.max(0, this.pain - dt * 0.07);
          if (patches.every((_, i) => this.coverage[i] >= 1)) this.finish();
        }
      }
    } else if (kind === 'comb' && this.holding && moving) {
      for (let i = 0; i < 6; i++)
        if (
          !this.covered.has(i) &&
          distance(this.position, this.fleaPosition(i)) < this.tolerance
        ) {
          this.covered.add(i);
          this.message = `Caught ${this.covered.size} of 6 fleas. Watch for the next hop!`;
        }
      if (this.covered.size === 6) this.finish();
    } else if (
      kind === 'aim' ||
      kind === 'steady' ||
      (kind === 'pressure' && !this.gripped)
    ) {
      if (near && this.engaged) {
        if (kind === 'steady' && (!this.holding || this.pressure > 0.8)) {
          if (this.holding) this.discomfort(dt * 0.6);
        } else {
          this.stable += dt;
          if (kind === 'steady' && this.stable >= 4) this.finish();
        }
      } else this.stable = Math.max(0, this.stable - dt);
    } else if (kind === 'pull' && this.gripped && this.holding) {
      const a = { x: 0.35, y: 0.65 },
        b = { x: 0.7, y: 0.27 },
        dx = b.x - a.x,
        dy = b.y - a.y;
      const projection =
        ((this.position.x - a.x) * dx + (this.position.y - a.y) * dy) /
        (dx * dx + dy * dy);
      const lateral = distance(this.position, {
        x: a.x + dx * projection,
        y: a.y + dy * projection,
      });
      if (
        lateral > this.tolerance ||
        speed > 0.75 ||
        projection > (this.stage + 1) / 3 + 0.16
      )
        this.discomfort(dt * 0.8 + Math.max(0, speed - 0.75) * dt * 0.4);
      else if (near) {
        this.stable += dt;
        if (this.stable >= 0.5) {
          this.stage++;
          this.stable = 0;
          this.message = 'Nicely done. Ease along to the next mark.';
          if (this.stage === 3) this.finish();
        }
      }
    } else if (kind === 'pressure' && this.gripped) {
      if (this.value > 0.72) this.discomfort(dt * (this.value - 0.65) * 3);
      else if (this.value >= 0.32 && this.value <= 0.62 && near) {
        this.dose += dt;
        if (this.dose >= 3) this.finish();
      } else if (this.value > 0)
        this.message = 'Keep the plunger in the striped gentle-pressure range.';
    } else if (kind === 'timing') {
      const fish = this.fishCare!,
        before = fish.drops,
        misses = fish.misses;
      fish.update(dt);
      if (fish.misses > misses) {
        this.misses++;
        this.message =
          'Oops, the fish swam under that drop! Your fish is fine. Wait until the ring is clear and try again.';
      } else if (fish.drops > before) {
        this.message = `${fish.drops}/5 gentle drops. Watch where your fish swims next.`;
        if (fish.drops === 5) this.finish();
      }
    }

    if (moving) this.movementAge = 0;
    this.movement = 0;
  }
  get qualityLoss() {
    return this.misses * 4;
  }
}
