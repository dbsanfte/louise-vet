import type { Group, Object3D } from 'three';
import { turnToward } from './movement.ts';
import type { Car } from './town-simulation.ts';

// Stable traffic slots preserve appearance through stops, rescues and old saves.
export const trafficModels = [
  'car-compact',
  'car-estate',
  'car-pickup',
  'car-van',
] as const;

export class TrafficVehicle {
  private wheels: Object3D[] = [];
  private placed = false;
  readonly model: Group;
  constructor(model: Group) {
    this.model = model;
    model.traverse((node) => {
      if (typeof node.userData.wheelRadius === 'number') this.wheels.push(node);
    });
  }
  update(car: Car, dt: number) {
    const travel = this.placed
      ? Math.hypot(car.x - this.model.position.x, car.z - this.model.position.z)
      : 0;
    for (const wheel of this.wheels)
      wheel.rotation.x =
        (wheel.rotation.x + travel / wheel.userData.wheelRadius) %
        (Math.PI * 2);
    this.model.position.set(car.x, 0.15, car.z);
    const facing = car.facing ?? (car.direction * Math.PI) / 2;
    this.model.rotation.y = this.placed
      ? turnToward(this.model.rotation.y, facing, dt)
      : facing;
    this.placed = true;
  }
}
