import * as THREE from 'three';
import { TownSurfaces } from './town-surfaces';
import { type ClinicBuild, buildableCells, gridKey } from './clinic-build';
import { edgeCells, edgeCentre, wallKey, type WallEdge } from './clinic-spaces';

/** Procedural cutaway floors/walls share the same cells as navigation. */
export class ClinicBuildScenery {
  readonly group = new THREE.Group();
  readonly grid = new THREE.Group();
  readonly preview = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.055, 1),
    new THREE.MeshBasicMaterial({
      color: 0x79b875,
      transparent: true,
      opacity: 0.3,
      depthTest: false,
      depthWrite: false,
    }),
  );
  private previewEdges: THREE.Mesh[] = [];
  readonly hints = new THREE.Group();
  hintEdges: WallEdge[] = [];
  private hintMesh?: THREE.InstancedMesh;
  private hintGeometry = new THREE.BoxGeometry(1, 1, 1);
  private hintMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.7,
    depthTest: false,
    depthWrite: false,
  });
  private shell = new THREE.Group();
  private surfaces = new TownSurfaces();
  private signature = '';
  private pool = new Map<
    string,
    {
      geometry: THREE.BufferGeometry;
      material: THREE.MeshStandardMaterial;
    }
  >();
  constructor() {
    this.preview.renderOrder = 20;
    const outline = new THREE.MeshBasicMaterial({
      color: 0x205b42,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    for (let i = 0; i < 4; i++) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(1, 0.02, 1), outline);
      edge.renderOrder = 21;
      this.previewEdges.push(edge);
      this.preview.add(edge);
    }
    const points: number[] = [];
    const edges = new Set<string>();
    for (const p of buildableCells) {
      for (const [a, b, c, d] of [
        [0, 0, 1, 0],
        [1, 0, 1, 1],
        [1, 1, 0, 1],
        [0, 1, 0, 0],
      ]) {
        const key = [gridKey(p.x + a, p.z + b), gridKey(p.x + c, p.z + d)]
          .sort()
          .join(':');
        if (edges.has(key)) continue;
        edges.add(key);
        points.push(p.x + a, 0.11, p.z + b, p.x + c, 0.11, p.z + d);
      }
    }
    const mesh = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.Float32BufferAttribute(points, 3),
      ),
      new THREE.LineBasicMaterial({
        color: 0x5d8e83,
        transparent: true,
        opacity: 0.3,
      }),
    );
    this.grid.add(mesh);
    this.group.add(this.shell, this.grid, this.preview, this.hints);
    this.hints.visible = false;
    this.grid.visible = this.preview.visible = false;
  }
  update(build: ClinicBuild) {
    const signature = JSON.stringify([
      build.state.floorEdited,
      build.tiles,
      build.state.walls,
      build.state.doors,
    ]);
    if (this.signature === signature) return;
    this.signature = signature;
    this.shell.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose();
    });
    this.shell.clear();
    this.shell.visible = build.state.floorEdited;
    if (!build.state.floorEdited) return;
    const occupied = new Map(build.tiles.map((p) => [gridKey(p.x, p.z), p]));
    const floorGeom = new THREE.BoxGeometry(0.995, 0.08, 0.995),
      wallGeom = new THREE.BoxGeometry(1, 0.8, 0.12),
      fenceGeom = new THREE.BoxGeometry(0.09, 0.72, 0.09);
    const floors: Record<string, THREE.Matrix4[]> = { room: [], garden: [] },
      walls: THREE.Matrix4[] = [],
      fences: THREE.Matrix4[] = [],
      rails: THREE.Matrix4[] = [],
      tips: THREE.Matrix4[] = [],
      doorPosts: THREE.Matrix4[] = [],
      doorHeaders: THREE.Matrix4[] = [],
      doorLeaves: THREE.Matrix4[] = [],
      gatePosts: THREE.Matrix4[] = [],
      gateLeaves: THREE.Matrix4[] = [];
    const boundaries = new Map<string, WallEdge>();
    const matrix = (x: number, y: number, z: number, r = 0) =>
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r),
        new THREE.Vector3(1, 1, 1),
      );
    for (const p of build.tiles) {
      floors[p.surface].push(matrix(p.x + 0.5, 0.02, p.z + 0.5));
      for (const [dx, dz] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]) {
        if (occupied.has(gridKey(p.x + dx, p.z + dz))) continue;
        if (p.x === 5 && p.z === 1 && dx === 1) continue; // the permanent street doorway
        const edge: WallEdge = dz
          ? { x: p.x, z: p.z + (dz > 0 ? 1 : 0), axis: 'x' }
          : { x: p.x + (dx > 0 ? 1 : 0), z: p.z, axis: 'z' };
        boundaries.set(wallKey(edge), edge);
      }
    }
    for (const edge of build.state.walls) boundaries.set(wallKey(edge), edge);
    const doorKeys = new Set(build.state.doors.map(wallKey));
    for (const edge of boundaries.values()) {
      if (edge.axis === 'z' && edge.x === 6 && edge.z === 1) continue;
      const { x, z } = edgeCentre(edge),
        r = edge.axis === 'x' ? 0 : Math.PI / 2;
      const garden = !edgeCells(edge).some(
        (p) => occupied.get(gridKey(p.x, p.z))?.surface === 'room',
      );
      if (doorKeys.has(wallKey(edge))) {
        const posts = garden ? gatePosts : doorPosts;
        for (const side of [-0.46, 0.46])
          posts.push(
            matrix(
              x + (edge.axis === 'x' ? side : 0),
              garden ? 0.42 : 0.64,
              z + (edge.axis === 'z' ? side : 0),
              r,
            ),
          );
        if (!garden) doorHeaders.push(matrix(x, 1.24, z, r));
        // Open leaves sit beside the route rather than across the doorway.
        (garden ? gateLeaves : doorLeaves).push(
          matrix(
            x + (edge.axis === 'x' ? -0.46 : 0.42),
            garden ? 0.4 : 0.6,
            z + (edge.axis === 'z' ? -0.46 : 0.42),
            r + Math.PI / 2,
          ),
        );
      } else if (garden) {
        rails.push(matrix(x, 0.25, z, r), matrix(x, 0.56, z, r));
        for (const t of [-0.375, -0.125, 0.125, 0.375]) {
          const px = x + (edge.axis === 'x' ? t : 0),
            pz = z + (edge.axis === 'z' ? t : 0);
          fences.push(matrix(px, 0.4, pz, r));
          tips.push(matrix(px, 0.81, pz, Math.PI / 4));
        }
      } else walls.push(matrix(x, 0.42, z, r));
    }
    const instances = (
      geometry: THREE.BufferGeometry,
      matrices: THREE.Matrix4[],
      color: number,
      name: string,
    ) => {
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.86,
        name,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.receiveShadow = mesh.castShadow = true;
      const cached = this.pool.get(name);
      if (cached) {
        geometry.dispose();
        material.dispose();
        mesh.geometry = cached.geometry;
        mesh.material = cached.material;
      } else {
        const source = mesh.geometry;
        this.surfaces.apply(mesh);
        if (source !== mesh.geometry) source.dispose();
        if (material !== mesh.material) material.dispose();
        this.pool.set(name, {
          geometry: mesh.geometry,
          material: mesh.material,
        });
      }
      this.shell.add(mesh);
    };
    instances(
      new THREE.BoxGeometry(0.07, 1.28, 0.09),
      doorPosts,
      0xf6efd8,
      'wood door frames',
    );
    instances(
      new THREE.BoxGeometry(1, 0.08, 0.09),
      doorHeaders,
      0xf6efd8,
      'wood door lintels',
    );
    instances(
      new THREE.BoxGeometry(0.84, 1.1, 0.055),
      doorLeaves,
      0x72a891,
      'wood open doors',
    );
    instances(
      new THREE.BoxGeometry(0.07, 0.84, 0.09),
      gatePosts,
      0xf6efd8,
      'wood gate posts',
    );
    instances(
      new THREE.BoxGeometry(0.84, 0.64, 0.045),
      gateLeaves,
      0xf6efd8,
      'wood open gates',
    );
    instances(floorGeom, floors.room, 0xe8dfc9, 'floor tile');
    instances(floorGeom.clone(), floors.garden, 0x8bab68, 'lawn');
    instances(wallGeom, walls, 0x97beac, 'plaster');
    instances(fenceGeom, fences, 0xf6efd8, 'wood');
    instances(
      new THREE.BoxGeometry(1, 0.07, 0.07),
      rails,
      0xf6efd8,
      'wood rails',
    );
    instances(
      new THREE.ConeGeometry(0.064, 0.1, 4),
      tips,
      0xf6efd8,
      'wood tips',
    );
  }
  hidePreview() {
    this.preview.visible = false;
    this.hints.visible = false;
  }
  showDoorHints(
    edges: WallEdge[],
    selected?: WallEdge | WallEdge[],
    valid = true,
  ) {
    this.hintEdges = edges;
    const count = edges.length * 4;
    if (!this.hintMesh || this.hintMesh.count !== count) {
      this.hintMesh?.dispose();
      this.hints.clear();
      this.hintMesh = new THREE.InstancedMesh(
        this.hintGeometry,
        this.hintMaterial,
        count,
      );
      this.hintMesh.renderOrder = 22;
      this.hintMesh.frustumCulled = false;
      this.hints.add(this.hintMesh);
    }
    const mesh = this.hintMesh,
      color = new THREE.Color();
    edges.forEach((edge, i) => {
      const centre = edgeCentre(edge),
        rotation = edge.axis === 'x' ? 0 : Math.PI / 2;
      const chosen = (
        Array.isArray(selected) ? selected : selected ? [selected] : []
      ).some((d) => wallKey(edge) === wallKey(d));
      color.setHex(chosen ? (valid ? 0x31a76b : 0xd44935) : 0x318acc);
      for (const [part, [along, y, width, height, depth]] of [
        [-0.46, 0.62, 0.08, 1.24, 0.1],
        [0.46, 0.62, 0.08, 1.24, 0.1],
        [0, 1.22, 1, 0.08, 0.1],
        [0, 0.09, 1, 0.025, 0.3],
      ].entries()) {
        const matrix = new THREE.Matrix4().compose(
          new THREE.Vector3(
            centre.x + (edge.axis === 'x' ? along : 0),
            y,
            centre.z + (edge.axis === 'z' ? along : 0),
          ),
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            rotation,
          ),
          new THREE.Vector3(width, height, depth),
        );
        mesh.setMatrixAt(i * 4 + part, matrix);
        mesh.setColorAt(i * 4 + part, color);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.hints.visible = count > 0;
  }
  showPreview(
    x: number,
    z: number,
    width: number,
    depth: number,
    rotation: number,
    valid: boolean,
  ) {
    this.preview.visible = true;
    this.preview.position.set(x, 0.13, z);
    this.preview.scale.set(width, 1, depth);
    this.preview.rotation.y = rotation;
    this.preview.material.color.setHex(valid ? 0x76b873 : 0xd36f58);
    (this.previewEdges[0].material as THREE.MeshBasicMaterial).color.setHex(
      valid ? 0x205b42 : 0x9f392c,
    );
    const edgeWidth = 0.12;
    this.previewEdges.forEach((edge, i) => {
      const horizontal = i < 2,
        side = i % 2 ? 1 : -1;
      edge.scale.set(
        horizontal ? 1 : edgeWidth / width,
        1,
        horizontal ? edgeWidth / depth : 1,
      );
      edge.position.set(
        horizontal ? 0 : side * (0.5 - edgeWidth / width / 2),
        0.04,
        horizontal ? side * (0.5 - edgeWidth / depth / 2) : 0,
      );
    });
  }
}
