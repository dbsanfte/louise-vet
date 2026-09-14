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

/** Only newly built cells need boundaries; overlapping old floor stays intact. */
export function spaceFootprint(tiles: readonly Point[], a: Point, b: Point) {
  const { from, width, depth } = floorRectangle(a, b);
  const existing = new Set(tiles.map((p) => `${p.x},${p.z}`));
  const added = new Map<string, Point>();
  // The build rule reports oversized plans; don't allocate a giant preview grid.
  if (width * depth <= 250)
    for (let x = from.x; x < from.x + width; x++)
      for (let z = from.z; z < from.z + depth; z++)
        if (!existing.has(`${x},${z}`)) added.set(`${x},${z}`, { x, z });
  const walls: WallEdge[] = [],
    connections: WallEdge[][] = [];
  const seen = new Set<string>();
  for (const [key, start] of added) {
    if (seen.has(key)) continue;
    const queue = [start],
      contacts: WallEdge[] = [];
    seen.add(key);
    for (const cell of queue)
      for (const [dx, dz] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const next = { x: cell.x + dx, z: cell.z + dz },
          key = `${next.x},${next.z}`;
        if (added.has(key)) {
          if (!seen.has(key)) {
            seen.add(key);
            queue.push(next);
          }
          continue;
        }
        const edge: WallEdge = dx
          ? { x: cell.x + (dx > 0 ? 1 : 0), z: cell.z, axis: 'z' }
          : { x: cell.x, z: cell.z + (dz > 0 ? 1 : 0), axis: 'x' };
        walls.push(edge);
        if (existing.has(key)) contacts.push(edge);
      }
    const centre = { x: from.x + width / 2, z: from.z + depth / 2 };
    contacts.sort((a, b) => {
      const pa = edgeCentre(a),
        pb = edgeCentre(b);
      return (
        Math.hypot(pa.x - centre.x, pa.z - centre.z) -
          Math.hypot(pb.x - centre.x, pb.z - centre.z) ||
        a.x - b.x ||
        a.z - b.z
      );
    });
    connections.push(contacts);
  }
  return { walls, connections, added: added.size };
}

/** Capture nearby existing edges at the pointer, never move the anchored corner. */
export function snapSpaceCorner(point: Point, tiles: readonly Point[]) {
  const cells = new Set(tiles.map((p) => `${p.x},${p.z}`));
  const snapped = { x: Math.round(point.x), z: Math.round(point.z) };
  let distance = 0.8;
  for (const cell of tiles)
    for (const [dx, dz] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      if (cells.has(`${cell.x + dx},${cell.z + dz}`)) continue;
      const line = dx ? cell.x + (dx > 0 ? 1 : 0) : cell.z + (dz > 0 ? 1 : 0);
      const along = dx ? point.z : point.x,
        start = dx ? cell.z : cell.x;
      if (along < start - 0.25 || along > start + 1.25) continue;
      const gap = Math.abs((dx ? point.x : point.z) - line);
      if (gap < distance) {
        distance = gap;
        if (dx) {
          snapped.x = line;
          snapped.z = Math.round(point.z);
        } else {
          snapped.z = line;
          snapped.x = Math.round(point.x);
        }
      }
    }
  return snapped;
}
