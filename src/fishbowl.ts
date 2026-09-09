import * as THREE from 'three';
import type { Tool } from './game';

/** Original visible water volume, fitted between the Blender bowl base and rim. */
export function addBowlWater(animal: THREE.Group, cloudy: boolean) {
  const geometry = new THREE.CylinderGeometry(0.69, 0.73, 1.1, 48, 16);
  const points = geometry.attributes.position;
  for (let i = 0; i < points.count; i++) {
    const t = (points.getY(i) + 0.55) / 1.1;
    const bulge = 1 + 0.32 * Math.sin(Math.PI * t);
    points.setX(i, points.getX(i) * bulge);
    points.setZ(i, points.getZ(i) * bulge);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    color: cloudy ? 0x9eb998 : 0x9edce3,
    transparent: true,
    opacity: cloudy ? 0.24 : 0.16,
    roughness: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const water = new THREE.Mesh(geometry, material);
  water.name = 'bowl_water';
  water.userData.bowlWater = true;
  water.position.y = 0.68;
  animal.add(water);
  return () => {
    animal.remove(water);
    geometry.dispose();
    material.dispose();
  };
}

/** Water tools sample the bowl; optical tools can still see the fish through it. */
export function instrumentHit(hits: THREE.Intersection[], tool: Tool) {
  if (tool === 'water-test' || tool === 'water-care')
    return hits.find((hit) => hit.object.userData.bowlWater) ?? hits[0];
  return hits.find((hit) => !hit.object.userData.bowlWater);
}
