import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CareSkill, careSkills, type CareTool } from '../src/care-skill.ts';
import { bandagePattern } from '../src/bandage-pattern.ts';
import { visits } from '../src/game.ts';
const tick = (s: CareSkill, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds / 0.05); i++) s.update(0.05);
};
function complete(tool: CareTool) {
  const s = new CareSkill(tool);
  s.start();
  switch (s.spec.kind) {
    case 'wrap':
      s.beginWrap(bandagePattern[0]);
      for (const point of bandagePattern) s.traceWrap(point);
      break;
    case 'spread':
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
        tick(s, 0.9);
      }
      break;
    case 'steady':
      for (let i = 0; i < 90; i++) {
        s.input(s.target);
        s.update(0.05);
      }
      break;
    case 'pressure':
      s.act();
      tick(s, 1.7);
      s.act();
      break;
    case 'pour':
      s.act();
      tick(s, 1.8);
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
    s.beginWrap(bandagePattern[0]);
    for (const point of bandagePattern) s.traceWrap(point);
    tick(s, 10);
    assert.equal(s.value, value);
    assert.equal(s.elapsed, 0);
    assert.equal(s.complete, false);
  }
});
test('bandages require continuous tracing, preserve checkpoints and resume after lifting', () => {
  const s = new CareSkill('bandage');
  s.start();
  for (let i = 0; i < 7; i++) s.act(i);
  assert.equal(s.progress, 0, 'clicking numbered steps no longer wraps');
  assert.equal(s.beginWrap(bandagePattern[48]), false, 'start at the roll');
  s.beginWrap(bandagePattern[0]);
  s.traceWrap(bandagePattern[32]);
  assert.equal(s.progress, 0, 'cannot jump to another coil');
  assert.equal(s.misses, 1);
  s.beginWrap(bandagePattern[0]);
  for (const point of bandagePattern.slice(0, 24)) s.traceWrap(point);
  assert.ok(s.wrapProgress > 22);
  s.traceWrap({ x: 1.5, y: 0.5 });
  assert.equal(s.wrapProgress, 16, 'an off-ribbon stroke keeps its checkpoint');
  assert.equal(s.misses, 2);
  s.traceWrap(bandagePattern[96]);
  assert.equal(s.misses, 2, 'one miss per interrupted stroke');
  s.beginWrap(s.wrapPosition);
  for (const point of bandagePattern.slice(16, 40)) s.traceWrap(point);
  s.releaseWrap();
  const progress = s.wrapProgress;
  s.traceWrap(bandagePattern[96]);
  assert.equal(s.wrapProgress, progress, 'hovering does not wrap');
  s.beginWrap(s.wrapPosition);
  for (const point of bandagePattern.slice(39)) s.traceWrap(point);
  assert.ok(s.complete);
  assert.equal(s.progress, 1);
  assert.equal(s.wrapping, false);
});
test('tighter treatment targets still support equipment and unhurried retries', () => {
  const drops = new CareSkill('drops');
  drops.start();
  drops.input(drops.target + 0.11);
  drops.act();
  assert.equal(drops.stage, 0, 'old edge of guide now needs more precise aim');
  const assisted = new CareSkill('drops', true);
  assisted.start();
  assisted.input(assisted.target + 0.11);
  assisted.act();
  assert.equal(assisted.stage, 1, 'equipment still widens the guide');
  const cooling = new CareSkill('cooling');
  cooling.start();
  for (let i = 0; i < 55; i++) {
    cooling.input(cooling.target);
    cooling.update(0.05);
  }
  assert.equal(
    cooling.complete,
    false,
    'cooling needs longer than one short pass',
  );
  for (let i = 0; i < 30; i++) {
    cooling.input(cooling.target);
    cooling.update(0.05);
  }
  assert.ok(cooling.complete);
  const unattended = new CareSkill('cooling');
  unattended.start();
  unattended.input(0.5);
  tick(unattended, 20);
  assert.equal(
    unattended.complete,
    false,
    'a parked pad cannot follow the moving guide',
  );
  assert.ok(
    new CareSkill('bandage', true).wrapTolerance >
      new CareSkill('bandage').wrapTolerance,
  );
});
test('cream needs full coverage and strokes need direction changes', () => {
  const cream = new CareSkill('cream');
  cream.start();
  for (let i = 0; i < 10; i++) cream.act(0);
  assert.equal(cream.covered.size, 1);
  cream.act(8);
  assert.equal(cream.complete, false);
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
  tick(pull, 0.6);
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
  tick(s, 1.7);
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
  tick(pour, 0.8);
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
  for (let i = 0; i < 85; i++) {
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
