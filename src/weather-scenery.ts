import * as THREE from 'three';
import type { TownWeather } from './town-weather';
/** One bounded rain draw; no particles inside the clinic's cutaway view. */
export class WeatherScenery {
  readonly group = new THREE.Group();
  private rain: THREE.LineSegments;
  private seeds: { x: number; z: number; y: number }[] = [];
  private positions: Float32Array;
  constructor(software: boolean) {
    const count = software ? 900 : 2200;
    this.positions = new Float32Array(count * 6);
    for (let i = 0; i < count; i++)
      this.seeds.push({
        x: ((i * 37.7) % 108) - 54,
        z: ((i * 23.91) % 86) - 43,
        y: (i * 0.713) % 13,
      });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.rain = new THREE.LineSegments(
      g,
      new THREE.LineBasicMaterial({
        color: 0xb8d8ea,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    );
    this.rain.frustumCulled = false;
    this.rain.userData.weatherEffect = 'rain';
    this.group.add(this.rain);
  }
  update(weather: TownWeather, time: number, visible: boolean) {
    this.group.visible = visible && weather.phase === 'rain';
    if (!this.group.visible) return;
    for (let i = 0; i < this.seeds.length; i++) {
      const p = this.seeds[i],
        y = (((p.y - time * 8) % 13) + 13) % 13;
      // Keep drops above roofs on the central housing plots and clinic.
      const clinic = p.x > -29 && p.x < -9 && p.z > -21 && p.z < -3.5;
      const base = clinic ? 4 : 0;
      this.positions.set(
        [p.x, y + base, p.z, p.x - 0.12, y + 0.65 + base, p.z + 0.03],
        i * 6,
      );
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
  }
}
