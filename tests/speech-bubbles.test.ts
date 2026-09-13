import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BubbleDirector } from '../src/speech-bubbles.ts';
import { characterVoices, messagesFor } from '../src/character-voices.ts';
import { dialogue } from '../src/character-dialogue.ts';
import { characterFeeling, rescueFeelings } from '../src/character-feelings.ts';
import {
  clinicAttractions,
  foodFeelings,
  attractionFeeling,
} from '../src/clinic-identity.ts';
import { TownSimulation, type Routine } from '../src/town-simulation.ts';
import { visits } from '../src/game.ts';
import type { RescuePhase } from '../src/emergencies.ts';
const pet = (name: string) => visits.find((p) => p.name === name)!;

test('one five-second bubble, inspection priority, replacement, and no renewal on state refresh', () => {
  const b = new BubbleDirector<string>();
  const reaction = {
    target: 'Milo',
    key: 'scratch',
    priority: 2,
    info: { name: 'Milo', description: '', feeling: 'Purr!' },
  };
  b.update(0, [reaction]);
  assert.equal(b.current?.source, 'reaction');
  b.inspect('Luna', { name: 'Luna', description: 'Amelia’s dog' }, 100);
  b.update(1000, [reaction]);
  assert.equal(b.current?.target, 'Luna');
  b.inspect('Amelia', { name: 'Amelia', description: 'Owner' }, 1100);
  b.refresh({ name: 'Amelia', description: 'Owner', feeling: 'Our turn!' });
  b.update(6099, [reaction]);
  assert.equal(b.current?.target, 'Amelia');
  b.update(6100, [reaction]);
  assert.equal(b.current, undefined);
  b.update(8200, [reaction]);
  assert.equal(
    b.current,
    undefined,
    'no repeated stale chatter for the same action',
  );
  b.update(8300, [{ ...reaction, key: 'drink' }]);
  assert.equal((b as BubbleDirector<string>).current?.target, 'Milo');
  b.update(8400, []);
  assert.equal(
    b.current,
    undefined,
    'a finished action stops claiming that feeling',
  );
});

test('every named pet and owner has five distinct personal lines per action and feeling', () => {
  const names = [
    ...new Set(['Louise', ...visits.flatMap((p) => [p.name, p.owner])]),
  ];
  assert.deepEqual(Object.keys(characterVoices).sort(), [...names].sort());
  for (const [action, bank] of Object.entries(dialogue)) {
    const all = new Set<string>();
    const repertoires = new Set<string>();
    for (const name of names) {
      const kind = characterVoices[name].kind;
      if (
        !bank[kind] ||
        (name === 'Louise') !== (action === 'Hello, little friend!')
      )
        continue;
      const lines = messagesFor(name, action);
      assert.equal(lines.length, 5, name);
      assert.equal(new Set(lines).size, 5, name);
      const repertoire = JSON.stringify([...lines].sort());
      assert.ok(
        !repertoires.has(repertoire),
        `shared repertoire: ${name}, ${action}`,
      );
      repertoires.add(repertoire);
      for (const line of lines) {
        if (kind === 'owner') assert.ok(!all.has(line), `shared line: ${line}`);
        else
          assert.doesNotMatch(
            line,
            /\b(?:you|your|yours)\b/i,
            `internal thought: ${line}`,
          );
        assert.ok(line.length <= 140, `keep bubbles short: ${line}`);
        assert.doesNotMatch(line, /[{}|]|undefined|\s{2}| ,|\.\./, line);
        assert.match(line, /^[A-Z].*[.!?]$/, line);
        all.add(line);
      }
    }
  }
});

test('independent clinic thoughts focus on the activity without addressing or naming an owner', () => {
  const actions = [
    ...Object.values(clinicAttractions).map((a) => a.feeling),
    ...Object.values(foodFeelings),
    'My turn soon!',
    'All aboard!',
    'Ooh! Let us try this!',
    'Happy to wait with you.',
    'Hello, cosy clinic!',
  ];
  for (const pet of visits)
    for (const action of actions)
      for (const line of messagesFor(pet.name, action)) {
        assert.ok(!line.includes(pet.owner), `${pet.name}: ${line}`);
        assert.doesNotMatch(line, /\b(?:you|your|yours)\b/i, line);
      }
  assert.ok(
    messagesFor('Ziggy', 'Where did everyone go?').some((line) =>
      line.includes('Max'),
    ),
  );
});

test('a character cycles through five messages before repeating an action', () => {
  const b = new BubbleDirector<string>();
  const info = {
    name: 'Luna',
    description: '',
    feeling: 'Whee!',
    messages: messagesFor('Luna', 'Whee!'),
  };
  const spoken: string[] = [];
  for (let i = 0; i < 6; i++) {
    b.inspect('Luna', info, i * 6000);
    b.refresh(info);
    spoken.push(b.current!.info.feeling!);
  }
  assert.equal(new Set(spoken.slice(0, 5)).size, 5);
  assert.equal(spoken[5], spoken[0]);
});

test('activity feelings follow the actual pet, species and action without changing simulation', () => {
  const s = new TownSimulation(visits, () => 0.5);
  s.seedClinic([visits.indexOf(pet('Luna'))]);
  s.configureLeisure(['expansion', 'pet-room', 'coaster']);
  s.update(0.1);
  const h = s.households.find((h) => h.owner === 'Amelia')!;
  const activity = s.leisure.pets.get(h.ticket!)!;
  Object.assign(activity, { station: 'coaster', phase: 'use' });
  const before = s.snapshot();
  assert.match(characterFeeling(s, h, pet('Luna')).text, /Wheee/);
  assert.doesNotMatch(characterFeeling(s, h, pet('Scout')).text, /Wheee/);
  activity.phase = 'queue';
  assert.match(characterFeeling(s, h, pet('Luna')).text, /turn soon/);
  for (const species of Object.keys(
    foodFeelings,
  ) as (keyof typeof foodFeelings)[]) {
    const line = attractionFeeling(
      { ...activity, phase: 'use', station: 'treat-dispenser' },
      species,
    );
    assert.equal(line, foodFeelings[species]);
  }
  assert.equal(new Set(Object.values(foodFeelings)).size, 7);
  activity.phase = 'use';
  assert.deepEqual(s.snapshot(), before);
});

test('every rescue stage has distinct owner/pet voices; uninvolved pets do not claim a rescue', () => {
  for (const name of ['Luna', 'Milo', 'Pico']) {
    const s = new TownSimulation(visits, () => 0.5);
    const h = s.households.find((h) => h.owner === pet(name).owner)!;
    assert.ok(s.emergencies.start('lost', h, s.households, 0, () => 0.5));
    const e = s.emergencies.active!;
    e.pets = [name];
    for (const phase of Object.keys(rescueFeelings) as RescuePhase[]) {
      e.phase = phase;
      const own = characterFeeling(s, h),
        animal = characterFeeling(s, h, pet(name));
      assert.equal(own.priority, 4, phase);
      assert.equal(animal.priority, 4, phase);
      assert.notEqual(own.text, animal.text);
      assert.equal(messagesFor(h.owner, own.text, own.companion).length, 5);
      assert.equal(messagesFor(name, animal.text).length, 5);
    }
    if (name === 'Luna')
      assert.notEqual(characterFeeling(s, h, pet('Scout')).priority, 4);
    const before = s.snapshot();
    for (const family of s.households)
      for (const p of family.pets) characterFeeling(s, family, p);
    assert.deepEqual(s.snapshot(), before);
  }
});

test('all household routines give both people and pets contextual lines', () => {
  const s = new TownSimulation(visits, () => 0.5),
    h = s.households[0];
  h.companions = h.pets.map((p) => p.name);
  for (const routine of [
    'garden',
    'gather',
    'walk',
    'park',
    'chat',
    'clinic-gather',
    'clinic-walk',
    'clinic-wait',
    'clinic-enter',
    'clinic-exit',
    'homeward',
    'incident',
  ] as Routine[]) {
    h.routine = routine;
    for (const pet of [undefined, ...h.pets]) {
      const feeling = characterFeeling(s, h, pet);
      assert.equal(
        messagesFor(pet?.name ?? h.owner, feeling.text, feeling.companion)
          .length,
        5,
        routine,
      );
    }
  }
  h.routine = 'clinic-walk';
  h.companions = ['Luna'];
  assert.equal(characterFeeling(s, h, pet('Scout')).text, 'Home sweet home!');
});

test('owners address the rescued pet or clinic patient, and rescue thoughts fit birds and fish too', () => {
  const s = new TownSimulation(visits, () => 0.5);
  const h = s.households.find((h) => h.owner === 'Amelia')!;
  assert.ok(s.emergencies.start('lost', h, s.households, 0, () => 0.5));
  const e = s.emergencies.active!;
  e.pets = ['Luna'];
  e.phase = 'handover';
  const owner = characterFeeling(s, h);
  for (const line of messagesFor(h.owner, owner.text, owner.companion)) {
    assert.match(line, /Luna/);
    assert.doesNotMatch(line, /Scout/);
  }
  const clinic = new TownSimulation(visits, () => 0.5);
  clinic.seedClinic([visits.indexOf(pet('Luna'))]);
  const family = clinic.households.find((h) => h.owner === 'Amelia')!;
  const greeting = characterFeeling(clinic, family);
  assert.equal(greeting.companion, 'Luna');
  for (const name of ['Pico', 'Bubbles']) {
    const rescue = new TownSimulation(visits, () => 0.5);
    const household = rescue.households.find(
      (h) => h.owner === pet(name).owner,
    )!;
    assert.ok(
      rescue.emergencies.start(
        'fire',
        household,
        rescue.households,
        0,
        () => 0.5,
      ),
    );
    for (const phase of Object.keys(rescueFeelings) as RescuePhase[]) {
      rescue.emergencies.active!.phase = phase;
      const feeling = characterFeeling(rescue, household, pet(name));
      for (const line of messagesFor(name, feeling.text))
        assert.doesNotMatch(
          line,
          /paw|whisker|woof|meow|hooray|whee|brilliant/i,
          `${name}: ${line}`,
        );
    }
  }
});

test('animal replies are individual sound-only speech; fish remain silent', async () => {
  const { petReply } = await import('../src/pet-replies.ts');
  const sounds = {
    dog: /^(woof|ruff|arf|bark|yip)$/i,
    cat: /^(meow|mrrp|mew|purr)$/i,
    bird: /^(chirp|tweet|chirrup)$/i,
    rabbit: /^(snuff|snff)$/i,
    hamster: /^(squeak|eep)$/i,
    gerbil: /^(peep|squeak)$/i,
    goldfish: /^$/,
  };
  const all = new Set<string>();
  for (const pet of visits) {
    const reply = petReply(pet);
    if (pet.species === 'goldfish') {
      assert.equal(reply, undefined);
      continue;
    }
    assert.equal(reply?.bubble, 'speech');
    assert.equal(reply?.messages?.length, 5);
    for (const line of reply!.messages!) {
      assert.ok(!all.has(line), `unique voice: ${line}`);
      all.add(line);
      assert.ok(
        line.match(/[a-z]+/gi)!.every((word) => sounds[pet.species].test(word)),
        `${pet.name}: ${line}`,
      );
    }
  }
});

test('pet sound replies follow their owner; inspection and changed actions cancel stale replies', () => {
  const owner = {
    target: 'Amelia',
    key: 'gather',
    priority: 2,
    info: {
      name: 'Amelia',
      description: '',
      bubble: 'speech' as const,
      feeling: 'Ready for a walk?',
    },
  };
  const pet = {
    target: 'Luna',
    key: 'gather',
    priority: 2,
    info: {
      name: 'Luna',
      description: '',
      bubble: 'thought' as const,
      feeling: 'Walkies!',
    },
    replyTo: 'Amelia',
    reply: {
      name: 'Luna',
      description: '',
      bubble: 'speech' as const,
      feeling: 'Woof, ruff!',
    },
  };
  const b = new BubbleDirector<string>();
  b.update(0, [owner, pet]);
  assert.equal(b.current?.target, 'Amelia');
  b.update(5000, [owner, pet]);
  b.update(7100, [owner, pet]);
  assert.equal(b.current?.target, 'Luna');
  assert.equal(b.current?.info.bubble, 'speech');
  assert.equal(b.current?.info.feeling, 'Woof, ruff!');
  b.clear(8000);
  b.update(11000, [
    { ...owner, key: 'chat' },
    { ...pet, key: 'chat' },
  ]);
  b.update(16000, [
    { ...owner, key: 'chat' },
    { ...pet, key: 'chat' },
  ]);
  b.inspect('Luna', pet.info, 16100);
  assert.equal(b.current?.info.bubble, 'thought');
  b.update(21200, [
    { ...owner, key: 'walk' },
    { ...pet, key: 'walk', reply: undefined },
  ]);
  b.update(23500, [
    { ...owner, key: 'walk' },
    { ...pet, key: 'walk', reply: undefined },
  ]);
  assert.notEqual(b.current?.info.feeling, 'Woof, ruff!');
});
