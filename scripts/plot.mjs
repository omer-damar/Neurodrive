// CSV -> SVG chart + Markdown summary.
// npm run plot -- experiments/mutation-rate.json  (or experiments/generalization.json)
// Reads experiments/results/<name>.csv and writes docs/experiments/<name>.svg and .md.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { parseDefinition, fromCSV, summarize } from './lib/experiment.mjs';
import {
  parseGeneralization,
  buildTestTracks,
  trainingTrack,
  sharpestTurns,
  summarizeGeneralization,
  GENERALIZATION_STRINGS,
} from './lib/generalization.mjs';
import { fitnessChartSVG, summaryMarkdown, generalizationChartSVG, generalizationMarkdown } from './lib/svg.mjs';
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
  writeFileSync(paths.md, summaryMarkdown(def, summary, valueLabel));
  return { paths, summary };
}

export function plotGeneralization(def, rows) {
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
  writeFileSync(paths.md, generalizationMarkdown(def, summary, corners));
  return { paths, summary };
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
