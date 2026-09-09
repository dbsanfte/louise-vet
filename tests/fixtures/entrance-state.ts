import { TownSimulation } from '../../src/town-simulation.ts';
import { visits } from '../../src/game.ts';
import { clinicDoor } from '../../src/town-map.ts';

export function crowdedClinic() {
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic([0, 1, 2, 3]);
  const snapshot = s.snapshot();
  snapshot.time = 100;
  snapshot.catalogueCursor = visits.length;
  snapshot.emergencies.due = 99999;
  for (const [i, h] of snapshot.households.entries()) {
    h.nextCare = 99999;
    if (h.inClinic) continue;
    const id = snapshot.nextTicket++;
    snapshot.tickets.push({
      id,
      pet: s.households[i].pets[0].name,
      reason: 'post-fire',
      status: 'travelling',
      origin: { ...clinicDoor },
      createdAt: 90,
    });
    Object.assign(h, {
      ticket: id,
      routine: 'clinic-wait',
      position: { ...clinicDoor },
      route: [],
      companions: s.households[i].pets.map((p) => p.name),
    });
  }
  const legacy: Partial<typeof snapshot> = snapshot;
  delete legacy.entrance;
  if (!s.restore(legacy)) throw Error('Invalid crowded clinic fixture');
  return s;
}
