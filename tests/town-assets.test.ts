import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Mesh, Vector3, Raycaster } from 'three';
import { layout } from '../src/town-map.ts';

test('sixteen home exports have distinct three-dimensional geometry, beyond their colours', async () => {
  const signatures = new Set<string>();
  for (const lot of layout.lots) {
    const bytes = await readFile(
      new URL(`../public/models/town/${lot.asset}.glb`, import.meta.url),
    );
    const { scene } = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    scene.updateMatrixWorld(true);
    const positions: string[] = [];
    scene.traverse((o) => {
      if (o instanceof Mesh) {
        const attr = o.geometry.getAttribute('position');
        for (let i = 0; i < attr.count; i++) {
          const p = new Vector3()
            .fromBufferAttribute(attr, i)
            .applyMatrix4(o.matrixWorld);
          positions.push(
            p
              .toArray()
              .map((n) => n.toFixed(3))
              .join(','),
          );
        }
      }
    });
    assert.ok(positions.length > 100, `${lot.asset} is a complete home`);
    signatures.add(
      createHash('sha256').update(positions.sort().join(';')).digest('hex'),
    );
  }
  assert.equal(signatures.size, 16);
});

test('pavement bends and branch junctions have a continuous walking surface', async () => {
  const bytes = await readFile(
    new URL('../public/models/town/neighbourhood.glb', import.meta.url),
  );
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  scene.updateMatrixWorld(true);
  const paths: Mesh[] = [];
  scene.traverse((o) => {
    if (
      o instanceof Mesh &&
      !Array.isArray(o.material) &&
      o.material.name === 'path'
    )
      paths.push(o);
  });
  assert.ok(paths.length, 'export contains walkable pavement geometry');
  const crossing = new Set(
    layout.crossings.map(([a, b]) => [a, b].sort((a, b) => a - b).join(',')),
  );
  const adjacent = new Map<number, number[]>();
  for (const [a, b] of layout.edges) {
    if (crossing.has([a, b].sort((a, b) => a - b).join(','))) continue;
    adjacent.set(a, [...(adjacent.get(a) ?? []), b]);
    adjacent.set(b, [...(adjacent.get(b) ?? []), a]);
  }
  const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0), 0, 2);
  for (const [i, neighbours] of adjacent) {
    const p = layout.nodes[i];
    const angles = Array.from({ length: 16 }, (_, j) => (j * Math.PI) / 8);
    if (neighbours.length === 2) {
      const vectors = neighbours.map((id) => {
        const n = layout.nodes[id],
          d = Math.hypot(n.x - p.x, n.z - p.z);
        return { x: (n.x - p.x) / d, z: (n.z - p.z) / d };
      });
      // Sample the outside bisector, where disconnected rectangles leave a gap.
      angles.push(
        Math.atan2(-vectors[0].z - vectors[1].z, -vectors[0].x - vectors[1].x),
      );
    }
    for (const angle of angles) {
      ray.ray.origin.set(
        p.x + Math.cos(angle) * 0.78,
        1,
        p.z + Math.sin(angle) * 0.78,
      );
      assert.ok(
        ray.intersectObjects(paths, false).length,
        `pavement gap at node ${i}, angle ${angle}`,
      );
    }
  }
});

test('the enlarged playground and both full ride models stay clear of roads and pavements', async () => {
  const { clinicPlan } = await import('../src/clinic-leisure.ts');
  const { localToTown } = await import('../src/town-map.ts');
  const { Box3 } = await import('three');
  const room = clinicPlan.rooms.find((r) => r.id === 'pet-room')!;
  const load = async (name: string) => {
    const bytes = await readFile(
      new URL(`../public/models/clinic/${name}.glb`, import.meta.url),
    );
    return (
      await new GLTFLoader().parseAsync(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
        '',
      )
    ).scene;
  };
  const bounds = new Box3().setFromObject(await load('playroom'));
  const segmentDistance = (
    p: { x: number; z: number },
    a: number[],
    b: number[],
  ) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / (dx * dx + dz * dz),
      ),
    );
    return Math.hypot(p.x - a[0] - t * dx, p.z - a[1] - t * dz);
  };
  for (let x = bounds.min.x; x <= bounds.max.x + 0.01; x += 0.1)
    for (let z = bounds.min.z; z <= bounds.max.z + 0.01; z += 0.1) {
      const p = localToTown(room.x + x, room.z + z);
      for (const road of layout.roads)
        for (let i = 1; i < road.points.length; i++)
          assert.ok(
            segmentDistance(p, road.points[i - 1], road.points[i]) > 4.1,
            'entire foundation clears carriageway and pavement with a margin',
          );
    }
  for (const id of ['coaster', 'ferris']) {
    const model = await load(id),
      s = clinicPlan.stations.find((s) => s.id === id)!;
    assert.ok(
      model.getObjectByName(id === 'coaster' ? 'CoasterCar' : 'FerrisRotor'),
    );
    if (id === 'ferris')
      for (let i = 0; i < 4; i++)
        assert.ok(model.getObjectByName(`FerrisCabin${i}`));
    const b = new Box3().setFromObject(model, true);
    assert.ok(
      s.x + b.min.x >= room.x - room.width / 2 &&
        s.x + b.max.x <= room.x + room.width / 2,
    );
    assert.ok(
      s.z + b.min.z >= room.z - room.depth / 2 &&
        s.z + b.max.z <= room.z + room.depth / 2,
    );
  }
});

test('the play garden and its six props fit the clinic plot, and lounge chair backs match seated headings', async () => {
  const { clinicPlan } = await import('../src/clinic-leisure.ts');
  const { localToTown, segmentDistance } = await import('../src/town-map.ts');
  const { Box3, Vector3 } = await import('three');
  const load = async (name: string) => {
    const bytes = await readFile(
      new URL(`../public/models/clinic/${name}.glb`, import.meta.url),
    );
    return (
      await new GLTFLoader().parseAsync(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
        '',
      )
    ).scene;
  };
  const room = clinicPlan.rooms.find((r) => r.id === 'play-annex')!;
  const bounds = new Box3().setFromObject(await load('play-annex'));
  for (let x = bounds.min.x; x <= bounds.max.x; x += 0.2)
    for (let z = bounds.min.z; z <= bounds.max.z; z += 0.2) {
      const p = localToTown(room.x + x, room.z + z);
      for (const road of layout.roads)
        for (let i = 1; i < road.points.length; i++)
          assert.ok(
            segmentDistance(
              p,
              { x: road.points[i - 1][0], z: road.points[i - 1][1] },
              { x: road.points[i][0], z: road.points[i][1] },
            ) > 4.1,
            'extension clears road and pavement',
          );
    }
  for (const s of clinicPlan.stations.filter((s) => s.queueX !== undefined)) {
    const room = clinicPlan.rooms.find(
      (r) =>
        s.x > r.x - r.width / 2 &&
        s.x < r.x + r.width / 2 &&
        s.z > r.z - r.depth / 2 &&
        s.z < r.z + r.depth / 2,
    )!;
    const b = new Box3().setFromObject(await load(s.kind));
    assert.ok(
      s.x + b.min.x >= room.x - room.width / 2 &&
        s.x + b.max.x <= room.x + room.width / 2,
      `${s.id} fits the garden width`,
    );
    assert.ok(
      s.z + b.min.z >= room.z - room.depth / 2 &&
        s.z + b.max.z <= room.z + room.depth / 2,
      `${s.id} fits the garden depth`,
    );
  }
  const lounge = await load('lounge');
  lounge.updateMatrixWorld(true);
  let chairs = 0;
  lounge.traverse((o) => {
    if (!o.name.startsWith('lounge_chair')) return;
    const back = o.children.find((c) => c.name.startsWith('chair_back'))!;
    const centre = o.getWorldPosition(new Vector3());
    const behind = back.getWorldPosition(new Vector3()).sub(centre).setY(0);
    assert.ok(behind.z > 0.3, 'chair back faces away from the open room');
    chairs++;
  });
  assert.equal(chairs, 3);
});

test('traffic has four different Blender bodies within the road footprint, with rolling wheels that stop at rest', async () => {
  const { Box3 } = await import('three');
  const { TrafficVehicle, trafficModels } =
    await import('../src/traffic-vehicle.ts');
  const shapes = new Set<string>(),
    paints = new Set<string>();
  for (const name of trafficModels) {
    const bytes = await readFile(
      new URL(`../public/models/town/${name}.glb`, import.meta.url),
    );
    const { scene } = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    const size = new Box3().setFromObject(scene).getSize(new Vector3());
    assert.ok(
      size.x < 1.5 && size.z < 2.7,
      `${name} stays inside the traffic footprint`,
    );
    assert.ok(size.y > 1 && size.y < 1.8);
    const vertices: number[] = [],
      wheels: import('three').Object3D[] = [];
    scene.traverse((o) => {
      if (o.userData.wheelRadius) wheels.push(o);
      if (o instanceof Mesh) {
        vertices.push(...o.geometry.attributes.position.array);
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of materials)
          if (m.name.includes('paint') && 'color' in m)
            paints.add((m.color as import('three').Color).getHexString());
      }
    });
    assert.equal(wheels.length, 4);
    shapes.add(
      createHash('sha256').update(JSON.stringify(vertices)).digest('hex'),
    );
    const vehicle = new TrafficVehicle(scene);
    const car = { x: 10, z: -1, stopped: false, direction: 1 };
    vehicle.update(car, 0.1);
    assert.equal(scene.rotation.y, Math.PI / 2);
    const start = wheels.map((w) => w.rotation.x);
    car.x += 0.26;
    vehicle.update(car, 0.1);
    wheels.forEach((w, i) =>
      assert.ok(Math.abs(w.rotation.x - start[i] - 1) < 0.001),
    );
    car.stopped = true;
    const stopped = wheels.map((w) => w.rotation.x);
    vehicle.update(car, 10);
    assert.deepEqual(
      wheels.map((w) => w.rotation.x),
      stopped,
    );
  }
  assert.equal(shapes.size, 4);
  assert.equal(paints.size, 4);
});
