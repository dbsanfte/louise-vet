import * as THREE from 'three';
/** Fish remain in their own water while the clinic trolley visits a dock. */
export class FishEnrichment {
  readonly swimmer = new THREE.Group();
  readonly hoop: THREE.Mesh;
  readonly bubbles: THREE.Mesh[] = [];
  private blend = 0;
  constructor(model: THREE.Group) {
    this.swimmer.name = 'SwimmingInsideBowl';
    const root = model.getObjectByName('goldfish')!;
    root.add(this.swimmer);
    for (const part of [...root.children])
      if (/^(body|eye|pupil|tail|fin)(\.|$)/.test(part.name)) {
        root.updateMatrixWorld(true);
        this.swimmer.attach(part);
      }
    this.hoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.43, 0.028, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xf3ce76, roughness: 0.55 }),
    );
    this.hoop.name = 'UnderwaterReefHoop';
    this.hoop.position.set(0, 0.65, 0);
    root.add(this.hoop);
    const geometry = new THREE.SphereGeometry(0.045, 8, 6),
      material = new THREE.MeshStandardMaterial({
        color: 0xcceef2,
        transparent: true,
        opacity: 0.6,
        roughness: 0.2,
      });
    for (let i = 0; i < 5; i++) {
      const bubble = new THREE.Mesh(geometry, material);
      bubble.name = 'UnderwaterPlayBubble';
      root.add(bubble);
      this.bubbles.push(bubble);
    }
    this.update(undefined, 0, 0);
  }
  update(kind: string | undefined, elapsed: number, dt: number) {
    const active = kind === 'fish-bubbles' || kind === 'fish-reef';
    this.blend = THREE.MathUtils.damp(this.blend, active ? 1 : 0, 3, dt);
    const b = this.blend,
      angle = elapsed * 0.9;
    this.swimmer.scale.setScalar(1 - b * 0.32);
    this.swimmer.position.set(
      Math.cos(angle) * 0.16 * b,
      0.65 * (1 - this.swimmer.scale.y) + Math.sin(angle * 2) * 0.025 * b,
      Math.sin(angle) * 0.25 * b,
    );
    this.swimmer.rotation.y = active
      ? Math.atan2(-Math.sin(angle) * 0.16, Math.cos(angle) * 0.25)
      : this.swimmer.rotation.y * (1 - Math.min(1, dt * 5));
    this.hoop.visible = kind === 'fish-reef';
    this.bubbles.forEach((bubble, i) => {
      bubble.visible = active;
      bubble.position.set(
        Math.sin(i * 2.1) * 0.38,
        0.2 + ((elapsed * 0.18 + i * 0.17) % 1) * 0.9,
        Math.cos(i * 2.1) * 0.35,
      );
    });
  }
}
