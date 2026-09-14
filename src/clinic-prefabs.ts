import type { ClinicBuild, FloorCell } from './clinic-build.ts';
import type { Point } from './town-map.ts';

/** Reusable shells, not furniture grants: ordinary floor credits/prices apply. */
export const clinicPrefabs = [
  {
    id: 'expansion',
    name: 'Waiting room',
    width: 6,
    depth: 8,
    surface: 'room',
    use: 'A cosy space for seats and quiet games.',
  },
  {
    id: 'pet-room',
    name: 'Pet playground',
    width: 6,
    depth: 14,
    surface: 'garden',
    use: 'A roomy lawn for pet toys and rides.',
  },
  {
    id: 'play-annex',
    name: 'Adventure room',
    width: 8,
    depth: 8,
    surface: 'room',
    use: 'An indoor space for climbing and play.',
  },
  {
    id: 'sun-courtyard',
    name: 'Garden',
    width: 6,
    depth: 8,
    surface: 'garden',
    use: 'A peaceful outdoor space for plants and seating.',
  },
] as const satisfies readonly {
  id: string;
  name: string;
  width: number;
  depth: number;
  surface: FloorCell['surface'];
  use: string;
}[];
export type ClinicPrefab = (typeof clinicPrefabs)[number];

/** Nearby attachment candidates; never teleport across the plot or cover rooms. */
export function prefabCandidates(
  build: ClinicBuild,
  prefab: ClinicPrefab,
  centre: Point,
  rotation: number,
) {
  const sideways = Math.round(rotation / (Math.PI / 2)) % 2 !== 0;
  const width = sideways ? prefab.depth : prefab.width,
    depth = sideways ? prefab.width : prefab.depth;
  const desired = {
    x: Math.round(centre.x - width / 2),
    z: Math.round(centre.z - depth / 2),
  };
  const candidates = new Map<string, Point>();
  const add = (x: number, z: number) => {
    if (Math.hypot(x - desired.x, z - desired.z) <= 2.1)
      candidates.set(`${x},${z}`, { x, z });
  };
  add(desired.x, desired.z);
  for (const tile of build.tiles)
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      if (build.contains({ x: tile.x + dx + 0.5, z: tile.z + dz + 0.5 }))
        continue;
      if (dx)
        for (const z of [desired.z, tile.z, tile.z + 1 - depth])
          add(tile.x + (dx > 0 ? 1 : -width), z);
      else
        for (const x of [desired.x, tile.x, tile.x + 1 - width])
          add(x, tile.z + (dz > 0 ? 1 : -depth));
    }
  return [...candidates.values()]
    .sort(
      (a, b) =>
        Math.hypot(a.x - desired.x, a.z - desired.z) -
        Math.hypot(b.x - desired.x, b.z - desired.z),
    )
    .map((start) => ({
      start,
      end: { x: start.x + width, z: start.z + depth },
    }));
}
