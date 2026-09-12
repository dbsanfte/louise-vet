import plan from './clinic-layout.json' with { type: 'json' };
import {
  layout,
  localToTown,
  segmentDistance,
  type Point,
} from './town-map.ts';
import { rescueTrees } from './emergency-map.ts';
import type { UpgradeId } from './game.ts';

export type Placement = Point & { rotation: number };
export type BuildItem = { id: string; placement?: Placement };
export type FloorCell = Point & { surface: 'room' | 'garden'; paid?: boolean };
export type BuildState = {
  version: 1;
  customized: boolean;
  floorEdited: boolean;
  unlocked: string[];
  tiles: FloorCell[];
  items: BuildItem[];
  credits: number;
};
export type BuildStation = {
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
    'Reception fern',
    '',
    'base-plant-0',
    -4.37,
    -3.04,
    0.8,
    0.8,
  ),
  recipe(
    'base-plant-1',
    'Window fern',
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
      `Lounge chair ${i - 4}`,
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
    version: 1,
    customized: false,
    floorEdited: false,
    unlocked: [],
    tiles: structuredClone(coreCells),
    items: buildRecipes
      .filter((r) => !r.upgrade)
      .map((r) => ({ id: r.id, placement: { x: r.x, z: r.z, rotation: 0 } })),
    credits: 0,
  };
  revision = 0;
  private navRevision = -1;
  private nodes = new Map<string, Point>();
  private tileSet = new Set<string>();
  private reachable = new Map<string, Point>();
  private edges = new Set<string>();
  private stationCache?: ReturnType<ClinicBuild['makeStations']>;
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
    return buildRecipes.find((r) => r.id === id)!;
  }
  placement(id: string) {
    return this.items.find((i) => i.id === id)?.placement;
  }
  changed() {
    this.revision++;
    this.stationCache = undefined;
    this.navRevision = -1;
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
    for (const r of buildRecipes.filter((r) => r.upgrade === id))
      this.items.push({
        id: r.id,
        placement: migrate ? { x: r.x, z: r.z, rotation: 0 } : undefined,
      });
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
      for (const id of r.stations) {
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
    const r = buildRecipes.find((r) => r.stations.includes(s.id));
    return r ? (this.placement(r.id)?.rotation ?? 0) : 0;
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
      r = buildRecipes.find((r) => r.stations.includes(s.id))!;
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
        .filter((s) => s.kind !== 'standing')
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
    // All floor patches must connect to the original clinic, even when empty.
    const tileTodo = [...coreCells],
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
        if (this.tileSet.has(k) && !tileSeen.has(k)) {
          tileSeen.add(k);
          tileTodo.push({ x: p.x + dx, z: p.z + dz, surface: 'room' });
        }
      }
    if (this.tiles.some((p) => !tileSeen.has(gridKey(p.x, p.z))))
      return 'Join the new space to your clinic.';
    return undefined;
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
  floor(
    a: Point,
    b: Point,
    surface: FloorCell['surface'] | 'erase',
    coins: number,
    actors: Point[] = [],
    apply = false,
  ): { error?: string; cost: number } {
    const x0 = Math.min(a.x, b.x),
      x1 = Math.max(a.x, b.x),
      z0 = Math.min(a.z, b.z),
      z1 = Math.max(a.z, b.z);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 250)
      return { error: 'Build up to 250 tiles at a time.', cost: 0 };
    const revision = this.revision;
    const oldEdited = this.state.floorEdited;
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
        if (surface === 'erase') {
          if (index >= 0) tiles.splice(index, 1);
        } else if (index < 0) {
          tiles.push({ x, z, surface, paid: true });
          count++;
        } else tiles[index].surface = surface;
      }
    const credits = Math.min(count, this.state.credits),
      cost = (count - credits) * floorPrice;
    if (cost > coins)
      return { error: `You need ${cost} coins for this space.`, cost };
    this.state.tiles = tiles;
    this.state.floorEdited = true;
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
      this.changed();
      this.revision = revision;
      return { error, cost };
    }
    this.state.customized = true;
    this.state.credits -= credits;
    this.changed();
    return { cost };
  }
  snapshot() {
    return structuredClone(this.state);
  }
  restore(value: unknown) {
    if (value === undefined) return true;
    try {
      const s = structuredClone(value) as BuildState;
      const knownUpgrades = new Set([
        ...buildRecipes.map((r) => r.upgrade).filter(Boolean),
        ...plan.rooms.map((r) => r.id),
        'equipment',
        'stock',
      ]);
      if (
        s.version !== 1 ||
        typeof s.customized !== 'boolean' ||
        typeof s.floorEdited !== 'boolean' ||
        !Array.isArray(s.tiles) ||
        s.tiles.length > buildable.size ||
        !Array.isArray(s.items) ||
        s.items.length > buildRecipes.length ||
        !Array.isArray(s.unlocked) ||
        !Number.isInteger(s.credits) ||
        s.credits < 0 ||
        s.credits > 1000
      )
        return false;
      if (
        s.unlocked.some((id) => !knownUpgrades.has(id)) ||
        new Set(s.unlocked).size !== s.unlocked.length ||
        buildRecipes.some(
          (r) =>
            (!r.upgrade || s.unlocked.includes(r.upgrade)) !==
            s.items.some((i) => i.id === r.id),
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
        s.items.some(
          (i) =>
            !buildRecipes.some((r) => r.id === i.id) ||
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
