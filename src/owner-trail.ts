import { distance, type Point } from './town-map.ts';
/** Companion pets follow the owner's recent path, including doorway corners. */
export class OwnerTrail {
  private points: Point[];
  constructor(position: Point) {
    this.points = [{ ...position }];
  }
  update(position: Point) {
    const moved = distance(this.points[0], position);
    // Discontinuous restored positions must not create a shortcut across walls.
    if (moved > 3) this.points = [{ ...position }];
    else if (moved > 0.001) this.points.unshift({ ...position });
    let length = 0;
    for (let i = 1; i < this.points.length; i++) {
      length += distance(this.points[i - 1], this.points[i]);
      if (length > 3) {
        this.points.length = i + 1;
        break;
      }
    }
  }
  sample(gap: number): Point {
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1],
        b = this.points[i],
        length = distance(a, b);
      if (length >= gap)
        return {
          x: a.x + ((b.x - a.x) * gap) / length,
          z: a.z + ((b.z - a.z) * gap) / length,
        };
      gap -= length;
    }
    return { ...this.points.at(-1)! };
  }
}
