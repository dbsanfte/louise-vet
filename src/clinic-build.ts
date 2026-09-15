import plan from './clinic-layout.json' with { type: 'json' };
import {
  edgeCells,
  edgeCentre,
  floorRectangle,
  joinWalls,
  spaceFootprint,
  wallKey,
  type WallEdge,
} from './clinic-spaces.ts';
export { floorRectangle } from './clinic-spaces.ts';
import {
  layout,
  localToTown,
  segmentDistance,
  type Point,
} from './town-map.ts';
import { rescueTrees } from './emergency-map.ts';
import { upgrades, type UpgradeId } from './game.ts';

export type Placement = Point & { rotation: number };
export type BuildItem = { id: string; recipe: string; placement?: Placement };
export type FloorCell = Point & { surface: 'room' | 'garden'; paid?: boolean };
export type BuildState = {
  version: 3;
  walls: WallEdge[];
  doors: WallEdge[];
  customized: boolean;
  floorEdited: boolean;
  unlocked: string[];
  tiles: FloorCell[];
  items: BuildItem[];
  credits: number;
  /** Leftover floor islands retained by erasure; inactive until reconnected. */
  detached?: Point[];
};
export type BuildStation = {
  itemId?: string;
  id: string;
  kind: string;
  x: number;
  z: number;
  facing: number;
  upgrade: string;
  audience: string;
  species?: string[];
  seconds?: number;
  queueX?: number;
  queueZ?: number;
};
export type BuildRecipe = {
  id: string;
  name: string;
  upgrade: string;
  asset: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  stations: string[];
  soft?: boolean;
};
/** Legacy starter positions share a catalogue type, but keep their saved IDs. */
export function furnitureType(recipeId: string) {
  return (
    (
      {
        'seat-6': 'seat-5',
        'seat-7': 'seat-5',
        'base-plant-1': 'base-plant-0',
        'plant-1': 'plant-0',
      } as Record<string, string>
    )[recipeId] ?? recipeId
  );
}
const recipe = (
  id: string,
  name: string,
  upgrade: string,
  asset: string,
  x: number,
  z: number,
  width: number,
  depth: number,
  stations: string[] = [],
  soft = false,
): BuildRecipe => ({
  id,
  name,
  upgrade,
  asset,
  x,
  z,
  width,
  depth,
  stations,
  soft,
});
export const buildRecipes: BuildRecipe[] = [
  recipe(
    'welcome-bench',
    'Welcome bench',
    '',
    'welcome-bench',
    -2.51,
    2.65,
    2.8,
    0.8,
    ['seat-0', 'seat-1', 'seat-2'],
  ),
  recipe('shelf', 'Treat shop shelf', '', 'base-shelf', -4.42, 1.85, 0.8, 2.8),
  recipe(
    'base-plant-0',
    'Potted fern',
    '',
    'base-plant-0',
    -4.37,
    -3.04,
    0.8,
    0.8,
  ),
  recipe(
    'base-plant-1',
    'Potted fern',
    '',
    'base-plant-1',
    4.35,
    -3.1,
    0.8,
    0.8,
  ),
  recipe(
    'round-rug',
    'Round welcome rug',
    '',
    'base-rug',
    1.7,
    -0.4,
    2,
    2,
    [],
    true,
  ),
  recipe(
    'welcome-mat',
    'Welcome mat',
    '',
    'base-mat',
    4.45,
    1.65,
    0.8,
    1.5,
    [],
    true,
  ),
  recipe(
    'paw-picture',
    'Pawprint picture',
    '',
    'base-picture',
    0.31,
    -3.5,
    1,
    0.25,
    [],
    true,
  ),
  recipe(
    'bench',
    'Comfy waiting seats',
    'bench',
    'bench',
    3.025,
    2.75,
    1.65,
    0.85,
    ['seat-3', 'seat-4'],
  ),
  ...[5, 6, 7].map((i) => {
    const s = plan.stations.find((s) => s.id === `seat-${i}`)!;
    return recipe(
      s.id,
      'Lounge chair',
      'expansion',
      'chair',
      s.x,
      s.z,
      0.9,
      0.85,
      [s.id],
    );
  }),
  recipe(
    'books',
    'Books and magazines',
    'books',
    'books',
    0.7,
    2.7,
    0.85,
    0.85,
  ),
  recipe(
    'table-games',
    'Board-game table',
    'table-games',
    'table-games',
    -8.2,
    -2.1,
    2.8,
    1.1,
    ['game-0', 'game-1'],
  ),
  recipe(
    'puzzle-table',
    'Puzzle picnic table',
    'puzzle-table',
    'puzzle-table',
    -14.8,
    -13.6,
    2.8,
    1.25,
    ['puzzle-0', 'puzzle-1'],
  ),
  ...plan.stations
    .filter((s) => s.audience === 'pet')
    .map((s) =>
      recipe(
        s.id,
        (
          {
            scratch: 'Scratching post',
            wheel: 'Exercise wheel',
            carousel: 'Merry-go-round',
            toys: 'Toy corner',
            coaster: 'Pet rollercoaster',
            ferris: 'Pet Ferris wheel',
            'treat-dispenser': 'Treat dispenser',
            'water-dispenser': 'Water dispenser',
            'toy-box': 'Bouncy toy box',
            yarn: 'Yarn-ball corner',
            aviary: 'Bird aviary',
            'play-tree': 'Friendly play tree',
            bubbles: 'Bubble chase',
            'cat-nook': 'Cosy cat nook',
            'bird-chimes': 'Bird chime arch',
          } as Record<string, string>
        )[s.id],
        s.upgrade,
        s.kind,
        s.x,
        s.z,
        s.kind === 'coaster' ? 4.5 : s.kind === 'ferris' ? 3.5 : 1.6,
        s.kind === 'coaster' ? 3.3 : s.kind === 'ferris' ? 1.8 : 1.55,
        [s.id],
      ),
    ),
  recipe('plant-0', 'Leafy plant', 'plants', 'plant', 1.8, 2.7, 0.9, 0.9),
  recipe('plant-1', 'Leafy plant', 'plants', 'plant', 4.35, 2.7, 0.9, 0.9),
  recipe(
    'poster',
    'Neighbourhood poster',
    'poster',
    'poster',
    -4.6,
    -3.7,
    0.85,
    0.25,
    [],
    true,
  ),
  recipe(
    'flower-border',
    'Blooming flower border',
    'flower-border',
    'flower-border',
    -14,
    -16,
    5.5,
    7.5,
    [],
    true,
  ),
  recipe(
    'bunting',
    'Pawprint bunting',
    'bunting',
    'bunting',
    -0.05,
    -3.4,
    8.9,
    0.5,
    [],
    true,
  ),
  recipe(
    'cosy-rug',
    'Cosy welcome rug',
    'cosy-rug',
    'cosy-rug',
    -2.5,
    1.05,
    2.5,
    1.5,
    [],
    true,
  ),
  recipe(
    'wall-art',
    'Happy pets gallery',
    'wall-art',
    'wall-art',
    -2.4,
    -3.4,
    3.4,
    0.3,
    [],
    true,
  ),
];
export const floorPrice = 3;
export const gridKey = (x: number, z: number) => `${x},${z}`;
export const toClinic = (p: Point): Point => ({
  x: (p.z - layout.clinic.z) / layout.clinic.scale,
  z: (layout.clinic.x - p.x) / layout.clinic.scale,
});
export const turnPoint = (p: Point, rotation: number): Point => ({
  x: p.x * Math.cos(rotation) + p.z * Math.sin(rotation),
  z: p.z * Math.cos(rotation) - p.x * Math.sin(rotation),
});
export function itemPoint(item: Placement, local: Point): Point {
  const p = turnPoint(local, item.rotation);
  return { x: item.x + p.x, z: item.z + p.z };
}
const coreCells: FloorCell[] = [];
function rectangle(
  x: number,
  z: number,
  width: number,
  depth: number,
  surface: FloorCell['surface'] = 'room',
) {
  const cells: FloorCell[] = [];
  for (let a = Math.floor(x - width / 2); a < x + width / 2; a++)
    for (let b = Math.floor(z - depth / 2); b < z + depth / 2; b++)
      cells.push({ x: a, z: b, surface });
  return cells;
}
coreCells.push(...rectangle(0, 0, 10, 8), ...rectangle(1.5, -7, 7, 6), {
  x: 5,
  z: 1,
  surface: 'room',
});
const core = new Set(coreCells.map((p) => gridKey(p.x, p.z)));
const legacyCells = [
  ...coreCells,
  ...plan.rooms.flatMap((r) =>
    rectangle(
      r.x,
      r.z,
      r.width,
      r.depth,
      r.id === 'sun-courtyard' ? 'garden' : 'room',
    ),
  ),
];
const legacy = new Set(legacyCells.map((p) => gridKey(p.x, p.z)));
function townGreen(p: Point) {
  if (p.z >= -3.55 || p.z < -23 || p.x < -32 || p.x > 15) return false;
  if (
    layout.roads.some((r) =>
      r.points.some(
        (b, i) =>
          i > 0 &&
          segmentDistance(
            p,
            { x: r.points[i - 1][0], z: r.points[i - 1][1] },
            { x: b[0], z: b[1] },
          ) < 3.6,
      ),
    )
  )
    return false;
  if (
    layout.lots.some((l) => {
      const d = turnPoint({ x: p.x - l.x, z: p.z - l.z }, -l.facing);
      return Math.abs(d.x) < 4.1 && Math.abs(d.z) < 4.15;
    })
  )
    return false;
  return !rescueTrees.some((t) => Math.hypot(p.x - t.x, p.z - t.z) < 3.2);
}
export const buildableCells: Point[] = [];
for (let x = -24; x <= 5; x++)
  for (let z = -56; z <= 13; z++) {
    if (
      legacy.has(gridKey(x, z)) ||
      [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ].every(([a, b]) => townGreen(localToTown(x + a, z + b)))
    )
      buildableCells.push({ x, z });
  }
const buildable = new Set(buildableCells.map((p) => gridKey(p.x, p.z)));
const samePlacement = (a: Placement | undefined, b: Placement | undefined) =>
  JSON.stringify(a) === JSON.stringify(b);
export class ClinicBuild {
  state: BuildState = {
    version: 3,
    walls: [],
    doors: [],
    customized: false,
    floorEdited: false,
    unlocked: [],
    tiles: structuredClone(coreCells),
    items: buildRecipes
      .filter((r) => !r.upgrade)
      .map((r) => ({
        id: r.id,
        recipe: r.id,
        placement: { x: r.x, z: r.z, rotation: 0 },
      })),
    credits: 0,
  };
  revision = 0;
  private navRevision = -1;
  private wallRevision = -1;
  private closedWalls = new Set<string>();
  private nodes = new Map<string, Point>();
  private tileSet = new Set<string>();
  private reachable = new Map<string, Point>();
  private edges = new Set<string>();
  private stationCache?: ReturnType<ClinicBuild['makeStations']>;
  private stationAccess = new Map<string, boolean>();
  get customized() {
    return this.state.customized;
  }
  get tiles() {
    return this.state.tiles;
  }
  get items() {
    return this.state.items;
  }
  get stations() {
    return (this.stationCache ??= this.makeStations());
  }
  recipe(id: string) {
    const type = this.items.find((i) => i.id === id)?.recipe ?? id;
    return buildRecipes.find((r) => r.id === type)!;
  }
  copies(recipeId: string) {
    return this.items.filter(
      (i) => furnitureType(i.recipe) === furnitureType(recipeId),
    );
  }
  /** The pooled tile allowance is shown against kits in purchase order.
   * Already-built legacy rooms have no unused allowance to list. */
  get unusedRoomKits() {
    let remaining = this.state.credits;
    return [...this.state.unlocked]
      .reverse()
      .flatMap((id) => {
        const room = plan.rooms.find((r) => r.id === id);
        if (!room || !remaining) return [];
        const credits = Math.min(remaining, room.width * room.depth);
        remaining -= credits;
        return [
          {
            ...room,
            credits,
            surface:
              id === 'sun-courtyard' ? ('garden' as const) : ('room' as const),
          },
        ];
      })
      .reverse();
  }
  hasPlaced(recipeId: string) {
    return this.copies(recipeId).some((i) => i.placement);
  }
  /** Each paid copy owns its placement and station reservations. */
  private addCopy(r: BuildRecipe, placement?: Placement) {
    let id = r.id,
      serial = 1;
    const used = new Set(this.items.map((i) => i.id));
    while (used.has(id)) id = `${r.id}~${serial++}`;
    const item: BuildItem = { id, recipe: r.id, placement };
    this.items.push(item);
    return item;
  }
  /** Call only after purchase() has charged the wallet, before saving both. */
  buy(id: string) {
    const product = upgrades.find((u) => u.id === id);
    if (!product) return;
    if (!('furniture' in product)) {
      this.unlock(id);
      return;
    }
    if (!this.state.unlocked.includes(id)) this.state.unlocked.push(id);
    const item = this.addCopy(
      buildRecipes.find((r) => r.id === product.furniture)!,
    );
    this.changed();
    return item;
  }
  itemStations(id: string) {
    return this.recipe(id).stations.map((station) =>
      id === this.recipe(id).id ? station : `${station}@${id}`,
    );
  }
  placement(id: string) {
    return this.items.find((i) => i.id === id)?.placement;
  }
  changed() {
    this.revision++;
    this.stationCache = undefined;
    this.stationAccess.clear();
    this.navRevision = -1;
    this.wallRevision = -1;
  }
  syncOwned(ids: readonly UpgradeId[]) {
    for (const id of ids)
      if (!this.state.unlocked.includes(id)) this.unlock(id, true);
  }
  unlock(id: string, migrate = false) {
    if (this.state.unlocked.includes(id)) return;
    this.state.unlocked.push(id);
    const room = plan.rooms.find((r) => r.id === id);
    if (room) {
      if (migrate) {
        const cells = rectangle(
          room.x,
          room.z,
          room.width,
          room.depth,
          id === 'sun-courtyard' ? 'garden' : 'room',
        );
        for (const p of cells)
          if (!this.tiles.some((t) => t.x === p.x && t.z === p.z))
            this.tiles.push(p);
      } else this.state.credits += room.width * room.depth;
    }
    const legacyRecipes = buildRecipes.filter((r) => r.upgrade === id);
    for (const r of legacyRecipes)
      this.addCopy(r, migrate ? { x: r.x, z: r.z, rotation: 0 } : undefined);
    const product = upgrades.find((u) => u.id === id);
    if (!legacyRecipes.length && product && 'furniture' in product)
      this.addCopy(buildRecipes.find((r) => r.id === product.furniture)!);
    this.changed();
  }
  private makeStations() {
    const result: BuildStation[] = plan.stations
      .filter((s) => s.id === 'standing')
      .map((s) => ({ ...s }));
    for (const item of this.items) {
      if (!item.placement) continue;
      const r = this.recipe(item.id),
        p = item.placement;
      for (const [index, id] of r.stations.entries()) {
        const original = plan.stations.find((s) => s.id === id)!;
        const position = itemPoint(p, {
          x: original.x - r.x,
          z: original.z - r.z,
        });
        const q =
          original.queueX !== undefined && original.queueZ !== undefined
            ? itemPoint(p, {
                x: original.queueX - r.x,
                z: original.queueZ - r.z,
              })
            : undefined;
        result.push({
          ...original,
          id: this.itemStations(item.id)[index],
          itemId: item.id,
          ...position,
          facing: original.facing + p.rotation,
          queueX: q?.x,
          queueZ: q?.z,
        });
      }
    }
    // There is always a separate clear standing spot for each admitted family,
    // even when every chair has been put back in the collection.
    const taken: Point[] = [];
    for (let i = 0; i < 8; i++) {
      const p = this.safe(
        { x: -2.7 + (i % 4) * 1.25, z: 0.7 + Math.floor(i / 4) * 1.2 },
        taken,
      );
      taken.push(p);
      if (i === 0) Object.assign(result[0], this.customized ? p : {});
      else
        result.push({
          id: `standing-${i}`,
          kind: 'standing',
          ...p,
          facing: Math.PI,
          upgrade: '',
          audience: 'owner',
        });
    }
    return result;
  }
  stationRotation(s: { id: string }) {
    const station = this.stations.find((st) => st.id === s.id);
    return station?.itemId
      ? (this.placement(station.itemId)?.rotation ?? 0)
      : 0;
  }
  stationPoint(s: { id: string; x: number; z: number }, offset: Point) {
    const p = turnPoint(offset, this.stationRotation(s));
    return localToTown(s.x + p.x, s.z + p.z);
  }
  contains(p: Point) {
    return this.tiles.some(
      (t) => Math.floor(p.x) === t.x && Math.floor(p.z) === t.z,
    );
  }
  insideItem(id: string, p: Point, margin = 0) {
    const at = this.placement(id);
    if (!at) return false;
    const r = this.recipe(id),
      d = turnPoint({ x: p.x - at.x, z: p.z - at.z }, -at.rotation);
    return (
      Math.abs(d.x) < r.width / 2 + margin &&
      Math.abs(d.z) < r.depth / 2 + margin
    );
  }
  /** Preserve the existing connected lounge partitions when first editing a
   * legacy clinic. Unbuilt future rooms never contribute floating doorways. */
  get architecture() {
    if (this.state.floorEdited)
      return { walls: this.state.walls, doors: this.state.doors };
    const walls: WallEdge[] = [],
      doors: WallEdge[] = [];
    const add = (edge: WallEdge, open: boolean) => {
      if (
        !edgeCells(edge).every((p) =>
          this.contains({ x: p.x + 0.5, z: p.z + 0.5 }),
        )
      )
        return;
      walls.push(edge);
      if (open) doors.push(edge);
    };
    for (let z = -4; z < 4; z++)
      add({ x: -5, z, axis: 'z' }, z === -1 || z === 0);
    for (let z = -12; z < 4; z++)
      add({ x: -11, z, axis: 'z' }, z === -1 || z === 0);
    for (let x = -11; x < -5; x++)
      add({ x, z: -4, axis: 'x' }, x === -9 || x === -8);
    for (let x = -17; x < -11; x++)
      add({ x, z: -12, axis: 'x' }, x === -13 || x === -12);
    return { walls, doors };
  }
  private wallBlocked(p: Point) {
    if (!this.state.floorEdited) return false;
    if (this.wallRevision !== this.revision) {
      const doors = new Set(this.state.doors.map(wallKey));
      this.closedWalls = new Set(
        this.state.walls.map(wallKey).filter((key) => !doors.has(key)),
      );
      this.wallRevision = this.revision;
    }
    for (const axis of ['x', 'z'] as const) {
      const across = axis === 'x' ? 'z' : 'x';
      if (Math.abs(p[across] - Math.round(p[across])) > 0.1) continue;
      for (const along of [Math.floor(p[axis]), Math.floor(p[axis] - 0.1)]) {
        const edge = { x: Math.round(p.x), z: Math.round(p.z), axis };
        edge[axis] = along;
        if (this.closedWalls.has(wallKey(edge))) return true;
      }
    }
    return false;
  }
  private fixedBlocked(p: Point) {
    // Counter, examination table, and the clinical partition stay anchored.
    const partition =
      !this.state.floorEdited &&
      ((Math.abs(p.x + 5.05) < 0.26 &&
        Math.abs(p.z) > 0.78 &&
        p.z > -4 &&
        p.z < 4) ||
        (this.state.unlocked.includes('expansion') &&
          Math.abs(p.x + 11) < 0.24 &&
          Math.abs(p.z) > 0.78 &&
          p.z > -12 &&
          p.z < 4) ||
        (this.state.unlocked.includes('play-annex') &&
          Math.abs(p.z + 4) < 0.24 &&
          Math.abs(p.x + 8) > 0.75 &&
          p.x > -11 &&
          p.x < -5) ||
        (this.state.unlocked.includes('sun-courtyard') &&
          Math.abs(p.z + 12) < 0.24 &&
          Math.abs(p.x + 11.95) > 0.65 &&
          p.x > -17 &&
          p.x < -11));
    return (
      this.wallBlocked(p) ||
      partition ||
      (Math.abs(p.x + 2) < 0.18 && p.z > -10 && p.z < -4) ||
      (Math.abs(p.x - 5) < 0.18 && p.z > -10 && p.z < -4) ||
      (Math.abs(p.z + 10) < 0.18 && p.x > -2 && p.x < 5) ||
      (Math.abs(p.x + 1.3) < 2.4 && p.z > -2.48 && p.z < -1.0) ||
      (Math.abs(p.x - 1.5) < 1.45 && Math.abs(p.z + 7) < 1.35) ||
      (p.z > -4.2 &&
        p.z < -3.75 &&
        p.x > -2.2 &&
        p.x < 5.1 &&
        (p.x < 2.85 || p.x > 4.15))
    );
  }
  walkable(p: Point) {
    return (
      this.tileSet.has(gridKey(Math.floor(p.x), Math.floor(p.z))) &&
      !this.fixedBlocked(p) &&
      !this.items.some(
        (i) =>
          i.placement &&
          !this.recipe(i.id).soft &&
          this.insideItem(i.id, p, 0.16),
      )
    );
  }
  private navigation() {
    if (this.navRevision === this.revision) return;
    this.tileSet = new Set(this.tiles.map((p) => gridKey(p.x, p.z)));
    this.nodes.clear();
    for (const t of this.tiles)
      for (const x of [0.25, 0.75])
        for (const z of [0.25, 0.75]) {
          const p = { x: t.x + x, z: t.z + z };
          if (this.walkable(p)) this.nodes.set(gridKey(p.x, p.z), p);
        }
    // Check the half-step as well: two open nodes can straddle a thin wall.
    this.edges.clear();
    for (const [key, p] of this.nodes)
      for (const [dx, dz] of [
        [0.5, 0],
        [0, 0.5],
      ]) {
        const other = gridKey(p.x + dx, p.z + dz);
        if (
          this.nodes.has(other) &&
          this.walkable({ x: p.x + dx / 2, z: p.z + dz / 2 })
        ) {
          this.edges.add(`${key}:${other}`);
          this.edges.add(`${other}:${key}`);
        }
      }
    this.reachable.clear();
    const start = this.nearest({ x: 3.45, z: 1.65 });
    const todo = start ? [start] : [];
    if (start) this.reachable.set(gridKey(start.x, start.z), start);
    for (let i = 0; i < todo.length; i++)
      for (const [dx, dz] of [
        [0.5, 0],
        [-0.5, 0],
        [0, 0.5],
        [0, -0.5],
      ]) {
        const p = todo[i],
          key = gridKey(p.x + dx, p.z + dz),
          node = this.nodes.get(key);
        if (
          node &&
          this.edges.has(`${gridKey(p.x, p.z)}:${key}`) &&
          !this.reachable.has(key)
        ) {
          this.reachable.set(key, node);
          todo.push(node);
        }
      }
    this.navRevision = this.revision;
  }
  private nearest(p: Point, nodes = this.nodes) {
    let best: Point | undefined,
      d = Infinity;
    for (const n of nodes.values()) {
      const gap = Math.hypot(n.x - p.x, n.z - p.z);
      if (gap < d) {
        best = n;
        d = gap;
      }
    }
    return best;
  }
  safe(p: Point, occupied: Point[] = []) {
    this.navigation();
    if (!occupied.length)
      return this.nearest(p, this.reachable) ?? { x: 0, z: 0 };
    const nodes = new Map(
      [...this.reachable].filter(([, n]) =>
        occupied.every((a) => Math.hypot(a.x - n.x, a.z - n.z) > 0.75),
      ),
    );
    return (
      this.nearest(p, nodes) ??
      this.nearest(p, this.reachable) ?? { x: 0, z: 0 }
    );
  }
  canStand(p: Point) {
    this.navigation();
    const n = this.nearest(p, this.reachable);
    return Boolean(
      n && this.walkable(p) && Math.hypot(n.x - p.x, n.z - p.z) < 0.8,
    );
  }
  private detachedItem(id: string) {
    const p = this.placement(id);
    return Boolean(
      p &&
      this.state.detached?.some(
        (t) => t.x === Math.floor(p.x) && t.z === Math.floor(p.z),
      ),
    );
  }
  stationAccessible(s: BuildStation) {
    if (!this.customized || s.kind === 'standing') return true;
    const cached = this.stationAccess.get(s.id);
    if (cached !== undefined) return cached;
    if (s.itemId && this.detachedItem(s.itemId)) {
      this.stationAccess.set(s.id, false);
      return false;
    }
    this.navigation();
    const p = s.audience === 'owner' ? this.approach(s) : this.port(s);
    const n = this.nearest(p, this.reachable);
    const accessible = Boolean(n && Math.hypot(n.x - p.x, n.z - p.z) < 0.8);
    this.stationAccess.set(s.id, accessible);
    return accessible;
  }
  approach(p: Point) {
    const s = this.stations.find(
      (s) =>
        s.audience === 'owner' &&
        s.kind !== 'standing' &&
        Math.hypot(p.x - s.x, p.z - s.z) < 0.25,
    );
    if (!s) return p;
    if (s.kind === 'game') {
      const d = turnPoint({ x: 0, z: 1.05 }, this.stationRotation(s));
      return { x: s.x + d.x, z: s.z + d.z };
    }
    return {
      x: s.x + Math.sin(s.facing) * 1.05,
      z: s.z + Math.cos(s.facing) * 1.05,
    };
  }
  route(from: Point, to: Point): Point[] {
    this.navigation();
    const a = toClinic(from),
      b = toClinic(to),
      aa = this.approach(a),
      bb = this.approach(b),
      start = this.nearest(aa, this.reachable),
      end = this.nearest(bb, this.reachable);
    if (!start || !end) return [];
    const todo = [start],
      seen = new Map<string, string>(),
      first = gridKey(start.x, start.z),
      goal = gridKey(end.x, end.z);
    seen.set(first, '');
    for (let i = 0; i < todo.length && !seen.has(goal); i++) {
      const p = todo[i];
      for (const [dx, dz] of [
        [0.5, 0],
        [-0.5, 0],
        [0, 0.5],
        [0, -0.5],
      ]) {
        const key = gridKey(p.x + dx, p.z + dz);
        if (
          this.nodes.has(key) &&
          this.edges.has(`${gridKey(p.x, p.z)}:${key}`) &&
          !seen.has(key)
        ) {
          seen.set(key, gridKey(p.x, p.z));
          todo.push(this.nodes.get(key)!);
        }
      }
    }
    if (!seen.has(goal)) return [];
    const path: Point[] = [];
    let key = goal;
    while (key) {
      path.unshift(this.nodes.get(key)!);
      key = seen.get(key)!;
    }
    // Keep corners; direct interpolation must never cut through a placed object.
    const simple = path.filter(
      (_, i) =>
        i === 0 ||
        i === path.length - 1 ||
        (path[i - 1].x !== path[i + 1].x && path[i - 1].z !== path[i + 1].z),
    );
    if (Math.hypot(a.x - aa.x, a.z - aa.z) > 0.02) simple.unshift(aa);
    if (this.walkable(bb) || Math.hypot(b.x - bb.x, b.z - bb.z) > 0.02)
      simple.push(bb, b);
    return simple
      .map((p) => localToTown(p.x, p.z))
      .filter((p) => Math.hypot(p.x - from.x, p.z - from.z) > 0.015);
  }
  private port(s: BuildStation): Point {
    this.navigation();
    const pose = { ...s, rotation: this.stationRotation(s) },
      r = this.recipe(s.itemId!);
    const preferred =
      s.queueX !== undefined && s.queueZ !== undefined
        ? { x: s.queueX, z: s.queueZ }
        : itemPoint(pose, {
            x: s.kind === 'coaster' ? 2.8 : 0,
            z: s.kind === 'coaster' ? 0 : 1.4,
          });
    const candidates = [
      preferred,
      ...[
        { x: r.width / 2 + 0.45, z: 0 },
        { x: -r.width / 2 - 0.45, z: 0 },
        { x: 0, z: r.depth / 2 + 0.45 },
        { x: 0, z: -r.depth / 2 - 0.45 },
      ].map((p) => itemPoint(pose, p)),
    ];
    return (
      candidates.find((p) => {
        const n = this.nearest(p, this.reachable);
        return this.walkable(p) && n && Math.hypot(n.x - p.x, n.z - p.z) < 0.6;
      }) ?? preferred
    );
  }
  queue(s: BuildStation, index: number) {
    const base = this.port(s);
    const taken: Point[] = [];
    for (let i = 0; i <= index; i++) {
      const d = turnPoint({ x: 0, z: i * 0.85 }, this.stationRotation(s));
      taken.push(this.safe({ x: base.x + d.x, z: base.z + d.z }, taken));
    }
    const p = taken[index];
    return localToTown(p.x, p.z);
  }
  validate(actors: Point[] = []): string | undefined {
    this.navigation();
    if (!this.nodes.size) return 'Leave some space to walk.';
    const start = this.nearest({ x: 3.45, z: 1.65 })!,
      todo = [start],
      seen = new Set([gridKey(start.x, start.z)]);
    for (let i = 0; i < todo.length; i++)
      for (const [dx, dz] of [
        [0.5, 0],
        [-0.5, 0],
        [0, 0.5],
        [0, -0.5],
      ]) {
        const p = todo[i],
          k = gridKey(p.x + dx, p.z + dz);
        if (
          this.nodes.has(k) &&
          this.edges.has(`${gridKey(p.x, p.z)}:${k}`) &&
          !seen.has(k)
        ) {
          seen.add(k);
          todo.push(this.nodes.get(k)!);
        }
      }
    // Tiny gaps behind migrated benches need not be walkable destinations.
    const required = [
      { x: -1.3, z: -0.1 },
      { x: 3.5, z: -6.9 },
      { x: -1.3, z: -2.75 },
      ...this.stations
        .filter(
          (s) =>
            s.kind !== 'standing' && !(s.itemId && this.detachedItem(s.itemId)),
        )
        .map((s) => (s.audience === 'owner' ? this.approach(s) : this.port(s))),
    ];
    if (
      required.some((p) => {
        const n = this.nearest(p);
        return (
          !n ||
          !seen.has(gridKey(n.x, n.z)) ||
          Math.hypot(n.x - p.x, n.z - p.z) > 0.8
        );
      })
    )
      return 'Keep a clear path to every seat, activity, the counter and the exam room.';
    if (
      actors.some((world) => {
        const p = this.approach(toClinic(world));
        // An animal may be aboard a ride; its access point is validated above.
        if (
          this.items.some(
            (i) =>
              this.recipe(i.id).stations.length &&
              this.insideItem(i.id, p, 0.2),
          )
        )
          return false;
        const n = this.nearest(p, this.reachable);
        return !n || Math.hypot(p.x - n.x, p.z - n.z) > 0.8;
      })
    )
      return 'Keep a clear way out for everyone in the clinic.';
    const tileSeen = this.connectedTiles();
    const detached = new Set(
      this.state.detached?.map((p) => gridKey(p.x, p.z)),
    );
    if (
      this.tiles.some(
        (p) =>
          !tileSeen.has(gridKey(p.x, p.z)) && !detached.has(gridKey(p.x, p.z)),
      )
    )
      return 'Connect every space to the clinic with a doorway or open side.';
    return undefined;
  }
  private connectedTiles() {
    this.navigation();
    const tileTodo: FloorCell[] = [{ x: 3, z: 1, surface: 'room' }],
      tileSeen = new Set(tileTodo.map((p) => gridKey(p.x, p.z)));
    for (let i = 0; i < tileTodo.length; i++)
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const p = tileTodo[i],
          k = gridKey(p.x + dx, p.z + dz);
        if (
          this.tileSet.has(k) &&
          !tileSeen.has(k) &&
          !this.wallBlocked({ x: p.x + 0.5 + dx / 2, z: p.z + 0.5 + dz / 2 })
        ) {
          tileSeen.add(k);
          tileTodo.push({ x: p.x + dx, z: p.z + dz, surface: 'room' });
        }
      }
    return tileSeen;
  }
  private refreshDetached() {
    if (!this.state.detached) return;
    const connected = this.connectedTiles();
    this.state.detached = this.state.detached.filter(
      (p) =>
        this.tileSet.has(gridKey(p.x, p.z)) &&
        !connected.has(gridKey(p.x, p.z)),
    );
    if (!this.state.detached.length) delete this.state.detached;
    this.changed();
  }
  private footprint(id: string) {
    const p = this.placement(id),
      r = this.recipe(id);
    if (!p) return [];
    const result: Point[] = [];
    const nx = Math.ceil(r.width / 0.2),
      nz = Math.ceil(r.depth / 0.2);
    for (let x = 0; x <= nx; x++)
      for (let z = 0; z <= nz; z++)
        result.push(
          itemPoint(p, {
            x: (x / nx - 0.5) * (r.width - 0.02),
            z: (z / nz - 0.5) * (r.depth - 0.02),
          }),
        );
    return result;
  }
  private clinicalAccess(p: Point) {
    return (
      (p.x > -2 && p.x < 5 && p.z < -4 && p.z > -10) ||
      (p.z > -3.25 && p.z < -2.4 && p.x > -1.9 && p.x < 2.35) ||
      (p.x > 1.3 && p.x < 2.35 && p.z > -3.25 && p.z < 0.45) ||
      (p.z > -0.6 && p.z < 0.45 && p.x > -1.8 && p.x < 4.05) ||
      (p.x > 2.9 && p.x < 4.05 && p.z > -9.4 && p.z < 0.45) ||
      (p.z > -9.4 && p.z < -8.4 && p.x > 0.9 && p.x < 4.05)
    );
  }
  proposal(
    id: string,
    placement: Placement | undefined,
    actors: Point[] = [],
  ): string | undefined {
    const item = this.items.find((i) => i.id === id);
    if (!item) return 'Buy this item in the shop first.';
    const old = item.placement;
    if (samePlacement(old, placement)) return;
    const revision = this.revision;
    item.placement = placement;
    this.changed();
    let error: string | undefined;
    if (placement) {
      const r = this.recipe(id);
      const footprint = this.footprint(id);
      if (footprint.some((p) => !this.contains(p)))
        error = 'Build floor or garden space under the whole item.';
      if (
        !r.soft &&
        footprint.some((p) => this.fixedBlocked(p) || this.clinicalAccess(p))
      )
        error =
          'Keep the counter, doorways and Louise’s route to the exam room clear.';
      if (
        !r.soft &&
        this.items.some(
          (i) =>
            i.id !== id &&
            i.placement &&
            !this.recipe(i.id).soft &&
            this.overlap(id, i.id),
        )
      )
        error = 'Give this item its own space.';
      if (!r.soft && actors.some((p) => this.insideItem(id, toClinic(p), 0.2)))
        error = 'Someone is standing there. Choose a clear spot.';
      if (!r.soft && this.fixedBlocked(placement))
        error = 'Keep the counter and exam area clear.';
    }
    error ??= this.validate(actors);
    item.placement = old;
    this.changed();
    this.revision = revision;
    return error;
  }
  private overlap(a: string, b: string) {
    const ra = this.recipe(a),
      rb = this.recipe(b),
      pa = this.placement(a)!,
      pb = this.placement(b)!;
    // Quarter-turn placements have axis-aligned footprints. Legacy positions retain their decimals.
    const size = (r: BuildRecipe, p: Placement) =>
      Math.abs(Math.sin(p.rotation)) > 0.5
        ? [r.depth, r.width]
        : [r.width, r.depth];
    const [aw, ad] = size(ra, pa),
      [bw, bd] = size(rb, pb);
    return (
      Math.abs(pa.x - pb.x) < (aw + bw) / 2 + 0.05 &&
      Math.abs(pa.z - pb.z) < (ad + bd) / 2 + 0.05
    );
  }
  place(id: string, placement: Placement | undefined, actors: Point[] = []) {
    const error = this.proposal(id, placement, actors);
    if (error) return error;
    this.items.find((i) => i.id === id)!.placement = placement
      ? { ...placement }
      : undefined;
    this.state.customized = true;
    this.changed();
  }
  doorOptions(a: Point, b: Point) {
    return spaceFootprint(this.tiles, a, b).connections.flat();
  }
  /** Gardens merge; rooms keep partitions. Find only the openings routes need. */
  autoSpace(
    a: Point,
    b: Point,
    surface: FloorCell['surface'],
    coins: number,
    actors: Point[] = [],
    apply = false,
  ) {
    const { width, depth, from, to } = floorRectangle(a, b);
    if (width * depth > 250)
      return {
        cost: 0,
        error: 'Build up to 250 tiles at a time.',
        door: undefined,
        doors: [] as WallEdge[],
      };
    for (let x = from.x; x <= to.x; x++)
      for (let z = from.z; z <= to.z; z++)
        if (!buildable.has(gridKey(x, z)))
          return {
            cost: 0,
            error:
              'Stay on the clinic greenspace, clear of paths and neighbours.',
            door: undefined,
            doors: [] as WallEdge[],
          };
    const footprint = spaceFootprint(this.tiles, a, b);
    if (!footprint.added)
      return {
        ...this.floor(from, to, surface, coins, actors, apply),
        door: undefined,
        doors: [] as WallEdge[],
      };
    if (footprint.connections.some((group) => !group.length))
      return {
        cost: 0,
        error: 'Draw beside the clinic so a doorway can connect your space.',
        door: undefined,
        doors: [] as WallEdge[],
      };
    const check = (doors: WallEdge[], commit = false) => ({
      ...this.space(
        a,
        b,
        surface,
        'auto',
        doors[0],
        coins,
        actors,
        commit,
        doors.slice(1),
      ),
      door: doors[0],
      doors,
    });
    const finish = (result: ReturnType<typeof check>) =>
      !result.error && apply ? check(result.doors, true) : result;
    // Try open garden connections first. A new room or an existing wall will
    // fail validation until a clear doorway joins it to the rest of the clinic.
    const openEdges = this.gardenConnections(footprint, surface);
    const connections = footprint.connections.map((group) =>
      group.filter((edge) => !openEdges.has(wallKey(edge))),
    );
    const first = check([]);
    if (!first.error || first.cost > coins) return finish(first);
    if (connections.length === 1) {
      for (const door of connections[0]) {
        const result = check([door]);
        if (!result.error || result.cost > coins) return finish(result);
      }
    }
    // Several patches, or several people on one boundary, may need more than
    // one opening. Start connected, then close surplus doors from the far end.
    // This is linear in the contact edges, never a combinatorial search per drag.
    let selected = check(connections.flat());
    if (selected.error) return first;
    for (const group of connections)
      for (const edge of [...group].reverse()) {
        const remaining = selected.doors.filter(
          (d) => wallKey(d) !== wallKey(edge),
        );
        const candidate = check(remaining);
        if (!candidate.error) selected = candidate;
      }
    return finish(selected);
  }

  private gardenConnections(
    footprint: ReturnType<typeof spaceFootprint>,
    surface: FloorCell['surface'],
  ) {
    const gardens = new Set(
      this.tiles
        .filter((t) => t.surface === 'garden')
        .map((t) => gridKey(t.x, t.z)),
    );
    return new Set(
      surface === 'garden'
        ? footprint.connections
            .flat()
            .filter((edge) =>
              edgeCells(edge).some((p) => gardens.has(gridKey(p.x, p.z))),
            )
            .map(wallKey)
        : [],
    );
  }

  /** Floor, boundary and chosen doorway are one transaction. Drafts never spend. */
  space(
    a: Point,
    b: Point,
    surface: FloorCell['surface'],
    enclosed: boolean | 'auto',
    door: WallEdge | undefined,
    coins: number,
    actors: Point[] = [],
    apply = false,
    extraDoors: WallEdge[] = [],
  ) {
    const { from, to, width, depth } = floorRectangle(a, b);
    if (width * depth > 250)
      return { cost: 0, error: 'Build up to 250 tiles at a time.' };
    const options = this.doorOptions(a, b);
    if (enclosed === true && !door)
      return {
        cost: 0,
        error: 'Choose a doorway to connect this space to the clinic.',
      };
    if (door && !options.some((edge) => wallKey(edge) === wallKey(door)))
      return {
        cost: 0,
        error: 'Put the doorway on a side that joins existing clinic floor.',
      };
    const old = this.state,
      revision = this.revision,
      architecture = this.architecture;
    const footprint = spaceFootprint(this.tiles, a, b);
    const merged =
      enclosed === 'auto'
        ? this.gardenConnections(footprint, surface)
        : new Set<string>();
    const added = enclosed
      ? footprint.walls.filter((e) => !merged.has(wallKey(e)))
      : [];
    const openings = [...(door ? [door] : []), ...extraDoors];
    if (
      openings.some(
        (d) => !options.some((edge) => wallKey(edge) === wallKey(d)),
      )
    )
      return {
        cost: 0,
        error: 'Put the doorway on a side that joins existing clinic floor.',
      };
    const walls = joinWalls(
      architecture.walls.filter((e) => !merged.has(wallKey(e))),
      added,
      openings,
    );
    const doors = joinWalls(
      architecture.doors.filter((e) => !merged.has(wallKey(e))),
      openings,
    );
    const open = new Set(doors.map(wallKey));
    const newWalls = added.filter(
      (edge) =>
        !open.has(wallKey(edge)) &&
        !architecture.walls.some((wall) => wallKey(wall) === wallKey(edge)),
    );
    for (const edge of newWalls) {
      const end = {
        x: edge.x + (edge.axis === 'x' ? 1 : 0),
        z: edge.z + (edge.axis === 'z' ? 1 : 0),
      };
      if (actors.some((p) => segmentDistance(toClinic(p), edge, end) < 0.28))
        return {
          cost: 0,
          error: 'Someone is standing by that wall. Choose a clear space.',
        };
      for (let t = 0; t <= 1; t += 0.25) {
        const p = {
          x: edge.x + (end.x - edge.x) * t,
          z: edge.z + (end.z - edge.z) * t,
        };
        if (this.clinicalAccess(p))
          return {
            cost: 0,
            error: 'Keep the entrance, counter and examination route clear.',
          };
        if (
          this.items.some(
            (item) =>
              item.placement &&
              !this.recipe(item.id).soft &&
              this.insideItem(item.id, p, 0.06),
          )
        )
          return {
            cost: 0,
            error: 'Move the furniture clear of your new walls first.',
          };
      }
    }
    this.state = { ...old, walls, doors, floorEdited: true };
    this.changed();
    const result = this.floor(
      from,
      to,
      surface,
      coins,
      actors,
      apply,
      footprint.added > 0,
      enclosed === 'auto',
    );
    if (result.error || !apply) {
      this.state = old;
      this.changed();
      this.revision = revision;
    }
    return result;
  }
  editableWalls() {
    return this.architecture.walls.filter((edge) =>
      edgeCells(edge).every((p) =>
        this.contains({ x: p.x + 0.5, z: p.z + 0.5 }),
      ),
    );
  }
  editDoor(edge: WallEdge, removeWall = false, actors: Point[] = []) {
    if (!this.editableWalls().some((wall) => wallKey(wall) === wallKey(edge)))
      return 'Choose a wall with built floor on both sides.';
    const old = this.state,
      architecture = this.architecture;
    const key = wallKey(edge),
      exists = architecture.doors.some((door) => wallKey(door) === key);
    const walls = architecture.walls.filter(
      (wall) => !removeWall || wallKey(wall) !== key,
    );
    const doors = architecture.doors.filter((door) => wallKey(door) !== key);
    if (!removeWall && !exists) doors.push(edge);
    this.state = { ...old, walls, doors, floorEdited: true };
    this.changed();
    const centre = edgeCentre(edge);
    const furnitureInDoor =
      !removeWall &&
      exists &&
      [0.1, 0.3, 0.5, 0.7, 0.9].some((t) =>
        this.items.some(
          (item) =>
            item.placement &&
            !this.recipe(item.id).soft &&
            this.insideItem(
              item.id,
              {
                x: edge.x + (edge.axis === 'x' ? t : 0),
                z: edge.z + (edge.axis === 'z' ? t : 0),
              },
              0.16,
            ),
        ),
      );
    const error = furnitureInDoor
      ? 'Move the furniture clear of that doorway first.'
      : !removeWall &&
          exists &&
          actors.some(
            (p) =>
              Math.hypot(toClinic(p).x - centre.x, toClinic(p).z - centre.z) <
              0.65,
          )
        ? 'Let everyone move clear of that doorway first.'
        : this.validate(actors);
    if (error) {
      this.state = old;
      this.changed();
      return error;
    }
    this.state.customized = true;
    this.changed();
    this.refreshDetached();
  }
  /** Preview is transactional: no furniture, occupants or saved state change. */
  erase(a: Point, b: Point, apply = false) {
    const x0 = Math.min(a.x, b.x),
      x1 = Math.max(a.x, b.x) + 1,
      z0 = Math.min(a.z, b.z),
      z1 = Math.max(a.z, b.z) + 1;
    const inRectangle = (p: Point) =>
      p.x >= x0 && p.x < x1 && p.z >= z0 && p.z < z1;
    const old = this.state,
      revision = this.revision,
      architecture = this.architecture;
    const stored: string[] = [];
    this.state = structuredClone(old);
    this.state.tiles = this.tiles.filter(
      (t) => core.has(gridKey(t.x, t.z)) || !inRectangle(t),
    );
    const removed = old.tiles.length - this.tiles.length;
    const store = (id: string) => {
      this.items.find((i) => i.id === id)!.placement = undefined;
      stored.push(id);
      this.changed();
    };
    for (const item of this.items)
      if (
        item.placement &&
        this.footprint(item.id).some((p) => inRectangle(p) || !this.contains(p))
      )
        store(item.id);
    const cells = new Set(this.tiles.map((t) => gridKey(t.x, t.z)));
    this.state.walls = architecture.walls.filter((e) =>
      edgeCells(e).some((p) => cells.has(gridKey(p.x, p.z))),
    );
    this.state.doors = architecture.doors.filter((e) =>
      edgeCells(e).every((p) => cells.has(gridKey(p.x, p.z))),
    );
    this.state.floorEdited = true;
    this.state.customized = true;
    this.changed();
    // A cut can remove an old doorway. Reopen a safe shared edge when floor
    // still meets; never fill the erased rectangle or delete extra room tiles.
    let connected = this.connectedTiles();
    const candidates = this.editableWalls().sort((a, b) => {
      const distance = (e: WallEdge) => {
        const p = edgeCentre(e);
        return Math.hypot(p.x - (x0 + x1) / 2, p.z - (z0 + z1) / 2);
      };
      return distance(a) - distance(b);
    });
    for (let i = 0; i < candidates.length; i++) {
      const edge = candidates.find((e) => {
        const adjacent = edgeCells(e);
        if (
          connected.has(gridKey(adjacent[0].x, adjacent[0].z)) ===
          connected.has(gridKey(adjacent[1].x, adjacent[1].z))
        )
          return false;
        const p = edgeCentre(e);
        return (
          [-0.25, 0.25].every((offset) =>
            this.walkable({
              x: p.x + (e.axis === 'z' ? offset : 0),
              z: p.z + (e.axis === 'x' ? offset : 0),
            }),
          ) &&
          !this.items.some(
            (item) =>
              item.placement &&
              !this.recipe(item.id).soft &&
              this.insideItem(item.id, p, 0.16),
          )
        );
      });
      if (!edge) break;
      this.state.doors = joinWalls(this.state.doors, [edge]);
      this.changed();
      connected = this.connectedTiles();
    }
    this.state.detached = this.tiles
      .filter((t) => !connected.has(gridKey(t.x, t.z)))
      .map(({ x, z }) => ({ x, z }));
    if (!this.state.detached.length) delete this.state.detached;
    this.changed();
    // A chair or ride beside the cut can also lose its required approach.
    // Include it in the preview's return count rather than leave unusable furniture.
    for (const item of this.items)
      if (
        item.placement &&
        !this.detachedItem(item.id) &&
        this.stations.some(
          (s) => s.itemId === item.id && !this.stationAccessible(s),
        )
      )
        store(item.id);
    const error = this.validate();
    const detached = this.state.detached?.length ?? 0;
    if (error || !apply || (!removed && !stored.length)) {
      this.state = old;
      this.changed();
      this.revision = revision;
    }
    return { error, cost: 0, stored, removed, detached };
  }
  floor(
    a: Point,
    b: Point,
    surface: FloorCell['surface'] | 'erase',
    coins: number,
    actors: Point[] = [],
    apply = false,
    preserveExisting = false,
    reconnectDetached = false,
  ): { error?: string; cost: number } {
    if (surface === 'erase') return this.erase(a, b, apply);
    const x0 = Math.min(a.x, b.x),
      x1 = Math.max(a.x, b.x),
      z0 = Math.min(a.z, b.z),
      z1 = Math.max(a.z, b.z);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 250)
      return { error: 'Build up to 250 tiles at a time.', cost: 0 };
    const revision = this.revision;
    const oldEdited = this.state.floorEdited;
    const oldWalls = this.state.walls,
      oldDoors = this.state.doors,
      oldDetached = this.state.detached;
    const architecture = this.architecture;
    const old = this.state.tiles,
      tiles = structuredClone(old);
    let count = 0;
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const index = tiles.findIndex((p) => p.x === x && p.z === z);
        if (core.has(gridKey(x, z))) continue;
        if (!buildable.has(gridKey(x, z)))
          return {
            error:
              'Stay on the clinic greenspace, clear of paths and neighbours.',
            cost: 0,
          };
        if (index < 0) {
          tiles.push({ x, z, surface, paid: true });
          count++;
        } else if (!preserveExisting) tiles[index].surface = surface;
      }
    const credits = Math.min(count, this.state.credits),
      cost = (count - credits) * floorPrice;
    if (cost > coins)
      return { error: `You need ${cost} coins for this space.`, cost };
    this.state.tiles = tiles;
    const cells = new Set(tiles.map((p) => gridKey(p.x, p.z)));
    this.state.walls = architecture.walls.filter((edge) =>
      edgeCells(edge).some((p) => cells.has(gridKey(p.x, p.z))),
    );
    this.state.doors = architecture.doors.filter((edge) =>
      edgeCells(edge).every((p) => cells.has(gridKey(p.x, p.z))),
    );
    this.state.floorEdited = true;
    if (reconnectDetached && oldDetached?.length) {
      // A bridge must reconnect every retained piece it touches, including its
      // furniture. Unrelated detached rooms keep their saved inactive state.
      const existing = new Set(old.map((p) => gridKey(p.x, p.z)));
      const detached = new Set(oldDetached.map((p) => gridKey(p.x, p.z)));
      const todo = tiles.filter((p) => !existing.has(gridKey(p.x, p.z)));
      const touched = new Set(todo.map((p) => gridKey(p.x, p.z)));
      for (const p of todo)
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const next = { x: p.x + dx, z: p.z + dz },
            key = gridKey(next.x, next.z);
          if (detached.has(key) && !touched.has(key)) {
            touched.add(key);
            todo.push({ ...next, surface });
          }
        }
      this.state.detached = oldDetached.filter(
        (p) => !touched.has(gridKey(p.x, p.z)),
      );
      if (!this.state.detached.length) delete this.state.detached;
    }
    this.changed();
    let error = this.validate(actors);
    if (
      !error &&
      tiles.some(
        (t) =>
          !old.some((o) => o.x === t.x && o.z === t.z) &&
          ![0.25, 0.75].some((x) =>
            [0.25, 0.75].some((z) =>
              this.reachable.has(gridKey(t.x + x, t.z + z)),
            ),
          ),
      )
    )
      error = 'Connect the new space through a clear opening.';
    if (actors.some((p) => !this.contains(toClinic(p))))
      error = 'Someone is using that space. Keep their floor in place.';
    if (
      this.items.some(
        (i) =>
          i.placement && this.footprint(i.id).some((p) => !this.contains(p)),
      )
    )
      error = 'Move the items before removing their floor.';
    if (error || !apply) {
      this.state.tiles = old;
      this.state.floorEdited = oldEdited;
      this.state.walls = oldWalls;
      this.state.doors = oldDoors;
      if (oldDetached) this.state.detached = oldDetached;
      else delete this.state.detached;
      this.changed();
      this.revision = revision;
      return { error, cost };
    }
    this.state.customized = true;
    this.state.credits -= credits;
    this.changed();
    this.refreshDetached();
    return { cost };
  }
  snapshot() {
    return structuredClone(this.state);
  }
  restore(value: unknown) {
    if (value === undefined) return true;
    try {
      const s = structuredClone(value) as BuildState;
      const version = (value as { version: number }).version;
      const knownUpgrades = new Set<string>(upgrades.map((u) => u.id));
      if (
        ![1, 2, 3].includes(version) ||
        typeof s.customized !== 'boolean' ||
        typeof s.floorEdited !== 'boolean' ||
        !Array.isArray(s.tiles) ||
        s.tiles.length > buildable.size ||
        !Array.isArray(s.items) ||
        !Array.isArray(s.unlocked) ||
        !Number.isInteger(s.credits) ||
        s.credits < 0 ||
        s.credits > 1000
      )
        return false;
      if (
        s.unlocked.some((id) => !knownUpgrades.has(id)) ||
        new Set(s.unlocked).size !== s.unlocked.length ||
        (version === 1 &&
          buildRecipes.some(
            (r) =>
              (!r.upgrade || s.unlocked.includes(r.upgrade)) !==
              s.items.some((i) => i.id === r.id),
          ))
      )
        return false;
      if (version === 1) {
        if (s.items.some((i) => !buildRecipes.some((r) => r.id === i.id)))
          return false;
        s.items.forEach((i) => {
          i.recipe = i.id;
        });
      }
      if (version < 3) {
        s.walls = [];
        s.doors = [];
      }
      s.version = 3;
      const validEdge = (edge: WallEdge) =>
        edge &&
        ['x', 'z'].includes(edge.axis) &&
        Number.isInteger(edge.x) &&
        Number.isInteger(edge.z) &&
        edgeCells(edge).some((p) =>
          s.tiles.some((t) => t.x === p.x && t.z === p.z),
        );
      if (
        !Array.isArray(s.walls) ||
        !Array.isArray(s.doors) ||
        s.walls.length > buildable.size * 4 ||
        s.doors.length > s.walls.length ||
        s.walls.some((edge) => !validEdge(edge)) ||
        new Set(s.walls.map(wallKey)).size !== s.walls.length ||
        new Set(s.doors.map(wallKey)).size !== s.doors.length ||
        s.doors.some(
          (edge) =>
            !validEdge(edge) ||
            !s.walls.some((wall) => wallKey(wall) === wallKey(edge)) ||
            !edgeCells(edge).every((p) =>
              s.tiles.some((t) => t.x === p.x && t.z === p.z),
            ),
        )
      )
        return false;
      if (
        buildRecipes.some(
          (r) =>
            !r.upgrade &&
            !s.items.some((i) => i.id === r.id && i.recipe === r.id),
        )
      )
        return false;
      if (
        new Set(s.tiles.map((p) => gridKey(p.x, p.z))).size !==
          s.tiles.length ||
        new Set(s.items.map((i) => i.id)).size !== s.items.length ||
        s.tiles.some(
          (p) =>
            !Number.isInteger(p.x) ||
            !Number.isInteger(p.z) ||
            !buildable.has(gridKey(p.x, p.z)) ||
            !['room', 'garden'].includes(p.surface),
        ) ||
        coreCells.some((c) => !s.tiles.some((p) => p.x === c.x && p.z === c.z))
      )
        return false;
      if (
        s.detached !== undefined &&
        (!Array.isArray(s.detached) ||
          s.detached.length > s.tiles.length ||
          new Set(s.detached.map((p) => gridKey(p.x, p.z))).size !==
            s.detached.length ||
          s.detached.some(
            (p) =>
              !p ||
              !Number.isInteger(p.x) ||
              !Number.isInteger(p.z) ||
              core.has(gridKey(p.x, p.z)) ||
              !s.tiles.some((t) => t.x === p.x && t.z === p.z),
          ))
      )
        return false;
      if (
        s.items.some(
          (i) =>
            typeof i.id !== 'string' ||
            !/^[a-z0-9-]+(?:~[1-9][0-9]*)?$/.test(i.id) ||
            !(i.id === i.recipe || i.id.startsWith(`${i.recipe}~`)) ||
            !buildRecipes.some(
              (r) =>
                r.id === i.recipe &&
                (!r.upgrade ||
                  s.unlocked.includes(r.upgrade) ||
                  upgrades.some(
                    (u) =>
                      'furniture' in u &&
                      u.furniture === r.id &&
                      s.unlocked.includes(u.id),
                  )),
            ) ||
            (i.placement &&
              (!Number.isFinite(i.placement.x) ||
                !Number.isFinite(i.placement.z) ||
                !Number.isFinite(i.placement.rotation) ||
                Math.abs(i.placement.rotation) > Math.PI * 2 ||
                Math.abs(
                  i.placement.rotation / (Math.PI / 2) -
                    Math.round(i.placement.rotation / (Math.PI / 2)),
                ) > 1e-6 ||
                !s.tiles.some(
                  (t) =>
                    t.x === Math.floor(i.placement!.x) &&
                    t.z === Math.floor(i.placement!.z),
                ))),
        )
      )
        return false;
      const old = this.state;
      this.state = s;
      this.changed();
      if (s.customized && this.validate()) {
        this.state = old;
        this.changed();
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}
