import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CareSkill,
  careSkills,
  carePatches,
  type CareTool,
} from '../src/care-skill.ts';
import { bandagePattern, type TracePoint } from '../src/bandage-pattern.ts';
import { visits } from '../src/game.ts';
import { FishCare } from '../src/fish-care.ts';
const tick = (s: CareSkill, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds / 0.05); i++) s.update(0.05);
};
function stroke(s: CareSkill, to: TracePoint, seconds = 0.8) {
  const from = { ...s.position },
    count = Math.ceil(seconds / 0.05);
  for (let i = 1; i <= count; i++) {
    s.move({
      x: from.x + ((to.x - from.x) * i) / count,
      y: from.y + ((to.y - from.y) * i) / count,
    });
    s.update(0.05);
  }
}
function circle(s: CareSkill, p: TracePoint) {
  s.press({ x: p.x + 0.035, y: p.y });
  for (let i = 1; i <= 36; i++) {
    s.move({
      x: p.x + Math.cos(i * 0.3) * 0.035,
      y: p.y + Math.sin(i * 0.3) * 0.035,
    });
    s.update(0.05);
  }
  s.release();
}
function complete(tool: CareTool) {
  const s = new CareSkill(tool);
  s.start();
  switch (s.spec.kind) {
    case 'wrap':
      s.beginWrap(bandagePattern[0]);
      for (const point of bandagePattern) s.traceWrap(point);
      break;
    case 'spread':
    case 'brush':
      for (const p of carePatches.slice(0, tool === 'cream' ? 6 : 3))
        circle(s, p);
      break;
    case 'comb':
      for (let i = 0; i < 6; i++) {
        const p = s.fleaPosition(i);
        s.press({ x: p.x - 0.03, y: p.y });
        s.move(p);
        s.update(0.05);
        s.release();
      }
      break;
    case 'aim':
      for (let i = 0; i < 3; i++) {
        s.press(s.targetPoint);
        tick(s, 0.6);
        s.release();
        s.act();
      }
      break;
    case 'pull':
      s.press(s.targetPoint);
      s.act();
      for (let i = 0; i < 3; i++) {
        stroke(s, s.targetPoint);
        tick(s, 0.6);
      }
      break;
    case 'steady':
      s.press(s.targetPoint);
      for (let i = 0; i < 85; i++) {
        s.move(s.targetPoint);
        s.update(0.05);
      }
      break;
    case 'pressure':
      s.press(s.targetPoint);
      tick(s, 0.5);
      s.release();
      s.act();
      s.input(0.45);
      tick(s, 3.1);
      break;
    case 'timing':
      for (let i = 0; i < 1200 && !s.complete; i++) {
        const fish = s.fishCare!;
        // Tap as the fish reaches the rim, then watch the next crossing.
        if (
          Math.hypot(fish.position.x, fish.position.y) > 0.39 &&
          fish.cooldown === 0
        ) {
          s.press(s.targetPoint);
          s.release();
        }
        s.update(0.05);
      }
      break;
  }
  return s;
}
test('all nine tool-specific activities are achievable and complete only once', () => {
  for (const v of visits) assert.ok(v.treatment in careSkills);
  for (const tool of Object.keys(careSkills) as CareTool[]) {
    const s = complete(tool);
    assert.ok(s.complete, tool);
    assert.equal(s.progress, 1);
    assert.equal(s.misses, 0, tool);
    const before = { stage: s.stage, misses: s.misses };
    s.act();
    s.press({ x: 0, y: 0 });
    s.input(1);
    tick(s, 4);
    assert.deepEqual({ stage: s.stage, misses: s.misses }, before);
  }
});
test('reading never starts care, and arbitrary clicks or sliders cannot replace contact', () => {
  for (const tool of Object.keys(careSkills) as CareTool[]) {
    const s = new CareSkill(tool);
    s.act();
    s.input(1);
    s.press(carePatches[0]);
    s.move(carePatches[1]);
    s.beginWrap(bandagePattern[0]);
    for (const p of bandagePattern) s.traceWrap(p);
    tick(s, 20);
    assert.equal(s.elapsed, 0);
    assert.equal(s.progress, 0);
  }
  for (const tool of ['cream', 'brush', 'comb'] as const) {
    const s = new CareSkill(tool);
    s.start();
    for (let i = 0; i < 6; i++) {
      s.act();
      s.input(i % 2);
      s.press(carePatches[i]);
      s.release();
      tick(s, 1);
    }
    assert.equal(s.progress, 0, tool);
  }
});
test('gentle circles cover every patch; fast or heavy scrubbing startles and requires a fresh attempt', () => {
  const s = new CareSkill('cream');
  s.start();
  circle(s, carePatches[0]);
  assert.equal(s.covered.size, 1);
  s.press(carePatches[1]);
  for (let i = 0; i < 80; i++) {
    s.move({ x: i % 2 ? 0.1 : 0.9, y: 0.38 });
    s.update(0.05);
  }
  assert.ok(s.startled);
  assert.equal(s.complete, false);
  assert.equal(s.misses, 1);
  tick(s, 60);
  assert.ok(s.startled, 'time alone cannot resume after startling');
  s.restart();
  assert.equal(s.progress, 0);
  assert.equal(s.pain, 0);
  for (const p of carePatches) circle(s, p);
  assert.ok(s.complete);
  assert.equal(s.qualityLoss, 4);
  const heavy = new CareSkill('brush');
  heavy.start();
  heavy.press(carePatches[0], 1);
  for (let i = 0; i < 60; i++) {
    heavy.move({ x: 0.32 + Math.sin(i) * 0.01, y: 0.38 }, 1);
    heavy.update(0.05);
  }
  assert.ok(heavy.startled);
});
test('fleas move and hop; only a comb stroke close to a flea catches it', () => {
  const s = new CareSkill('comb');
  s.start();
  const before = s.fleaPosition(0);
  tick(s, 1.4);
  assert.notDeepEqual(s.fleaPosition(0), before);
  assert.ok(s.fleaPosition(0).hop > 0);
  s.press({ x: 0, y: 0 });
  s.move({ x: 0.01, y: 0 });
  s.update(0.05);
  assert.equal(s.covered.size, 0);
  const flea = s.fleaPosition(0);
  s.release();
  s.press({ x: flea.x - 0.025, y: flea.y });
  s.move(flea);
  s.update(0.05);
  assert.ok(s.covered.has(0));
  assert.equal(s.complete, false);
});
test('bandage preserves exact progress and rejoins within the same drag, without skipping coils', () => {
  const s = new CareSkill('bandage');
  s.start();
  assert.equal(s.beginWrap(bandagePattern[48]), false);
  s.beginWrap(bandagePattern[0]);
  s.traceWrap(bandagePattern[32]);
  assert.equal(s.progress, 0, 'a shortcut cannot add progress');
  assert.equal(s.misses, 1);
  assert.ok(s.wrapping, 'a drift must not cancel the drag');
  assert.ok(s.wrapRecovering);
  s.traceWrap(bandagePattern[48]);
  s.traceWrap(bandagePattern[96]);
  assert.equal(s.progress, 0);
  assert.equal(s.misses, 1, 'one mistake per excursion, not per pointer event');
  s.traceWrap(bandagePattern[0]);
  assert.equal(s.wrapRecovering, false);
  for (const p of bandagePattern.slice(1, 24)) s.traceWrap(p);
  const beforeSlip = s.wrapProgress;
  assert.ok(beforeSlip >= 23);
  s.traceWrap({ x: 1.5, y: 0.5 });
  assert.equal(
    s.wrapProgress,
    beforeSlip,
    'keep everything wrapped, not just the last marker',
  );
  s.traceWrap(bandagePattern[23]);
  for (const p of bandagePattern.slice(24, 40)) s.traceWrap(p);
  s.releaseWrap();
  const progress = s.wrapProgress;
  s.traceWrap(bandagePattern[96]);
  assert.equal(s.wrapProgress, progress);
  s.beginWrap(s.wrapPosition);
  for (const p of bandagePattern.slice(39)) s.traceWrap(p);
  assert.ok(s.complete);
  assert.equal(s.wrapping, false);
  assert.equal(s.misses, 2);
});
test('bandage tolerates small hand wobbles and rounded turns across board shapes', () => {
  for (const [width, height] of [
    [320, 170],
    [320, 380],
    [410, 210],
  ]) {
    const s = new CareSkill('bandage');
    // A level camera projects each three-dimensional coil without hooked reversals.
    const path = bandagePattern.map((p) => ({
      x: 0.5 + (p.x - 0.5) * 0.65,
      y: 0.5 + (p.y - 0.5) * 0.5,
    }));
    s.setWrapPath(path, width, height);
    s.start();
    s.beginWrap(path[0]);
    // Sparse input rounds each turn; six-pixel wobbles should stay in the visible lane.
    for (let i = 2; i <= 96; i += 2) {
      s.traceWrap({
        x: path[i].x + (Math.sin(i * 1.7) * 6) / width,
        y: path[i].y + (Math.cos(i * 0.7) * 6) / height,
      });
      assert.equal(s.wrapRecovering, false, `${width}x${height} segment ${i}`);
    }
    assert.ok(s.complete, `${width}x${height}`);
    assert.equal(s.misses, 0);
  }
});
test('the final bandage marker accepts the same lane tolerance without skipping the last curve', () => {
  const s = new CareSkill('bandage');
  s.start();
  s.beginWrap(bandagePattern[0]);
  for (const p of bandagePattern.slice(1, 65)) s.traceWrap(p);
  s.traceWrap(bandagePattern[96]);
  assert.equal(
    s.complete,
    false,
    'cannot skip the last coil by jumping to its final marker',
  );
  s.traceWrap(bandagePattern[64]);
  for (const p of bandagePattern.slice(65, 94)) s.traceWrap(p);
  assert.ok(
    s.complete,
    'reaching inside the final marker needs no exact endpoint',
  );
  assert.equal(s.wrapProgress, 96);
});
test('drops require steady aim; forceps need a grip, a slow straight pull and pauses', () => {
  const d = new CareSkill('drops');
  d.start();
  d.act();
  assert.equal(d.stage, 0);
  d.press(d.targetPoint);
  d.act();
  assert.equal(d.stage, 0);
  tick(d, 0.6);
  d.act();
  assert.equal(d.stage, 1);
  const s = new CareSkill('forceps');
  s.start();
  s.press({ x: 0, y: 0 });
  s.act();
  assert.equal(s.gripped, false);
  s.press(s.targetPoint);
  s.act();
  stroke(s, { x: 0.95, y: 0.8 });
  tick(s, 2);
  assert.ok(s.startled);
  assert.equal(s.stage, 0);
  s.restart();
  s.press(s.targetPoint);
  s.act();
  stroke(s, s.targetPoint, 0.8);
  tick(s, 0.2);
  assert.ok(s.stage <= 1, 'cannot skip all three extraction marks');
});
test('cooling requires held alignment; lifting pauses, a parked pad does not complete', () => {
  const s = new CareSkill('cooling');
  s.start();
  s.press(s.targetPoint);
  for (let i = 0; i < 30; i++) {
    s.move(s.targetPoint);
    s.update(0.05);
  }
  s.release();
  const progress = s.progress;
  tick(s, 0.2);
  assert.ok(s.progress <= progress);
  assert.equal(s.complete, false);
  for (let i = 0; i < 100; i++) {
    s.press(s.targetPoint);
    s.update(0.05);
  }
  assert.ok(s.complete);
  const parked = new CareSkill('cooling');
  parked.start();
  parked.press({ x: 0.5, y: 0.5 });
  tick(parked, 30);
  assert.equal(parked.complete, false);
});
test('vaccine needs aim and gentle pressure', () => {
  const v = new CareSkill('vaccine');
  v.start();
  v.input(0.45);
  tick(v, 8);
  assert.equal(v.progress, 0);
  v.press(v.targetPoint);
  tick(v, 0.5);
  v.act();
  v.input(1);
  tick(v, 2);
  assert.ok(v.startled);
  assert.equal(v.complete, false);
});
test('water care checks the swimming fish at landing, keeps safe drops and ignores repeated holds and sliders', () => {
  const s = new CareSkill('water-care');
  s.start();
  s.press(s.targetPoint);
  tick(s, 0.4);
  assert.equal(s.fishCare!.drops, 1);
  tick(s, 0.45);
  // The fish now crosses underneath the dropper.
  s.press(s.targetPoint);
  s.press(s.targetPoint);
  s.input(1);
  tick(s, 0.4);
  assert.equal(s.fishCare!.drops, 1, 'a miss preserves earlier care');
  assert.equal(
    s.fishCare!.misses,
    1,
    'repeat presses cannot stack falling drops',
  );
  assert.equal(s.qualityLoss, 4);
  assert.equal(s.startled, false);
  assert.match(s.message, /fish is fine/);
  tick(s, 12);
  assert.equal(s.fishCare!.drops, 1, 'holding does not keep dropping');
  assert.equal(s.complete, false);
  const before = { ...s.fishCare!.position };
  tick(s, 0.7);
  assert.notDeepEqual(s.fishCare!.position, before);
  const approaching = new FishCare();
  approaching.update(0.5);
  assert.ok(approaching.clear);
  approaching.drop();
  approaching.update(0.35);
  assert.equal(
    approaching.misses,
    1,
    'check where the fish is at landing, not at release',
  );
});
test('fish swims on changing bounded routes, with both safe and unsafe opportunities', () => {
  const fish = new FishCare(() => 0.8);
  let safe = 0,
    unsafe = 0,
    sideways = false;
  for (let i = 0; i < 2400; i++) {
    fish.update(0.025);
    assert.ok(Math.hypot(fish.position.x, fish.position.y) <= 0.401);
    if (fish.clear) safe++;
    else unsafe++;
    if (Math.abs(fish.position.y) > 0.1) sideways = true;
  }
  assert.ok(safe > 300 && unsafe > 300 && sideways);
});
test('equipment widens guides without bypassing the interaction', () => {
  for (const tool of Object.keys(careSkills) as CareTool[]) {
    const assisted = new CareSkill(tool, true),
      plain = new CareSkill(tool);
    assert.ok(assisted.tolerance > plain.tolerance);
    assert.ok(assisted.wrapTolerance > plain.wrapTolerance);
    assisted.start();
    tick(assisted, 60);
    assert.equal(assisted.complete, false);
  }
});

test('brushing coverage and gentle speed do not depend on pointer-event frequency', () => {
  const run = (every: number) => {
    const s = new CareSkill('cream');
    s.start();
    s.press({ x: 0.355, y: 0.38 });
    for (let frame = 1; frame <= 24; frame++) {
      if (frame % every === 0)
        s.move({
          x: 0.32 + Math.cos((frame / 60) * 4) * 0.035,
          y: 0.38 + Math.sin((frame / 60) * 4) * 0.035,
        });
      s.update(1 / 60);
    }
    return s;
  };
  const frequent = run(1),
    touch = run(2),
    batched = run(4);
  for (const s of [touch, batched]) {
    assert.ok(Math.abs(s.progress - frequent.progress) < 0.005);
    assert.equal(s.pain, 0);
    assert.equal(s.misses, 0);
  }
});
