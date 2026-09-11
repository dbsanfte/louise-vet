// Five distinct expressions for each neighbour. Gentle lines are used during
// rescues and discomfort; cheerful catchphrases never celebrate an accident.
export const characterVoices: Record<
  string,
  { bright: string[]; gentle: string[] }
> = {};
const voices: Record<string, readonly [string, string]> = {
  Luna: [
    'Golden paws, happy heart!|Tail going like a windmill!|My ears are all wiggly!|A golden sort of day!|Big doggy smile!',
    'Amelia, stay near.|My golden paws are trying.|A soft woof from me.|One little wag for courage.|I trust my Amelia.',
  ],
  Milo: [
    'Most magnificent, meow.|A silver-whisker moment!|Quite my cup of cream.|Purrfectly splendid.|My whiskers approve!',
    'A quiet silver purr.|Oliver, a little closer.|Careful with my whiskers.|I shall be very patient.|A dignified little mew.',
  ],
  Pip: [
    'Hip, hop, hooray!|My nose is twitching!|A bunny-sized adventure!|Ears up, Pip is ready!|Hoppity happiness!',
    'Sophie, hold me gently.|My ears are listening.|A tiny brave bunny breath.|Soft paws, steady hops.|I can take a little hop.',
  ],
  Peanut: [
    'Tiny paws, big plans!|Peanut-sized perfection!|A whiskery little victory!|My cheeks are smiling!|A pocketful of happy!',
    'Noah, I am only little.|Tiny paws can be brave.|A small, careful squeak.|Please be gentle with me.|One Peanut-sized step.',
  ],
  Sunny: [
    'Sunshine in my whiskers!|A little gerbil jig!|My tail is doing a dance!|Bright eyes, Sunny skies!|Squeaky sunshine!',
    'Isla, a sunny cuddle?|A little squeak for courage.|My small paws are ready.|Slowly does it for Sunny.|I feel braver with Isla.',
  ],
  Bubbles: [
    'Bubble, bubble, brilliant!|A fin-tastic moment!|Round my bowl I go!|Bloopity bliss!|Happy little fin wiggles!',
    'Leo, keep my bowl steady.|One calm bubble at a time.|A gentle fin wave.|I can see my Leo.|Bloop… nice and slowly.',
  ],
  Hazel: [
    'Hazel gives it two paws!|My nose says yes!|Happy hound coming through!|A lovely spaniel wiggle!|Floppy ears, full cheer!',
    'Grace, lend me courage.|My floppy ears are listening.|A gentle hound sigh.|One soft paw at a time.|I feel safe with Grace.',
  ],
  Cleo: [
    'A royal little purr!|Queen of this corner!|Cleo finds this delightful!|Fit for a feline queen!|My velvet paws approve!',
    'Freddie, your queen needs you.|A very small royal mew.|Velvet paws, steady now.|I will be a brave little queen.|Gentle hands for Cleo.',
  ],
  Scout: [
    'Adventure paws reporting!|Scout has discovered fun!|Tail up, explorer ready!|A splendid sniffing mission!|Explorer badge earned!',
    'Amelia, explorer needs a hand.|Scout can wait right here.|A brave explorer breath.|Careful steps, adventure paws.|Home team, stick together.',
  ],
  Poppy: [
    'A pop of purring joy!|Flower-soft paw pats!|My whiskers are blooming!|Petal paws at play!|A blossom of happiness!',
    'Grace, a flower-soft cuddle.|Petal paws need gentle help.|A little Poppy purr.|I will stay close to Grace.|Small steps for soft paws.',
  ],
  Maple: [
    'Sweet as a sunny walk!|A maple-leaf tail swish!|Four paws full of joy!|My cosy collie grin!|A leaf-sized leap of joy!',
    'Isla, my cosy person.|A small collie sigh.|Steady paws, Maple.|I will lean on Isla.|A soft nose needs kindness.',
  ],
  Daisy: [
    'Daisy does a happy dance!|A daisy-chain of tail wags!|Bright paws, bright day!|My terrier toes are tapping!|A sunny little woof!',
    'Ava, hold my little paw.|Terrier toes, take it slowly.|A quiet Daisy woof.|Small paws need kind hands.|I can lean on my Ava.',
  ],
  Biscuit: [
    'A crumb of cat delight!|Biscuit is feeling grand!|My biscuit paws are kneading!|A freshly baked purr!|Whiskers full of wonder!',
    'Oscar, a crumb of comfort?|Soft biscuit paws, be still.|A small crumbly meow.|My Oscar knows my purr.|I need a little warm kindness.',
  ],
  Clover: [
    'Lucky little bunny feet!|Four-leaf fun for me!|A clover-green adventure!|Hops full of luck!|My bunny heart goes boing!',
    'Mia, my lucky person.|One small lucky hop.|Clover ears, listen carefully.|I will tuck close to Mia.|A gentle bunny nose nudge.',
  ],
  Nibbles: [
    'Nibbles has big little ideas!|A whisker-twitching triumph!|Tiny toes, tremendous fun!|Squeak squeak, splendid!|My little paws are cheering!',
    'Ethan, tiny friend here.|One careful Nibbles squeak.|I will keep my little paws still.|My whiskers need gentle hands.|Small steps with Ethan.',
  ],
  Mochi: [
    'Soft as a mochi cloud!|A marshmallow sort of purr!|Squishy-paw happiness!|Cloud-soft cat delight!|Mochi makes happy biscuits!',
    'Ruby, my soft place.|A cloud-small mew.|Please mind my squishy paws.|Mochi needs a quiet cuddle.|I will curl close to Ruby.',
  ],
  Teddy: [
    'Bear-hug-sized happiness!|A big soft Teddy woof!|Paws up for cosy fun!|My cuddly tail is wagging!|Teddy gives a happy bounce!',
    'Archie, a bear hug please.|Big soft paws can wait.|A little Teddy whimper.|I am brave beside Archie.|Gentle care for a cuddly dog.',
  ],
  Pebble: [
    'Pebble-sized party!|Tiny feet, rocky rhythm!|A little gem of a day!|My whiskers do a jig!|Small paws, sparkling joy!',
    'Lily, your little Pebble here.|A pebble-small squeak.|I will be still as a stone.|Tiny feet, gentle steps.|My Lily helps me feel brave.',
  ],
  Coral: [
    'A rainbow of fin wiggles!|Coral-coloured happiness!|My bowl is full of wonder!|Swishy fishy joy!|A sparkling little bloop!',
    'Theo, keep me close.|A little coral-coloured wave.|Slow bubbles, steady bowl.|My fins need gentle care.|I can see my Theo smiling.',
  ],
  Waffles: [
    'A waffle-load of tail wags!|Breakfast-sized doggy joy!|Waffles votes for more fun!|A syrupy-sweet woof!|My ears are doing flips!',
    'Zara, a Waffles cuddle?|One soft breakfast-dog sigh.|My paws need a gentle moment.|I will wait beside Zara.|A small brave Waffles wag.',
  ],
  Ziggy: [
    'Zig, zag, zoom!|A zigzag of cat delight!|My stripey paws are dancing!|Ziggy has a bright idea!|A stripe-powered purr!',
    'Max, help my stripey paws.|One slow zig, one slow zag.|A quiet Ziggy meow.|My stripes can be brave.|I will curl beside Max.',
  ],
  Pico: [
    'Pico piccolo, chirp!|A tiny tropical cheer!|Bright feathers, bright idea!|A parrot-sized hooray!|My beak has a happy song!',
    'Ruby, your little Pico here.|A soft tropical chirrup.|Small beak, brave heart.|Feathers close, Pico.|I trust my Ruby.',
  ],
  Pepper: [
    'Pepper adds a little chirp!|A feathery pinch of fun!|My crest is celebrating!|Chirpy little spice!|Wings up, Pepper is pleased!',
    'Lily, a gentle perch please.|A quiet Pepper peep.|My crest is listening.|Little wings, steady now.|Lily makes my feathers settle.',
  ],
  Melody: [
    'La la, lovely!|A song in my feathers!|Melody sings a happy note!|Tweet-tweet, what a treat!|A little wingbeat waltz!',
    'Theo, listen for my little song.|One soft note for courage.|Quiet wings, quiet song.|A gentle Melody tweet.|I can hear my Theo.',
  ],
  Amelia: [
    'That warms my golden-dog heart.|My explorers will love this.|A lovely day for our pack.|Our little team is smiling.|Two tails make twice the joy.',
    'My explorers, I am here.|We will take gentle pack steps.|Luna and Scout can count on me.|Our little team sticks together.|I have a kind hand ready.',
  ],
  Oliver: [
    'Milo would call that splendid.|A rather elegant little moment.|That earns a silver-whisker smile.|My feline friend has good taste.|How delightfully civilised.',
    'Easy now, my silver gentleman.|Milo, your Oliver is here.|We shall take this very gently.|My whiskered friend can lean on me.|A calm voice for my little cat.',
  ],
  Sophie: [
    'A hop, skip and a smile.|Pip makes every day brighter.|Bunny-sized joys are the best.|A little hop of happiness.|Our ears-up sort of day.',
    'Soft hands for my little hopper.|Pip, I am close by.|One bunny-sized step together.|My little rabbit can trust me.|I will keep things gentle for Pip.',
  ],
  Noah: [
    'Small wonders make me smile.|Peanut-sized things are brilliant.|A tiny adventure to remember.|Little paws, lovely company.|My pocket-sized pal knows fun.',
    'Gentle hands for tiny Peanut.|My little friend, I am here.|We have time for small steps.|Peanut can count on my kindness.|I will be your safe little corner.',
  ],
  Isla: [
    'Our little mixed-up family shines.|Maple and Sunny make me smile.|Big paws, tiny paws, happy days.|A sunny sort of family outing.|Room in my heart for both of you.',
    'My Sunny and Maple, stay near.|Big or little, I am here for you.|Our family takes gentle steps.|I have comfort for every paw.|We will keep our little team safe.',
  ],
  Leo: [
    'That deserves a happy bubble.|Bubbles makes ordinary days sparkle.|A little splash of joy.|Fin friends are wonderful company.|Our bowlful of bright ideas.',
    'Steady hands for Bubbles.|My finned friend, I am here.|We will keep your bowl calm.|Slow and gentle for my goldfish.|A quiet voice for little Bubbles.',
  ],
  Grace: [
    'A garden full of furry joy.|Hazel and Poppy brighten my day.|Paws and petals make me smile.|A lovely moment for our little pair.|My furry flowers know how to have fun.',
    'Hazel and Poppy, I am close.|Gentle care for my furry flowers.|Our little pair can count on me.|We will stay together, paws and all.|There is a soft hand for each of you.',
  ],
  Freddie: [
    'Cleo would give that a royal nod.|A splendid day for our tiny queen.|Her furry majesty approves.|A little royal treat for us.|Life with Cleo is rather grand.',
    'Your Freddie is here, little queen.|Gentle care for her furry majesty.|Cleo, I will stay by your side.|My brave little queen can rest.|A calm cuddle for our royal friend.',
  ],
  Ava: [
    'Daisy makes my toes tap.|A little terrier-sized celebration.|Our days are bright as daisies.|A happy dance for our tiny team.|My small pal brings big smiles.',
    'Daisy, your Ava is close.|We will take tiny terrier steps.|A gentle hand for my small pal.|My little Daisy can lean on me.|I have a quiet cuddle ready for you.',
  ],
  Oscar: [
    'Biscuit brings a crumb of joy.|A warm little moment for us.|My cat has freshly baked charm.|A biscuit-sized reason to smile.|Cosy company makes a lovely day.',
    'Biscuit, your cosy person is here.|Soft hands for my crumb of joy.|We will take small biscuit steps.|My little cat has my whole heart.|There is warm comfort waiting for you.',
  ],
  Mia: [
    'Clover brings a little luck.|A lucky bunny sort of day.|Our little four-leaf friendship.|A happy hop for the two of us.|Small green joys make me smile.',
    'Clover, your lucky friend is here.|We will make one gentle hop.|My little bunny has a safe friend.|I will be your quiet patch of clover.|Soft hands for our lucky little pal.',
  ],
  Ethan: [
    'Nibbles makes little things exciting.|A tiny idea can be a great one.|Our small adventures are the best.|A whisker-sized reason to cheer.|Little paws have enormous charm.',
    'Nibbles, I am right beside you.|Tiny friend, take your time.|My small adventurer can rest here.|We have room for quiet little steps.|I will listen for your smallest squeak.',
  ],
  Ruby: [
    'Cloud-soft paws and colourful wings.|Mochi and Pico fill my day with joy.|Our fluffy feathery little team.|A purr and a chirp make me smile.|Soft paws, bright feathers, lovely company.',
    'My fluffy feathery friends, stay close.|Mochi and Pico can trust me.|A soft place for paws and wings.|I have gentle comfort for you both.|Our little purr-and-chirp team stays together.',
  ],
  Archie: [
    'Teddy makes everything cosier.|A bear-hug sort of happy day.|Big soft paws bring big smiles.|Our cuddly team deserves a cheer.|My Teddy knows a good time.',
    'Teddy, your bear-hug friend is here.|Big soft paws, little gentle steps.|I have a Teddy-sized cuddle ready.|My cuddly pal can lean on me.|We will take this slowly, big friend.',
  ],
  Lily: [
    'Pebble and Pepper add a little sparkle.|A squeak and a chirp make a fine duet.|Our tiny friends have big ideas.|Small paws and wings bring lovely things.|A little sparkle for our mixed-up team.',
    'Pebble and Pepper, I am nearby.|Small paws and wings need soft care.|My tiny team can count on me.|I have a safe hand for each little friend.|We will take small sparkling steps together.',
  ],
  Theo: [
    'Coral and Melody make a colourful duet.|A fin and a feather brighten my day.|Our family has a lovely little rhythm.|A song and a bubble make me grin.|What a cheerful fin-and-wing team.',
    'Coral and Melody, listen for me.|My fin-and-wing friends have my care.|We will find our quiet little rhythm.|Gentle hands for bowls and feathers.|I am here for every note and bubble.',
  ],
  Zara: [
    'Waffles brings a breakfast-sized grin.|Our days are sweet as a treat.|A great big Waffles-worthy smile.|My dog adds a sprinkle of joy.|A happy little moment for our sweet team.',
    'Waffles, your Zara is right here.|My sweet pal can lean on me.|A gentle moment for my breakfast buddy.|We will take soft Waffles steps.|I have a warm cuddle waiting for you.',
  ],
  Max: [
    'Ziggy adds a stripe of fun.|A zigzag of bright ideas.|Our stripey little adventures shine.|My cat keeps life wonderfully wiggly.|A stripe-powered reason to smile.',
    'Ziggy, your Max is close.|We will take one slow zigzag.|My stripey friend can rest with me.|Gentle hands for our little explorer.|I will be your steady place, Ziggy.',
  ],
  Louise: [
    'A kind little moment.|My clinic has room for every friend.|Helping paws makes me smile.|Hookville is full of lovely neighbours.|A little care goes a long way.',
    'Gentle hands, little friend.|We can take our time together.|I am here to help you feel better.|One kind step at a time.|There is always room for a cuddle.',
  ],
};
for (const [name, [bright, gentle]] of Object.entries(voices))
  characterVoices[name] = {
    bright: bright.split('|'),
    gentle: gentle.split('|'),
  };

/** Complete lines are unique to the named speaker, not just a shared label. */
export function messagesFor(
  name: string,
  action: string,
  gentle = false,
): string[] {
  const voice = characterVoices[name];
  if (!voice) throw new Error(`Missing character voice: ${name}`);
  return voice[gentle ? 'gentle' : 'bright'].map((line, i) =>
    i % 2 ? `${line} ${action}` : `${action} ${line}`,
  );
}
