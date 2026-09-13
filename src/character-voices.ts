import { visits } from './game.ts';
import { dialogue } from './character-dialogue.ts';

type Voice = {
  kind: 'pet' | 'owner';
  friend: string;
  variation: 0 | 1;
};
export const characterVoices: Record<string, Voice> = {
  Louise: { kind: 'owner', friend: '', variation: 0 },
};
for (const pet of visits) {
  const family = visits.filter((p) => p.owner === pet.owner);
  characterVoices[pet.name] = {
    kind: 'pet',
    friend: pet.owner,
    variation: (family.indexOf(pet) % 2) as 0 | 1,
  };
  characterVoices[pet.owner] = {
    kind: 'owner',
    friend: family.map((p) => p.name).join(' and '),
    variation: 0,
  };
}

/** Pick complete sentences for this situation, never append a stock catchphrase.
 * An owner addresses the current companions or rescued pet, not absent family.
 */
export function messagesFor(
  name: string,
  action: string,
  companion?: string,
): string[] {
  const voice = characterVoices[name];
  if (!voice) throw new Error(`Missing character voice: ${name}`);
  const bank = dialogue[action];
  const lines =
    voice.kind === 'pet' ? bank?.pet?.[voice.variation] : bank?.owner;
  if (!lines) throw new Error(`Missing ${voice.kind} dialogue: ${action}`);
  return lines
    .split('|')
    .map((line) => line.replaceAll('{friend}', companion ?? voice.friend));
}
