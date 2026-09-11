import type { Visit } from './game.ts';
import type { ClinicInfo } from './clinic-identity.ts';

// Individual sound patterns, never English dialogue. Fish stay silent; their
// reactions are thoughts, rather than pretending that bubbles are speech.
const calls: Record<string, readonly [string, string]> = {
  Luna: ['Woof', 'ruff'],
  Scout: ['Arf', 'woof'],
  Daisy: ['Bark', 'woof'],
  Biscuit: ['Mew', 'mrrp'],
  Teddy: ['Woof', 'yip'],
  Waffles: ['Arf', 'ruff'],
  Milo: ['Meow', 'mrrp'],
  Cleo: ['Mew', 'purr'],
  Maple: ['Ruff', 'woof'],
  Mochi: ['Purr', 'mew'],
  Ziggy: ['Meow', 'purr'],
  Pico: ['Chirp', 'tweet'],
  Pepper: ['Tweet', 'chirrup'],
  Melody: ['Chirrup', 'chirp'],
  Pip: ['Snuff', 'snff'],
  Poppy: ['Mrrp', 'mew'],
  Clover: ['Snuff', 'snuff'],
  Peanut: ['Squeak', 'squeak'],
  Hazel: ['Bark', 'ruff'],
  Nibbles: ['Eep', 'squeak'],
  Sunny: ['Peep', 'squeak'],
  Pebble: ['Squeak', 'peep'],
};
export function petReply(pet: Visit): ClinicInfo | undefined {
  if (pet.species === 'goldfish') return undefined;
  const pair = calls[pet.name];
  if (!pair) throw Error(`Missing pet reply: ${pet.name}`);
  const [a, b] = pair;
  return {
    name: pet.name,
    description: '',
    bubble: 'speech',
    feeling: `${a}, ${b}!`,
    messages: [
      `${a}, ${b}!`,
      `${a}, ${b}, ${b}!`,
      `${a}, ${b}?`,
      `${a}, ${b}… ${a.toLowerCase()}!`,
      `${a}, ${b}! ${b}!`,
    ],
  };
}
