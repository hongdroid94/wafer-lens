import { training } from './training.ts';
import { demoExamples } from './examples.ts';

export type DieState = 0 | 1 | 2;
export type WaferGrid = number[][];
export type PatternCandidate = { label: string; score: number; distance: number };
export type NearestExample = { id: string; label: string; distance: number; grid: WaferGrid };
export type ClassificationResult = {
  candidates: PatternCandidate[];
  nearestExamples: NearestExample[];
  uncertainty: number;
  abstained: boolean;
  reason?: string;
};

const LABELS = ['none', 'Center', 'Donut', 'Edge-Loc', 'Edge-Ring', 'Loc', 'Near-full', 'Random', 'Scratch'];
const SIZE = 32;
const DESCRIPTIONS: Record<string, string> = {
  none: 'No labeled defect pattern',
  Center: 'Failures concentrated near the center',
  Donut: 'Failures forming an inner ring',
  'Edge-Loc': 'Failures clustered at part of the edge',
  'Edge-Ring': 'Failures distributed around the edge',
  Loc: 'A localized failure cluster',
  'Near-full': 'Failures across most of the wafer',
  Random: 'Scattered failures',
  Scratch: 'Failures in a narrow line',
};

export const examples: { id: string; label: string; description: string; grid: WaferGrid }[] = LABELS.map((label) => {
  const example = demoExamples.find((item) => item.label === label)!;
  return { id: example.id, label, description: DESCRIPTIONS[label], grid: example.grid };
});

export function parseWaferCsv(text: string): WaferGrid {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length || lines.length > 256) throw new Error('CSV must contain 2–256 rows of die states.');
  const grid = lines.map((line) => line.trim().split(line.includes(',') ? ',' : line.includes(';') ? ';' : /\s+/).map((cell) => {
    const state = cell.trim();
    return /^[012]$/.test(state) ? Number(state) : NaN;
  }));
  validateGrid(grid);
  return grid;
}

function validateGrid(grid: WaferGrid): void {
  if (!Array.isArray(grid) || grid.length < 2 || grid.length > 256) throw new Error('Wafer map must have 2–256 rows.');
  const width = grid[0]?.length ?? 0;
  if (width < 2 || width > 256 || grid.some((row) => row.length !== width || row.some((die) => die !== 0 && die !== 1 && die !== 2))) {
    throw new Error('Use a rectangular CSV grid with only 0 (outside), 1 (pass), and 2 (fail).');
  }
  if (!grid.some((row) => row.some((die) => die !== 0))) throw new Error('Wafer map needs at least one die.');
}

function normalize(grid: WaferGrid): WaferGrid {
  return Array.from({ length: SIZE }, (_, y) => Array.from({ length: SIZE }, (_, x) =>
    grid[Math.min(Math.floor((y + 0.5) * grid.length / SIZE), grid.length - 1)]
      [Math.min(Math.floor((x + 0.5) * grid[0].length / SIZE), grid[0].length - 1)]));
}

export function extractFeatures(input: WaferGrid): number[] {
  const grid = input.length === SIZE && input[0].length === SIZE ? input : normalize(input);
  const rings = Array(4).fill(0), ringDies = Array(4).fill(0);
  const sectors = Array(8).fill(0), sectorDies = Array(8).fill(0);
  const cells = Array(16).fill(0), cellDies = Array(16).fill(0);
  let dies = 0, failures = 0, sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumXY = 0, adjacent = 0;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const state = grid[y][x];
    if (!state) continue;
    dies++;
    const dx = (x + 0.5 - SIZE / 2) / (SIZE / 2);
    const dy = (y + 0.5 - SIZE / 2) / (SIZE / 2);
    const r = Math.min(3, Math.floor(Math.hypot(dx, dy) * 4));
    const angle = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI);
    const sector = Math.min(7, Math.floor(angle * 8));
    const cell = Math.floor(y / 8) * 4 + Math.floor(x / 8);
    ringDies[r]++; sectorDies[sector]++; cellDies[cell]++;
    if (state !== 2) continue;
    failures++; rings[r]++; sectors[sector]++; cells[cell]++;
    sumX += dx; sumY += dy; sumX2 += dx * dx; sumY2 += dy * dy; sumXY += dx * dy;
    if (x > 0 && grid[y][x - 1] === 2) adjacent++;
    if (y > 0 && grid[y - 1][x] === 2) adjacent++;
  }
  const n = Math.max(1, failures), mx = sumX / n, my = sumY / n;
  const vx = Math.max(0, sumX2 / n - mx * mx), vy = Math.max(0, sumY2 / n - my * my), cov = sumXY / n - mx * my;
  const anisotropy = Math.sqrt((vx - vy) ** 2 + 4 * cov ** 2) / Math.max(0.001, vx + vy);
  const sectorRates = sectors.map((count, i) => count / Math.max(1, sectorDies[i])).sort((a, b) => b - a);
  return [
    failures / Math.max(1, dies),
    ...rings.map((count, i) => count / Math.max(1, ringDies[i])),
    ...sectorRates,
    Math.hypot(mx, my), Math.sqrt(vx + vy), anisotropy, adjacent / Math.max(1, 2 * failures),
    ...cells.map((count, i) => count / Math.max(1, cellDies[i])),
  ];
}

let vectors: { id: string; label: string; grid: WaferGrid; features: number[] }[] | undefined;
let scales: number[];
let cachedTraining: { id: string; label: string; grid: WaferGrid }[] | undefined;

function model(reference: { id: string; label: string; grid: WaferGrid }[]) {
  if (vectors && cachedTraining === reference) return vectors;
  cachedTraining = reference;
  vectors = reference.map((item) => ({ ...item, features: extractFeatures(item.grid) }));
  const count = vectors.length;
  const means = vectors[0].features.map((_, i) => vectors!.reduce((sum, row) => sum + row.features[i], 0) / count);
  scales = means.map((mean, i) => Math.max(0.04, Math.sqrt(vectors!.reduce((sum, row) => sum + (row.features[i] - mean) ** 2, 0) / count)));
  return vectors;
}

export function classifyWafer(grid: WaferGrid, reference: { id: string; label: string; grid: WaferGrid }[] = training): ClassificationResult {
  validateGrid(grid);
  const features = extractFeatures(grid);
  const nearest = model(reference).map((item) => ({
    ...item,
    distance: Math.sqrt(features.reduce((sum, value, i) => sum + ((value - item.features[i]) / scales[i]) ** 2, 0) / features.length),
  })).sort((a, b) => a.distance - b.distance);
  const neighbors = nearest.slice(0, 9);
  const weights = new Map<string, number>();
  for (const item of neighbors) weights.set(item.label, (weights.get(item.label) ?? 0) + 1 / (item.distance + 0.1) ** 2);
  const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0);
  const candidates = LABELS.map((label) => ({
    label,
    score: (weights.get(label) ?? 0) / total,
    distance: nearest.find((item) => item.label === label)!.distance,
  })).sort((a, b) => b.score - a.score || a.distance - b.distance);
  const top = candidates[0];
  const uncertainty = Math.max(0, Math.min(1, (1 - top.score) * 0.75 + Math.min(1, nearest[0].distance / 2) * 0.25));
  const abstained = top.score < 0.45 || nearest[0].distance > 2;
  return {
    candidates: candidates.slice(0, 3),
    nearestExamples: nearest.slice(0, 3).map(({ id, label, distance, grid }) => ({ id, label, distance, grid })),
    uncertainty,
    abstained,
    ...(abstained ? { reason: nearest[0].distance > 2 ? 'Outside the sampled training distribution' : 'Neighbor labels disagree' } : {}),
  };
}
