import { walkRoute } from './movement.ts';
import {
  localToTown,
  layout,
  vetHome,
  vetExam,
  examOwner,
  distance,
  type Point,
} from './town-map.ts';
import type { Household } from './town-simulation.ts';
import { townToLocal } from './clinic-leisure.ts';
const points = (...p: [number, number][]) =>
  p.map(([x, z]) => localToTown(x, z));
const walk = walkRoute;
/** One physical Louise leads one family, then walks back to reception. */
export class ClinicEscort {
  position: Point = { ...vetHome };
  facing = layout.clinic.rotation;
  phase: 'idle' | 'approach' | 'lead' | 'exam' | 'return' = 'idle';
  ticket?: number;
  household?: number;
  route: Point[] = [];
  ownerRoute: Point[] = [];
  private delay = 0;
  start(id: number, h: Household) {
    if (this.phase !== 'idle') return false;
    this.ticket = id;
    this.household = h.id;
    this.phase = 'approach';
    this.route = points([1.8, -2.75], [1.8, -0.1], [0, -0.1]);
    return true;
  }
  update(dt: number, households: Household[]) {
    if (this.phase === 'idle' || this.phase === 'exam') return;
    this.facing = walk(this.position, this.route, dt, 1.7) ?? this.facing;
    if (this.phase === 'return') {
      if (!this.route.length) {
        this.phase = 'idle';
        this.facing = layout.clinic.rotation;
      }
      return;
    }
    const h = households[this.household!];
    if (this.phase === 'approach' && !this.route.length) {
      this.phase = 'lead';
      this.delay = 0.65;
      this.route = points(
        [2.1, -0.1],
        [3.5, -0.1],
        [3.5, -4],
        [3.5, -7],
        [3.5, -8.9],
        [1.5, -8.9],
      );
      this.ownerRoute = points(
        [0, -0.1],
        [2.1, -0.1],
        [3.5, -0.1],
        [3.5, -4],
        [3.5, -6.9],
      );
    }
    if (this.phase === 'lead') {
      this.delay = Math.max(0, this.delay - dt);
      if (!this.delay)
        h.facing = walk(h.position, this.ownerRoute, dt, 1.5) ?? h.facing;
      if (!this.route.length && !this.ownerRoute.length) {
        this.phase = 'exam';
        h.facing = Math.PI;
        this.facing = layout.clinic.rotation;
      }
    }
  }
  finish() {
    if (this.phase === 'idle' || this.phase === 'return') return;
    this.ticket = undefined;
    this.household = undefined;
    this.ownerRoute = [];
    const p = townToLocal(this.position);
    this.route =
      p.z < -4
        ? points([3.5, p.z], [3.5, -4], [1.8, -2.75], [-1.3, -2.75])
        : p.z < -2.3
          ? points([-1.3, -2.75])
          : points([1.8, p.z], [1.8, -2.75], [-1.3, -2.75]);
    this.phase = 'return';
  }
  snapshot() {
    return { position: { ...this.position }, facing: this.facing };
  }
  restore(value: unknown) {
    if (value === undefined) return true;
    try {
      const s = value as ReturnType<ClinicEscort['snapshot']>,
        p = townToLocal(s.position);
      if (
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.z) ||
        p.x < -5 ||
        p.x > 5.5 ||
        p.z < -10 ||
        p.z > 4 ||
        !Number.isFinite(s.facing)
      )
        return false;
      this.position = { ...s.position };
      this.facing = s.facing;
      if (distance(this.position, vetHome) > 0.02) {
        this.phase = 'exam';
        this.finish();
      }
      return true;
    } catch {
      return false;
    }
  }
  atTable(id: number) {
    return (
      this.ticket === id &&
      this.phase === 'exam' &&
      distance(this.position, vetExam) < 0.05
    );
  }
  ownerAtTable(h: Household) {
    return distance(h.position, examOwner) < 0.05;
  }
}
