import * as THREE from 'three';
import { partyPlan, type PetParties } from './pet-parties';

/** One small instanced bubble effect and a readable sign; no particle allocations per frame. */
export class PartyScenery {
  readonly group = new THREE.Group();
  private canvas = document.createElement('canvas');
  private texture: THREE.CanvasTexture;
  private label = '';
  private pose = new THREE.Object3D();
  private bubbles = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.07, 8, 6),
    new THREE.MeshStandardMaterial({
      color: 0xbceef5,
      transparent: true,
      opacity: 0.6,
      roughness: 0.12,
      metalness: 0.15,
      depthWrite: false,
    }),
    24,
  );
  constructor(hall: THREE.Group) {
    this.group.name = 'PetPartyHall';
    this.group.userData.townLabel = partyPlan.name;
    this.group.add(hall, this.bubbles);
    this.bubbles.frustumCulled = false;
    this.canvas.width = 768;
    this.canvas.height = 160;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 1.25),
      new THREE.MeshBasicMaterial({
        map: this.texture,
        side: THREE.DoubleSide,
      }),
    );
    sign.position.set(-20, 2.17, 12.12);
    sign.rotation.y = Math.PI;
    this.group.add(sign);
  }
  update(time: number, parties: PetParties) {
    const party = parties.active;
    const label = party ? `${party.pet}’s birthday!` : partyPlan.name;
    this.group.userData.townLabel = parties.description();
    if (label !== this.label) {
      this.label = label;
      const c = this.canvas.getContext('2d')!;
      c.fillStyle = '#356c63';
      c.fillRect(0, 0, 768, 160);
      c.fillStyle = '#fff4dc';
      c.textAlign = 'center';
      c.font = 'bold 54px Nunito, sans-serif';
      c.fillText(label, 384, 72, 730);
      c.font = '30px Nunito, sans-serif';
      c.fillText('Birthdays · bubbles · friends', 384, 125);
      this.texture.needsUpdate = true;
    }
    this.bubbles.visible = party?.phase === 'games';
    if (!this.bubbles.visible) return;
    for (let i = 0; i < 24; i++) {
      const seat = partyPlan.seats[Math.floor(i / 6)],
        age = (time * 0.35 + i * 0.17) % 1;
      this.pose.position.set(
        seat.x + Math.sin(time + i) * 0.4,
        0.3 + age * 1.7,
        8.7 + Math.cos(time * 0.8 + i) * 0.9,
      );
      this.pose.scale.setScalar(0.5 + Math.sin(age * Math.PI) * 0.6);
      this.pose.updateMatrix();
      this.bubbles.setMatrixAt(i, this.pose.matrix);
    }
    this.bubbles.instanceMatrix.needsUpdate = true;
  }
}
