// CSV -> SVG chart + Markdown summary.
// npm run plot -- experiments/mutation-rate.json  (or experiments/generalization.json)
// Reads experiments/results/<name>.csv and writes docs/experiments/<name>.svg and .md.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { parseDefinition, fromCSV, summarize, groupBy } from './lib/experiment.mjs';
import { compareGroups, holm, pairedPermutationTest, deltaSize } from './lib/stats.mjs';
import {
  parseGeneralization,
  buildTestTracks,
  trainingTrack,
  sharpestTurns,
  summarizeGeneralization,
  summarizeNoise,
  GENERALIZATION_STRINGS,
} from './lib/generalization.mjs';
import {
  fitnessChartSVG,
  summaryMarkdown,
  generalizationChartSVG,
  generalizationMarkdown,
  noiseMarkdown,
  significanceMarkdown,
} from './lib/svg.mjs';
import { LAPS } from '../src/core/config.js';

const VALUE_LABELS = {
  mutationRate: (v) => `oran ${v}`,
  mutationStrength: (v) => `şiddet ${v}`,
  populationSize: (v) => `nüfus ${v}`,
  hiddenNeurons: (v) => `${v} gizli nöron`,
  rayCount: (v) => `${v} ışın`,
};

export function resultPaths(def) {
  return {
    csv: `experiments/results/${def.name}.csv`,
    svg: `docs/experiments/${def.name}.svg`,
    md: `docs/experiments/${def.name}.md`,
  };
}

export function plot(def, rows) {
  const paths = resultPaths(def);
  const valueLabel = VALUE_LABELS[def.variable];
  const summary = summarize(rows);
  const svg = fitnessChartSVG(summary, {
    title: def.title,
    subtitle: `${def.track} pisti · nüfus ${def.population} · koşul başına ${def.seeds.length} tohum · ortalama ± 1 sd`,
    valueLabel,
    xLabel: 'Nesil',
    yLabel: 'En iyi fitness',
  });
  mkdirSync('docs/experiments', { recursive: true });
  writeFileSync(paths.svg, svg);
  // Significance: generations until the best car first completes a lap, per run.
  const groups = def.values.map((value) => {
    const runs = [...groupBy(rows.filter((r) => r.value === value), (r) => r.seed).values()];
    const firsts = runs.map((run) => run.find((r) => r.best >= 1)?.generation).filter((g) => g !== undefined);
    return { label: valueLabel(value), values: firsts };
  });
  const pairs = compareGroups(groups);
  const note = groups.some((g, i) => g.values.length < summary[i].runs) ? ' (hiç tur atamayan koşular dışarıda)' : '';
  writeFileSync(paths.md, `${summaryMarkdown(def, summary, valueLabel)}
${significanceMarkdown(pairs, `ilk tura kadar geçen nesil${note}`, 1)}`);
  return { paths, summary, pairs };
}

export function plotGeneralization(def, rows) {
  if (def.testNoise) return plotNoise(def, rows);
  const paths = resultPaths(def);
  const summary = summarizeGeneralization(rows, def);
  const testTracks = buildTestTracks(def);
  const thumbs = Object.fromEntries([...testTracks].map(([name, track]) => [name, track.center]));
  const trainingNames = [...new Set(def.conditions.flatMap((c) => c.tracks))];
  const corners = [
    ...trainingNames.map((name) => ({ track: name, use: 'eğitim', ...sharpestTurns(trainingTrack(def, name)) })),
    ...[...testTracks].map(([name, track]) => ({ track: name, use: 'test', ...sharpestTurns(track) })),
  ];
  const svg = generalizationChartSVG(summary, {
    title: def.title,
    subtitle: `${def.generations} nesil eğitim · ${Object.keys(def.testTracks).length} test pisti hiçbir koşulda eğitimde yok · koşul başına ${def.seeds.length} tohum · ortalama ± 1 sd`,
    yLabel: 'Öğrenmeden atılan tur',
    allLabel: 'tümü',
    maxLaps: LAPS,
    thumbs,
  });
  mkdirSync('docs/experiments', { recursive: true });
  writeFileSync(paths.svg, svg);
  // Significance: each run's mean laps over the unseen test tracks.
  const pairs = compareGroups(def.conditions.map((c) => ({ label: c.label, values: perRunMean(rows, c.name, 'test') })));
  writeFileSync(paths.md, `${generalizationMarkdown(def, summary, corners)}
${significanceMarkdown(pairs, 'koşu başına görülmemiş pistlerdeki ortalama tur')}`);
  return { paths, summary, pairs };
}

// Noise experiments: one group per test noise level, laps on the training tracks (where every
// champion is perfect without noise, so any drop is the noise's doing).
function plotNoise(def, rows) {
  const paths = resultPaths(def);
  const summary = summarizeNoise(rows, def);
  const bars = summary.map((s) => ({
    label: s.label,
    runs: s.runs,
    perTrack: s.levels.map((l) => ({ track: `±${l.level}`, laps: l.train.laps, finished: l.train.finished })),
  }));
  const svg = generalizationChartSVG(bars, {
    title: def.title,
    subtitle: `Eğitim pistlerinde, gürültülü sensörlerle öğrenmeden atılan tur · koşul başına ${def.seeds.length} tohum · ortalama ± 1 sd`,
    yLabel: 'Pist başına tur (3 üzerinden)',
    allLabel: null,
    maxLaps: LAPS,
  });
  mkdirSync('docs/experiments', { recursive: true });
  writeFileSync(paths.svg, svg);
  // Significance: at each test noise level, the conditions' per-run mean laps on the training tracks.
  // One comparison per level; Holm then adjusts across the levels together.
  const pairs = def.testNoise.flatMap((level) => compareGroups(def.conditions.map((c) => ({
    label: `${c.label} @ ±${level}`,
    values: perRunMean(rows.filter((r) => r.testNoise === level), c.name, 'train'),
  }))));
  holm(pairs.map((x) => x.p)).forEach((p, k) => {
    pairs[k].pHolm = p;
  });
  // Effect of the noise itself: within each condition the same champions are driven without and with
  // noise, so ±0 vs each level is a paired comparison (Holm across all of them).
  const [base, ...levels] = def.testNoise;
  const effect = def.conditions.flatMap((c) => {
    const clean = perRunMean(rows.filter((r) => r.testNoise === base), c.name, 'train');
    return levels.map((level) => {
      const noisy = perRunMean(rows.filter((r) => r.testNoise === level), c.name, 'train');
      const signs = clean.map((v, i) => Math.sign(v - noisy[i]));
      const delta = signs.reduce((s, v) => s + v, 0) / signs.length;
      return { a: `${c.label} @ ±${base}`, b: `@ ±${level}`, ...pairedPermutationTest(clean, noisy), delta, size: deltaSize(delta) };
    });
  });
  holm(effect.map((x) => x.p)).forEach((p, k) => {
    effect[k].pHolm = p;
  });
  writeFileSync(paths.md, [
    noiseMarkdown(def, summary),
    significanceMarkdown(effect, 'koşu başına eğitim pistlerindeki ortalama tur, gürültüsüz ve gürültülü sürüş', 2, {
      heading: 'Gürültünün etkisi (eşli karşılaştırma)',
      paired: true,
    }),
    significanceMarkdown(pairs, 'her test gürültüsünde, koşu başına eğitim pistlerindeki ortalama tur', 2, {
      heading: 'Gürültüyle eğitmenin etkisi',
    }),
  ].join('\n'));
  return { paths, summary, pairs, effect };
}

// Per run (seed) of one condition: mean laps over the rows of one split, in seed order.
function perRunMean(rows, condition, split) {
  const runs = groupBy(rows.filter((r) => r.condition === condition && r.split === split), (r) => r.seed);
  return [...runs.values()].map((run) => run.reduce((s, r) => s + r.laps, 0) / run.length);
}

// Run directly: re-plot an existing CSV without re-training.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const defPath = process.argv[2];
  if (!defPath) {
    console.error('Usage: npm run plot -- experiments/<name>.json');
    process.exit(1);
  }
  const json = JSON.parse(readFileSync(defPath, 'utf8'));
  let paths;
  if (json.type === 'generalization') {
    const def = parseGeneralization(json);
    ({ paths } = plotGeneralization(def, fromCSV(readFileSync(resultPaths(def).csv, 'utf8'), GENERALIZATION_STRINGS)));
  } else {
    const def = parseDefinition(json);
    ({ paths } = plot(def, fromCSV(readFileSync(resultPaths(def).csv, 'utf8'))));
  }
  console.log(`wrote ${paths.svg} and ${paths.md}`);
}
