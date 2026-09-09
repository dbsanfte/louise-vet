import * as THREE from 'three';
import { streetDetails, type DogWalks } from './dog-walks';
import type { Household } from './town-simulation';
export class StreetScenery {
  group = new THREE.Group();
  private breaks: { poo: THREE.Group; bag: THREE.Group; wee: THREE.Line }[] =
    [];
  constructor(clone: (name: string) => THREE.Group, count: number) {
    for (const prop of streetDetails) {
      const model = clone(prop.kind);
      model.position.set(prop.x, 0.15, prop.z);
      model.userData.streetDetail = prop.id;
      this.group.add(model);
    }
    for (let i = 0; i < count; i++) {
      const poo = clone('dog-poo'),
        bag = clone('cleanup-bag');
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(24), 3),
      );
      const wee = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({
          color: 0xe4c776,
          transparent: true,
          opacity: 0.55,
        }),
      );
      for (const [name, prop] of Object.entries({ poo, bag, wee })) {
        prop.userData.dogProp = name;
        prop.userData.household = i;
      }
      poo.visible = bag.visible = wee.visible = false;
      this.group.add(poo, bag, wee);
      this.breaks.push({ poo, bag, wee });
    }
  }
  update(walks: DogWalks, households: Household[]) {
    this.breaks.forEach((props, i) => {
      const b = walks.active.get(i),
        h = households[i];
      props.poo.visible = Boolean(b?.litter);
      props.bag.visible = Boolean(
        b?.kind === 'poo' && ['collect', 'return'].includes(b.phase),
      );
      props.wee.visible = Boolean(b?.kind === 'wee' && b.phase === 'toilet');
      if (!b) return;
      props.poo.position.set(
        b.spot.x - Math.sin(b.facing) * 0.28,
        0.16,
        b.spot.z - Math.cos(b.facing) * 0.28,
      );
      props.bag.position.set(
        h.position.x + Math.sin(h.facing) * 0.3 + Math.cos(h.facing) * 0.2,
        b.phase === 'collect' ? 0.28 : 0.5,
        h.position.z + Math.cos(h.facing) * 0.3 - Math.sin(h.facing) * 0.2,
      );
      if (props.wee.visible) {
        const site = streetDetails.find((s) => s.id === b.site)!;
        const attr = props.wee.geometry.attributes.position;
        for (let k = 0; k < 8; k++) {
          const t = k / 7;
          attr.setXYZ(
            k,
            b.spot.x + (site.x - b.spot.x) * t,
            0.43 - 0.25 * t * t,
            b.spot.z + (site.z - b.spot.z) * t,
          );
        }
        attr.needsUpdate = true;
        props.wee.geometry.computeBoundingSphere();
      }
    });
  }
}
