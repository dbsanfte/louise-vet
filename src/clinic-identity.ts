import type { PetActivity } from './clinic-leisure.ts';
import type { Species } from './game.ts';

export type ClinicInfo = {
  name: string;
  description: string;
  bubble?: 'speech' | 'thought' | 'label';
  feeling?: string;
  messages?: string[];
};
export const clinicAttractions: Record<
  string,
  { name: string; feeling: string }
> = {
  scratch: {
    name: 'Scratching post',
    feeling: 'Ooh, lovely scratch!',
  },
  wheel: {
    name: 'Exercise wheel',
    feeling: 'Little legs, go go go!',
  },
  carousel: { name: 'Merry-go-round', feeling: 'Whee! Round we go!' },
  toys: { name: 'Toy corner', feeling: 'Ooh! My favourite toy!' },
  coaster: {
    name: 'Pet rollercoaster',
    feeling: 'Wheee! Here comes the hill!',
  },
  ferris: {
    name: 'Pet Ferris wheel',
    feeling: 'Wow! I can see my house!',
  },
  'treat-dispenser': {
    name: 'Treat dispenser',
    feeling: 'Mmm, yummy!',
  },
  'water-dispenser': {
    name: 'Water dispenser',
    feeling: 'Ahh! A cool drink!',
  },
  bubbles: { name: 'Bubble chase', feeling: 'Pop! Got that bubble!' },
  'cat-nook': {
    name: 'Cosy cat nook',
    feeling: 'So cosy… purrr…',
  },
  'bird-chimes': {
    name: 'Bird chime arch',
    feeling: 'Chirp! What a pretty tune!',
  },
  'toy-box': {
    name: 'Bouncy toy box',
    feeling: 'Come back, bouncy ball!',
  },
  yarn: {
    name: 'Yarn-ball corner',
    feeling: 'Pounce! Silly wiggly yarn!',
  },
  aviary: {
    name: 'Bird aviary',
    feeling: 'Flap, flap! Lovely space!',
  },
  'play-tree': {
    name: 'Friendly play tree',
    feeling: 'My lovely leafy lookout!',
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
export const foodFeelings: Record<Species, string> = {
  dog: 'Yum! Crunchy doggy treats!',
  cat: 'Purrr… tasty kitty nibbles!',
  bird: 'Chirp! Lovely little seeds!',
  rabbit: 'Nibble, nibble! Yummy greens!',
  hamster: 'Mmm! A snack for my cheeks!',
  gerbil: 'Crunch! Tasty little grains!',
  goldfish: 'Bloop! Delicious fish flakes!',
};
export function attractionFeeling(activity?: PetActivity, species?: Species) {
  return activity?.phase === 'use'
    ? activity.station === 'treat-dispenser' && species
      ? foodFeelings[species]
      : clinicAttractions[activity.station]?.feeling
    : undefined;
}
