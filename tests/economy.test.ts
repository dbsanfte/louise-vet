import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadProgress,
  purchase,
  reward,
  visits,
  toolInfo,
} from '../src/game.ts';

test('money, stock, reputation, and upgrades have consistent rewards', () => {
  const p = loadProgress();
  assert.equal(purchase(p, 'equipment'), false);
  assert.equal(p.coins, 120);
  assert.equal(purchase(p, 'plants'), true);
  assert.equal(purchase(p, 'plants'), false);
  assert.equal(p.coins, 60);
  const result = reward(p, 95);
  assert.equal(result.satisfaction, 98);
  assert.equal(p.coins, 60 + result.total);
  assert.equal(p.earned, result.total);
  assert.equal(p.stock, 2);
  assert.equal(p.treated, 1);
  p.stock = 0;
  assert.equal(reward(p, 100).retail, 0);
  assert.equal(p.stock, 0);
});

test('every authored visit has two actionable clues and a valid care tool', () => {
  assert.equal(new Set(visits.map((v) => v.species)).size, 6);
  for (const v of visits) {
    assert.equal(v.checks.length, 2);
    assert.ok(toolInfo[v.treatment]);
    assert.ok(v.checks.every((c) => Boolean(toolInfo[c.tool])));
    assert.equal(new Set([v.diagnosis, ...v.alternatives]).size, 3);
    assert.ok(v.checks.some((c) => c.zone === v.zone));
  }
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
