import { petLook } from './pet-appearance.ts';
export type Species =
  'dog' | 'cat' | 'rabbit' | 'hamster' | 'gerbil' | 'goldfish' | 'bird';
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
  | 'water-care'
  | 'forceps'
  | 'thermometer'
  | 'cooling';
export interface Check {
  tool: Tool;
  zone: Zone;
  finding: string;
}
export type VisitReason =
  | 'authored'
  | 'vaccination'
  | 'checkup'
  | 'fever'
  | 'accident'
  | 'rescue'
  | 'paw-adventure'
  | 'post-fire';
export interface Visit {
  purpose?: 'checkup';
  name: string;
  owner: string;
  ownerModel: 'visitor' | 'visitor-ponytail' | 'visitor-bob';
  species: Species;
  sex?: 'female' | 'male';
  breed: string;
  age: string;
  quote: string;
  symptom: string;
  diagnosis: string;
  alternatives: string[];
  checks: Check[];
  clinical?: {
    skin?: 'sting' | 'fleas' | 'tangle' | 'splinter' | 'burn';
    fracture?: boolean;
    ear?: 'inflamed';
    teeth?: 'tartar' | 'cavity';
    heart?: 'fast';
    water?: 'cloudy';
    fever?: boolean;
  };
  treatment: Tool;
  zone: Zone;
  aftercare: string;
  color: string;
}

const examinationZones: Partial<Record<Tool, Zone[]>> = {
  listen: ['chest'],
  thermometer: ['coat'],
  ear: ['ear'],
  mouth: ['mouth'],
  xray: ['ear', 'chest', 'paw', 'coat', 'mouth', 'tank', 'fin'],
  'water-test': ['tank'],
  inspect: ['ear', 'chest', 'paw', 'coat', 'mouth', 'tank', 'fin'],
};

export function examine(
  visit: Visit,
  tool: Tool,
  zone: Zone,
  findingVisible = true,
):
  | { kind: 'finding'; text: string; clueIndex: number }
  | { kind: 'guidance'; text: string } {
  const available = zonesFor(visit.species);
  const targets = (
    visit.species === 'bird' && ['ear', 'mouth'].includes(tool)
      ? []
      : (examinationZones[tool] ?? [])
  ).filter((z) => available.includes(z));
  if (!targets.includes(zone)) {
    return {
      kind: 'guidance',
      text: targets.length
        ? `${toolInfo[tool].name} works at ${targets.map((z) => zoneLabel(z, visit.species).toLowerCase()).join(' or ')}. Choose one of those markers.`
        : 'Choose an examination tool for this patient.',
    };
  }
  const clueIndex = visit.checks.findIndex(
    (c) => c.tool === tool && c.zone === zone,
  );
  if (clueIndex >= 0 && !findingVisible)
    return {
      kind: 'guidance',
      text: 'Keep looking around this spot. Move the viewer closer, or look around the other side of your patient.',
    };
  if (clueIndex >= 0)
    return {
      kind: 'finding',
      text: visit.checks[clueIndex].finding,
      clueIndex,
    };

  // Normal checks are useful too: an unneeded tool must never silently fail,
  // and a surface look must not declare a hidden problem healthy.
  const closerLook = visit.checks.find(
    (c) => c.zone === zone && c.tool !== tool && c.tool !== 'listen',
  );
  let text: string;
  if (tool === 'inspect' && closerLook) {
    text = `This spot deserves a closer look. ${toolInfo[closerLook.tool].name} can help you investigate it.`;
  } else if (tool === 'ear') {
    text = `${visit.name}’s ear looks clear and comfortable. No irritation here.`;
  } else if (tool === 'mouth') {
    text = `${visit.name}’s teeth look clean and the gums look comfortable.`;
  } else if (tool === 'xray') {
    text =
      'The storybook X-ray shows no cracks in these bones. Skin and fur need a different kind of check.';
  } else if (tool === 'listen') {
    text = `A steady heartbeat. ${visit.name} is settling comfortably on the table.`;
  } else if (tool === 'thermometer') {
    text = 'Comfortable. The storybook temperature check shows no fever.';
  } else if (tool === 'water-test') {
    text = 'The water check looks comfortable for our little fish.';
  } else {
    const normal: Record<Zone, string> = {
      ear: 'The outside of the ear looks comfortable.',
      chest: 'The chest is moving gently with each breath.',
      paw: 'This paw looks comfortable on the outside.',
      coat: 'The fur looks tidy, with no little specks or tangles.',
      mouth: 'The outside of the mouth looks comfortable.',
      tank: 'You can see the bowl and water. A water tester can check what your eyes cannot see.',
      fin: 'The fin is moving gently and looks comfortable.',
    };
    text =
      visit.species === 'bird'
        ? ((
            {
              coat: 'The feathers look tidy and comfortable.',
              paw: 'Both feet look comfortable.',
              mouth: 'The beak looks smooth and comfortable.',
            } as Partial<Record<Zone, string>>
          )[zone] ?? normal[zone])
        : normal[zone];
  }
  return { kind: 'finding', text, clueIndex: -1 };
}

export const visits: Visit[] = [
  {
    name: 'Luna',
    clinical: { skin: 'sting' },
    owner: 'Amelia',
    ownerModel: 'visitor-ponytail',
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
    clinical: { ear: 'inflamed' },
    owner: 'Oliver',
    ownerModel: 'visitor',
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
    clinical: { fracture: true, heart: 'fast' },
    owner: 'Sophie',
    ownerModel: 'visitor-bob',
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
          'A clear gap and an offset in the front leg bone. Pip needs a support wrap.',
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
    clinical: { skin: 'fleas' },
    owner: 'Noah',
    ownerModel: 'visitor',
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
    clinical: { skin: 'tangle' },
    owner: 'Isla',
    ownerModel: 'visitor-ponytail',
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
    clinical: { water: 'cloudy' },
    owner: 'Leo',
    ownerModel: 'visitor',
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
    ownerModel: 'visitor-bob',
    species: 'dog',
    breed: 'Young retriever',
    age: '1 year',
    color: 'yellow',
    symptom: 'A routine vaccination',
    quote:
      'Hazel is here for her scheduled vaccination. She has been very brave today.',
    diagnosis: 'Routine vaccination',
    alternatives: [],
    checks: [],
    treatment: 'vaccine',
    zone: 'coat',
    aftercare:
      'A bravery sticker and a little rest. Hazel’s care card has been updated.',
  },
  {
    name: 'Cleo',
    clinical: { teeth: 'tartar' },
    owner: 'Freddie',
    ownerModel: 'visitor',
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
  {
    name: 'Scout',
    owner: 'Amelia',
    ownerModel: 'visitor-ponytail',
    species: 'dog',
    breed: 'Curious terrier',
    age: '2 years',
    color: 'yellow',
    symptom: 'A prickly paw',
    quote:
      'Scout stepped on a little piece of wood near the garden shed. He keeps lifting one paw.',
    diagnosis: 'Splinter',
    alternatives: ['Fleas', 'Ear irritation'],
    clinical: { skin: 'splinter', heart: 'fast' },
    checks: [
      {
        tool: 'inspect',
        zone: 'paw',
        finding:
          'A sharp wooden splinter is sticking through the fur on the paw.',
      },
      {
        tool: 'listen',
        zone: 'chest',
        finding:
          'A quicker heartbeat. Scout is a little worried about his prickly paw.',
      },
    ],
    treatment: 'forceps',
    zone: 'paw',
    aftercare:
      'The little splinter is out. A gentle clean and a quiet rest for that brave paw.',
  },
  {
    name: 'Poppy',
    owner: 'Grace',
    ownerModel: 'visitor-bob',
    species: 'cat',
    breed: 'Fluffy house cat',
    age: '5 years',
    color: 'pink',
    symptom: 'A sore tooth',
    quote:
      'Poppy has been leaving the crunchy bits of dinner. Could a tooth be bothering her?',
    diagnosis: 'Tooth cavity',
    alternatives: ['Fleas', 'Ear irritation'],
    clinical: { teeth: 'cavity' },
    checks: [
      {
        tool: 'mouth',
        zone: 'mouth',
        finding:
          'A dark crater in the tooth, with a brown edge. Poppy needs a dental care appointment.',
      },
      {
        tool: 'listen',
        zone: 'chest',
        finding: 'A steady heartbeat. Poppy feels safe on the table.',
      },
    ],
    treatment: 'brush',
    zone: 'mouth',
    aftercare:
      'A gentle clean and a dental appointment booked to care for that damaged tooth.',
  },
  {
    name: 'Maple',
    owner: 'Isla',
    ownerModel: 'visitor-ponytail',
    species: 'dog',
    breed: 'Little spaniel',
    age: '2 years',
    color: 'peach',
    symptom: 'A warm, sleepy morning',
    quote:
      'Maple stayed in her garden bed instead of wanting a walk. She feels warmer than usual.',
    diagnosis: 'Fever',
    alternatives: ['Fleas', 'Ear irritation'],
    clinical: { fever: true, heart: 'fast' },
    checks: [
      {
        tool: 'thermometer',
        zone: 'coat',
        finding:
          'Fever. The storybook thermometer shows that Maple is warmer than usual.',
      },
      {
        tool: 'listen',
        zone: 'chest',
        finding:
          'A quicker heartbeat while Maple feels warm. A quiet care plan will help.',
      },
    ],
    treatment: 'cooling',
    zone: 'coat',
    aftercare:
      'A comfy cooling pad and a quiet rest. We will check on Maple again soon.',
  },
];

export const authoredVisits = [...visits];

// New neighbours join the same care system with healthy introductory checkups.
for (const [owner, name, species, ownerModel] of [
  ['Ava', 'Daisy', 'dog', 'visitor-bob'],
  ['Oscar', 'Biscuit', 'cat', 'visitor'],
  ['Mia', 'Clover', 'rabbit', 'visitor-ponytail'],
  ['Ethan', 'Nibbles', 'hamster', 'visitor'],
  ['Ruby', 'Mochi', 'cat', 'visitor-bob'],
  ['Archie', 'Teddy', 'dog', 'visitor'],
  ['Lily', 'Pebble', 'gerbil', 'visitor-ponytail'],
  ['Theo', 'Coral', 'goldfish', 'visitor'],
  ['Zara', 'Waffles', 'dog', 'visitor-bob'],
  ['Max', 'Ziggy', 'cat', 'visitor'],
] as const) {
  const base = visits.find((p) => p.species === species)!;
  visits.push(
    communityVisit(
      {
        ...base,
        owner,
        name,
        species,
        ownerModel,
        breed: base.breed,
        age: '2 years',
      },
      'checkup',
    ),
  );
}

// Birds join existing households; roster indices and home IDs stay stable.
for (const [name, owner] of [
  ['Pico', 'Ruby'],
  ['Pepper', 'Lily'],
  ['Melody', 'Theo'],
] as const) {
  const family = visits.find((v) => v.owner === owner)!;
  visits.push(
    communityVisit(
      {
        ...family,
        name,
        species: 'bird',
        breed: '',
        age: '1 year',
        color: 'gold',
      },
      'checkup',
    ),
  );
}
for (const pet of visits) {
  if (pet.species === 'dog')
    pet.sex = ['Scout', 'Teddy', 'Waffles'].includes(pet.name)
      ? 'male'
      : 'female';
  const look = petLook(pet);
  if (look) pet.breed = look.breed;
}
export function zonesFor(species: Species): Zone[] {
  return species === 'goldfish'
    ? ['tank', 'fin']
    : species === 'bird'
      ? ['chest', 'coat', 'paw', 'mouth']
      : ['ear', 'chest', 'paw', 'coat', 'mouth'];
}
export function zoneLabel(zone: Zone, species?: Species) {
  if (species === 'bird')
    return (
      (
        { coat: 'Feathers', paw: 'Feet', mouth: 'Beak' } as Partial<
          Record<Zone, string>
        >
      )[zone] ?? zoneNames[zone]
    );
  return zoneNames[zone];
}

/** Keep identity fixed while a town event supplies the reason for this visit. */
export function communityVisit(pet: Visit, reason: VisitReason): Visit {
  if (reason === 'authored') return pet;
  const common = { ...pet, clinical: {}, purpose: undefined };
  if (reason === 'post-fire') {
    if (pet.species === 'goldfish')
      return {
        ...common,
        symptom: 'A check after a house fire',
        quote: `The firefighters carried ${pet.name}’s bowl out safely. Please check the water after all that smoke.`,
        diagnosis: 'Smoky bowl water',
        alternatives: ['Healthy water', 'A sore fin'],
        clinical: { water: 'cloudy' },
        checks: [
          {
            tool: 'water-test',
            zone: 'tank',
            finding: 'The water needs refreshing after the smoky air.',
          },
          {
            tool: 'inspect',
            zone: 'fin',
            finding:
              'The fins look tired after the adventure. A clean bowl and rest will help.',
          },
        ],
        treatment: 'water-care',
        zone: 'tank',
        aftercare:
          'Fresh water and a peaceful rest. The house is safe again and everyone will recover.',
      };
    return {
      ...common,
      symptom: 'A post-fire smoke and skin check',
      quote: `The firefighters rescued ${pet.name}. There is a little cough and a sore warm patch. Our house is safe again.`,
      diagnosis: 'Smoke irritation and a mild burn',
      alternatives: ['Fleas', 'Ear irritation'],
      clinical: { skin: 'burn', heart: 'fast' },
      checks: [
        {
          tool: 'listen',
          zone: 'chest',
          finding:
            'A quicker heartbeat and a little cough after smoky air. Our friend needs a calm recovery check.',
        },
        {
          tool: 'inspect',
          zone: 'coat',
          finding:
            'A small pink, warm patch from the fire. A gentle cooling pad and follow-up care will help.',
        },
      ],
      treatment: 'cooling',
      zone: 'coat',
      aftercare:
        'The warm patch is soothed. Rest in fresh air at the safe home. Keep visiting Louise for regular checkups. Everyone will recover.',
    };
  }
  if (reason === 'rescue' || reason === 'paw-adventure') {
    if (pet.species === 'bird')
      return {
        ...common,
        symptom: 'A sore wing after a tree rescue',
        quote: `The firefighter brought ${pet.name} down safely. Please check this sore patch under the feathers.`,
        diagnosis: 'A sore wing patch',
        alternatives: ['Fever', 'Healthy feathers'],
        clinical: { skin: 'burn', heart: 'fast' },
        checks: [
          {
            tool: 'inspect',
            zone: 'coat',
            finding: 'A small pink sore patch under the ruffled feathers.',
          },
          {
            tool: 'listen',
            zone: 'chest',
            finding:
              'A quick heartbeat after the adventure. A calm rest will help.',
          },
        ],
        treatment: 'cooling',
        zone: 'coat',
        aftercare:
          'A soothing cool pad and a quiet rest. Keep visiting Louise for regular checkups.',
      };
    return {
      ...common,
      symptom: 'A scratched paw after an adventure',
      quote: `We are so glad ${pet.name} is safe again. This paw got sore while scrambling around town.`,
      diagnosis: 'A scratched paw',
      alternatives: ['Broken bone', 'Fleas'],
      clinical: { skin: 'sting', heart: 'fast' },
      checks: [
        {
          tool: 'inspect',
          zone: 'paw',
          finding: 'A small pink sore spot on the paw after the adventure.',
        },
        {
          tool: 'listen',
          zone: 'chest',
          finding:
            'A quicker heartbeat after the excitement. Our friend is safe now.',
        },
      ],
      treatment: 'cream',
      zone: 'paw',
      aftercare:
        'A soothed paw and a safe trip home together. Louise will check on our little explorer again.',
    };
  }
  if (reason === 'vaccination')
    return {
      ...common,
      symptom: 'A scheduled vaccination',
      diagnosis: 'Routine vaccination',
      quote: `It is time for ${pet.name}’s routine vaccination. We walked over from our home in Hookville.`,
      alternatives: [],
      checks: [],
      treatment: 'vaccine',
      zone: 'coat',
      aftercare:
        'A bravery sticker and a little rest back home. Routine care is complete.',
    };
  if (reason === 'fever')
    return {
      ...common,
      clinical: { fever: true, heart: 'fast' },
      symptom: 'Feeling warm and sleepy',
      quote: `${pet.name} felt warm and did not want to play at home, so we came to see Louise.`,
      diagnosis: 'Fever',
      alternatives:
        pet.species === 'bird'
          ? ['Healthy checkup', 'Tired after playing']
          : ['Fleas', 'Ear irritation'],
      checks: [
        {
          tool: 'thermometer',
          zone: 'coat',
          finding: `Fever. ${pet.name} feels warmer than usual on our storybook thermometer.`,
        },
        {
          tool: 'listen',
          zone: 'chest',
          finding: 'A quicker heartbeat while our little friend feels warm.',
        },
      ],
      treatment: 'cooling',
      zone: 'coat',
      aftercare:
        'A comfy cooling pad and a quiet rest at home. We will keep checking on our little friend.',
    };
  if (reason === 'accident')
    return {
      ...common,
      clinical: { fracture: true, heart: 'fast' },
      symptom: 'A sore leg after a road accident',
      quote: `A car bumped ${pet.name} on High Street. We came straight from the crossing. Everyone is safe; please help this sore leg.`,
      diagnosis: 'Broken bone',
      alternatives: ['Bee sting', 'Fleas'],
      checks: [
        {
          tool: 'xray',
          zone: 'paw',
          finding:
            'The X-ray shows a gap and displaced ends in a front leg bone. A support wrap will help.',
        },
        {
          tool: 'listen',
          zone: 'chest',
          finding:
            'A quicker heartbeat after the surprise. Our brave patient is safe here.',
        },
      ],
      treatment: 'bandage',
      zone: 'paw',
      aftercare:
        'A soft support wrap and a restful trip home. The family will return for a checkup. Everyone will recover.',
    };
  const fish = pet.species === 'goldfish';
  return {
    ...common,
    purpose: 'checkup',
    symptom: 'A regular wellness checkup',
    quote: `${pet.name} is here for a regular checkup. It is lovely to see our neighbourhood vet!`,
    diagnosis: 'Healthy checkup',
    alternatives: [],
    checks: fish
      ? [
          {
            tool: 'water-test',
            zone: 'tank',
            finding: 'The storybook water test is in the comfortable zone.',
          },
          {
            tool: 'inspect',
            zone: 'fin',
            finding: 'The fins look healthy and are moving comfortably.',
          },
        ]
      : [
          {
            tool: 'thermometer',
            zone: 'coat',
            finding:
              'Comfortable. No fever on our storybook temperature check.',
          },
          {
            tool: 'listen',
            zone: 'chest',
            finding: 'A steady heartbeat. Everything sounds comfortable today.',
          },
        ],
    treatment: fish ? 'water-care' : 'brush',
    zone: fish ? 'tank' : 'coat',
    aftercare:
      'A happy, healthy checkup. No treatment needed today. See you around Hookville!',
  };
}

/** Describe the required checks from the visit itself, so guidance cannot drift. */
export function checkInstruction(check: Check, species: Species) {
  if (check.tool === 'thermometer')
    return `Check temperature: hold the Thermometer at the ${species === 'bird' ? 'feathers' : 'coat'}.`;
  if (check.tool === 'listen')
    return 'Listen to the heart: hold the Stethoscope at the chest.';
  if (check.tool === 'water-test')
    return 'Check the water: dip the Water test tool anywhere in the bowl water.';
  if (check.tool === 'inspect' && check.zone === 'fin')
    return 'Look at the fins: use the Magnifier on the fish’s fins.';
  return `${toolInfo[check.tool].name}: check the ${zoneLabel(check.zone, species).toLowerCase()}.`;
}

export const toolInfo: Record<
  Tool,
  { name: string; icon: string; hint: string }
> = {
  thermometer: {
    name: 'Thermometer',
    icon: 'search',
    hint: 'Hold the storybook sensor at the coat',
  },
  cooling: {
    name: 'Cooling pad',
    icon: 'drop',
    hint: 'Place a comfy cooling pad on the coat',
  },
  forceps: {
    name: 'Fine forceps',
    icon: 'search',
    hint: 'Lift the little splinter from the paw',
  },
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
  xray: {
    name: 'X-ray',
    icon: 'scan',
    hint: 'Move the viewer across the whole animal',
  },
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
    description:
      'Wider guides help you aim drops, pull gently, hold steady and control pressure or pouring.',
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
      'Build a connected customer lounge with three seats. Capacity grows from four to six patients.',
  },
  {
    id: 'books',
    name: 'Books and magazines',
    kind: 'Owner pastime',
    price: 65,
    icon: 'book',
    description:
      'A book trolley and something lovely to read. Seated owners open a book while they wait.',
  },
  {
    id: 'table-games',
    name: 'Tabletop games',
    kind: 'Owner pastime',
    price: 130,
    icon: 'star',
    requires: 'expansion',
    description: 'A colourful board game for two seats in the customer lounge.',
  },
  {
    id: 'pet-room',
    name: 'Pet playground',
    kind: 'Expansion',
    price: 300,
    icon: 'paw',
    requires: 'expansion',
    description:
      'Build a spacious connected playground with a toy corner, marked queues and room for bigger rides. Capacity grows to eight patients.',
  },
  {
    id: 'scratch',
    name: 'Scratching post',
    kind: 'Pet amusement',
    price: 85,
    icon: 'paw',
    requires: 'pet-room',
    description:
      'Cats queue for a stretch and a scratch, one happy turn at a time.',
  },
  {
    id: 'wheel',
    name: 'Exercise wheel',
    kind: 'Pet amusement',
    price: 110,
    icon: 'heart',
    requires: 'pet-room',
    description:
      'Hamsters and gerbils take turns running in their very own spinning wheel.',
  },
  {
    id: 'carousel',
    name: 'Gentle merry-go-round',
    kind: 'Pet amusement',
    price: 160,
    icon: 'star',
    requires: 'pet-room',
    description:
      'A slow, low ride for dogs and rabbits, with a queue and a turn for everyone.',
  },
  {
    id: 'coaster',
    name: 'Pet rollercoaster',
    kind: 'Pet amusement',
    price: 260,
    icon: 'star',
    requires: 'pet-room',
    description:
      'A gentle little hill ride for dogs, cats and rabbits. One pet rides in the snug car at a time.',
  },
  {
    id: 'ferris',
    name: 'Pet Ferris wheel',
    kind: 'Pet amusement',
    price: 220,
    icon: 'heart',
    requires: 'pet-room',
    description:
      'A slow skyward turn in a cosy, level cabin for dogs, cats and rabbits. Stops at the bottom to let them out.',
  },
  {
    id: 'play-annex',
    name: 'Play garden extension',
    kind: 'Expansion',
    price: 300,
    icon: 'home',
    requires: 'pet-room',
    description:
      'Add a connected garden with six activity spaces. More room to play; patient capacity stays at eight.',
  },
  {
    id: 'treat-dispenser',
    name: 'Treat dispenser',
    kind: 'Pet amusement',
    price: 80,
    icon: 'jar',
    requires: 'play-annex',
    description:
      'Pets press a paw pad for a little storybook snack. Refills are included; your shop stock is separate.',
  },
  {
    id: 'water-dispenser',
    name: 'Water dispenser',
    kind: 'Pet amusement',
    price: 65,
    icon: 'drop',
    requires: 'play-annex',
    description:
      'A bubbling drinking station for a refreshing break. Refills are included.',
  },
  {
    id: 'toy-box',
    name: 'Bouncy toy box',
    kind: 'Pet amusement',
    price: 120,
    icon: 'star',
    requires: 'play-annex',
    description:
      'Dogs, rabbits and little rodents hop and chase a colourful rolling ball.',
  },
  {
    id: 'yarn',
    name: 'Yarn-ball corner',
    kind: 'Pet amusement',
    price: 75,
    icon: 'paw',
    requires: 'play-annex',
    description: 'Cats bat and chase a rolling ball of yarn on a soft mat.',
  },
  {
    id: 'aviary',
    name: 'Bird aviary',
    kind: 'Pet amusement',
    price: 200,
    icon: 'home',
    requires: 'play-annex',
    description:
      'A roomy flight pavilion with branches, a swing and space for birds to spread their wings.',
  },
  {
    id: 'play-tree',
    name: 'Friendly play tree',
    kind: 'Pet amusement',
    price: 180,
    icon: 'leaf',
    requires: 'play-annex',
    description:
      'Cats climb the spiral steps and birds fly up to the branches. Everyone plays peacefully, one turn at a time.',
  },
  {
    id: 'sun-courtyard',
    name: 'Sunshine courtyard',
    kind: 'Expansion',
    price: 360,
    icon: 'home',
    requires: 'pet-room',
    description:
      'A spacious courtyard behind the playground, with room for new games and cosy corners. Patient capacity stays at eight.',
  },
  {
    id: 'puzzle-table',
    name: 'Puzzle picnic table',
    kind: 'Customer amusement',
    price: 150,
    icon: 'book',
    requires: 'sun-courtyard',
    description:
      'Two customers sit together to play a colourful tabletop puzzle beneath a sunshade.',
  },
  {
    id: 'bubbles',
    name: 'Bubble chase',
    kind: 'Pet amusement',
    price: 130,
    icon: 'star',
    requires: 'sun-courtyard',
    description:
      'Dogs, cats and rabbits chase a trail of floating, popping storybook bubbles.',
  },
  {
    id: 'cat-nook',
    name: 'Cosy cat nook',
    kind: 'Pet amusement',
    price: 95,
    icon: 'paw',
    requires: 'sun-courtyard',
    description:
      'A soft hooded bed for cats to curl up, breathe gently and enjoy a peaceful turn.',
  },
  {
    id: 'bird-chimes',
    name: 'Bird chime arch',
    kind: 'Pet amusement',
    price: 115,
    icon: 'leaf',
    requires: 'sun-courtyard',
    description:
      'Birds fly between perches and play with gently swaying colourful chimes.',
  },
  {
    id: 'flower-border',
    name: 'Blooming flower border',
    kind: 'Decoration',
    price: 85,
    icon: 'leaf',
    requires: 'sun-courtyard',
    description:
      'Bright flowers in raised planters decorate the courtyard edges.',
  },
  {
    id: 'bunting',
    name: 'Pawprint bunting',
    kind: 'Decoration',
    price: 70,
    icon: 'star',
    description:
      'Colourful pawprint flags make reception feel ready for a celebration.',
  },
  {
    id: 'cosy-rug',
    name: 'Cosy welcome rug',
    kind: 'Decoration',
    price: 75,
    icon: 'heart',
    description:
      'A woven, paw-patterned rug brings warmth and colour to the waiting area.',
  },
  {
    id: 'wall-art',
    name: 'Happy pets gallery',
    kind: 'Decoration',
    price: 90,
    icon: 'paw',
    description:
      'Three cheerful framed pet pictures brighten the reception wall.',
  },
] as const;
export type UpgradeId = (typeof upgrades)[number]['id'];
export function clinicCapacity(ids: readonly UpgradeId[]) {
  return ids.includes('pet-room') ? 8 : ids.includes('expansion') ? 6 : 4;
}
export interface Progress {
  town?: unknown;
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
      town: p.town,
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
    ('requires' in item && !p.upgrades.includes(item.requires)) ||
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
