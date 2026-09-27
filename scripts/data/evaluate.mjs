// Run with Node 24+: node scripts/data/evaluate.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { classifyWafer, examples } from '../../src/model/classifier.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const v1 = process.argv.includes('--v1');
const holdout = JSON.parse(readFileSync(resolve(root, v1 ? 'data/holdout.json' : 'data/explore_final.json'), 'utf8'));
const training = v1 ? JSON.parse(readFileSync(resolve(root, 'data/v1_training.json'), 'utf8')) : JSON.parse(readFileSync(resolve(root, 'data/explore_train.json'), 'utf8'));
const manifest = v1 ? JSON.parse(readFileSync(resolve(root, 'data/sample_manifest.json'), 'utf8')) : {
  seed: 8112027,
  resize: '32x32 nearest-neighbor cell-center',
  lotSplit: 'SHA-256 first 32 bits of lotName modulo 5; residue 1 v2 validation, 2 v2 evaluation, 3/4 v2 training. Residue 0 was used for historical v1 evaluation.',
  caps: { trainPerClass: 160, validationPerClass: 40, finalPerClass: 40 },
  sampledRows: { train: countByLabel(training), final: countByLabel(holdout) },
  sampledLots: { train: new Set(training.map(row => row.lot)).size, final: new Set(holdout.map(row => row.lot)).size },
};
const labels = ['none', 'Center', 'Donut', 'Edge-Loc', 'Edge-Ring', 'Loc', 'Near-full', 'Random', 'Scratch'];
function countByLabel(rows) { return Object.fromEntries([...new Set(rows.map(row => row.label))].map(label => [label, rows.filter(row => row.label === label).length])); }
const v1TrainingIds = v1 ? new Set() : new Set(JSON.parse(readFileSync(resolve(root, 'data/v1_training.json'), 'utf8')).map(row => row.id));
const v2History = !v1 && {
  v2EvaluationLotOverlapWithV2Training: new Set(training.map(row => row.lot)).intersection(new Set(holdout.map(row => row.lot))).size,
  v2EvaluationLotOverlapWithV2Validation: new Set(JSON.parse(readFileSync(resolve(root, 'data/explore_validation.json'), 'utf8')).map(row => row.lot)).intersection(new Set(holdout.map(row => row.lot))).size,
  v2EvaluationWaferIdOverlapWithV1Training: holdout.filter(row => v1TrainingIds.has(row.id)).length,
};
if (v2History && (v2History.v2EvaluationLotOverlapWithV2Training || v2History.v2EvaluationLotOverlapWithV2Validation)) throw Error('v2 lot leakage');
const confusion = Object.fromEntries(labels.map(label => [label, Object.fromEntries([...labels, 'ABSTAIN'].map(pred => [pred, 0]))]));
const predictions = holdout.map(row => {
  const result = classifyWafer(row.grid, training);
  const prediction = result.abstained ? 'ABSTAIN' : result.candidates[0].label;
  confusion[row.label][prediction]++;
  return { id: row.id, truth: row.label, prediction, topCandidate: result.candidates[0].label, score: result.candidates[0].score, distance: result.nearestExamples[0].distance, abstained: result.abstained };
});
const perClass = Object.fromEntries(labels.map(label => {
  const tp = confusion[label][label];
  const support = predictions.filter(row => row.truth === label).length;
  const predicted = labels.reduce((sum, truth) => sum + confusion[truth][label], 0);
  const precision = predicted ? tp / predicted : 0;
  const recall = support ? tp / support : 0;
  return [label, { support, precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0, abstained: confusion[label].ABSTAIN }];
}));
const abstained = predictions.filter(row => row.abstained).length;
const correct = predictions.filter(row => row.prediction === row.truth).length;
const accepted = predictions.length - abstained;
const metrics = {
  source: { name: 'WM-811K wafer map', uploader: 'QINGYI', url: 'https://www.kaggle.com/datasets/qingyi/wm811k-wafer-map/metadata', listingLicense: 'CC0: Public Domain', caveat: 'Original upstream provenance and rights were not independently verified.' },
  method: '9-nearest-neighbor classifier on 32x32 normalized die maps using failure-density, radial, angular, spatial, and adjacency features; inverse-square distance vote. Scores are relative neighbor support, not calibrated probabilities.',
  split: manifest,
  ...(v1 ? { version: 'v1 historical baseline; original test results were inspected before the v2 training-size comparison.' } : { version: `v2 exploratory evaluation. Its evaluation lots do not overlap v2 training or validation lots, but ${v2History.v2EvaluationWaferIdOverlapWithV1Training} of ${holdout.length} evaluated wafer IDs appeared in v1 training, so this is not a globally untouched prospective test.`, evaluationHistory: v2History, validationComparison: JSON.parse(readFileSync(resolve(root, 'data/exploration_comparison.json'), 'utf8')) }),
  evaluation: { type: v1 ? 'Deterministic, capped, class-stratified v1 evaluation by lotName; no v1 train/evaluation lot overlap. Metrics describe this sample, not deployment prevalence or fab performance.' : 'Deterministic, capped, class-stratified v2 evaluation by lotName. The v2 lot partition has no overlap with its own train/validation groups. Metrics describe this exploratory sample, not deployment prevalence or fab performance.', total: predictions.length, correct, accuracy: correct / predictions.length, macroF1: labels.reduce((sum, label) => sum + perClass[label].f1, 0) / labels.length, abstained, abstentionRate: abstained / predictions.length, accepted, selectiveAccuracy: accepted ? correct / accepted : 0, perClass, confusion, demoPredictions: (v1 ? labels.map(label => holdout.find(row => row.label === label)) : examples).map(example => predictions.find(row => row.id === example.id)) },
  limitations: ['Dataset labels are visual pattern classes, not physical root causes.', 'The holdout is small and class-stratified, with limited Near-full examples.', '32x32 nearest-neighbor downsampling may discard tiny defects.', 'A novel fab, process, image modality, or annotation policy can shift performance.', 'The source listing reports CC0 but original upstream rights have not been audited.'],
};
writeFileSync(resolve(root, v1 ? 'public/data/metrics-v1.json' : 'public/data/metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
console.log(JSON.stringify({ total: predictions.length, accuracy: metrics.evaluation.accuracy, macroF1: metrics.evaluation.macroF1, abstentionRate: metrics.evaluation.abstentionRate, selectiveAccuracy: metrics.evaluation.selectiveAccuracy, perClass, demoPredictions: metrics.evaluation.demoPredictions }, null, 2));
