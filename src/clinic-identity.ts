import type { PetActivity } from './clinic-leisure.ts';

export type ClinicInfo = {
  name: string;
  description: string;
  feeling?: string;
};
export const clinicAttractions: Record<
  string,
  { name: string; feeling: string }
> = {
  scratch: {
    name: 'Scratching post',
    feeling: 'Content — that scratch feels lovely!',
  },
  wheel: {
    name: 'Exercise wheel',
    feeling: 'Energetic — happy to stretch those legs!',
  },
  carousel: { name: 'Merry-go-round', feeling: 'Delighted — round and round!' },
  toys: { name: 'Toy corner', feeling: 'Playful — so many toys to explore!' },
  coaster: {
    name: 'Pet rollercoaster',
    feeling: 'Excited — whee, a little hill!',
  },
  ferris: {
    name: 'Pet Ferris wheel',
    feeling: 'Curious — what a lovely view!',
  },
  'treat-dispenser': {
    name: 'Treat dispenser',
    feeling: 'Delighted — a tasty little treat!',
  },
  'water-dispenser': {
    name: 'Water dispenser',
    feeling: 'Refreshed — a lovely cool drink!',
  },
  bubbles: { name: 'Bubble chase', feeling: 'Playful — pop! Another bubble!' },
  'cat-nook': {
    name: 'Cosy cat nook',
    feeling: 'Cosy — ready for a little snooze.',
  },
  'bird-chimes': {
    name: 'Bird chime arch',
    feeling: 'Curious — listening to the tinkling chimes.',
  },
  'toy-box': {
    name: 'Bouncy toy box',
    feeling: 'Bouncy — chasing the rolling ball!',
  },
  yarn: {
    name: 'Yarn-ball corner',
    feeling: 'Playful — that yarn won’t sit still!',
  },
  aviary: {
    name: 'Bird aviary',
    feeling: 'Cheerful — room to stretch those wings!',
  },
  'play-tree': {
    name: 'Friendly play tree',
    feeling: 'Relaxed — a peaceful place above the room.',
  },
};
export const clinicFixtureNames: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(clinicAttractions).map(([id, info]) => [id, info.name]),
  ),
  'puzzle-table': 'Puzzle picnic table',
  'table-games': 'Board-game table',
  books: 'Books and magazines',
};

/** A description of the current turn, never a new mood score or saved trait. */
export function attractionFeeling(activity?: PetActivity) {
  return activity?.phase === 'use'
    ? clinicAttractions[activity.station]?.feeling
    : undefined;
}
