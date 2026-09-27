// Run with Node 24+ after explore_more_training.py. Uses validation only.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { classifyWafer } from '../../src/model/classifier.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = file => JSON.parse(readFileSync(resolve(root, 'data', file), 'utf8'));
const allTraining = read('explore_train.json');
const validation = read('explore_validation.json');
const labels = [...new Set(allTraining.map(row => row.label))];
const baseline = labels.flatMap(label => allTraining.filter(row => row.label === label).slice(0, 80));
function evaluate(training) {
  const outcomes = validation.map(row => {
    const result = classifyWafer(row.grid, training);
    return { truth: row.label, prediction: result.abstained ? 'ABSTAIN' : result.candidates[0].label };
  });
  const perClass = Object.fromEntries(labels.map(label => {
    const tp = outcomes.filter(row => row.truth === label && row.prediction === label).length;
    const support = outcomes.filter(row => row.truth === label).length;
    const predicted = outcomes.filter(row => row.prediction === label).length;
    const p = predicted ? tp / predicted : 0, r = tp / support;
    return [label, { support, f1: p + r ? 2 * p * r / (p + r) : 0, recall: r }];
  }));
  return { training: training.length, total: outcomes.length, accuracy: outcomes.filter(row => row.truth === row.prediction).length / outcomes.length,
    macroF1: labels.reduce((sum, label) => sum + perClass[label].f1, 0) / labels.length,
    abstentions: outcomes.filter(row => row.prediction === 'ABSTAIN').length, perClass };
}
const result = { baseline80: evaluate(baseline), candidate160: evaluate(allTraining) };
writeFileSync(resolve(root, 'data/exploration_comparison.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
