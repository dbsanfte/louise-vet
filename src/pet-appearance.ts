import catalogue from './pet-looks.json' with { type: 'json' };
import type { Visit } from './game.ts';
export const petLooks = catalogue.looks;
export function petLook(visit: Pick<Visit, 'name' | 'species'>) {
  const id = (catalogue.pets as Record<string, string>)[visit.name];
  return (
    petLooks.find((look) => look.id === id && look.species === visit.species) ??
    petLooks.find((look) => look.species === visit.species)
  );
}
export function petAsset(visit: Pick<Visit, 'name' | 'species'>) {
  const look = petLook(visit);
  return look ? `pets/${look.id}` : visit.species;
}
