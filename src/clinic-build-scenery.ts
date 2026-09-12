import * as THREE from 'three';
import { TownSurfaces } from './town-surfaces';
import { type ClinicBuild, buildableCells, gridKey } from './clinic-build';

/** Procedural cutaway floors/walls share the same cells as navigation. */
export class ClinicBuildScenery {
  readonly group = new THREE.Group();
  readonly grid = new THREE.Group();
  readonly preview = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.055, 1),
    new THREE.MeshBasicMaterial({
      color: 0x79b875,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );
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
    this.group.add(this.shell, this.grid, this.preview);
    this.grid.visible = this.preview.visible = false;
  }
  update(build: ClinicBuild) {
    const signature = JSON.stringify([build.state.floorEdited, build.tiles]);
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
      tips: THREE.Matrix4[] = [];
    const matrix = (x: number, y: number, z: number, r = 0) =>
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r),
        new THREE.Vector3(1, 1, 1),
      );
    for (const p of build.tiles) {
      floors[p.surface].push(matrix(p.x + 0.5, 0.02, p.z + 0.5));
      for (const [dx, dz, r] of [
        [0, -1, 0],
        [0, 1, 0],
        [-1, 0, Math.PI / 2],
        [1, 0, Math.PI / 2],
      ]) {
        if (occupied.has(gridKey(p.x + dx, p.z + dz))) continue;
        if (p.x === 5 && p.z === 1 && dx === 1) continue; // the permanent street doorway
        const x = p.x + 0.5 + dx * 0.5,
          z = p.z + 0.5 + dz * 0.5;
        if (p.surface === 'garden') {
          rails.push(matrix(x, 0.25, z, r), matrix(x, 0.56, z, r));
          for (const t of [-0.375, -0.125, 0.125, 0.375]) {
            fences.push(matrix(x + (dz ? t : 0), 0.4, z + (dx ? t : 0)));
            tips.push(
              matrix(x + (dz ? t : 0), 0.81, z + (dx ? t : 0), Math.PI / 4),
            );
          }
        } else walls.push(matrix(x, 0.42, z, r));
      }
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
  }
}
