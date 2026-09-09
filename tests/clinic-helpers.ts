import assert from 'node:assert/strict';
import type { TownSimulation } from '../src/town-simulation.ts';
/** Calling care now includes the family's visible walk to the counter and examination room. */
export function callToRoom(s: TownSimulation, id: number) {
  for (let i = 0; i < 500; i++) {
    if (s.startVisit(id)) return true;
    s.update(0.1);
  }
  assert.fail(`Patient ${id} did not reach the examination room`);
}
