// Dependency-free SVG charts (line chart, grouped bar chart) and Markdown reports for experiment summaries.
// Static output (README image), so hover is limited to native <title> tooltips on markers.

// Validated categorical slots 1-4 (light / dark surface); identity follows the condition order.
// Slots 3-4 sit below 3:1 on the light surface, so every series is also labelled in text.
const SERIES = [
  { light: '#2a78d6', dark: '#3987e5' },
  { light: '#eb6834', dark: '#d95926' },
  { light: '#1baf7a', dark: '#199e70' },
  { light: '#eda100', dark: '#c98500' },
];
const MAX_SERIES = SERIES.length;
const WIDTH = 760;
const HEIGHT = 420;
const PAD = { top: 56, right: 150, bottom: 52, left: 64 };
const Y_TICKS = 5;
const BAND_OPACITY = 0.14;
const MARKER_EVERY = 5; // generations between hover markers

/**
 * Mean best fitness per generation with a ±1 sd band, one line per condition.
 * @param {ReturnType<import('./experiment.mjs').summarize>} summary
 * @param {{ title: string, subtitle: string, valueLabel: (v: number) => string,
 *           xLabel: string, yLabel: string }} text
 */
export function fitnessChartSVG(summary, text) {
  if (summary.length > MAX_SERIES) throw new Error(`At most ${MAX_SERIES} conditions per chart`);
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const gens = summary[0].curve.map((p) => p.generation);
  const xMin = gens[0];
  const xMax = gens[gens.length - 1];
  let yMax = 0;
  for (const s of summary) for (const p of s.curve) yMax = Math.max(yMax, p.mean + p.sd);
  yMax = niceCeil(yMax);
  const x = (g) => PAD.left + ((g - xMin) / Math.max(1, xMax - xMin)) * plotW;
  const y = (v) => PAD.top + plotH - (Math.max(0, v) / yMax) * plotH;

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-labelledby="t d">`);
  parts.push(`<title id="t">${esc(text.title)}</title><desc id="d">${esc(text.subtitle)}</desc>`);
  parts.push(`<style>${styleBlock()}</style>`);
  parts.push(`<rect class="surface" width="${WIDTH}" height="${HEIGHT}" rx="8"/>`);
  parts.push(`<text class="title" x="${PAD.left}" y="24">${esc(text.title)}</text>`);
  parts.push(`<text class="muted" x="${PAD.left}" y="42">${esc(text.subtitle)}</text>`);

  // Recessive grid and axes.
  for (let i = 0; i <= Y_TICKS; i++) {
    const v = (yMax / Y_TICKS) * i;
    const yy = y(v);
    parts.push(`<line class="grid" x1="${PAD.left}" x2="${PAD.left + plotW}" y1="${r(yy)}" y2="${r(yy)}"/>`);
    parts.push(`<text class="tick" x="${PAD.left - 8}" y="${r(yy + 4)}" text-anchor="end">${fmt(v)}</text>`);
  }
  for (const g of xTicks(xMin, xMax)) {
    parts.push(`<text class="tick" x="${r(x(g))}" y="${PAD.top + plotH + 18}" text-anchor="middle">${g}</text>`);
  }
  parts.push(`<line class="axis" x1="${PAD.left}" x2="${PAD.left + plotW}" y1="${PAD.top + plotH}" y2="${PAD.top + plotH}"/>`);
  parts.push(`<text class="muted" x="${PAD.left + plotW / 2}" y="${HEIGHT - 12}" text-anchor="middle">${esc(text.xLabel)}</text>`);
  parts.push(`<text class="muted" transform="translate(16 ${PAD.top + plotH / 2}) rotate(-90)" text-anchor="middle">${esc(text.yLabel)}</text>`);

  summary.forEach((s, i) => {
    const upper = s.curve.map((p) => `${r(x(p.generation))},${r(y(p.mean + p.sd))}`);
    const lower = s.curve.map((p) => `${r(x(p.generation))},${r(y(p.mean - p.sd))}`).reverse();
    parts.push(`<polygon class="band s${i}" points="${[...upper, ...lower].join(' ')}"/>`);
  });
  summary.forEach((s, i) => {
    const pts = s.curve.map((p) => `${r(x(p.generation))},${r(y(p.mean))}`).join(' ');
    parts.push(`<polyline class="line s${i}" points="${pts}"/>`);
    for (const p of s.curve) {
      if (p.generation !== xMax && (p.generation - xMin) % MARKER_EVERY !== 0) continue;
      parts.push(
        `<circle class="dot s${i}" cx="${r(x(p.generation))}" cy="${r(y(p.mean))}" r="4">` +
          `<title>${esc(text.valueLabel(s.value))} · ${p.generation}: ${fmt(p.mean)} ± ${fmt(p.sd)}</title></circle>`,
      );
    }
  });

  // Direct labels at the line ends, nudged apart so they never overlap.
  const ends = summary
    .map((s, i) => ({ i, label: text.valueLabel(s.value), y: y(s.curve[s.curve.length - 1].mean) }))
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 16);
  for (const e of ends) {
    parts.push(`<circle class="dot s${e.i}" cx="${PAD.left + plotW + 14}" cy="${r(e.y)}" r="4"/>`);
    parts.push(`<text class="label" x="${PAD.left + plotW + 24}" y="${r(e.y + 4)}">${esc(e.label)}</text>`);
  }
  parts.push('</svg>');
  return parts.join('\n') + '\n';
}

/** Markdown summary table (the chart's table view). */
export function summaryMarkdown(def, summary, valueLabel) {
  const lines = [
    `# ${def.title}`,
    '',
    `- Pist: \`${def.track}\`, nüfus ${def.population}, ${def.generations} nesil`,
    `- Değişken: \`${def.variable}\` ∈ {${def.values.join(', ')}}`,
    `- Tohumlar: ${def.seeds.join(', ')} (koşul başına ${def.seeds.length} koşu)`,
    '- Değerler: ortalama ± standart sapma (örneklem)',
    '',
    '| Koşul | İlk tura kadar nesil | Hiç tur atamayan koşu | En iyi tur (sn) | Son nesil en iyi fitness |',
    '|---|---|---|---|---|',
  ];
  for (const s of summary) {
    lines.push(
      `| ${valueLabel(s.value)} | ${ms(s.firstLapGeneration, 1)} | ${s.neverLapped} / ${s.runs} | ` +
        `${ms(scale(s.bestLapSteps, 1 / 60), 2)} | ${ms(s.finalBest, 3)} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

function scale(stat, factor) {
  return stat.mean === null ? stat : { ...stat, mean: stat.mean * factor, sd: stat.sd * factor };
}

function ms(stat, digits) {
  return stat.mean === null ? '–' : `${stat.mean.toFixed(digits)} ± ${stat.sd.toFixed(digits)}`;
}

function styleBlock() {
  const light = SERIES.map((c, i) => `.s${i}{--c:${c.light}}`).join('');
  const dark = SERIES.map((c, i) => `.s${i}{--c:${c.dark}}`).join('');
  return [
    'svg{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
    '.surface{fill:#fcfcfb}.title{font-size:16px;font-weight:600;fill:#0b0b0b}',
    '.muted{font-size:12px;fill:#52514e}.tick{font-size:11px;fill:#52514e}.label{font-size:12px;fill:#0b0b0b}',
    '.grid{stroke:#e6e5e1;stroke-width:1}.axis{stroke:#9b9a95;stroke-width:1}',
    `.line{fill:none;stroke:var(--c);stroke-width:2;stroke-linejoin:round}.band{fill:var(--c);opacity:${BAND_OPACITY}}`,
    '.dot{fill:var(--c);stroke:#fcfcfb;stroke-width:2}',
    light,
    '@media (prefers-color-scheme:dark){',
    '.surface{fill:#1a1a19}.title,.label{fill:#f0efec}.muted,.tick{fill:#c3c2b7}',
    '.grid{stroke:#2e2e2c}.axis{stroke:#5c5b57}.dot{stroke:#1a1a19}',
    dark,
    '}',
  ].join('');
}

function xTicks(min, max) {
  const span = max - min;
  const step = span <= 10 ? 1 : span <= 30 ? 5 : 10;
  const ticks = [min];
  for (let g = Math.ceil((min + 1) / step) * step; g < max; g += step) ticks.push(g);
  if (max !== min) ticks.push(max);
  return ticks;
}

function niceCeil(v) {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= v) return m * mag;
  return 10 * mag;
}

function fmt(v) {
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function r(v) {
  return Math.round(v * 10) / 10;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const BAR = { width: 760, height: 470, pad: { top: 84, right: 24, bottom: 96, left: 64 }, gap: 2, radius: 4, cap: 5 };
const THUMB = { width: 64, height: 40 }; // track outline under each group label
const LEGEND_ROW = 18; // px between wrapped legend rows

/**
 * Generalization result: one group per test track plus an "all" group, one bar per condition
 * (mean laps, ±1 sd error bar), a small outline of each test track under its label.
 * @param {ReturnType<import('./generalization.mjs').summarizeGeneralization>} summary
 * @param {{ title: string, subtitle: string, yLabel: string, allLabel?: string | null, maxLaps: number,
 *           thumbs?: Record<string, ArrayLike<number>> }} text thumbs: flat [x, y, ...] centre lines;
 *   without allLabel there is no "all" group (the noise experiment groups by noise level instead)
 */
export function generalizationChartSVG(summary, text) {
  if (summary.length > MAX_SERIES) throw new Error(`At most ${MAX_SERIES} conditions per chart`);
  const { width: W, height: H, pad } = BAR;
  const plotW = W - pad.left - pad.right;
  // Legend items flow left to right and wrap onto a new row when they would overflow; each extra
  // row pushes the plot down (identity is never colour alone: labels sit next to swatches).
  const legend = [];
  let lx = pad.left;
  let row = 0;
  summary.forEach((s, i) => {
    const width = 18 + s.label.length * 7;
    if (lx > pad.left && lx + width > W - pad.right) {
      lx = pad.left;
      row++;
    }
    legend.push({ i, label: s.label, x: lx, y: 56 + row * LEGEND_ROW });
    lx += width + 24;
  });
  const plotTop = pad.top + row * LEGEND_ROW;
  const plotH = H - plotTop - pad.bottom;
  const tracks = summary[0].perTrack.map((p) => p.track);
  const groups = [
    ...tracks.map((track, g) => ({ key: track, label: track, stats: summary.map((s) => s.perTrack[g]) })),
    ...(text.allLabel ? [{ key: null, label: text.allLabel, stats: summary.map((s) => ({ laps: s.testLaps, finished: null })) }] : []),
  ];
  const groupW = plotW / groups.length;
  const barW = (groupW * 0.62 - BAR.gap * (summary.length - 1)) / summary.length;
  const y = (v) => plotTop + plotH - (Math.min(Math.max(v, 0), text.maxLaps) / text.maxLaps) * plotH;
  const base = plotTop + plotH;

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">`);
  parts.push(`<title id="t">${esc(text.title)}</title><desc id="d">${esc(text.subtitle)}</desc>`);
  parts.push(`<style>${styleBlock()}.bar{fill:var(--c)}.err{stroke:#52514e;stroke-width:1.5}.thumb{fill:none;stroke:#9b9a95;stroke-width:1.5}@media (prefers-color-scheme:dark){.err{stroke:#c3c2b7}.thumb{stroke:#7a7975}}</style>`);
  parts.push(`<rect class="surface" width="${W}" height="${H}" rx="8"/>`);
  parts.push(`<text class="title" x="${pad.left}" y="24">${esc(text.title)}</text>`);
  parts.push(`<text class="muted" x="${pad.left}" y="42">${esc(text.subtitle)}</text>`);

  for (const item of legend) {
    parts.push(`<rect class="bar s${item.i}" x="${item.x}" y="${item.y}" width="12" height="12" rx="2"/>`);
    parts.push(`<text class="label" x="${item.x + 18}" y="${item.y + 10}">${esc(item.label)}</text>`);
  }

  for (let v = 0; v <= text.maxLaps; v++) {
    parts.push(`<line class="grid" x1="${pad.left}" x2="${pad.left + plotW}" y1="${r(y(v))}" y2="${r(y(v))}"/>`);
    parts.push(`<text class="tick" x="${pad.left - 8}" y="${r(y(v) + 4)}" text-anchor="end">${v}</text>`);
  }
  parts.push(`<line class="axis" x1="${pad.left}" x2="${pad.left + plotW}" y1="${base}" y2="${base}"/>`);
  parts.push(`<text class="muted" transform="translate(16 ${plotTop + plotH / 2}) rotate(-90)" text-anchor="middle">${esc(text.yLabel)}</text>`);

  groups.forEach((group, g) => {
    const gx = pad.left + groupW * g + (groupW - (barW * summary.length + BAR.gap * (summary.length - 1))) / 2;
    group.stats.forEach((stat, i) => {
      const x0 = gx + i * (barW + BAR.gap);
      const mean = stat.laps.mean ?? 0;
      const top = y(mean);
      const tip = `${summary[i].label} · ${group.label}: ${fmt(mean)} ± ${fmt(stat.laps.sd ?? 0)}` +
        (stat.finished === null ? '' : ` · ${stat.finished}/${summary[i].runs}`);
      parts.push(`<path class="bar s${i}" d="${topRoundedBar(x0, top, barW, base - top)}"><title>${esc(tip)}</title></path>`);
      if (stat.laps.sd > 1e-9) { // float noise on identical runs is not a spread
        const cx = r(x0 + barW / 2);
        const hi = r(y(mean + stat.laps.sd));
        const lo = r(y(mean - stat.laps.sd));
        parts.push(`<line class="err" x1="${cx}" x2="${cx}" y1="${hi}" y2="${lo}"/>`);
        parts.push(`<line class="err" x1="${r(cx - BAR.cap)}" x2="${r(cx + BAR.cap)}" y1="${hi}" y2="${hi}"/>`);
        parts.push(`<line class="err" x1="${r(cx - BAR.cap)}" x2="${r(cx + BAR.cap)}" y1="${lo}" y2="${lo}"/>`);
      }
    });
    const cx = pad.left + groupW * (g + 0.5);
    parts.push(`<text class="label" x="${r(cx)}" y="${base + 18}" text-anchor="middle">${esc(group.label)}</text>`);
    const outline = group.key === null ? null : text.thumbs?.[group.key];
    if (outline) parts.push(`<polygon class="thumb" points="${thumbPoints(outline, cx - THUMB.width / 2, base + 30)}"/>`);
  });
  parts.push('</svg>');
  return parts.join('\n') + '\n';
}

// A bar rounded only at its data end (top), square on the baseline.
function topRoundedBar(x, top, w, h) {
  const rad = Math.min(BAR.radius, w / 2, h);
  if (h <= 0) return `M${r(x)},${r(top)}h${r(w)}`;
  return `M${r(x)},${r(top + h)}V${r(top + rad)}Q${r(x)},${r(top)} ${r(x + rad)},${r(top)}` +
    `H${r(x + w - rad)}Q${r(x + w)},${r(top)} ${r(x + w)},${r(top + rad)}V${r(top + h)}Z`;
}

// Fits a flat [x, y, ...] loop into the thumbnail box, keeping its aspect ratio; every 4th point.
function thumbPoints(flat, left, top) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < flat.length; i += 2) {
    minX = Math.min(minX, flat[i]);
    maxX = Math.max(maxX, flat[i]);
    minY = Math.min(minY, flat[i + 1]);
    maxY = Math.max(maxY, flat[i + 1]);
  }
  const k = Math.min(THUMB.width / (maxX - minX), THUMB.height / (maxY - minY));
  const ox = left + (THUMB.width - (maxX - minX) * k) / 2;
  const oy = top + (THUMB.height - (maxY - minY) * k) / 2;
  const pts = [];
  for (let i = 0; i < flat.length; i += 8) pts.push(`${r(ox + (flat[i] - minX) * k)},${r(oy + (flat[i + 1] - minY) * k)}`);
  return pts.join(' ');
}

/**
 * Markdown report for the generalization experiment (the chart's table view).
 * @param {{ track: string, use: string, right: number, left: number }[]} [corners] sharpest turns per track
 */
export function generalizationMarkdown(def, summary, corners = []) {
  const tracks = Object.keys(def.testTracks);
  const lines = [
    `# ${def.title}`,
    '',
    `- Eğitim: ${trainingBudget(def)}; dönüşümlü koşulda pist her nesil değişir`,
    ...def.conditions.map((c) => `- Koşul \`${c.name}\`: ${c.label}`),
    `- Şampiyon: her neslin elitleri arasından yalnızca kendi eğitim pistlerinde en iyi süren (test pistleri seçimde kullanılmaz)`,
    `- Test pistleri (hiçbir koşulda eğitimde yok): ${tracks.map((t) => `\`${t}\``).join(', ')}`,
    `- Tohumlar: ${def.seeds.join(', ')} (koşul başına ${def.seeds.length} koşu)`,
    '- Ölçüm: şampiyon her pisti öğrenmeden bir kez sürer (en fazla 3 tur, 60 sn); değerler ortalama ± standart sapma (örneklem)',
    '',
    '| Koşul | Test pistlerinde ortalama tur | Bitirilen test pisti (koşu başına) | Eğitim pistlerinde ortalama tur |',
    '|---|---|---|---|',
    ...summary.map((s) => `| ${s.label} | ${ms(s.testLaps, 2)} | ${ms(s.testFinished, 1)} / ${tracks.length} | ${ms(s.trainLaps, 2)} |`),
    '',
    `| Test pisti | ${summary.map((s) => s.label).join(' | ')} |`,
    `|---|${summary.map(() => '---').join('|')}|`,
    ...tracks.map((track, t) =>
      `| \`${track}\` | ${summary.map((s) => `${ms(s.perTrack[t].laps, 2)} tur, ${s.perTrack[t].finished}/${s.perTrack[t].runs} bitirdi`).join(' | ')} |`),
    '',
  ];
  if (corners.length) {
    lines.push(
      'En keskin virajlar (≈ 480 birimlik yayda toplam yön değişimi, radyan; sağ +, sol −):',
      '',
      '| Pist | Kullanım | En keskin sağ | En keskin sol |',
      '|---|---|---|---|',
      ...corners.map((c) => `| \`${c.track}\` | ${c.use} | ${c.right.toFixed(2)} | ${c.left.toFixed(2)} |`),
      '',
    );
  }
  return lines.join('\n');
}

// "60 nesil, nüfus 100", or "koşula göre" when the conditions train with different budgets.
function trainingBudget(def) {
  const same = def.conditions.every((c) => c.generations === def.generations && !c.config.populationSize);
  return same ? `${def.generations} nesil, nüfus ${def.population}` : 'nesil ve nüfus koşula göre (koşul adlarında)';
}

/** Markdown report for a noise experiment: laps per noise level on training and unseen tracks. */
export function noiseMarkdown(def, summary) {
  const lines = [
    `# ${def.title}`,
    '',
    `- Eğitim: ${def.generations} nesil, nüfus ${def.population}, pistler dönüşümlü`,
    ...def.conditions.map((c) => `- Koşul \`${c.name}\`: ${c.label}`),
    `- Test: şampiyon her pisti her gürültü seviyesinde öğrenmeden bir kez sürer; seviyeler ±${def.testNoise.join(', ±')} (okuma 0–1 ölçeğinde, eşit dağılımlı)`,
    `- Tohumlar: ${def.seeds.join(', ')} (koşul başına ${def.seeds.length} koşu); değerler ortalama ± standart sapma (örneklem)`,
    '',
    `| Test gürültüsü | ${summary.map((s) => `${s.label}: eğitim pistleri`).join(' | ')} | ${summary.map((s) => `${s.label}: görülmemiş pistler`).join(' | ')} |`,
    `|---|${summary.map(() => '---').join('|')}|${summary.map(() => '---').join('|')}|`,
    ...def.testNoise.map((level, k) => {
      const cell = (x) => `${ms(x.laps, 2)} tur (${x.finished}/${x.drives} bitti)`;
      return `| ±${level} | ${summary.map((s) => cell(s.levels[k].train)).join(' | ')} | ${summary.map((s) => cell(s.levels[k].test)).join(' | ')} |`;
    }),
    '',
  ];
  return lines.join('\n');
}

/**
 * "Significance" section for a report: one row per comparison.
 * @param {{ a: string, b: string, diff: number, p: number, pHolm: number, exact: boolean,
 *           delta: number, size: string }[]} pairs
 * @param {string} metric what was compared, in words
 * @param {number} digits decimals for the difference
 * @param {{ heading?: string, paired?: boolean }} [options] paired: the same runs measured twice
 */
export function significanceMarkdown(pairs, metric, digits = 2, { heading = 'Anlamlılık', paired = false } = {}) {
  const sizeTr = { negligible: 'ihmal edilebilir', small: 'küçük', medium: 'orta', large: 'büyük' };
  if (paired) return pairedMarkdown(pairs, metric, digits, heading, sizeTr);
  return [
    `## ${heading}`,
    '',
    `Karşılaştırılan ölçüt: ${metric}. Her koşu bir gözlem (koşul başına bir değer listesi).`,
    '',
    '| Karşılaştırma | Ortalama farkı (A − B) | p | p (Holm) | Cliff\'s δ | Etki |',
    '|---|---|---|---|---|---|',
    ...pairs.map((x) =>
      `| ${x.a} vs ${x.b} | ${signed(x.diff, digits)} | ${formatP(x.p)} | ${formatP(x.pHolm)} | ` +
        `${signed(x.delta, 2)} | ${sizeTr[x.size]} |`),
    '',
    'Nasıl okunur: *p*, iki koşul aslında aynı olsaydı en az bu kadar büyük bir farkın yalnızca şansla ' +
      'görülme olasılığıdır (iki yönlü permütasyon testi; ' +
      (pairs.every((x) => x.exact) ? 'koşular arasındaki tüm olası yeniden etiketlemeler sayıldı, yani kesin' : 'tohumlu Monte Carlo tahmini') +
      '). *p (Holm)*, aynı raporda birden çok karşılaştırma yapıldığı için düzeltilmiş değerdir; ' +
      '0.05\'in altı geleneksel olarak anlamlı sayılır. *Cliff\'s δ*, A\'dan rastgele bir koşunun B\'den rastgele bir ' +
      'koşudan büyük olma olasılığı eksi küçük olma olasılığıdır (−1…+1); |δ| ≥ 0.474 büyük etki sayılır.',
    '',
  ].join('\n');
}

function pairedMarkdown(pairs, metric, digits, heading, sizeTr) {
  return [
    `## ${heading}`,
    '',
    `Karşılaştırılan ölçüt: ${metric}. Aynı koşular iki kez ölçüldü (eşli veri).`,
    '',
    '| Karşılaştırma | Ortalama farkı (A − B) | p | p (Holm) | Eşli δ | Etki |',
    '|---|---|---|---|---|---|',
    ...pairs.map((x) =>
      `| ${x.a} vs ${x.b} | ${signed(x.diff, digits)} | ${formatP(x.p)} | ${formatP(x.pHolm)} | ` +
        `${signed(x.delta, 2)} | ${sizeTr[x.size]} |`),
    '',
    'Nasıl okunur: *p*, eşli işaret çevirme permütasyon testinden gelir: etki yoksa her koşunun farkı eşit ' +
      'olasılıkla artı ya da eksidir, tüm işaret düzenleri sayıldı. *p (Holm)* bu tablodaki karşılaştırmalar için ' +
      'düzeltilmiştir. *Eşli δ*, A\'nın B\'den büyük olduğu koşuların oranı eksi küçük olduğu koşuların oranıdır (−1…+1).',
    '',
  ].join('\n');
}

function formatP(p) {
  return p < 0.001 ? '< 0.001' : p.toFixed(3);
}

// "+0.40" / "−0.40"; values that round to zero print without a sign.
function signed(value, digits) {
  const text = Math.abs(value).toFixed(digits);
  if (Number(text) === 0) return text;
  return `${value > 0 ? '+' : '−'}${text}`;
}
