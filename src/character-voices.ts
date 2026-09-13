import { visits } from './game.ts';
import { dialogue } from './character-dialogue.ts';

type Voice = {
  kind: 'pet' | 'owner';
  friend: string;
  variation: number;
};
export const characterVoices: Record<string, Voice> = {
  Louise: { kind: 'owner', friend: '', variation: 0 },
};
for (const pet of visits) {
  const family = visits.filter((p) => p.owner === pet.owner);
  characterVoices[pet.name] = {
    kind: 'pet',
    friend: pet.owner,
    variation: visits.indexOf(pet),
  };
  characterVoices[pet.owner] = {
    kind: 'owner',
    friend: family.map((p) => p.name).join(' and '),
    variation: 0,
  };
}

// Different five-line selections let pets have individual repertoires without
// forcing a name or catchphrase into every thought. Build each pool only once.
const thoughtChoices = new Map<readonly string[], string[][]>();
function thoughts(pool: readonly string[], variation: number): string[] {
  let choices = thoughtChoices.get(pool);
  if (!choices) {
    const lines = [...new Set(pool.flatMap((part) => part.split('|')))];
    choices = [];
    const choose = (from: number, selected: string[]) => {
      if (selected.length === 5) {
        choices!.push(selected);
        return;
      }
      for (let i = from; i <= lines.length - (5 - selected.length); i++)
        choose(i + 1, [...selected, lines[i]]);
    };
    choose(0, []);
    thoughtChoices.set(pool, choices);
  }
  return choices[(variation * 37) % choices.length];
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
    voice.kind === 'pet'
      ? bank?.pet && thoughts(bank.pet, voice.variation)
      : bank?.owner?.split('|');
  if (!lines) throw new Error(`Missing ${voice.kind} dialogue: ${action}`);
  return lines.map((line) =>
    line.replaceAll('{friend}', companion ?? voice.friend),
  );
}
