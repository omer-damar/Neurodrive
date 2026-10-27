// CSV -> SVG chart + Markdown summary.
// npm run plot -- experiments/mutation-rate.json
// Reads experiments/results/<name>.csv and writes docs/experiments/<name>.svg and .md.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { parseDefinition, fromCSV, summarize } from './lib/experiment.mjs';
import { fitnessChartSVG, summaryMarkdown } from './lib/svg.mjs';

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

// Run directly: re-plot an existing CSV without re-training.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const defPath = process.argv[2];
  if (!defPath) {
    console.error('Usage: npm run plot -- experiments/<name>.json');
    process.exit(1);
  }
  const def = parseDefinition(JSON.parse(readFileSync(defPath, 'utf8')));
  const rows = fromCSV(readFileSync(resultPaths(def).csv, 'utf8'));
  const { paths } = plot(def, rows);
  console.log(`wrote ${paths.svg} and ${paths.md}`);
}
