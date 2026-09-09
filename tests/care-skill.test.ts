import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CareSkill, careSkills, type CareTool } from '../src/care-skill.ts';
import { visits } from '../src/game.ts';
const tick = (s: CareSkill, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds / 0.05); i++) s.update(0.05);
};
function complete(tool: CareTool) {
  const s = new CareSkill(tool);
  s.start();
  switch (s.spec.kind) {
    case 'spread':
    case 'wrap':
      for (let i = 0; i < 6; i++) s.act(i);
      break;
    case 'comb':
    case 'brush':
      for (let i = 0; i < 6; i++) s.input(i % 2 ? 0 : 1);
      break;
    case 'aim':
      for (let i = 0; i < 3; i++) {
        s.input(s.target);
        s.act();
      }
      break;
    case 'pull':
      s.act();
      for (let i = 0; i < 3; i++) {
        s.input(s.target);
        tick(s, 0.7);
      }
      break;
    case 'steady':
      for (let i = 0; i < 60; i++) {
        s.input(s.target);
        s.update(0.05);
      }
      break;
    case 'pressure':
      s.act();
      tick(s, 2.15);
      s.act();
      break;
    case 'pour':
      s.act();
      tick(s, 2.1);
      s.act();
      tick(s, 1);
      break;
  }
  return s;
}
test('every prescribed care tool has a suitable, completable activity', () => {
  for (const v of visits) assert.ok(v.treatment in careSkills, v.treatment);
  for (const tool of Object.keys(careSkills) as CareTool[]) {
    const s = complete(tool);
    assert.ok(s.complete, tool);
    assert.equal(s.progress, 1);
    assert.equal(s.misses, 0, tool);
    const before = { stage: s.stage, misses: s.misses };
    s.act(0);
    s.input(0);
    tick(s, 4);
    assert.deepEqual(
      { stage: s.stage, misses: s.misses },
      before,
      'completed care cannot be applied twice',
    );
  }
});
test('reading time is unhurried and no action can skip starting', () => {
  for (const tool of Object.keys(careSkills) as CareTool[]) {
    const s = new CareSkill(tool),
      value = s.value;
    s.act(0);
    s.input(1);
    tick(s, 10);
    assert.equal(s.value, value);
    assert.equal(s.elapsed, 0);
    assert.equal(s.complete, false);
  }
});
test('cream needs full coverage; bandages need ordered wraps; strokes need direction changes', () => {
  const cream = new CareSkill('cream');
  cream.start();
  for (let i = 0; i < 10; i++) cream.act(0);
  assert.equal(cream.covered.size, 1);
  cream.act(8);
  assert.equal(cream.complete, false);
  const wrap = new CareSkill('bandage');
  wrap.start();
  wrap.act(3);
  assert.equal(wrap.stage, 0);
  assert.equal(wrap.misses, 1);
  for (let i = 0; i < 6; i++) wrap.act(i);
  assert.ok(wrap.complete);
  for (const tool of ['comb', 'brush'] as const) {
    const s = new CareSkill(tool);
    s.start();
    for (let i = 0; i < 6; i++) s.input(1);
    assert.equal(s.stage, 1);
    assert.equal(s.complete, false);
    for (let i = 1; i < 6; i++) s.input(i % 2 ? 0 : 1);
    assert.ok(s.complete);
  }
});
test('drops cannot release off target; forceps must grip and pause at every mark', () => {
  const drops = new CareSkill('drops');
  drops.start();
  drops.act();
  assert.equal(drops.stage, 0);
  assert.equal(drops.misses, 1);
  drops.input(drops.target);
  drops.act();
  assert.equal(drops.stage, 1);
  const pull = new CareSkill('forceps');
  pull.start();
  pull.input(0.8);
  tick(pull, 1);
  assert.equal(pull.stage, 0);
  pull.act();
  pull.input(0.95);
  tick(pull, 1);
  assert.equal(pull.stage, 0);
  assert.equal(pull.misses, 1);
  pull.input(pull.target);
  tick(pull, 0.3);
  assert.equal(pull.stage, 0);
  tick(pull, 0.4);
  assert.equal(pull.stage, 1);
});
test('vaccine pressure and water flow allow harmless retries without premature completion', () => {
  const s = new CareSkill('vaccine');
  s.start();
  s.act();
  tick(s, 0.1);
  s.act();
  assert.equal(s.complete, false);
  assert.equal(s.misses, 1);
  s.act();
  tick(s, 5);
  assert.equal(s.complete, false);
  assert.equal(s.holding, false);
  s.act();
  tick(s, 2.15);
  s.act();
  assert.ok(s.complete);
  const pour = new CareSkill('water-care');
  pour.start();
  pour.act();
  tick(pour, 1);
  pour.act();
  tick(pour, 1);
  assert.equal(pour.complete, false);
  pour.act();
  tick(pour, 1);
  pour.act();
  tick(pour, 1);
  assert.ok(pour.complete, 'a small pour can be resumed');
  const over = new CareSkill('water-care');
  over.start();
  over.act();
  tick(over, 4);
  assert.equal(over.complete, false);
  assert.equal(over.holding, false);
  assert.equal(over.misses, 1);
});
test('cooling requires sustained alignment; equipment widens guided targets', () => {
  const s = new CareSkill('cooling');
  s.start();
  tick(s, 4);
  assert.equal(s.complete, false);
  s.input(0);
  tick(s, 4);
  assert.equal(s.complete, false);
  for (let i = 0; i < 55; i++) {
    s.input(s.target);
    s.update(0.05);
  }
  assert.ok(s.complete);
  for (const tool of [
    'drops',
    'forceps',
    'vaccine',
    'water-care',
    'cooling',
  ] as const)
    assert.ok(
      new CareSkill(tool, true).tolerance > new CareSkill(tool).tolerance,
    );
});
