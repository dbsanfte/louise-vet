import layout from './town-layout.json' with { type: 'json' };
import clinicPlan from './clinic-layout.json' with { type: 'json' };
export { layout };
export const examRoom = clinicPlan.examination;
export type Point = { x: number; z: number };
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.z - b.z);
export function localToTown(x: number, z: number): Point {
  return {
    x: layout.clinic.x - z * layout.clinic.scale,
    z: layout.clinic.z + x * layout.clinic.scale,
  };
}
export const vetHome = localToTown(-1.3, -2.75);
export const examDoor = localToTown(examRoom.doorX, examRoom.doorZ);
export const examOwner = localToTown(3.5, -6.9);
export const vetExam = localToTown(1.5, -8.9);
export const clinicDoor = localToTown(5.65, 1.65);
export const clinicDesk = localToTown(-1.3, -0.1);
export const clinicHall = localToTown(3.45, 1.65);
export const clinicSeats = [
  [-1.3, -0.1],
  [-0.8, 1.15],
  [0.55, 1.8],
  [2.15, 2],
  [2.7, -0.7],
  [1.25, -0.45],
  [-6.5, 0.9],
  [-8, 0.9],
].map(([x, z]) => localToTown(x, z));
export function garden(
  lot: (typeof layout.lots)[number],
  right = 0,
  forward = 2.4,
): Point {
  return {
    x: lot.x + Math.sin(lot.facing) * forward + Math.cos(lot.facing) * right,
    z: lot.z + Math.cos(lot.facing) * forward - Math.sin(lot.facing) * right,
  };
}
const graph = layout.nodes.map(() => [] as { id: number; cost: number }[]);
for (const [a, b] of layout.edges) {
  const cost = distance(layout.nodes[a], layout.nodes[b]);
  graph[a].push({ id: b, cost });
  graph[b].push({ id: a, cost });
}
export function nearestNode(p: Point) {
  let best = 0;
  for (let i = 1; i < layout.nodes.length; i++)
    if (distance(p, layout.nodes[i]) < distance(p, layout.nodes[best]))
      best = i;
  return best;
}
/** Shortest connected pavement route; road crossings are explicit graph edges. */
export function routeBetween(from: Point, to: Point): Point[] {
  const start = nearestNode(from),
    end = nearestNode(to),
    cost = layout.nodes.map(() => Infinity),
    prev = layout.nodes.map(() => -1),
    open = new Set(layout.nodes.map((_, i) => i));
  cost[start] = 0;
  while (open.size) {
    let a = -1;
    for (const i of open) if (a < 0 || cost[i] < cost[a]) a = i;
    if (a === end) break;
    open.delete(a);
    for (const e of graph[a])
      if (cost[a] + e.cost < cost[e.id]) {
        cost[e.id] = cost[a] + e.cost;
        prev[e.id] = a;
      }
  }
  const ids = [end];
  while (ids[0] !== start) {
    const p = prev[ids[0]];
    if (p < 0) throw new Error('Disconnected Hookville pavement');
    ids.unshift(p);
  }
  return [...ids.map((i) => ({ ...layout.nodes[i] })), { ...to }];
}
export function roadCircuit(branch: number, direction: number): Point[] {
  const main = layout.roads[0].points,
    loop = layout.roads[branch].points;
  const path = [...main, ...loop.slice(1, -1).reverse()];
  const ordered = direction > 0 ? path : [...path].reverse();
  return ordered.map((p, i) => {
    const a = ordered[(i - 1 + ordered.length) % ordered.length],
      b = ordered[(i + 1) % ordered.length];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      l = Math.hypot(dx, dz);
    return { x: p[0] + dz / l, z: p[1] - dx / l };
  });
}
export const carRoutes = [
  roadCircuit(1, 1),
  roadCircuit(2, 1),
  roadCircuit(1, -1),
  roadCircuit(2, -1),
];

export function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    t = Math.max(
      0,
      Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)),
    );
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
}
export function onRoad(p: Point) {
  return layout.roads.some((r) =>
    r.points.some(
      (a, i) =>
        i > 0 &&
        segmentDistance(
          p,
          { x: r.points[i - 1][0], z: r.points[i - 1][1] },
          { x: a[0], z: a[1] },
        ) < 2.1,
    ),
  );
}
