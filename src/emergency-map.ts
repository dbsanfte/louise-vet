import { layout, distance, type Point } from './town-map.ts';
export const stations = {
  fire: { x: 43, z: -10, facing: -Math.PI / 2, door: { x: 39, z: -10 } },
  police: { x: -43, z: 9, facing: Math.PI / 2, door: { x: -39, z: 9 } },
};
// These are the public trees authored in create-town-assets.py.
export const rescueTrees: Point[] = [
  { x: -25, z: 10 },
  { x: -4, z: -18 },
  { x: 12, z: -17 },
  { x: -20, z: 18 },
  { x: 3, z: 18 },
  { x: 22, z: 12 },
];
/** Visible branch tip, outside the leaf canopy, shared by pets and ladder. */
export const rescuePerch = (tree: Point): Point => ({
  x: tree.x + 1,
  z: tree.z + 1,
});
export function nearestTree(p: Point) {
  return rescueTrees.reduce((a, b) =>
    distance(p, a) < distance(p, b) ? a : b,
  );
}
const nodes: Point[] = [],
  edges: number[][] = [];
for (const road of layout.roads) {
  let previous = -1;
  for (const [x, z] of road.points) {
    let id = nodes.findIndex((p) => distance(p, { x, z }) < 0.01);
    if (id < 0) {
      id = nodes.length;
      nodes.push({ x, z });
      edges.push([]);
    }
    if (previous >= 0) {
      edges[id].push(previous);
      edges[previous].push(id);
    }
    previous = id;
  }
}
export function roadStop(p: Point) {
  return {
    ...nodes.reduce((a, b) => (distance(p, a) < distance(p, b) ? a : b)),
  };
}
/** Fire engines follow connected road centres, parking beside the rescue. */
export function emergencyDrive(from: Point, to: Point): Point[] {
  const start = nodes.indexOf(
    nodes.reduce((a, b) => (distance(from, a) < distance(from, b) ? a : b)),
  );
  const end = nodes.indexOf(
    nodes.reduce((a, b) => (distance(to, a) < distance(to, b) ? a : b)),
  );
  const costs = nodes.map(() => Infinity),
    prev = nodes.map(() => -1),
    open = new Set(nodes.map((_, i) => i));
  costs[start] = 0;
  while (open.size) {
    let a = -1;
    for (const i of open) if (a < 0 || costs[i] < costs[a]) a = i;
    if (a === end) break;
    open.delete(a);
    for (const b of edges[a])
      if (costs[a] + distance(nodes[a], nodes[b]) < costs[b]) {
        costs[b] = costs[a] + distance(nodes[a], nodes[b]);
        prev[b] = a;
      }
  }
  const path = [end];
  while (path[0] !== start) {
    const p = prev[path[0]];
    if (p < 0) throw Error('Disconnected emergency road');
    path.unshift(p);
  }
  return path.map((i) => ({ ...nodes[i] }));
}
