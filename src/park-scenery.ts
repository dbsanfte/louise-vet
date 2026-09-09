import * as THREE from 'three';
import { parkPlan, type Park } from './park.ts';
/** Shared station ornaments and a small duck family follow the park's active clock. */
export class ParkScenery {
  readonly group = new THREE.Group();
  private ducks: THREE.Group[] = [];
  private ripples: THREE.Mesh[] = [];
  private ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xe8d85b }),
  );
  private butterfly = new THREE.Group();
  constructor(park: THREE.Group, duck: THREE.Group) {
    this.group.add(park, this.ball, this.butterfly);
    for (let i = 0; i < 4; i++) {
      const d = duck.clone(true);
      d.userData.townLabel = i < 2 ? 'Pond duck' : 'Duckling';
      d.scale.setScalar(i > 1 ? 0.52 : 0.78);
      this.ducks.push(d);
      this.group.add(d);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.23, 0.009, 4, 24),
        new THREE.MeshBasicMaterial({
          color: 0xb4e6df,
          transparent: true,
          opacity: 0.5,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      this.ripples.push(ring);
      this.group.add(ring);
    }
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(
        new THREE.SphereGeometry(1, 8, 6),
        new THREE.MeshStandardMaterial({
          color: side < 0 ? 0xeaa365 : 0xdb87b3,
        }),
      );
      wing.scale.set(0.11, 0.015, 0.17);
      wing.position.x = side * 0.085;
      this.butterfly.add(wing);
    }
  }
  update(time: number, park: Park) {
    const pond = parkPlan.pond;
    this.ducks.forEach((duck, i) => {
      const a = time * 0.22 + (i * Math.PI) / 2,
        r = i > 1 ? 0.64 : 0.84;
      duck.position.set(
        pond.x + Math.cos(a) * r,
        0.16 + Math.sin(time * 2 + i) * 0.015,
        pond.z + Math.sin(a) * r,
      );
      // The exported bill points along -Z; face the tangent of the swim circle.
      duck.rotation.y = Math.PI - a;
      duck.traverse((o) => {
        if (o.name.startsWith('duck_wing'))
          o.rotation.z = Math.sin(time * 4 + i) * 0.06;
      });
      const ring = this.ripples[i];
      ring.position.set(duck.position.x, 0.182, duck.position.z);
      ring.scale.setScalar(0.8 + ((time * 0.5 + i * 0.2) % 1) * 0.65);
    });
    const fetch = parkPlan.stations.find((s) => s.id === 'fetch')!,
      pounce = parkPlan.stations.find((s) => s.id === 'pounce')!;
    const pet = [...park.visits.values()]
      .flatMap((v) => v.pets)
      .find((p) => p.station === 'fetch' && p.phase === 'use');
    this.ball.position.set(
      fetch.x + (pet ? Math.sin(pet.elapsed * 1.4 + 0.5) * 0.85 : 0),
      0.22,
      fetch.z + (pet ? 0 : 0.58),
    );
    this.butterfly.position.set(
      pounce.x + Math.sin(time) * 0.45,
      0.8 + Math.sin(time * 2) * 0.1,
      pounce.z + Math.cos(time) * 0.25,
    );
    this.butterfly.children.forEach(
      (o, i) => (o.rotation.z = Math.sin(time * 13) * (i ? 1 : -1) * 0.7),
    );
  }
}
