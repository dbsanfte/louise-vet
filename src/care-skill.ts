import type { Tool, Zone } from './game.ts';
import {
  bandageEnd,
  bandageFraction,
  bandagePoint,
  projectBandage,
  type TracePoint,
} from './bandage-pattern.ts';
export const careSkills = {
  cream: {
    kind: 'spread',
    title: 'A soft, even layer',
    hint: 'Spread cream over every patch. Drag across them, or tap each patch.',
    action: 'Spread cream',
  },
  bandage: {
    kind: 'wrap',
    title: 'Wrap a cosy bandage',
    hint: 'Drag the roll along the dotted ribbon through numbers 1–7. Make three wraps. Lift to pause; arrow keys work too.',
    action: 'Wrap bandage',
  },
  comb: {
    kind: 'comb',
    title: 'Follow the fur',
    hint: 'Comb along the arrow to lift the fleas. Return the comb, then make the next stroke.',
    action: 'Move the comb',
  },
  brush: {
    kind: 'brush',
    title: 'Little brushing strokes',
    hint: 'Brush back and forth. Two small strokes clean each storybook tooth.',
    action: 'Move the brush',
  },
  drops: {
    kind: 'aim',
    title: 'One little drop at a time',
    hint: 'Line the nozzle up with the striped guide, then release a drop. Follow the guide for three drops.',
    action: 'Release a drop',
  },
  forceps: {
    kind: 'pull',
    title: 'Grip, then ease it out',
    hint: 'Grip the splinter. Slide to each striped mark and pause there before pulling a little further.',
    action: 'Grip splinter',
  },
  cooling: {
    kind: 'steady',
    title: 'Keep the cool pad steady',
    hint: 'Drag the blue ice pack to follow the striped guide. You can also use the slider below. Keep it lined up to help your pet relax.',
    action: 'Move the cool pad',
  },
  vaccine: {
    kind: 'pressure',
    title: 'A gentle vaccine',
    hint: 'Tap Give vaccine to begin. Tap Pause vaccine when the pressure reaches the striped green patch.',
    action: 'Give vaccine',
  },
  'water-care': {
    kind: 'pour',
    title: 'A careful water pour',
    hint: 'Start pouring, then stop near the striped fill line. Let the last trickle settle.',
    action: 'Start pouring',
  },
} as const;
export type CareTool = keyof typeof careSkills;
export const isCareTool = (tool: Tool): tool is CareTool => tool in careSkills;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
/** Storybook hand-skill rules, independent of the scene, DOM and wall clock. */
export class CareSkill {
  readonly spec;
  started = false;
  complete = false;
  stage = 0;
  value = 0;
  elapsed = 0;
  stable = 0;
  holding = false;
  gripped = false;
  engaged = false;
  misses = 0;
  accuracyLoss = 0;
  covered = new Set<number>();
  wrapProgress = 0;
  wrapPosition = bandagePoint(0);
  wrapping = false;
  message = 'Read the instructions, then start when you are ready.';
  private outside = false;
  private flow = 0;
  readonly tool: CareTool;
  readonly assisted: boolean;
  readonly surface: 'teeth' | 'fur';
  constructor(tool: CareTool, assisted = false, zone: Zone = 'mouth') {
    this.tool = tool;
    this.assisted = assisted;
    this.surface = zone === 'mouth' ? 'teeth' : 'fur';
    this.spec =
      tool === 'brush' && this.surface === 'fur'
        ? {
            ...careSkills.brush,
            title: 'Smooth the little tangles',
            hint: 'Brush back and forth with little strokes. Two gentle passes smooth each tangle.',
          }
        : careSkills[tool];
    if (['aim', 'steady'].includes(this.spec.kind)) this.value = 0.5;
    if (this.spec.kind === 'pour') this.value = 0.1;
  }
  get tolerance() {
    return this.assisted ? 0.14 : 0.09;
  }
  get wrapTolerance() {
    return this.assisted ? 0.07 : 0.05;
  }
  get target() {
    if (this.spec.kind === 'aim')
      return [0.25, 0.75, 0.4][Math.min(this.stage, 2)];
    if (this.spec.kind === 'pull')
      return [0.25, 0.5, 0.8][Math.min(this.stage, 2)];
    if (this.spec.kind === 'steady')
      return 0.5 + Math.sin(this.elapsed * 1.05) * 0.28;
    return this.spec.kind === 'pour' ? 0.65 : 0.5;
  }
  get progress() {
    if (this.complete) return 1;
    switch (this.spec.kind) {
      case 'spread':
        return this.covered.size / 6;
      case 'wrap':
        return bandageFraction(this.wrapProgress);
      case 'comb':
      case 'brush':
        return this.stage / 6;
      case 'aim':
      case 'pull':
        return this.stage / 3;
      case 'steady':
        return this.stable / 4;
      default:
        return this.value;
    }
  }
  start() {
    if (!this.started) {
      this.started = true;
      this.message =
        this.spec.kind === 'wrap'
          ? 'Start at the bandage roll. Follow the next number.'
          : this.spec.hint;
    }
  }
  private miss(message: string) {
    this.misses++;
    this.message = message;
  }
  private finish() {
    this.complete = true;
    this.holding = false;
    this.wrapping = false;
    this.message = 'Lovely, gentle work! Finish care when you are ready.';
  }
  beginWrap(point: TracePoint) {
    if (
      this.spec.kind !== 'wrap' ||
      !this.started ||
      this.complete ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y)
    )
      return false;
    const roll = bandagePoint(this.wrapProgress);
    if (Math.hypot(point.x - roll.x, point.y - roll.y) > 0.1) {
      this.message =
        'Start at the bandage roll, then follow the dotted ribbon.';
      return false;
    }
    this.wrapPosition = roll;
    this.wrapping = true;
    this.message = 'Follow the ribbon to the next number. Take your time.';
    return true;
  }
  traceWrap(point: TracePoint) {
    if (
      !this.wrapping ||
      this.complete ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y)
    )
      return;
    const from = this.wrapPosition;
    // Check the whole stroke, including between sparse pointer events. Cutting
    // across the paw or teleporting to a later number cannot complete a wrap.
    const steps = Math.min(
      300,
      Math.max(
        1,
        Math.ceil(Math.hypot(point.x - from.x, point.y - from.y) / 0.008),
      ),
    );
    for (let i = 1; i <= steps; i++) {
      const sample = {
        x: from.x + ((point.x - from.x) * i) / steps,
        y: from.y + ((point.y - from.y) * i) / steps,
      };
      const projected = projectBandage(sample, this.wrapProgress);
      if (projected.distance > this.wrapTolerance) {
        this.wrapProgress = Math.floor(this.wrapProgress / 16) * 16;
        this.stage = this.wrapProgress / 16;
        this.releaseWrap();
        this.miss(
          'Oops, stay on the dotted ribbon. Try from the roll again; finished sections are safe.',
        );
        return;
      }
      this.wrapProgress = projected.progress;
      this.stage = Math.floor(this.wrapProgress / 16);
    }
    this.wrapPosition = point;
    if (this.wrapProgress >= bandageEnd - 0.01) {
      this.wrapProgress = bandageEnd;
      this.stage = 6;
      this.wrapPosition = bandagePoint(bandageEnd);
      this.finish();
    }
  }
  releaseWrap() {
    this.wrapping = false;
    this.wrapPosition = bandagePoint(this.wrapProgress);
  }
  input(value: number) {
    if (!this.started || this.complete || !Number.isFinite(value)) return;
    const kind = this.spec.kind;
    if (!['comb', 'brush', 'aim', 'pull', 'steady'].includes(kind)) return;
    if (kind === 'pull' && !this.gripped) return;
    this.value = clamp(value);
    this.engaged = true;
    if (kind === 'comb' || kind === 'brush') {
      const end = this.stage % 2 ? 0 : 1;
      if (Math.abs(this.value - end) < 0.04) {
        this.stage++;
        this.message =
          kind === 'comb'
            ? this.stage % 2
              ? 'Fleas lifted! Return the comb to the start.'
              : 'Ready for the next gentle stroke.'
            : 'Good brushing! Follow the next arrow.';
        if (this.stage === 6) this.finish();
      }
    }
  }
  act(cell?: number) {
    if (!this.started || this.complete) return;
    switch (this.spec.kind) {
      case 'spread':
        if (
          cell === undefined ||
          !Number.isInteger(cell) ||
          cell < 0 ||
          cell > 5
        )
          return;
        this.covered.add(cell);
        this.message = `${this.covered.size} of 6 patches covered.`;
        if (this.covered.size === 6) this.finish();
        break;
      case 'wrap':
        // Wrapping needs an actual traced stroke, never individual clicks.
        break;
      case 'aim':
        if (Math.abs(this.value - this.target) > this.tolerance) {
          this.miss('Line the nozzle up first. No drop released yet.');
          return;
        }
        this.stage++;
        if (this.stage === 3) this.finish();
        else this.message = 'A tiny drop! Line up with the next guide.';
        break;
      case 'pull':
        this.gripped = true;
        this.message = 'Got it! Ease the slider to the first mark and pause.';
        break;
      case 'pressure':
        if (this.holding) {
          this.holding = false;
          if (Math.abs(this.value - this.target) <= this.tolerance) {
            this.accuracyLoss = Math.round(
              Math.abs(this.value - this.target) * 20,
            );
            this.finish();
          } else {
            this.value = 0;
            this.miss(
              'Pause and try again in the striped patch. No vaccine given and no injury.',
            );
          }
        } else {
          this.holding = true;
          this.message =
            'A gentle press… tap Pause vaccine in the striped patch.';
        }
        break;
      case 'pour':
        this.holding = !this.holding;
        this.stable = 0;
        this.message = this.holding
          ? 'Watch the fill line. You can stop and resume.'
          : 'Let the trickle settle. Add a little more if needed.';
        break;
    }
  }
  update(dt: number) {
    if (!this.started || this.complete || !Number.isFinite(dt) || dt <= 0)
      return;
    dt = Math.min(dt, 0.1);
    this.elapsed += dt;
    const kind = this.spec.kind;
    if (kind === 'pressure' && this.holding) {
      this.value += dt * 0.29;
      if (this.value > 0.9) {
        this.value = 0;
        this.holding = false;
        this.miss(
          'Time for a fresh try. Pause in the striped patch; your pet is safe.',
        );
      }
    }
    if (kind === 'pour') {
      this.flow = this.holding ? 0.28 : Math.max(0, this.flow - dt * 0.8);
      this.value += this.flow * dt;
      if (this.value > this.target + this.tolerance) {
        this.value = 0.1;
        this.holding = false;
        this.flow = 0;
        this.miss(
          'A little too full. Try a smaller pour in the practice bowl.',
        );
      } else if (
        !this.holding &&
        this.flow === 0 &&
        this.value >= this.target - this.tolerance
      ) {
        this.stable += dt;
        if (this.stable >= 0.4) this.finish();
      }
    }
    if (
      (kind === 'steady' && this.engaged) ||
      (kind === 'pull' && this.gripped)
    ) {
      const linedUp = Math.abs(this.value - this.target) <= this.tolerance;
      if (linedUp) {
        this.outside = false;
        this.stable += dt;
        if (this.stable >= (kind === 'pull' ? 0.85 : 4)) {
          if (kind === 'steady') this.finish();
          else {
            this.stage++;
            this.stable = 0;
            this.message = 'Nicely done. Move to the next mark and pause.';
            if (this.stage === 3) this.finish();
          }
        }
      } else {
        this.stable = Math.max(0, this.stable - dt * 0.5);
        // Ordinary repositioning is free; only overshooting a pull or losing a
        // previously held cooling position counts as a wobbly attempt.
        const wobbly =
          kind === 'pull'
            ? this.value > this.target + this.tolerance
            : this.stable > 0;
        if (wobbly && !this.outside) {
          this.outside = true;
          this.miss(
            'A little steadier. Bring the tool back to the striped guide.',
          );
        }
      }
    }
  }
  get qualityLoss() {
    return this.misses * 4 + this.accuracyLoss;
  }
}
