import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadProgress,
  purchase,
  reward,
  visits,
  toolInfo,
  upgrades,
  clinicCapacity,
  examine,
  type Tool,
  type Zone,
} from '../src/game.ts';

test('normal examinations return findings, while wrong targets explain where the tool works', () => {
  const luna = visits[0];
  const ear = examine(luna, 'ear', 'ear');
  assert.equal(ear.kind, 'finding');
  if (ear.kind === 'finding') {
    assert.match(ear.text, /clear and comfortable/);
    assert.equal(ear.clueIndex, -1);
  }
  const wrong = examine(luna, 'ear', 'paw');
  assert.equal(wrong.kind, 'guidance');
  assert.match(wrong.text, /Ear scope works at ear/);
  const pipSurface = examine(visits[2], 'inspect', 'paw');
  assert.match(pipSurface.text, /X-ray/);
  assert.doesNotMatch(pipSurface.text, /healthy|comfortable/);
  assert.match(examine(visits[1], 'ear', 'ear').text, /irritated/);
});

test('every displayed examination tool produces a result at a sensible target for every patient', () => {
  for (const visit of visits) {
    const probes: [Tool, Zone][] =
      visit.species === 'goldfish'
        ? [
            ['water-test', 'tank'],
            ['inspect', 'fin'],
            ['inspect', 'tank'],
          ]
        : visit.species === 'bird'
          ? [
              ['listen', 'chest'],
              ['thermometer', 'coat'],
              ['xray', 'paw'],
              ['inspect', 'mouth'],
              ['inspect', 'coat'],
              ['inspect', 'paw'],
            ]
          : [
              ['listen', 'chest'],
              ['ear', 'ear'],
              ['mouth', 'mouth'],
              ['xray', 'paw'],
              ['xray', 'chest'],
              ['inspect', 'paw'],
              ['inspect', 'coat'],
              ['inspect', 'ear'],
              ['inspect', 'mouth'],
              ['inspect', 'chest'],
            ];
    for (const [tool, zone] of probes)
      assert.equal(
        examine(visit, tool, zone).kind,
        'finding',
        `${visit.name}: ${tool} at ${zone}`,
      );
    visit.checks.forEach((check, index) => {
      const result = examine(visit, check.tool, check.zone);
      assert.equal(result.kind, 'finding');
      if (result.kind === 'finding') {
        assert.equal(result.clueIndex, index);
        assert.equal(result.text, check.finding);
      }
    });
  }
});

test('money, stock, reputation, and upgrades have consistent rewards', () => {
  const p = loadProgress();
  assert.equal(purchase(p, 'equipment'), false);
  assert.equal(p.coins, 120);
  assert.equal(purchase(p, 'plants'), true);
  assert.equal(purchase(p, 'plants'), true);
  assert.equal(purchase(p, 'plants'), false);
  assert.equal(p.coins, 0);
  assert.deepEqual(p.upgrades, ['plants']);
  const result = reward(p, 95);
  assert.equal(result.satisfaction, 98);
  assert.equal(p.coins, result.total);
  assert.equal(p.earned, result.total);
  assert.equal(p.stock, 2);
  assert.equal(p.treated, 1);
  p.stock = 0;
  assert.equal(reward(p, 100).retail, 0);
  assert.equal(p.stock, 0);
});

test('sick visits have actionable clues; scheduled vaccines only need placement and care', () => {
  assert.equal(new Set(visits.map((v) => v.species)).size, 7);
  for (const v of visits) {
    assert.ok(toolInfo[v.treatment]);
    if (v.treatment === 'vaccine') {
      assert.equal(v.checks.length, 0);
      assert.equal(v.alternatives.length, 0);
      assert.equal(v.zone, 'coat');
      continue;
    }
    assert.equal(
      v.checks.length,
      ['Luna', 'Milo', 'Peanut', 'Sunny', 'Cleo', 'Scout', 'Poppy'].includes(
        v.name,
      )
        ? 1
        : 2,
    );
    assert.ok(v.checks.every((c) => Boolean(toolInfo[c.tool])));
    if (v.purpose === 'checkup') {
      assert.equal(v.alternatives.length, 0);
      assert.deepEqual(v.clinical, {});
      continue;
    }
    assert.equal(new Set([v.diagnosis, ...v.alternatives]).size, 3);
    assert.ok(v.checks.some((c) => c.zone === v.zone));
  }
});

test('every shop item can be bought without a room kit; price, copies and one-time grants still apply', () => {
  for (const product of upgrades) {
    const p = loadProgress();
    p.coins = product.price - 1;
    assert.equal(purchase(p, product.id), false, product.id);
    p.coins = product.price * 3;
    assert.ok(purchase(p, product.id), product.id);
    assert.equal(p.coins, product.price * 2);
    assert.deepEqual(p.upgrades, product.id === 'stock' ? [] : [product.id]);
    const repeatable = 'furniture' in product || product.id === 'stock';
    assert.equal(purchase(p, product.id), repeatable, product.id);
    assert.equal(p.coins, product.price * (repeatable ? 1 : 2));
    if (product.id !== 'stock') assert.equal(p.upgrades.length, 1);
  }
  const p = loadProgress();
  p.coins = 1000;
  assert.ok(purchase(p, 'pet-room'));
  assert.equal(clinicCapacity(p.upgrades), 8);
  assert.ok(purchase(p, 'expansion'));
  assert.equal(
    clinicCapacity(p.upgrades),
    8,
    'buying kits in reverse order cannot shrink capacity',
  );
});

test('invalid saved values fall back to a fresh clinic', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: () => JSON.stringify({ version: 1, coins: -200, upgrades: [] }),
    },
    configurable: true,
  });
  assert.equal(loadProgress().coins, 120);
  Object.defineProperty(globalThis, 'localStorage', {
    value: { getItem: () => '{broken' },
    configurable: true,
  });
  assert.equal(loadProgress().coins, 120);
  Reflect.deleteProperty(globalThis, 'localStorage');
});
