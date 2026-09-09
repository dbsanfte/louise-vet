import { clinicDoor, layout, routeBetween, type Point } from './town-map.ts';
import details from './street-details.json' with { type: 'json' };
import type { Household } from './town-simulation.ts';

// Family-sized waiting places on High Street's north pavement, leaving the door,
// crossings and street furniture clear. The outer strip remains an access lane.
export const entrancePlaces: Point[] = [];
const crossings = layout.crossings
  .flatMap(([a, b]) => [layout.nodes[a], layout.nodes[b]])
  .filter((p) => p.z === -3);
for (let x = clinicDoor.x + 1.6; entrancePlaces.length < 18; x += 2.2) {
  if (crossings.some((p) => p.x > x - 0.9 && p.x < x + 1.9)) continue;
  if (
    details.some((p) => p.z < -2 && p.z > -4 && p.x > x - 0.6 && p.x < x + 1.7)
  )
    continue;
  entrancePlaces.push({ x, z: -3.3 });
}
const lane = (p: Point): Point => ({ x: p.x, z: -2.55 });
/** Keep clinic journeys beside the waiting places; retain actual crossing ends. */
export function clinicStreetRoute(from: Point, to: Point): Point[] {
  const route = routeBetween(from, to),
    result: Point[] = [];
  route.forEach((p, i) => {
    if (p.z !== -3 || p.x < -26 || p.x > 26) {
      result.push(p);
      return;
    }
    const previous = i ? route[i - 1] : from,
      next = route[i + 1];
    if (previous.z > -3 && previous.x === p.x) result.push(p);
    result.push(lane(p));
    if (next && next.z > -3 && next.x === p.x) result.push(p);
  });
  return result;
}
export class ClinicEntrance {
  places = new Map<number, number>();
  waiting: number[] = [];
  reserve(id: number) {
    if (!this.places.has(id)) {
      const index = entrancePlaces.findIndex(
        (_, i) => ![...this.places.values()].includes(i),
      );
      if (index < 0) throw Error('No clinic entrance place available');
      this.places.set(id, index);
    }
    return entrancePlaces[this.places.get(id)!];
  }
  approach(h: Household) {
    const spot = this.reserve(h.id);
    return [...clinicStreetRoute(h.position, lane(spot)), { ...spot }];
  }
  arrive(id: number) {
    if (!this.waiting.includes(id)) this.waiting.push(id);
  }
  release(id: number) {
    this.places.delete(id);
    this.waiting = this.waiting.filter((i) => i !== id);
  }
  entry(h: Household) {
    return [lane(h.position), lane(clinicDoor), { ...clinicDoor }];
  }
  petSpot(h: Household, index: number): Point {
    return {
      x: h.position.x + 0.65 + index * 0.6,
      z: h.position.z + index * 0.35,
    };
  }
  snapshot() {
    return { places: [...this.places.entries()], waiting: [...this.waiting] };
  }
  restore(value: unknown, households: Household[]) {
    if (value === undefined) return true;
    try {
      const s = structuredClone(value) as ReturnType<
        ClinicEntrance['snapshot']
      >;
      if (
        !Array.isArray(s.places) ||
        !Array.isArray(s.waiting) ||
        s.places.length > households.length ||
        new Set(s.places.map((p) => p[0])).size !== s.places.length ||
        new Set(s.places.map((p) => p[1])).size !== s.places.length ||
        new Set(s.waiting).size !== s.waiting.length
      )
        return false;
      for (const [id, index] of s.places) {
        const h = households[id];
        if (
          !Number.isInteger(id) ||
          !Number.isInteger(index) ||
          !entrancePlaces[index] ||
          !h ||
          h.inClinic ||
          h.ticket === undefined ||
          !['clinic-walk', 'clinic-wait'].includes(h.routine)
        )
          return false;
      }
      if (s.waiting.some((id) => !s.places.some((p) => p[0] === id)))
        return false;
      // A saved waiting family must own its place, even while walking back after migration.
      if (
        households.some(
          (h) =>
            !h.inClinic &&
            ['clinic-walk', 'clinic-wait'].includes(h.routine) &&
            h.ticket !== undefined &&
            !s.places.some((p) => p[0] === h.id),
        )
      )
        return false;
      this.places = new Map(s.places);
      this.waiting = s.waiting;
      return true;
    } catch {
      return false;
    }
  }
}
