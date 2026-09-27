import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyWafer, examples, parseWaferCsv } from '../src/model/classifier.ts';

test('held-out wafer is classified from training examples, and invalid CSV is rejected', () => {
  const edgeRing = examples.find((item) => item.label === 'Edge-Ring')!;
  const result = classifyWafer(edgeRing.grid);
  assert.equal(result.candidates[0].label, 'Edge-Ring');
  assert.equal(result.abstained, false);
  assert.ok(result.nearestExamples.every((item) => item.id !== edgeRing.id));
  assert.deepEqual(parseWaferCsv('0,1,2\n0,2,1'), [[0, 1, 2], [0, 2, 1]]);
  assert.throws(() => parseWaferCsv('0,1,2,\n0,2,1,'), /rectangular CSV grid/);
});
