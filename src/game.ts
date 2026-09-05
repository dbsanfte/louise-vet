export type Species =
  'dog' | 'cat' | 'rabbit' | 'hamster' | 'gerbil' | 'goldfish';
export type Zone = 'ear' | 'chest' | 'paw' | 'coat' | 'mouth' | 'tank' | 'fin';
export type Tool =
  | 'listen'
  | 'ear'
  | 'inspect'
  | 'xray'
  | 'mouth'
  | 'water-test'
  | 'cream'
  | 'drops'
  | 'bandage'
  | 'comb'
  | 'vaccine'
  | 'brush'
  | 'water-care';
export interface Check {
  tool: Tool;
  zone: Zone;
  finding: string;
}
export interface Visit {
  name: string;
  owner: string;
  species: Species;
  breed: string;
  age: string;
  quote: string;
  symptom: string;
  diagnosis: string;
  alternatives: string[];
  checks: Check[];
  treatment: Tool;
  zone: Zone;
  aftercare: string;
  color: string;
}

export const visits: Visit[] = [
  {
    name: 'Luna',
    owner: 'Amelia',
    species: 'dog',
    breed: 'Golden retriever',
    age: '3 years',
    color: 'peach',
    symptom: 'A tender little paw',
    quote:
      'Luna was exploring the flowers. Now she keeps licking her front paw.',
    diagnosis: 'Bee sting',
    alternatives: ['Fleas', 'Ear irritation'],
    checks: [
      {
        tool: 'inspect',
        zone: 'paw',
        finding: 'A small pink bump on the paw. It looks like a little sting.',
      },
      {
        tool: 'listen',
        zone: 'chest',
        finding: 'A calm, steady heartbeat. Luna is feeling brave.',
      },
    ],
    treatment: 'cream',
    zone: 'paw',
    aftercare:
      'A quiet afternoon and a little extra kindness. Luna is ready to head home.',
  },
  {
    name: 'Milo',
    owner: 'Oliver',
    species: 'cat',
    breed: 'British shorthair',
    age: '2 years',
    color: 'blue',
    symptom: 'A bothersome ear',
    quote:
      'Milo keeps shaking his head and scratching one ear. Can you have a look?',
    diagnosis: 'Ear irritation',
    alternatives: ['Bee sting', 'Sore paw'],
    checks: [
      {
        tool: 'ear',
        zone: 'ear',
        finding: 'This ear looks irritated. That explains the head shaking.',
      },
      {
        tool: 'listen',
        zone: 'chest',
        finding: 'A steady heartbeat, with a small rumble of purring.',
      },
    ],
    treatment: 'drops',
    zone: 'ear',
    aftercare:
      'A gentle ear-care plan and a cosy place to rest. Lovely work, Louise!',
  },
  {
    name: 'Pip',
    owner: 'Sophie',
    species: 'rabbit',
    breed: 'Little lop rabbit',
    age: '1 year',
    color: 'pink',
    symptom: 'A wobbly hop',
    quote:
      'Pip landed awkwardly during a big hop. His front paw needs some help.',
    diagnosis: 'Sore paw',
    alternatives: ['Fleas', 'Ear irritation'],
    checks: [
      {
        tool: 'xray',
        zone: 'paw',
        finding:
          'The storybook X-ray shows a tiny crack. This paw needs support.',
      },
      {
        tool: 'listen',
        zone: 'chest',
        finding: 'A quick but regular rabbit heartbeat. Pip is settling down.',
      },
    ],
    treatment: 'bandage',
    zone: 'paw',
    aftercare:
      'A soft support wrap and lots of rest. We will see Pip again for a check-up.',
  },
  {
    name: 'Peanut',
    owner: 'Noah',
    species: 'hamster',
    breed: 'Golden hamster',
    age: '8 months',
    color: 'peach',
    symptom: 'An itchy coat',
    quote:
      'Peanut has been scratching instead of enjoying the wheel. Something is tickly!',
    diagnosis: 'Fleas',
    alternatives: ['Bee sting', 'Sore paw'],
    checks: [
      {
        tool: 'inspect',
        zone: 'coat',
        finding:
          'Tiny specks hiding in the fur. We have found the itchy visitors.',
      },
      {
        tool: 'listen',
        zone: 'chest',
        finding: 'A lively little heartbeat. The itch is the main problem.',
      },
    ],
    treatment: 'comb',
    zone: 'coat',
    aftercare:
      'All fresh and comfortable. Peanut’s bedding will need a lovely clean too.',
  },
  {
    name: 'Sunny',
    owner: 'Isla',
    species: 'gerbil',
    breed: 'Mongolian gerbil',
    age: '1 year',
    color: 'yellow',
    symptom: 'A tangled patch of fur',
    quote:
      'Sunny has a little tangle after a very adventurous morning in the bedding.',
    diagnosis: 'Tangled fur',
    alternatives: ['Ear irritation', 'Sore paw'],
    checks: [
      {
        tool: 'inspect',
        zone: 'coat',
        finding:
          'A tiny tangle with some bedding caught inside. No itchy visitors.',
      },
      {
        tool: 'listen',
        zone: 'chest',
        finding: 'Everything sounds bright and lively.',
      },
    ],
    treatment: 'brush',
    zone: 'coat',
    aftercare:
      'A smooth coat for a happy explorer. Time to get back to digging!',
  },
  {
    name: 'Bubbles',
    owner: 'Leo',
    species: 'goldfish',
    breed: 'Fancy goldfish',
    age: '2 years',
    color: 'blue',
    symptom: 'A cloudy-water day',
    quote:
      'Bubbles seems a little quiet, and the water in the travel bowl looks cloudy.',
    diagnosis: 'Water needs care',
    alternatives: ['Tangled fur', 'Sore paw'],
    checks: [
      {
        tool: 'water-test',
        zone: 'tank',
        finding: 'The pretend water test is outside the happy blue zone.',
      },
      {
        tool: 'inspect',
        zone: 'fin',
        finding: 'The fins look fine. Let’s focus on the water.',
      },
    ],
    treatment: 'water-care',
    zone: 'tank',
    aftercare:
      'Fresh surroundings and a follow-up water check. Bubbles is exploring again.',
  },
  {
    name: 'Hazel',
    owner: 'Grace',
    species: 'dog',
    breed: 'Young retriever',
    age: '1 year',
    color: 'yellow',
    symptom: 'A routine vaccination',
    quote:
      'Hazel is here for her scheduled vaccination. She has been very brave today.',
    diagnosis: 'Routine vaccination',
    alternatives: ['Fleas', 'Ear irritation'],
    checks: [
      {
        tool: 'listen',
        zone: 'chest',
        finding: 'A steady heartbeat. Hazel is ready for her routine visit.',
      },
      {
        tool: 'inspect',
        zone: 'coat',
        finding: 'A healthy coat, and the storybook care card is up to date.',
      },
    ],
    treatment: 'vaccine',
    zone: 'coat',
    aftercare:
      'A bravery sticker and a little rest. Hazel’s care card has been updated.',
  },
  {
    name: 'Cleo',
    owner: 'Freddie',
    species: 'cat',
    breed: 'Silver house cat',
    age: '4 years',
    color: 'pink',
    symptom: 'A tooth-care visit',
    quote:
      'Cleo is due for her tooth-care visit. She brought her favourite little blanket.',
    diagnosis: 'Teeth need a clean',
    alternatives: ['Bee sting', 'Fleas'],
    checks: [
      {
        tool: 'mouth',
        zone: 'mouth',
        finding: 'A little build-up on the teeth. A gentle clean will help.',
      },
      {
        tool: 'listen',
        zone: 'chest',
        finding: 'Cleo is relaxed and her heartbeat is steady.',
      },
    ],
    treatment: 'brush',
    zone: 'mouth',
    aftercare: 'A sparkling smile and a tooth-care plan for home. Well done!',
  },
];

export const toolInfo: Record<
  Tool,
  { name: string; icon: string; hint: string }
> = {
  listen: {
    name: 'Stethoscope',
    icon: 'stethoscope',
    hint: 'Listen at the chest',
  },
  ear: { name: 'Ear scope', icon: 'search', hint: 'Look inside an ear' },
  inspect: {
    name: 'Magnifier',
    icon: 'search',
    hint: 'Look closely at the problem',
  },
  xray: { name: 'X-ray', icon: 'scan', hint: 'Check a sore paw' },
  mouth: { name: 'Mouth mirror', icon: 'search', hint: 'Look at the teeth' },
  'water-test': {
    name: 'Water test',
    icon: 'drop',
    hint: 'Check the bowl water',
  },
  cream: {
    name: 'Soothing cream',
    icon: 'jar',
    hint: 'Soothe the little sting',
  },
  drops: {
    name: 'Ear drops',
    icon: 'drop',
    hint: 'Care for the irritated ear',
  },
  bandage: {
    name: 'Soft bandage',
    icon: 'bandage',
    hint: 'Support the sore paw',
  },
  comb: { name: 'Flea comb', icon: 'comb', hint: 'Gently comb the coat' },
  vaccine: {
    name: 'Vaccine',
    icon: 'plus',
    hint: 'A tiny storybook vaccination',
  },
  brush: {
    name: 'Gentle brush',
    icon: 'comb',
    hint: 'Carefully brush the problem area',
  },
  'water-care': {
    name: 'Water care',
    icon: 'drop',
    hint: 'Freshen the bowl water',
  },
};
export const zoneNames: Record<Zone, string> = {
  ear: 'Ear',
  chest: 'Chest',
  paw: 'Front paw',
  coat: 'Coat',
  mouth: 'Mouth',
  tank: 'Bowl water',
  fin: 'Fin',
};
export const upgrades = [
  {
    id: 'plants',
    name: 'A little more green',
    kind: 'Decoration',
    price: 60,
    icon: 'leaf',
    description:
      'Leafy friends for a welcoming clinic. +3 happiness per visit.',
  },
  {
    id: 'stock',
    name: 'Treat shelf refill',
    kind: 'Shop stock',
    price: 35,
    icon: 'jar',
    description:
      'Six treats for the shelf. Families buy one for 9 coins after a visit.',
  },
  {
    id: 'bench',
    name: 'Comfy waiting seats',
    kind: 'Furniture',
    price: 90,
    icon: 'chair',
    description: 'A softer spot for little paws. +4 happiness per visit.',
  },
  {
    id: 'equipment',
    name: 'Steady-paw tool kit',
    kind: 'Equipment',
    price: 150,
    icon: 'stethoscope',
    description: 'Better tools make the green timing zone wider.',
  },
  {
    id: 'poster',
    name: 'Tell the neighbourhood',
    kind: 'Advertising',
    price: 110,
    icon: 'megaphone',
    description: 'A friendly local poster brings visitors more often.',
  },
  {
    id: 'expansion',
    name: 'Room for more paws',
    kind: 'Expansion',
    price: 240,
    icon: 'home',
    description:
      'Open the side waiting area. Room for six waiting patients instead of four.',
  },
] as const;
export type UpgradeId = (typeof upgrades)[number]['id'];
export interface Progress {
  version: 1;
  coins: number;
  earned: number;
  happiness: number;
  treated: number;
  stock: number;
  upgrades: UpgradeId[];
  sound: boolean;
}
const KEY = 'louises-vet-office-v1';
const defaults = (): Progress => ({
  version: 1,
  coins: 120,
  earned: 0,
  happiness: 100,
  treated: 0,
  stock: 3,
  upgrades: [],
  sound: false,
});
export function loadProgress(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!p || p.version !== 1) return defaults();
    const valid = (v: unknown, max: number) =>
      typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
    if (
      !valid(p.coins, 1e9) ||
      !valid(p.earned, 1e9) ||
      !valid(p.happiness, 100) ||
      !valid(p.treated, 1e7) ||
      !valid(p.stock, 1000) ||
      !Array.isArray(p.upgrades)
    )
      return defaults();
    return {
      ...defaults(),
      coins: Math.floor(p.coins),
      earned: Math.floor(p.earned),
      happiness: p.happiness,
      treated: Math.floor(p.treated),
      stock: Math.floor(p.stock),
      upgrades: [
        ...new Set<UpgradeId>(
          p.upgrades.filter(
            (id: UpgradeId) =>
              id !== 'stock' && upgrades.some((u) => u.id === id),
          ),
        ),
      ],
      sound: p.sound === true,
    };
  } catch {
    return defaults();
  }
}
export function saveProgress(p: Progress): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}
export function purchase(p: Progress, id: string): boolean {
  const item = upgrades.find((u) => u.id === id);
  if (
    !item ||
    p.coins < item.price ||
    (id !== 'stock' && p.upgrades.includes(item.id)) ||
    (id === 'stock' && p.stock > 994)
  )
    return false;
  p.coins -= item.price;
  if (id === 'stock') p.stock += 6;
  else p.upgrades.push(item.id);
  return true;
}
export function reward(p: Progress, quality: number) {
  const bonus =
    (p.upgrades.includes('plants') ? 3 : 0) +
    (p.upgrades.includes('bench') ? 4 : 0);
  const satisfaction = Math.min(100, Math.max(50, Math.round(quality + bonus)));
  const fee = 35 + Math.round(satisfaction * 0.35);
  const tip = Math.round(satisfaction * 0.15);
  const retail = p.stock > 0 ? 9 : 0;
  if (retail) p.stock--;
  p.coins += fee + tip + retail;
  p.earned += fee + tip + retail;
  p.happiness = Math.round(
    (p.happiness * p.treated + satisfaction) / (p.treated + 1),
  );
  p.treated++;
  return { satisfaction, fee, tip, retail, total: fee + tip + retail };
}
