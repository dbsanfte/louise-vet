import type { Household, TownSimulation } from './town-simulation.ts';
import type { Visit } from './game.ts';
import type { RescuePhase } from './emergencies.ts';
import { attractionFeeling } from './clinic-identity.ts';

export type Feeling = { key: string; text: string; priority: number };
// Pet / owner lines for every stage. Hidden pets inside houses remain hidden;
// these lines only speak when their actual rendered character is visible.
export const rescueFeelings: Record<RescuePhase, readonly [string, string]> = {
  wander: ['Ooh! What is over there?', 'Wait for me, little friend!'],
  report: ['Where did everyone go?', 'The police will help me find you.'],
  search: ['I can hear my name!', 'We are coming to find you!'],
  dispatch: ['Help is coming!', 'I can hear the fire engine!'],
  unload: ['Hello, friendly helpers!', 'The firefighters are here!'],
  ladder: ['That ladder reaches me!', 'Hold on, little friend.'],
  climb: ['Someone is coming up!', 'Carefully… nearly there!'],
  rescue: ['Safe in friendly arms!', 'You have got my little friend!'],
  descend: ['Down we go, nice and slow.', 'I am right here for you!'],
  extinguish: ['I can hear our helpers!', 'They are putting the fire out.'],
  'enter-house': ['Here I am!', 'Please find my little friend.'],
  'exit-house': [
    'Fresh air! That feels better.',
    'There you are! What a relief!',
  ],
  handover: ['A cuddle! I missed you!', 'Safe again! Let us see Louise.'],
  return: ['Time for a gentle checkup.', 'Thank you, lovely helpers!'],
  'driver-out': ['Ouch, my paw needs help.', 'Someone has stopped to help.'],
  summon: ['I will wait right here.', 'I am coming, little friend!'],
  collect: ['A gentle cuddle, please.', 'I have you. Louise can help.'],
  'driver-return': ['Off to see Louise.', 'Thank you for helping us!'],
};
const parkFeelings: Record<string, string> = {
  fetch: 'Throw it again! Again!',
  agility: 'Hop! Through the hoop!',
  scratch: 'Purrr… lovely scratch!',
  pounce: 'Flutter, flutter! Pounce!',
  tunnel: 'Peekaboo! A little tunnel!',
  perch: 'Chirp! What a view!',
};
/** Read current simulation state; never advance time, routes, care or rewards. */
export function characterFeeling(
  s: TownSimulation,
  h: Household,
  pet?: Visit,
): Feeling {
  const say = (key: string, text: string, priority = 1): Feeling => ({
    key,
    text,
    priority,
  });
  const e = s.emergencies.active;
  if (
    e &&
    !e.delivered &&
    e.families.includes(h.id) &&
    (!pet || e.pets.includes(pet.name))
  ) {
    let text = rescueFeelings[e.phase][pet ? 0 : 1];
    if (e.kind === 'fire' && ['dispatch', 'unload', 'ladder'].includes(e.phase))
      text = pet
        ? 'Our helpers will find us.'
        : 'We are safe outside. Help is here!';
    if (pet && ['wander', 'report', 'search'].includes(e.phase)) {
      if (e.trapped)
        text =
          pet.species === 'bird'
            ? 'Chirp… a little help down?'
            : 'Meow… this tree is very tall!';
      else if (e.chase?.route.length) text = 'Eek! I need a safe place!';
      else if (e.recalled) text = 'Here I am! I will wait.';
      else if (pet.species === 'bird') text = 'Flap, flap! Another tree!';
    }
    return say(
      `rescue:${e.kind}:${e.phase}:${e.trapped}:${e.recalled}:${e.rescued}`,
      text,
      4,
    );
  }
  if (e?.chaser === h.id && pet?.name === e.chaserPet && e.chase)
    return say('chasing', 'Oops! I got a bit too bouncy!', 3);
  if (e?.chaser === h.id && !pet && e.chase)
    return say('calling-chaser', 'Come back! Gentle play, please.', 3);
  if (
    h.busyUntil !== undefined &&
    s.time < h.busyUntil &&
    (!pet || h.companions.includes(pet.name))
  )
    return say(
      'clinic-busy',
      pet
        ? 'A little break with my family.'
        : 'Hmm, it is very busy. We will come back later.',
      4,
    );
  const shelter = s.weather.active.get(h.id);
  if (
    shelter &&
    (!pet || shelter.pet === pet.name || h.companions.includes(pet.name))
  ) {
    const lines = {
      approach: ['Wet whiskers! Under that tree!', 'Let us find a dry spot.'],
      wait: ['Much better. Nice and dry!', 'We can wait here together.'],
      return: ['Sunshine! Off we go!', 'The rain has stopped. Lovely!'],
    };
    return say(
      `rain:${shelter.phase}`,
      pet && pet.name !== shelter.pet
        ? 'I will wait with my family.'
        : lines[shelter.phase][pet ? 0 : 1],
      3,
    );
  }
  const stop = s.dogWalks.active.get(h.id);
  if (stop && (!pet || stop.pet === pet.name)) {
    const text = pet
      ? stop.phase === 'toilet'
        ? 'A little toilet break!'
        : stop.phase === 'sniff'
          ? 'Sniff, sniff! Who was here?'
          : stop.phase === 'collect' || stop.phase === 'return'
            ? 'All better! Ready to walk!'
            : 'Ooh, an interesting smell!'
      : stop.phase === 'collect'
        ? 'Bag it up! Keep Hookville tidy.'
        : stop.phase === 'return'
          ? 'All tidy. Off we go!'
          : 'Take your time, little friend.';
    return say(`dog-stop:${stop.kind}:${stop.phase}`, text, 3);
  }
  if (h.inClinic) {
    const ticket = h.ticket === undefined ? undefined : s.tickets.get(h.ticket);
    const activity =
      ticket && pet && ticket.pet === pet.name
        ? s.leisure.pets.get(ticket.id)
        : undefined;
    if (pet) {
      const feeling = attractionFeeling(activity, pet.species);
      if (feeling)
        return say(
          `clinic:${activity!.station}:${activity!.turns}:${activity!.joined}:use`,
          feeling,
          2,
        );
      if (activity && ['walk', 'queue', 'board'].includes(activity.phase))
        return say(
          `clinic:${activity.station}:${activity.phase}:${activity.turns}`,
          activity.phase === 'queue'
            ? 'My turn soon!'
            : activity.phase === 'board'
              ? 'All aboard!'
              : 'Ooh! Let us try this!',
          2,
        );
      return say(
        `clinic:${s.leisure.owners.get(h.id)?.phase}:rest`,
        'Happy to wait with you.',
      );
    }
    const phase = s.leisure.owners.get(h.id)?.phase;
    const lines: Record<string, string> = {
      walk: 'This looks like a comfy spot.',
      stand: 'What a welcoming clinic!',
      sit: 'A lovely place to rest.',
      read: 'Ooh, a lovely story!',
      game: 'Your turn! This is fun!',
      wait: 'We will wait right here.',
      'check-in': 'Hello Louise! Here we are.',
      desk: 'Our turn to see Louise!',
      ready: 'Ready when you are, Louise!',
      escort: 'Come along, little friend.',
      'in-room': 'You are in kind hands.',
    };
    return say(
      `clinic-owner:${phase}`,
      lines[phase ?? 'wait'] ?? 'A lovely place to wait.',
      2,
    );
  }
  const park = s.park.visits.get(h.id);
  if (park && (!pet || h.companions.includes(pet.name))) {
    const p = park.pets.find((p) => p.name === pet?.name);
    return say(
      `park:${p?.phase}:${p?.station}:${p?.turns}:${park.leaving}:${park.seated}:${s.park.chatting(h.id, s.time)}`,
      pet
        ? p?.phase === 'use'
          ? (parkFeelings[p.station!] ?? 'What a lovely park!')
          : park.leaving
            ? 'One last sniff, then home!'
            : 'So much to explore!'
        : park.leaving
          ? 'Come along, time to go!'
          : s.park.chatting(h.id, s.time)
            ? 'Lovely to see you! How are you?'
            : park.seated
              ? 'A peaceful rest by the ducks.'
              : 'Let us find a nice bench.',
      2,
    );
  }
  if (h.retryCareAt !== undefined && h.routine === 'garden')
    return say(
      'care-later',
      pet
        ? 'A cosy rest before seeing Louise.'
        : 'We will try Louise again a little later.',
      2,
    );
  // Companions left at home must not claim to be walking or visiting the vet.
  const routine =
    pet && !h.companions.includes(pet.name) ? 'garden' : h.routine;
  const lines: Record<Household['routine'], readonly [string, string]> = {
    garden: ['Home sweet home!', 'What a lovely day.'],
    gather: ['Walkies? Yes please!', 'Ready for a little walk?'],
    walk: [
      h.returning ? 'Home for a cosy rest!' : 'So many lovely smells!',
      h.returning ? 'That was a lovely walk.' : 'Off to the park together!',
    ],
    chat: ['Hello, new friend!', 'Hello! Lovely to see you!'],
    park: ['Playtime!', 'What a lovely park.'],
    'clinic-gather': ['A little visit to Louise.', 'Time for your checkup.'],
    'clinic-walk': ['Louise will look after me.', 'We are on our way, Louise!'],
    'clinic-wait': ['Nearly our turn!', 'We will wait safely here.'],
    'clinic-enter': ['Hello, cosy clinic!', 'Hello! Here for our visit.'],
    'clinic-exit': ['Home for a cuddle!', 'Thank you, Louise!'],
    homeward: ['Feeling cared for!', 'Let us get you cosy at home.'],
    incident: ['I need a little help.', 'Stay with me. Help is coming.'],
  };
  let text = lines[routine][pet ? 0 : 1];
  if (pet?.species === 'bird' && routine === 'walk')
    text = 'Flap, flap! Out with my family!';
  if (pet?.species === 'goldfish' && routine === 'walk')
    text = 'Bloop! A trip in my bowl!';
  return say(`routine:${routine}:${h.returning}`, text);
}
