import type { Point } from './town-map.ts';

/** A one-tile wall segment starts at a grid corner and runs along its axis. */
export type WallEdge = Point & { axis: 'x' | 'z' };
export const wallKey = (edge: WallEdge) => `${edge.axis}:${edge.x},${edge.z}`;
export const edgeCentre = (edge: WallEdge): Point => ({
  x: edge.x + (edge.axis === 'x' ? 0.5 : 0),
  z: edge.z + (edge.axis === 'z' ? 0.5 : 0),
});
export function edgeCells(edge: WallEdge): [Point, Point] {
  return edge.axis === 'x'
    ? [
        { x: edge.x, z: edge.z - 1 },
        { x: edge.x, z: edge.z },
      ]
    : [
        { x: edge.x - 1, z: edge.z },
        { x: edge.x, z: edge.z },
      ];
}
export function floorRectangle(a: Point, b: Point) {
  const from = { x: Math.min(a.x, b.x), z: Math.min(a.z, b.z) };
  const width = Math.max(1, Math.abs(a.x - b.x)),
    depth = Math.max(1, Math.abs(a.z - b.z));
  return {
    from,
    to: { x: from.x + width - 1, z: from.z + depth - 1 },
    width,
    depth,
  };
}
export function rectangleWalls(a: Point, b: Point): WallEdge[] {
  const { from, width, depth } = floorRectangle(a, b);
  const walls: WallEdge[] = [];
  for (let x = from.x; x < from.x + width; x++)
    walls.push(
      { x, z: from.z, axis: 'x' },
      { x, z: from.z + depth, axis: 'x' },
    );
  for (let z = from.z; z < from.z + depth; z++)
    walls.push(
      { x: from.x, z, axis: 'z' },
      { x: from.x + width, z, axis: 'z' },
    );
  return walls;
}
export function joinWalls(...lists: WallEdge[][]): WallEdge[] {
  return [
    ...new Map(lists.flat().map((edge) => [wallKey(edge), edge])).values(),
  ];
}
export function nearestWall(point: Point, edges: WallEdge[], radius = 0.65) {
  let best: WallEdge | undefined,
    gap = radius;
  for (const edge of edges) {
    const centre = edgeCentre(edge);
    const distance = Math.hypot(point.x - centre.x, point.z - centre.z);
    if (distance < gap) {
      gap = distance;
      best = edge;
    }
  }
  return best;
}
