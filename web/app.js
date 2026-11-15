import { cleanGeology, cleanGroundwater, cleanPumping, normalizeSeries, normalizeRate, normalizeHotspots, validateGeoJSON, safeSourceURL, formatNumber, isNumber, cleanInsights, normalizeCumulative, cleanTeam, cleanNisar } from './model.mjs';

const $ = selector => document.querySelector(selector);
const DATA = new URL('../data/processed/', import.meta.url);
const COLORS = { rust: '#A64B2A', ink: '#2D2A25', olive: '#52664B', sand: '#E4D9C9', slate: '#626D76' };
// Layers in the panel. Each has a group heading and one plain-language line: what it is, and why it is there.
const LAYER_INFO = {
  hotspots: { group: 'Where to look', name: 'Study areas', desc: 'The places we studied. Click one to read its numbers and watch it change over time.' },
  rate: { group: 'What we measured', name: 'Ground motion, selected area', desc: 'How fast the ground in the chosen area moved from 2016 to 2026. Red means sinking. This is our main result.' },
  rate_sentinel1_descending: { group: 'What we measured', name: 'Sinking map, southern Arizona', desc: 'The same measurement across the whole region, so you can see where the ground is sinking and where it is not.' },
  nisar: { group: 'What we measured', name: 'NASA NISAR, early record', desc: 'NASA\u2019s new satellite over Willcox and Eloy. Its record is still too short for a reliable speed, so treat it as a preview.' },
  adwr_subsidence: { group: 'The official record', name: 'Official sinking zones (ADWR)', desc: 'Areas Arizona\u2019s water agency maps as sinking. A check that our results match the official record.' },
  mines_excluded: { group: 'Read with care', name: 'Probable mines', desc: 'Open-pit mines move for reasons unrelated to groundwater. We mark them so they are not mistaken for aquifer sinking.' },
  checked_flat: { group: 'Read with care', name: 'Checked: no sinking found', desc: 'Places we checked where the ground is steady, such as Phoenix and the West Valley. Sinking is local, not everywhere.' }
};
const REGION_LAYERS = [['rate_sentinel1_descending', false]];                    // region-wide Sentinel-1 rate map (hidden by default)
const NISAR_LAYERS = ['rate_nisar_willcox', 'rate_nisar_eloy'];                    // one switch for both provisional NISAR overlays
const MARKER_LAYERS = [['mines_excluded'], ['checked_flat']];
const state = { selected: null, slugs: [], cumulative: new Map(), time: null, series: new Map(), rates: new Map(), layers: new Map(), outlines: new Map(), base: 'satellite' };
let map, outlineGroup;
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
function note(text) { return el('p', 'metric-note', text); }
function setStatus(text) { $('#data-status').textContent = text; }
function dataError(result, fallback) {
  if (result?.status === 'invalid') return 'File needs review: ' + result.error;
  if (result?.status === 'error') return 'Could not load the source file. Refresh to retry.';
  return fallback;
}
async function loadJSON(name, normalize = value => value) {
  if (window.ATLAS_PREVIEW_DATA) {
    if (!(name in window.ATLAS_PREVIEW_DATA)) return { status: 'missing' };
    try { return { status: 'ready', value: normalize(window.ATLAS_PREVIEW_DATA[name]) }; }
    catch (error) { return { status: 'invalid', error: error.message }; }
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(new URL(name, DATA), { signal: controller.signal, cache: 'no-cache' });
    if (response.status === 404) return { status: 'missing' };
    if (!response.ok) throw new Error('HTTP ' + response.status);
    let raw;
    try { raw = await response.json(); } catch { return { status: 'invalid', error: 'Invalid JSON.' }; }
    try { return { status: 'ready', value: normalize(raw) }; }
    catch (error) { return { status: 'invalid', error: error.message }; }
  } catch (error) { return { status: 'error', error: error.message }; }
  finally { clearTimeout(timeout); }
}
function factList(items) {
  const list = el('dl', 'detail-facts');
  items.forEach(([label, value]) => {
    const row = el('div');
    row.append(el('dt', '', label), el('dd', '', value));
    list.append(row);
  });
  return list;
}
function section(title, noteKey = null) {
  const node = el('section', 'detail-section'), heading = el('div', 'detail-section-heading');
  heading.append(el('h2', '', title));
  if (noteKey) heading.append(explainButton(noteKey));
  node.append(heading);
  return node;
}
function svgNode(tag, attrs = {}, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  if (text != null) node.textContent = text;
  return node;
}
function makeChart(series, hooks = null) {
  const wrap = el('div', 'chart');
  const svg = svgNode('svg', { viewBox: '0 0 300 170', role: 'img', 'aria-label': 'Cumulative displacement in centimetres relative to ' + series.reference });
  const valid = series.points.filter(p => isNumber(p.value));
  const stable = series.stablePoints.filter(p => isNumber(p.value));
  const start = Date.parse(series.dates[0]), end = Date.parse(series.dates.at(-1));
  const extent = [...valid, ...stable].map(p => p.value);
  let lo = Math.min(...extent), hi = Math.max(...extent);
  const pad = Math.max((hi - lo) * 0.15, 0.1);
  lo -= pad; hi += pad;
  const x = date => 42 + (Date.parse(date) - start) / (end - start || 1) * 244;
  const y = value => 130 - (value - lo) / (hi - lo) * 112;
  [lo, (lo + hi) / 2, hi].forEach(value => {
    svg.append(svgNode('line', { x1: 42, x2: 286, y1: y(value), y2: y(value), stroke: '#C9C0B2', 'stroke-width': 0.7 }));
    svg.append(svgNode('text', { x: 35, y: y(value) + 3, 'text-anchor': 'end', class: 'chart-label' }, formatNumber(value)));
  });
  svg.append(svgNode('text', { x: 8, y: 12, class: 'chart-label' }, 'cm'));
  let path = '', next = true;
  series.points.forEach(p => {
    if (p.value === null) { next = true; return; }
    path += (next ? 'M' : 'L') + x(p.date) + ',' + y(p.value) + ' ';
    next = false;
  });
  const sinkPath = svgNode('path', { d: path, fill: 'none', stroke: COLORS.rust, 'stroke-width': 1.8 });
  svg.append(sinkPath);
  let stablePath = null;
  if (stable.length) {
    let stableD = '', gap = true;
    series.stablePoints.forEach(p => {
      if (p.value === null) { gap = true; return; }
      stableD += (gap ? 'M' : 'L') + x(p.date) + ',' + y(p.value) + ' '; gap = false;
    });
    stablePath = svgNode('path', { d: stableD, fill: 'none', stroke: COLORS.slate, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' });
    svg.append(stablePath);
  }
  valid.forEach(p => svg.append(svgNode('circle', { cx: x(p.date), cy: y(p.value), r: 2.5, fill: COLORS.rust })));
  svg.append(svgNode('text', { x: 42, y: 153, class: 'chart-label' }, series.dates[0]));
  if (series.dates.length > 1) svg.append(svgNode('text', { x: 286, y: 168, 'text-anchor': 'end', class: 'chart-label' }, series.dates.at(-1)));
  if (hooks) addChartScrubbing(wrap, svg, series, x, y, sinkPath, stablePath, hooks);
  wrap.append(svg);
  if (stable.length) wrap.append(note('Solid rust: sinking-pixel average · Dashed slate: stable ground (measurement noise). Both are line-of-sight displacement.'));
  const details = el('details');
  details.append(el('summary', '', 'View observations as a table'));
  const table = el('table'), head = el('thead'), header = el('tr'), body = el('tbody');
  header.append(el('th', '', 'Date'), el('th', '', 'Displacement (cm)'));
  if (stable.length) header.append(el('th', '', 'Stable ground (cm)'));
  head.append(header);
  series.points.forEach((p, i) => { const tr = el('tr'); tr.append(el('td', '', p.date), el('td', '', p.value === null ? 'No observation' : formatNumber(p.value))); if (stable.length) tr.append(el('td', '', series.stablePoints[i].value === null ? 'No observation' : formatNumber(series.stablePoints[i].value))); body.append(tr); });
  table.append(head, body); details.append(table); wrap.append(details);
  return wrap;
}
// Hover or touch along the chart: a cursor, a readout, and the map follows (see applyTimeFrame). Keyboard works too.
function addChartScrubbing(wrap, svg, series, x, y, sinkPath, stablePath, hooks) {
  const n = series.points.length;
  const hidden = { visibility: 'hidden', 'pointer-events': 'none' };
  const cursor = svgNode('line', { y1: 12, y2: 130, stroke: COLORS.ink, 'stroke-width': 0.8, 'stroke-dasharray': '2 2', ...hidden });
  const dotSink = svgNode('circle', { r: 4, fill: COLORS.rust, stroke: '#F4EFE6', 'stroke-width': 1, ...hidden });
  const dotStable = svgNode('circle', { r: 3.5, fill: COLORS.slate, stroke: '#F4EFE6', 'stroke-width': 1, ...hidden });
  const tip = svgNode('g', hidden);
  const tipBox = svgNode('rect', { rx: 2, fill: '#F4EFE6', stroke: '#C9C0B2', 'stroke-width': 0.7, opacity: 0.96 });
  const tipText = svgNode('text', { class: 'chart-tip' });
  tip.append(tipBox, tipText);
  const hit = svgNode('rect', { x: 42, y: 8, width: 244, height: 126, fill: 'transparent', style: 'touch-action:pan-y;cursor:crosshair' });
  svg.append(hit, cursor, dotSink, dotStable, tip);
  svg.setAttribute('role', 'slider'); svg.setAttribute('tabindex', '0');
  svg.setAttribute('aria-label', 'Move through time. Left and right arrow keys step through the dates; Space plays; Escape clears.');
  svg.setAttribute('aria-valuemin', '0'); svg.setAttribute('aria-valuemax', String(n - 1)); svg.setAttribute('aria-valuenow', '0'); svg.setAttribute('aria-valuetext', 'No date selected');
  const hide = node => node.setAttribute('visibility', 'hidden');
  wrap.setCursor = index => {
    if (index == null) { [cursor, dotSink, dotStable, tip].forEach(hide); svg.setAttribute('aria-valuetext', 'No date selected'); return; }
    const p = series.points[index], px = x(p.date), lines = [p.date];
    cursor.setAttribute('x1', px); cursor.setAttribute('x2', px); cursor.setAttribute('visibility', 'visible');
    if (isNumber(p.value)) { dotSink.setAttribute('cx', px); dotSink.setAttribute('cy', y(p.value)); dotSink.setAttribute('visibility', 'visible'); lines.push('Sinking area  ' + formatNumber(p.value) + ' cm'); } else hide(dotSink);
    const s = series.stablePoints[index];
    if (s && isNumber(s.value)) { dotStable.setAttribute('cx', px); dotStable.setAttribute('cy', y(s.value)); dotStable.setAttribute('visibility', 'visible'); lines.push('Stable ground  ' + formatNumber(s.value) + ' cm'); } else hide(dotStable);
    tipText.replaceChildren();
    const w = Math.max(...lines.map(t => t.length)) * 4.9 + 14, h = lines.length * 11 + 7, tx = px > 160 ? px - w - 7 : px + 7;
    lines.forEach((t, i) => tipText.append(svgNode('tspan', { x: tx + 7, y: 29 + i * 11 }, t)));
    tipBox.setAttribute('x', tx); tipBox.setAttribute('y', 18); tipBox.setAttribute('width', w); tipBox.setAttribute('height', h);
    tip.setAttribute('visibility', 'visible');
    svg.setAttribute('aria-valuenow', String(index)); svg.setAttribute('aria-valuetext', lines.join(', '));
  };
  wrap.emphasise = kind => {
    sinkPath.setAttribute('stroke-width', kind === 'sinking' ? 3.2 : 1.8);
    if (stablePath) stablePath.setAttribute('stroke-width', kind === 'stable' ? 3 : 1.5);
  };
  const nearest = clientX => {
    const r = svg.getBoundingClientRect(), px = (clientX - r.left) / (r.width || 300) * 300;
    let best = 0, bestDistance = Infinity;
    series.points.forEach((p, i) => { const d = Math.abs(x(p.date) - px); if (d < bestDistance) { bestDistance = d; best = i; } });
    return best;
  };
  hit.addEventListener('pointermove', e => hooks.hover(nearest(e.clientX)));
  hit.addEventListener('pointerleave', () => hooks.hover(null));
  hit.addEventListener('click', e => hooks.pin(nearest(e.clientX)));
  svg.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') hooks.step(-1);
    else if (e.key === 'ArrowRight') hooks.step(1);
    else if (e.key === 'Home') hooks.jump(0);
    else if (e.key === 'End') hooks.jump(n - 1);
    else if (e.key === ' ' || e.key === 'Enter') hooks.play();
    else if (e.key === 'Escape') hooks.clear();
    else return;
    e.preventDefault();
  });
}
// ---- time view: the map shows the total change since the first date, for the date under the cursor ----
const TIME_STEP_MS = 700;
const timeURL = path => window.ATLAS_PREVIEW_IMAGES?.[path] || new URL(path, DATA).href;
function resetTimeView() {
  const t = state.time;
  if (t) { clearInterval(t.timer); [t.image, ...Object.values(t.masks)].forEach(layer => { if (layer && map) map.removeLayer(layer); }); }
  state.time = { meta: null, hover: null, pinned: null, shown: null, timer: null, image: null, masks: {}, chart: null, ui: null };
}
function applyTimeFrame() {
  const t = state.time, meta = t.meta;
  if (!meta || !map) return;
  const index = t.hover ?? t.pinned;
  t.chart?.setCursor(index);
  if (index !== t.shown) {
    t.shown = index;
    if (index == null) {
      if (t.image) { map.removeLayer(t.image); t.image = null; }
      updateRateLayer();                       // back to the normal rate map and its legend
    } else {
      const url = timeURL(meta.frames[index]);
      if (!t.image) {
        t.image = L.imageOverlay(url, meta.bounds, { pane: 'timeframes', opacity: 0.85, interactive: false }).addTo(map);
        if (state.rateImage) map.removeLayer(state.rateImage);
        meta.frames.forEach(path => { const preload = new Image(); preload.src = timeURL(path); });
      } else t.image.setUrl(url);
      const legend = $('#rate-legend'); legend.hidden = false; legend.replaceChildren();
      legend.append(el('strong', '', 'Total ground change since ' + meta.dates[0]), el('div', '', 'As of ' + meta.dates[index]),
        el('div', '', formatNumber(meta.vmin) + ' to +' + formatNumber(meta.vmax) + ' cm'),
        el('small', '', 'Red = lower than at the start. Blank = not measured.'));
    }
  }
  t.ui?.sync();
}
function toggleMask(kind) {
  const t = state.time;
  if (!map || !t.meta?.masks?.[kind]) return;
  if (t.masks[kind]) { map.removeLayer(t.masks[kind]); delete t.masks[kind]; }
  else t.masks[kind] = L.imageOverlay(timeURL(t.meta.masks[kind]), t.meta.bounds, { pane: 'timeframes', opacity: 0.6, interactive: false }).addTo(map);
  t.chart?.emphasise(t.masks.sinking ? 'sinking' : t.masks.stable ? 'stable' : null);
  t.ui?.sync();
}
function togglePlay() {
  const t = state.time;
  if (!t.meta) return;
  if (t.timer) { clearInterval(t.timer); t.timer = null; t.ui?.sync(); return; }
  const last = t.meta.dates.length - 1;
  let i = t.pinned != null && t.pinned < last ? t.pinned : 0;
  t.pinned = i; applyTimeFrame();
  t.timer = setInterval(() => {
    i += 1;
    if (i > last) { clearInterval(t.timer); t.timer = null; t.ui?.sync(); return; }
    t.pinned = i; applyTimeFrame();
  }, TIME_STEP_MS);
  t.ui?.sync();
}
function timeHooks() {
  const t = state.time;
  const stop = () => { if (t.timer) { clearInterval(t.timer); t.timer = null; } };
  return {
    hover: i => { t.hover = i; applyTimeFrame(); },
    pin: i => { stop(); t.pinned = t.pinned === i ? null : i; applyTimeFrame(); },
    step: d => { stop(); const n = t.meta.dates.length, base = t.pinned ?? (d > 0 ? -1 : n); t.pinned = Math.max(0, Math.min(n - 1, base + d)); applyTimeFrame(); },
    jump: i => { stop(); t.pinned = i; applyTimeFrame(); },
    play: () => togglePlay(),
    clear: () => { stop(); t.pinned = null; t.hover = null; applyTimeFrame(); }
  };
}
function makeTimeControls() {
  const t = state.time, node = el('div', 'time-controls'), idle = 'Move along the chart to watch the map change. Click (or tap) to hold a date.';
  const button = (label, kind) => { const b = el('button', 'time-btn', label); b.type = 'button'; b.setAttribute('aria-pressed', 'false'); if (kind) b.dataset.kind = kind; return b; };
  const play = button('\u25B6 Play through time'), sink = button('Show the sinking area on the map', 'sinking'), stab = button('Show the stable ground on the map', 'stable');
  const back = button('Back to the rate map'); back.classList.add('subtle'); back.removeAttribute('aria-pressed');
  const status = el('p', 'metric-note time-status', idle); status.setAttribute('aria-live', 'polite');
  const row = el('div', 'time-row'); row.append(play, sink, stab, back); node.append(row, status);
  if (!t.meta.masks.sinking) sink.hidden = true;
  if (!t.meta.masks.stable) stab.hidden = true;
  const ui = { node, sync() {
    const index = t.hover ?? t.pinned, playing = Boolean(t.timer);
    play.textContent = playing ? '\u275A\u275A Pause' : '\u25B6 Play through time'; play.setAttribute('aria-pressed', String(playing));
    sink.setAttribute('aria-pressed', String(Boolean(t.masks.sinking))); stab.setAttribute('aria-pressed', String(Boolean(t.masks.stable)));
    back.hidden = t.pinned == null && !playing;
    status.textContent = index == null ? idle : 'Map: total change since ' + t.meta.dates[0] + ', as of ' + t.meta.dates[index] + (t.hover == null && t.pinned === index ? ' (held)' : '') + '.';
  } };
  play.addEventListener('click', togglePlay);
  sink.addEventListener('click', () => toggleMask('sinking'));
  stab.addEventListener('click', () => toggleMask('stable'));
  back.addEventListener('click', () => timeHooks().clear());
  ui.sync();
  return ui;
}
function renderInsights(root, series) {
  const ins = cleanInsights(series?.insights);
  if (!ins) return;
  const box = el('section', 'insights report-highlights');
  const header = el('div', 'insights-header'), heading = el('div', 'insights-heading');
  heading.append(el('span', 'report-eyebrow', 'AT A GLANCE'), el('h2', 'insights-title', 'What the satellites show'));
  const help = explainButton('confidence'); help.textContent = 'Explain confidence ↗';
  header.append(heading, help); box.append(header);
  const lead = el('div', 'insights-lead');
  lead.append(el('p', 'insights-summary', ins.summary));
  if (ins.confidence) {
    const confidence = el('div', 'confidence-row');
    [[ins.confidence.where_label, ins.confidence.where], [ins.confidence.how_fast_label, ins.confidence.how_fast]].forEach(([label, level]) => {
      const pill = el('span', 'confidence-pill level-' + level);
      pill.append(el('small', '', label), el('strong', '', 'Confidence: ' + level));
      confidence.append(pill);
    });
    lead.append(confidence);
  }
  box.append(lead);
  const grid = el('div', 'insight-grid');
  ins.points.forEach((point, index) => {
    const item = el('article', 'insight-point');
    item.append(el('span', 'insight-number', String(index + 1).padStart(2, '0')), el('h3', '', point.heading));
    const preview = point.text.match(/^.*?[.!?](?=\s|$)/)?.[0] || point.text;
    item.append(el('p', '', preview));
    if (preview !== point.text) {
      const more = el('details', 'insight-expansion');
      more.append(el('summary', '', 'Read full explanation'), el('p', '', point.text));
      item.append(more);
    }
    grid.append(item);
  });
  box.append(grid); root.append(box);
}
const FIELD_NOTES = {
  confidence: ['How certain is this observation?', 'Confidence describes the strength and quality of the evidence, not how concerning a place is. Several observations, an appropriate reference and independent look directions strengthen interpretation.', 'Confidence labels are from the team’s processed export.'],
  rate: ['What does the reported rate mean?', 'This rate summarizes observed motion over a defined interval. A radar satellite views the ground at an angle, so a line-of-sight rate is not automatically a vertical sinking rate.', 'Read the rate together with its uncertainty, time interval, reference area and sign convention. A motion signal does not establish cause.'],
  chart: ['How do I read the graph?', 'Every dot is an actual exported observation. Tap or focus a dot for its date and value. Blank periods are missing evidence, not zero movement.', 'The dashed comparison, when supplied, tracks stable-reference behavior; no intermediate observations are fabricated.'],
  record: ['Why does metadata matter?', 'Satellite product, orbit track, look direction, real acquisition dates and reference area determine what is comparable.', 'Different viewing geometries or periods cannot automatically be combined as equivalent vertical rates.'],
  validation: ['What does the official comparison show?', 'ADWR radar results provide important historical context. Spatial patterns, correlations and medians may agree or disagree across sensors.', 'Different periods, look directions and reference areas limit direct rate comparisons. Agreement does not by itself validate each study.'],
  study: ['What is a study outline?', 'The boundary represents a project-defined study extent. It is not the observed subsidence footprint.', 'Names and stories are taken from the latest GeoJSON, not a fixed list.'],
  directions: ['Why do two satellite look directions matter?', 'Ascending passes generally move from south toward north, while descending passes move from north toward south. They observe the landscape from different slanted viewing geometries. Comparing both can help distinguish some components of motion and test consistency.', 'One viewing direction alone does not uniquely determine vertical ground movement. Geometry, quality and reference selection matter.']
};
function showFieldNote(title, description, footnote = '') {
  $('#explain-title').textContent = title;
  $('#explain-text').textContent = description;
  $('#explain-note').textContent = footnote;
  $('#explain-drawer').hidden = false;
}
function explainButton(key) {
  const button = el('button', 'explain-trigger', 'Explain ↗'); button.type = 'button';
  button.setAttribute('aria-label', 'Explain: ' + FIELD_NOTES[key][0]);
  button.addEventListener('click', () => showFieldNote(...FIELD_NOTES[key]));
  return button;
}
function renderDetails() {
  resetTimeView();
  if (state.miniMap) { clearInterval(state.miniMap.timer); state.miniMap.map?.remove(); state.miniMap = null; }
  const feature = state.hotspots.features.find(f => f.properties.slug === state.selected);
  const p = feature.properties;
  const result = state.series.get(state.selected);
  const series = result?.status === 'ready' ? result.value : null;
  const rateResult = state.rates.get(state.selected);
  const meta = rateResult?.status === 'ready' ? rateResult.value : null;
  const root = $('#detail-content');
  root.replaceChildren();
  const kicker = el('div', 'detail-kicker');
  kicker.append(el('span', '', (p.county || 'Arizona') + ', Arizona'), el('span', '', 'Study ' + String(state.slugs.indexOf(state.selected) + 1).padStart(2, '0')));
  root.append(kicker, el('h1', '', p.name), el('p', 'story-name', p.tagline));
  const studyContext = el('div', 'study-context'); studyContext.append(explainButton('study')); root.append(studyContext);
  if (p.confirmation) root.append(el('p', 'confirmation-chip' + (p.confirmation === 'single look direction' ? ' unconfirmed' : ''), p.confirmation === 'single look direction' ? 'Unconfirmed · ' + p.confirmation : p.confirmation));
  const summaryPanel = el('div', 'report-summary');
  renderInsights(summaryPanel, series);
  const hasRate = series && isNumber(series.rate_cm_yr);
  const metric = el('section', 'metric' + (hasRate ? '' : ' pending'));
  metric.append(el('p', 'metric-label', 'Reported displacement rate · line of sight'));
  const value = el('div', 'metric-value', hasRate ? formatNumber(series.rate_cm_yr) : 'Measurement pending');
  if (hasRate) value.append(el('small', '', (isNumber(series.rate_sigma) ? '± ' + formatNumber(series.rate_sigma) + ' ' : '') + 'cm/yr'));
  metric.append(value);
  metric.append(note(hasRate
    ? (isNumber(series.rate_sigma) ? (series.rate_sigma_note || 'Uncertainty supplied by the processing pipeline.') : 'Uncertainty has not been supplied.')
    : dataError(result, 'Awaiting a referenced time series and fitted rate.')));
  if (hasRate) metric.append(note(series.sign_convention || 'Sign convention not supplied. This value is not labelled as vertical sinking.'));
  const rateHelp = explainButton('rate'); rateHelp.textContent = 'Explain this rate ↗';
  metric.append(rateHelp);
  const topRow = el('div', 'report-top');
  topRow.append(metric);
  const compare = renderCompare(state.selected);
  if (compare) topRow.append(compare); else topRow.classList.add('single');
  root.append(topRow);
  const chartSection = section('Displacement through time', 'chart');
  if (series?.hasData) {
    const cumulative = state.cumulative.get(state.selected);
    const timeMeta = cumulative?.status === 'ready' && map ? cumulative.value : null;
    state.time.meta = timeMeta;
    const chart = makeChart(series, timeMeta ? timeHooks() : null);
    state.time.chart = chart;
    chartSection.append(chart, note('Relative to: ' + series.reference));
    if (timeMeta) { const ui = makeTimeControls(); state.time.ui = ui; chartSection.append(ui.node); }
  } else {
    const wait = el('div', 'chart-wait');
    wait.append(el('span', 'waiting-mark'), el('p', '', 'No observations to plot yet'), el('small', '', dataError(result, 'The chart will use the measured record. Pending does not mean zero movement.')));
    chartSection.append(wait);
  }
  const chartTarget = $('#study-chart');
  chartTarget.hidden = false;
  chartTarget.replaceChildren(chartSection);
  const chartFooter = el('a', 'map-chart-details', 'Read the full ' + p.name + ' study report ↓');
  chartFooter.href = '#details';
  chartTarget.append(chartFooter);
  const technical = el('div', 'report-methods');
  technical.append(el('p', 'report-technical-hint', 'Source records, observations, the official comparison and the limits of this measurement.'));
  const technicalGrid = el('div', 'report-technical-grid');
  technical.append(technicalGrid);
  const record = section('Measurement record', 'record');
  record.append(factList([
    ['Satellite / product', series?.source || meta?.track || 'Not supplied'],
    ['Track / frame', series?.track || meta?.track || 'Coverage check pending'],
    ['Record', series?.dates.length ? series.dates[0] + ' — ' + series.dates.at(-1) : 'Pending'],
    ['Reference', series?.reference || 'Stable reference pending'],
    ['Data release', series?.data_release || meta?.data_release || 'Not supplied']
  ]));
  technicalGrid.append(record);
  // The observation table belongs with the report; the map shows the graph only.
  const table = chartSection.querySelector('.chart details');
  if (table) {
    table.remove();
    const observations = section('Observation table');
    observations.append(table);
    technicalGrid.append(observations);
  }
  const caveats = Array.isArray(series?.caveats) ? series.caveats.filter(text => typeof text === 'string' && text.trim()) : [];
  if (caveats.length) {
    const limits = section('Study measurement limits');
    caveats.forEach(text => limits.append(el('p', 'validation-note', text)));
    technicalGrid.append(limits);
  }
  if (typeof series?.nisar?.status_note === 'string' && series.nisar.status_note.trim()) {
    const provisional = section('NISAR status');
    provisional.append(el('p', 'validation-note', series.nisar.status_note));
    technicalGrid.append(provisional);
  }
  const validation = section('ADWR comparison', 'validation');
  if (series && (isNumber(series.adwr_rate_cm_yr) || isNumber(series.adwr_rs2_rate_cm_yr))) {
    const c = series.adwr_comparison;
    validation.append(note('Median rates over the same sinking pixels · cm/yr, line of sight · ADWR units inferred. These medians differ from the fitted rate above.'));
    validation.append(factList([
      ['Our median', formatNumber(c?.ours_median ?? series.median_rate_cm_yr)],
      ['ADWR Sentinel-1', formatNumber(series.adwr_rate_cm_yr)],
      ['ADWR RADARSAT-2', formatNumber(series.adwr_rs2_rate_cm_yr)]
    ]));
    if (c) validation.append(factList([
      ['Sentinel-1 correlation', formatNumber(c.corr_s1)],
      ['RADARSAT-2 correlation', formatNumber(c.corr_rs2)],
      ['Our − ADWR S1 median', isNumber(c.diff_s1) ? formatNumber(c.diff_s1) + ' cm/yr' : 'Pending']
    ]));
    validation.append(el('p', 'validation-note', series.adwr_note || 'ADWR provenance and comparison periods have not been supplied.'));
    validation.append(el('p', 'validation-note', 'Sentinel-1 is a consistency check, not independent validation. RADARSAT-2 is an independent sensor over a longer period. Agreement varies; these comparisons do not establish validation of every study or of NISAR. Eloy – Picacho is not validated by this test.'));
    const source = el('a', '', 'Comparison method, periods and limitations');
    source.href = 'https://github.com/mansi200304/NASA-Hackathon/blob/main/docs/adwr_validation.md'; source.target = '_blank'; source.rel = 'noopener noreferrer'; validation.append(source);
  } else {
    validation.append(el('p', 'detail-copy', 'Comparison pending'));
    validation.append(el('p', 'validation-note', 'Match the area and observation period before comparing rates.'));
  }
  technicalGrid.append(validation);
  const geology = renderGeology(state.selected);
  const story = section('Why this place');
  story.append(el('p', 'detail-copy', p.story));
  if (typeof p.land_use_note === 'string' && p.land_use_note.trim()) story.append(note(p.land_use_note));
  story.classList.add('report-why');
  const timelapse = renderTimelapse(state.selected, p.name);
  const summaryRow = el('div', 'report-summary-row' + (timelapse ? '' : ' single'));
  summaryRow.append(story);
  if (timelapse) summaryRow.append(timelapse.node);
  summaryPanel.append(summaryRow);
  reportTabs(root, [
    ['summary', 'Summary', summaryPanel, timelapse?.show],
    ['beneath', 'What lies beneath', geology],
    ['methods', 'Methods & checks', technical]
  ]);
  const bottom = el('div', 'detail-bottom');
  bottom.append(el('div', '', 'Radar measures motion along the satellite’s line of sight. A vertical rate requires a justified conversion.'));
  const button = el('button', '', 'Read the measurement limits');
  button.type = 'button'; button.addEventListener('click', () => openDialog('limits'));
  bottom.append(button); root.append(bottom);
}
// Next to the headline rate: the same rate for every study area, so a reader sees at once where this place stands.
function renderCompare(selected) {
  const rows = state.slugs.map(slug => {
    const r = state.series.get(slug), s = r?.status === 'ready' ? r.value : null;
    const f = state.hotspots.features.find(x => x.properties.slug === slug);
    return { slug, name: f.properties.name, rate: s && isNumber(s.rate_cm_yr) ? s.rate_cm_yr : null };
  }).filter(r => r.rate !== null).sort((x, y) => x.rate - y.rate);
  if (rows.length < 2 || !rows.some(r => r.slug === selected)) return null;
  const box = el('section', 'report-compare');
  box.append(el('p', 'metric-label', 'How it compares'));
  const max = Math.max(...rows.map(r => Math.abs(r.rate)));
  const list = el('ol', 'compare-bars');
  rows.forEach(r => {
    const li = el('li', r.slug === selected ? 'is-current' : '');
    const btn = el('button', 'compare-row'); btn.type = 'button';
    if (r.slug === selected) btn.setAttribute('aria-current', 'true');
    btn.setAttribute('aria-label', r.name + ': ' + formatNumber(r.rate) + ' centimetres a year' + (r.slug === selected ? ' (this area)' : '. Open this study area'));
    const bar = el('span', 'compare-bar'); const fill = el('i'); fill.style.width = Math.max(4, Math.abs(r.rate) / max * 100).toFixed(1) + '%'; bar.append(fill);
    btn.append(el('span', 'compare-name', r.name), bar, el('span', 'compare-value', formatNumber(r.rate)));
    if (r.slug !== selected) btn.addEventListener('click', () => selectHotspot(r.slug));
    li.append(btn); list.append(li);
  });
  const rank = rows.findIndex(r => r.slug === selected) + 1;
  const allSinking = rows.every(r => r.rate < 0);
  const where = rank === 1 ? 'Fastest of the ' + rows.length + ' study areas.'
    : rank === rows.length ? 'Slowest of the ' + rows.length + ' study areas' + (allSinking ? ', though all of them are sinking.' : '.')
    : ordinal(rank) + ' fastest of the ' + rows.length + ' study areas.';
  box.append(list, note(where + ' cm/yr, Sentinel-1 2016\u20132026, line of sight. Select a bar to open that area.'));
  return box;
}
const ordinal = n => n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n] || 'th');
// Summary tab: a small satellite view that plays our dated Sentinel-1 pictures (total change since the first date). Plays only when asked.
const SATELLITE_TILES = { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics' };
const monthYear = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
function renderTimelapse(slug, name) {
  const result = state.cumulative.get(slug);
  if (result?.status !== 'ready' || typeof L === 'undefined') return null;
  const meta = result.value, last = meta.dates.length - 1;
  const feature = state.hotspots.features.find(f => f.properties.slug === slug);
  const fig = el('figure', 'timelapse');
  fig.append(el('p', 'metric-label', 'From above, ' + meta.dates[0].slice(0, 4) + '–' + meta.dates[last].slice(0, 4)));
  const box = el('div', 'timelapse-map');
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', 'Satellite view of ' + name + ' coloured by how much lower the ground is than in ' + monthYear(meta.dates[0]));
  const controls = el('div', 'timelapse-controls');
  const playLabel = 'Play ' + meta.dates[0].slice(0, 4) + ' \u2192 ' + meta.dates[last].slice(0, 4);
  const play = el('button', 'timelapse-play', playLabel); play.type = 'button'; play.setAttribute('aria-pressed', 'false');
  const range = el('input', 'timelapse-range'); range.type = 'range'; range.min = '0'; range.max = String(last); range.step = '1'; range.value = String(last);
  range.setAttribute('aria-label', 'Date shown');
  const date = el('output', 'timelapse-date', monthYear(meta.dates[last]));
  controls.append(play, range, date);
  const legend = el('div', 'timelapse-legend');
  const strip = el('span', 'timelapse-strip'); strip.setAttribute('aria-hidden', 'true');
  const labels = el('span', 'timelapse-labels'); labels.append(el('span', '', formatNumber(meta.vmin) + ' cm'), el('span', '', '0'), el('span', '', '+' + formatNumber(meta.vmax)));
  legend.append(strip, labels);
  fig.append(box, controls, legend, el('figcaption', '', 'Red: ground lower than in ' + monthYear(meta.dates[0]) + ', measured along the satellite\u2019s slanted view (Sentinel-1). Blank: not measured at every date, not zero. White line: study outline.'));
  const view = { map: null, image: null, timer: null, index: last };
  const showFrame = i => {
    view.index = i; range.value = String(i); date.textContent = monthYear(meta.dates[i]);
    range.setAttribute('aria-valuetext', monthYear(meta.dates[i]));
    view.image?.setUrl(timeURL(meta.frames[i]));
  };
  const stopPlay = () => { clearInterval(view.timer); view.timer = null; play.textContent = playLabel; play.setAttribute('aria-pressed', 'false'); };
  play.addEventListener('click', () => {
    if (view.timer) { stopPlay(); return; }
    meta.frames.forEach(path => { const pre = new Image(); pre.src = timeURL(path); });
    if (view.index >= last) showFrame(0);
    play.textContent = 'Pause'; play.setAttribute('aria-pressed', 'true');
    view.timer = setInterval(() => { if (view.index >= last) stopPlay(); else showFrame(view.index + 1); }, 550);
  });
  range.addEventListener('input', () => { stopPlay(); showFrame(Number(range.value)); });
  const fit = () => { if (!view.map) return; view.map.invalidateSize(); view.map.fitBounds(meta.bounds, { padding: [4, 4] }); };
  const show = () => {
    if (view.map) { requestAnimationFrame(fit); return; }
    try {
      view.map = L.map(box, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, tap: false, attributionControl: true });
      view.map.attributionControl.setPrefix(false);
      L.tileLayer(SATELLITE_TILES.url, { attribution: SATELLITE_TILES.attribution, maxZoom: 18 }).addTo(view.map);
      view.image = L.imageOverlay(timeURL(meta.frames[view.index]), meta.bounds, { opacity: 0.9, interactive: false }).addTo(view.map);
      if (feature) L.geoJSON(feature, { interactive: false, style: { color: '#ffffff', weight: 2, fill: false, opacity: 0.95 } }).addTo(view.map);
      view.map.fitBounds(meta.bounds, { padding: [4, 4] });
      requestAnimationFrame(fit);
    } catch (error) { fig.hidden = true; }
  };
  state.miniMap = view;
  return { node: fig, show };
}
// Study report tabs. The chosen tab is kept when another study area is opened, so areas can be compared section by section.
function reportTabs(root, entries) {
  const list = entries.filter(entry => entry[2]);
  if (!list.some(([id]) => id === state.reportTab)) state.reportTab = list[0][0];
  const bar = el('div', 'report-tabs');
  bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', 'Study report sections');
  const tabs = [], panels = [];
  list.forEach(([id, label, body]) => {
    const tab = el('button', '', label); tab.type = 'button'; tab.id = 'report-tab-' + id;
    tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', 'report-panel-' + id);
    const panel = el('div', 'report-panel'); panel.id = 'report-panel-' + id; panel.dataset.tab = id;
    panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', tab.id); panel.tabIndex = 0;
    panel.append(body); tabs.push(tab); panels.push(panel);
  });
  const select = (index, focus) => {
    state.reportTab = list[index][0];
    tabs.forEach((tab, i) => { const on = i === index; tab.setAttribute('aria-selected', String(on)); tab.tabIndex = on ? 0 : -1; panels[i].hidden = !on; });
    if (focus) tabs[index].focus();
    if (typeof list[index][3] === 'function') list[index][3]();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(i, false));
    tab.addEventListener('keydown', ev => {
      const n = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 }[ev.key];
      if (n !== undefined) { ev.preventDefault(); select(n, true); }
    });
  });
  bar.append(...tabs);
  root.append(bar, ...panels);
  select(list.findIndex(([id]) => id === state.reportTab), false);
}
function renderHotspots() {
  const list = $('#hotspot-list'); list.replaceChildren();
  state.hotspots.features.forEach((f, i) => {
    const button = el('button', 'hotspot-button');
    button.type = 'button';
    button.dataset.slug = f.properties.slug;
    button.setAttribute('aria-pressed', String(f.properties.slug === state.selected));
    button.append(el('span', 'index', String(i + 1).padStart(2, '0')));
    const title = el('span', 'place', f.properties.name);
    title.append(el('span', 'tagline', f.properties.tagline));
    button.append(title);
    button.addEventListener('click', () => selectHotspot(f.properties.slug));
    list.append(button);
  });
}
function selectHotspot(slug, fit = true) {
  $('#explain-drawer').hidden = true;
  map?.closePopup();
  state.selected = slug;
  document.querySelectorAll('.hotspot-button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.slug === slug)));
  state.outlines.forEach((layer, key) => layer.setStyle({ color: key === slug ? '#F4EFE6' : '#9CA5A9', weight: key === slug ? 1.8 : 1, fillOpacity: 0, dashArray: key === slug ? null : '5 5' }));
  $('#map-location').textContent = state.hotspots.features.find(f => f.properties.slug === slug).properties.name;
  renderDetails(); updateRateLayer();
  if (fit && map) fitSelected();
}
function fitSelected() {
  const layer = state.outlines.get(state.selected);
  if (map && layer) {
    map.stop();
    map.fitBounds(layer.getBounds(), { padding: [50, 75], animate: false, maxZoom: 11 });
  }
}
function showAll() { if (map && outlineGroup) { map.stop(); map.fitBounds(outlineGroup.getBounds(), { padding: [45, 65], animate: false, maxZoom: 9 }); } }
function initMap() {
  if (!window.L) {
    $('#map-error').textContent = 'The map library could not load. Study details remain available.';
    $('#map-error').hidden = false; return;
  }
  map = L.map('map', { zoomControl: false, minZoom: 5, maxZoom: 18, zoomSnap: 0.25, attributionControl: true }).setView([32.8, -111.65], 9);
  map.createPane('measurements'); map.getPane('measurements').style.zIndex = 330;
  map.createPane('timeframes'); map.getPane('timeframes').style.zIndex = 335;
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
  const tileSources = {
    terrain: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, USGS, NGA, EPA, USDA, NPS' },
    satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community' }
  };
  state.basemaps = {};
  Object.entries(tileSources).forEach(([key, config]) => {
    const layer = L.tileLayer(config.url, { attribution: config.attribution, maxNativeZoom: config.maxNativeZoom || 18, maxZoom: 18 });
    let errors = 0;
    layer.on('tileerror', () => { if (state.base === key && ++errors >= 3) $('#map-error').hidden = false; });
    layer.on('tileload', () => { if (state.base === key) { errors = 0; $('#map-error').hidden = true; } });
    state.basemaps[key] = layer;
  });
  state.basemaps[state.base].addTo(map);
  outlineGroup = L.featureGroup().addTo(map);
  state.hotspots.features.forEach(f => {
    const layer = L.geoJSON(f, { bubblingMouseEvents: false, style: { color: '#9CA5A9', weight: 1, fillOpacity: 0 } });
    const tooltip = el('div', '', f.properties.name);
    if (f.properties.confirmation) tooltip.append(el('small', '', f.properties.confirmation));
    layer.bindTooltip(tooltip, { sticky: true, className: 'study-label' });
    layer.on('click', () => selectHotspot(f.properties.slug));
    layer.addTo(outlineGroup); state.outlines.set(f.properties.slug, layer);
  });
  // Background map clicks no longer open the screen-obscuring field note.
  new ResizeObserver(() => map.invalidateSize({ pan: false })).observe($('#map'));
}
function renderLayerControls() {
  const list = $('#layer-list'); list.replaceChildren();
  let lastGroup = null;
  state.layers.forEach((config, key) => {
    const info = LAYER_INFO[key];
    if (info && info.group !== lastGroup) { lastGroup = info.group; list.append(el('h3', 'layer-group', info.group)); }
    const ready = config.status === 'ready';
    const row = el('div', 'layer-row' + (ready ? '' : ' unavailable'));
    const label = el('label');
    const input = el('input');
    input.type = 'checkbox'; input.checked = ready && config.visible; input.disabled = !ready;
    input.id = 'layer-' + key;
    const statusLabel = ready ? '' : key === 'rate' && !state.selected ? 'Choose an area' : config.status === 'missing' || config.status === 'loading' ? 'Pending' : 'Review file';
    label.append(input, el('span', 'layer-title', config.name), el('span', 'layer-state', statusLabel));
    if (config.error) label.title = config.error; else if (config.note) label.title = config.note;
    row.append(label);
    if (info?.desc) row.append(el('p', 'layer-desc', info.desc));
    input.addEventListener('change', () => {
      config.visible = input.checked;
      if (key === 'rate') updateRateLayer();
      else if (map && config.layer) { if (input.checked) config.layer.addTo(map); else map.removeLayer(config.layer); }
    });
    if (ready && key !== 'hotspots') {
      const opacityWrap = el('div', 'opacity-control'), opacity = el('input');
      opacity.type = 'range'; opacity.min = 0; opacity.max = 100; opacity.value = config.opacity * 100;
      opacity.setAttribute('aria-label', config.name + ' opacity');
      opacity.addEventListener('input', () => {
        config.opacity = Number(opacity.value) / 100;
        if (key === 'rate') state.rateImage?.setOpacity(config.opacity);
        else if (key === 'nisar') config.layer?.eachLayer(layer => layer.setOpacity(config.opacity));
        else if (config.layer?.setOpacity) config.layer.setOpacity(config.opacity);
        else config.layer?.setStyle({ opacity: config.opacity, fillOpacity: key === 'adwr_subsidence' ? 0 : MARKER_LAYERS.some(l => l[0] === key) ? config.opacity * 0.8 : config.opacity * 0.15 });
      });
      opacityWrap.append(el('span', '', 'Opacity'), opacity); row.append(opacityWrap);
    }
    list.append(row);
  });
}
function updateRateLayer() {
  if (map && state.rateImage) map.removeLayer(state.rateImage);
  state.rateImage = null;
  const result = state.rates.get(state.selected), config = state.layers.get('rate');
  config.status = result?.status || 'missing'; config.error = result?.error;
  const legend = $('#rate-legend'); legend.hidden = true; legend.replaceChildren();
  if (result?.status === 'ready' && config.visible && map) {
    const meta = result.value;
    const slug = state.selected;
    const imageName = 'rate_' + slug + '.png';
    const imageURL = window.ATLAS_PREVIEW_IMAGES?.[imageName] || new URL(imageName, DATA).href;
    const image = L.imageOverlay(imageURL, meta.bounds, { pane: 'measurements', opacity: config.opacity, interactive: false });
    state.rateImage = image;
    image.on('error', () => {
      if (state.rateImage !== image) return;
      map.removeLayer(image); legend.hidden = true;
      config.status = 'invalid'; config.error = 'Rate metadata exists, but the PNG did not load.';
      renderLayerControls();
    });
    image.on('load', () => {
      if (state.rateImage !== image) return;
      legend.hidden = false;
      legend.append(el('strong', '', 'Ground motion · line of sight'));
      legend.append(el('div', '', formatNumber(meta.vmin) + ' to ' + formatNumber(meta.vmax) + ' cm/yr'));
      if (Array.isArray(meta.colors) && meta.colors.length >= 2 && meta.colors.every(c => /^#[0-9a-f]{6}$/i.test(c))) {
        const strip = el('div', 'legend-colors'); strip.style.background = 'linear-gradient(to right,' + meta.colors.join(',') + ')'; legend.append(strip);
      }
      // The team's documented custom ramp is not a linear colour scale. Describe
      // it categorically rather than manufacture a numeric gradient from it.
      if (typeof meta.colormap === 'string' && meta.colormap.startsWith('custom: red = sinking')) {
        const key = el('div', 'map-color-key');
        for (const [cls, text] of [['sinking', 'Red: sinking'], ['stable', 'Transparent: stable'], ['rising', 'Blue: rising']]) {
          const item = el('span', '', text); item.prepend(el('i', cls)); key.append(item);
        }
        legend.append(key);
      }
      legend.append(el('small', '', meta.track || 'Track not supplied'));
      legend.append(el('small', '', meta.dates[0] + ' — ' + meta.dates.at(-1)));
      if (meta.sign_convention) legend.append(el('small', '', meta.sign_convention));
      legend.append(el('small', '', meta.data_release || 'Release status not supplied'));
    });
    image.addTo(map);
  }
  renderLayerControls();
}
function makeOverlay(raw, key) {
  const color = key === 'checked_flat' ? COLORS.olive : key === 'mines_excluded' ? COLORS.slate : COLORS.rust;
  return L.geoJSON(raw, {
    bubblingMouseEvents: false,
    // Official ADWR context polygons sit above study outlines. Do not let them
    // intercept clicks meant to select a study and load its graph/report.
    interactive: key !== 'adwr_subsidence',
    style: { color, weight: 1.3, fillOpacity: key === 'adwr_subsidence' ? 0 : 0.12, opacity: 0.8 },
    pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 5, color, weight: 1.5, fillColor: color, fillOpacity: 0.8 }),
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      const popup = el('div');
      popup.append(el('strong', '', p.name || p.NAME || 'Context feature'));
      if (key === 'adwr_subsidence') {
        if (p.period) popup.append(el('p', '', p.period));
        if (p.source) popup.append(el('p', '', p.source));
      }
      if (key === 'mines_excluded' && p.reason) popup.append(el('p', '', p.reason));
      if (key === 'checked_flat' && p.note) popup.append(el('p', '', p.note + (isNumber(p.median_rate_cm_yr) ? ' · median ' + formatNumber(p.median_rate_cm_yr) + ' cm/yr' : '')));
      const source = safeSourceURL(p.source_url);
      if (source) { const a = el('a', '', 'Source'); a.href = source; a.target = '_blank'; a.rel = 'noopener noreferrer'; popup.append(a); }
      if (key !== 'adwr_subsidence') layer.bindPopup(popup);
      // Context layers retain their Leaflet source popup without a second drawer.
    }
  });
}
const dialogCopy = {
  method: {
    title: 'How we measure ground motion',
    body: '<p>A satellite sends a radar pulse down and times the echo, so it knows how far away the ground is. Flying over the same spot again and again, it can tell when the ground has moved closer or farther by a few millimetres. Moist air and the ionosphere also delay the signal, so we subtract the corrections NISAR provides for both before measuring any movement.</p><ol><li><strong>Compare two passes.</strong> If the ground moved between two passes, the radar waves return slightly out of step. That shift tells us how far it moved.</li><li><strong>Add up many pairs.</strong> One pair is noisy, because moisture in the air and the upper atmosphere also change the signal. Chaining many pairs over years lets steady sinking add up while random noise does not.</li><li><strong>Two satellites.</strong> Sentinel-1 has flown since 2016, so it gives a ten-year trend. NASA-ISRO NISAR started in late 2025, so its record is still short. We show the Sentinel-1 trend and mark NISAR as preliminary.</li><li><strong>Two viewing directions.</strong> Satellites look at the ground from the east or from the west. When both agree, the sinking is much more likely to be real.</li><li><strong>Check against the official record.</strong> We compare our numbers with the radar results the Arizona Department of Water Resources publishes itself.</li></ol><p>We removed the effects of the Earth\u2019s tides and of the upper atmosphere. We did not remove water vapour in the lower atmosphere, which is a main source of the remaining noise. Numbers are measured along the satellite\u2019s slanted view, not straight down.</p>'
  },
  limits: {
    title: 'Read the map with its limits',
    body: '<ul><li><strong>Pending is not zero.</strong> Empty results mean that a file is missing or has not passed the interface checks.</li><li><strong>Radar measures line-of-sight motion.</strong> A vertical sinking rate needs a justified conversion. A positive or negative value is not interpreted without its sign convention.</li><li><strong>Short records need care.</strong> Seasonal movement, atmospheric errors and the stable reference can influence a fitted rate. NISAR\u2019s record is about a year at Willcox and under four months at Eloy, so we do not publish a NISAR speed; one bad acquisition date can move a one-year fit by a centimetre or more.</li><li><strong>Data quality varies.</strong> Farming and construction can reduce coherence. Product corrections and release status must be checked.</li><li><strong>Location does not establish cause.</strong> A nearby farm or city does not prove responsibility for ground movement.</li><li><strong>Radar does not observe wildlife.</strong> Any mention of habitat comes from outside sources, not from this measurement.</li><li><strong>Mines move too.</strong> Open-pit mines and their waste piles shift for reasons unrelated to groundwater. We mark the ones we found.</li><li><strong>Blue patches are probably not real uplift.</strong> Rising values, such as on the Willcox Playa floor, most likely come from wet or swelling soil changing the radar signal. We have not verified this.</li><li><strong>Gaps are not zeros.</strong> Where the map is empty, the radar could not measure reliably (over plowed fields, for example). That does not mean the ground is stable.</li><li><strong>A study box is not a sinking zone.</strong> Outlines show the areas the team chose to investigate.</li></ul>'
  },
  sources: {
    title: 'Resources · research, data and code',
    body: `<p><strong>What supports the story?</strong> The groundwater and farming claims in the Overview come from the agency publications and research papers below. They are historical evidence, not outputs calculated from this team's satellite processing.</p>
    <h3>Research: groundwater, agriculture and subsidence</h3>
    <ol class="resource-list">
      <li><a href="https://www.usgs.gov/water-science-school/science/land-subsidence" target="_blank" rel="noopener noreferrer">USGS · Land Subsidence</a> — Public scientific explanation of groundwater pumping, aquifer compaction and long-term storage loss.</li>
      <li><a href="https://pubs.usgs.gov/publication/wri874143" target="_blank" rel="noopener noreferrer">Epstein, V. J. (1987) · Hydrologic and geologic factors affecting land subsidence near Eloy, Arizona</a> — USGS Water-Resources Investigations Report 87-4143; direct measurements of 1.09 m land subsidence from groundwater withdrawal in 1965–1983.</li>
      <li><a href="https://pubs.usgs.gov/publication/wri004277" target="_blank" rel="noopener noreferrer">Pool, D. R., Carruth, R. L. &amp; Meehan, W. D. (2001) · Hydrogeology of Picacho Basin, south-central Arizona</a> — USGS Water-Resources Investigations Report 2000-4277; groundwater development, declining water levels, aquifer compaction and fissures.</li>
      <li><a href="https://www.azwater.gov/find-info-on/how-do-i/willcox-groundwater-basin" target="_blank" rel="noopener noreferrer">Arizona Department of Water Resources · Willcox Groundwater Basin</a> — Official sector water-use estimates for 2022 (agricultural: 155,805 acre-feet; industrial: 11,268; municipal: 910), groundwater overdraft and the limits of assigning decline to specific users.</li>
      <li><a href="https://www.mdpi.com/2076-3263/13/6/176" target="_blank" rel="noopener noreferrer">Job, C., Ochoa, C., Jarvis, W. &amp; Kennedy, R. (2023) · A Spatiotemporal Characterization of Water Resource Conditions and Demands as Influenced by the Hydrogeologic Framework of the Willcox Groundwater Basin, Southeastern Arizona, USA. Geosciences, 13(6), 176</a> — Peer-reviewed study associating agricultural expansion, pumping pressure and groundwater declines; DOI: 10.3390/geosciences13060176.</li>
      <li><a href="https://www.sciencedirect.com/science/article/pii/S0034425722000086" target="_blank" rel="noopener noreferrer">Peng, M. et al. (2022) · Mapping land subsidence and aquifer system properties of the Willcox Basin, Arizona, from InSAR observations and independent component analysis. Remote Sensing of Environment, 271, 112894</a> — Peer-reviewed InSAR and groundwater-level study linking historical subsidence with excessive groundwater exploitation.</li>
    </ol>
    <h3>Data and project methods</h3>
    <ul>
      <li><a href="https://github.com/mansi200304/NASA-Hackathon/blob/main/docs/overview_evidence.md" target="_blank" rel="noopener noreferrer">Evidence-to-claim notes, citations and limitations</a></li>
      <li><a href="https://github.com/mansi200304/NASA-Hackathon" target="_blank" rel="noopener noreferrer">Sinkronized · code and pipeline outputs</a></li>
      <li><a href="https://nisar.jpl.nasa.gov/" target="_blank" rel="noopener noreferrer">NASA-ISRO NISAR mission information</a></li>
      <li><a href="https://doi.org/10.5067/NIL2GUNW-P1" target="_blank" rel="noopener noreferrer">NISAR L2 Geocoded Unwrapped Interferogram (GUNW), Provisional · ASF DAAC</a> — DOI 10.5067/NIL2GUNW-P1; the NISAR data processed here.</li>
      <li><a href="https://api.waterdata.usgs.gov/ogcapi/v0/collections/field-measurements" target="_blank" rel="noopener noreferrer">U.S. Geological Survey \u00b7 Water Data API, groundwater field measurements</a> \u2014 depth to water below land surface (parameter 72019), including measurements by the Arizona Department of Water Resources; used for 1980\u20132000 resting water levels.</li>\n      <li><a href="https://services3.arcgis.com/iuNbZYJOrAYBrPyC/ArcGIS/rest/services/Well_Sites/FeatureServer" target="_blank" rel="noopener noreferrer">Arizona Department of Water Resources \u00b7 Groundwater Site Inventory (GWSI) well sites</a> \u2014 each well\u2019s latest water level, used for the recent end of the comparison.</li>\n      <li><a href="https://doi.org/10.5066/P1ZU6T5N" target="_blank" rel="noopener noreferrer">Read, A. L., Kahler, A. J., Porter, T. J. &amp; Potteiger, S. E. \u00b7 Estimated crop irrigation water use withdrawals in Willcox Groundwater Basin, Arizona for 2024 (USGS data release)</a> \u2014 DOI 10.5066/P1ZU6T5N, CC0; field polygons with modelled withdrawals (modified Blaney-Criddle consumptive-use model; no uncertainty stated).</li>
      <li><a href="https://doi.org/10.3133/cir1182" target="_blank" rel="noopener noreferrer">Galloway, D., Jones, D. R. &amp; Ingebritsen, S. E. (1999) \u00b7 Land Subsidence in the United States (USGS Circular 1182)</a> \u2014 why aquifer compaction is largely permanent, and the documented south-central Arizona fissures and infrastructure damage.</li>\n      <li><a href="https://doi.org/10.3133/wsp1859F" target="_blank" rel="noopener noreferrer">Brown, S. G. &amp; Schumann, H. H. (1969) \u00b7 Geohydrology and Water Utilization in the Willcox Basin (USGS Water-Supply Paper 1859-F)</a> \u2014 basin fill and the Lake Cochise clay beneath Willcox Playa.</li>\n      <li><a href="https://doi.org/10.5281/ZENODO.20075813" target="_blank" rel="noopener noreferrer">NISAR Data User Guide (Kristenson et al., 2026) · ASF</a> — DOI 10.5281/ZENODO.20075813; product definitions, maturity levels and availability used throughout this project.</li>
      <li><a href="https://doi.org/10.48577/jpl.UD4HV3" target="_blank" rel="noopener noreferrer">NASA-ISRO SAR (NISAR) Mission Science Users’ Handbook, Second Edition (2025)</a> — DOI 10.48577/jpl.UD4HV3.</li>
      <li><a href="https://ecommons.cornell.edu/entities/publication/5e298b2f-9ae6-4861-abfe-a8c194323c08" target="_blank" rel="noopener noreferrer">Devlin, K. (2025) · More Than Just Noise: Effects of Vegetation and Agriculture on InSAR Time Series Analysis</a> — Cornell University PhD dissertation; reports an average bias of about 2–4 cm/yr of apparent subsidence for crops such as cotton in Sentinel-1 data, and the largest C-band versus L-band differences in orchard crops.</li>
      <li><a href="https://meetingorganizer.copernicus.org/EGU21/EGU21-3503.html" target="_blank" rel="noopener noreferrer">Saporta, Gomba &amp; De Zan (2021) · Analyzing an InSAR short-term systematic phase bias with regards to soil moisture and landcover</a> — EGU General Assembly 2021 abstract EGU21-3503; velocity biases that can reach several mm per year in Sentinel-1 data.</li>
      <li><a href="https://doi.org/10.5067/SNWG/OPL3DISPS1-V1" target="_blank" rel="noopener noreferrer">OPERA Surface Displacement from Sentinel-1 (DISP-S1), Version 1 · ASF DAAC</a> — DOI 10.5067/SNWG/OPL3DISPS1-V1; the ten-year record, built from Copernicus Sentinel-1 data (ESA).</li>
      <li><a href="https://registry.opendata.aws/copernicus-dem/" target="_blank" rel="noopener noreferrer">Copernicus 30 m DEM</a> — ground heights used to apply NISAR’s troposphere correction.</li>
      <li><a href="https://search.asf.alaska.edu/" target="_blank" rel="noopener noreferrer">Alaska Satellite Facility · SAR data discovery</a></li>
      <li><a href="https://www.azwater.gov/hydrology/field-services/land-subsidence-arizona" target="_blank" rel="noopener noreferrer">ADWR · Arizona land-subsidence monitoring</a></li>
      <li><a href="https://www.azwater.gov/gis" target="_blank" rel="noopener noreferrer">ADWR GIS · official subsidence areas and radar products</a></li>
      <li><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap · land-use reference notes</a></li>
    </ul>
    <p><strong>Interpretation:</strong> Groundwater pumping is a documented regional mechanism, and agriculture is a major groundwater-use sector in Willcox. Neither a correlation nor the Sinkronized maps alone can assign an observed pixel to a specific farm, well or other water user.</p>
    <p>Satellite/terrain basemap imagery is served by Esri, with attribution on the map. Mapping software: Leaflet 1.9.4 (BSD-2-Clause). Basemap imagery is geographic context, not a radar measurement.</p>`
  }
};
function openDialog(key) {
  const copy = dialogCopy[key]; if (!copy) return;
  $('#dialog-title').textContent = copy.title;
  $('#dialog-body').innerHTML = copy.body; // Static, locally authored content only.
  $('#about-dialog').showModal();
}
document.querySelectorAll('[data-dialog]').forEach(b => b.addEventListener('click', () => openDialog(b.dataset.dialog)));
$('#close-dialog').addEventListener('click', () => $('#about-dialog').close());
$('#close-explain').addEventListener('click', () => { $('#explain-drawer').hidden = true; });
document.addEventListener('keydown', event => { if (event.key === 'Escape') $('#explain-drawer').hidden = true; });
$('#about-dialog').addEventListener('click', e => { if (e.target === $('#about-dialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } });
$('#reload-data').addEventListener('click', () => location.reload());
$('#toggle-layers').addEventListener('click', () => {
  const open = $('.sidebar').classList.toggle('layers-open');
  $('#toggle-layers').setAttribute('aria-expanded', String(open));
  $('#toggle-layers').textContent = open ? 'Hide map layers' : 'Show map layers';
});
$('#show-all').addEventListener('click', showAll);
$('#fit-study').addEventListener('click', fitSelected);
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.overview-steps > div').forEach(step => {
    step.classList.add('overview-step-in'); observer.observe(step);
  });
}
document.querySelectorAll('[data-basemap]').forEach(button => button.addEventListener('click', () => {
  if (!map) return;
  map.removeLayer(state.basemaps[state.base]); state.base = button.dataset.basemap;
  state.basemaps[state.base].addTo(map); $('#map-error').hidden = true;
  document.querySelectorAll('[data-basemap]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
}));

async function start() {
  const hotspots = await loadJSON('hotspots.geojson', normalizeHotspots);
  if (hotspots.status !== 'ready') {
    setStatus('Study file needs review');
    $('#detail-content').append(el('h1', '', 'Study outlines unavailable'), note(dataError(hotspots, 'Serve the repository root and include data/processed/hotspots.geojson.')));
    $('#map-error').textContent = 'The study outlines could not load. See the study panel for details.';
    $('#map-error').hidden = false; return;
  }
  state.hotspots = hotspots.value;
  state.slugs = state.hotspots.features.map(f => f.properties.slug);
  state.selected = null; // Begin with all study outlines, not a preselected location.
  $('#study-count').textContent = String(state.slugs.length).padStart(2, '0');
  state.layers.set('hotspots', { name: LAYER_INFO.hotspots.name, status: 'ready', visible: true, opacity: 1 });
  state.layers.set('rate', { name: LAYER_INFO.rate.name, status: 'loading', visible: true, opacity: 0.75 });
  for (const [key, visible] of REGION_LAYERS) state.layers.set(key, { name: LAYER_INFO[key].name, status: 'loading', visible, opacity: 0.7 });
  state.layers.set('nisar', { name: LAYER_INFO.nisar.name, status: 'loading', visible: false, opacity: 0.7 });
  state.layers.set('adwr_subsidence', { name: LAYER_INFO.adwr_subsidence.name, status: 'loading', visible: false, opacity: 0.8 });
  for (const [key] of MARKER_LAYERS) state.layers.set(key, { name: LAYER_INFO[key].name, status: 'loading', visible: true, opacity: 0.9 });
  renderHotspots(); initMap();
  state.layers.get('hotspots').layer = outlineGroup;
  renderLayerControls(); showAll();
  const tasks = [
    ...state.slugs.map(async slug => state.series.set(slug, await loadJSON('timeseries_' + slug + '.json', raw => normalizeSeries(raw, slug)))),
    ...state.slugs.map(async slug => state.rates.set(slug, await loadJSON('rate_' + slug + '.json', normalizeRate))),
    ...state.slugs.map(async slug => state.cumulative.set(slug, await loadJSON('cumulative_' + slug + '.json', raw => normalizeCumulative(raw, slug)))),
    ...['adwr_subsidence', ...MARKER_LAYERS.map(l => l[0])].map(async key => {
      const result = await loadJSON(key + '.geojson', validateGeoJSON);
      const config = state.layers.get(key); config.status = result.status; config.error = result.error;
      if (result.status === 'ready') {
        if (!result.value.features.length) { config.status = 'missing'; return; }
        if (map) { config.layer = makeOverlay(result.value, key); config.visible = true; config.layer.addTo(map); }
      }
    }),
    ...REGION_LAYERS.map(async ([key]) => {
      const result = await loadJSON(key + '.json', normalizeRate);
      const config = state.layers.get(key); config.status = result.status; config.error = result.error;
      if (result.status !== 'ready') return;
      const meta = result.value;
      config.note = [meta.track, meta.sign_convention, meta.data_release].filter(Boolean).join(' · ');
      const src = window.ATLAS_PREVIEW_IMAGES?.[key + '.png'] || new URL(key + '.png', DATA).href;
      if (map) { config.layer = L.imageOverlay(src, meta.bounds, { pane: 'measurements', opacity: config.opacity, interactive: false }); if (config.visible) config.layer.addTo(map); }
    }),
    (async () => {                                      // both NISAR overlays behind one switch
      const config = state.layers.get('nisar');
      const loaded = await Promise.all(NISAR_LAYERS.map(async key => ({ key, result: await loadJSON(key + '.json', normalizeRate) })));
      const ready = loaded.filter(item => item.result.status === 'ready');
      if (!ready.length) { config.status = loaded[0].result.status; config.error = loaded[0].result.error; return; }
      config.status = 'ready';
      config.note = ready.map(({ result: { value } }) => [value.track, value.sign_convention, value.data_release].filter(Boolean).join(' \u00b7 ')).join(' | ');
      if (map) {
        config.layer = L.featureGroup(ready.map(({ key, result }) => L.imageOverlay(window.ATLAS_PREVIEW_IMAGES?.[key + '.png'] || new URL(key + '.png', DATA).href,
          result.value.bounds, { pane: 'measurements', opacity: config.opacity, interactive: false })));
        if (config.visible) config.layer.addTo(map);
      }
    })()
  ];
  await Promise.all(tasks);
  if (state.selected) renderDetails();
  updateRateLayer();
  const hasMeasurements = [...state.series.values()].some(r => r.status === 'ready' && r.value.hasData);
  const problems = [...state.series.values(), ...state.rates.values(), ...state.layers.values()].some(r => ['invalid', 'error'].includes(r.status));
  setStatus(problems ? 'Some files need review' : hasMeasurements ? 'Measured record loaded' : 'Measurements pending');
}
start().catch(error => {
  setStatus('Interface needs attention');
  $('#map-error').textContent = 'The interface could not finish loading. Refresh data to retry.';
  $('#map-error').hidden = false;
  console.error('Atlas initialization failed:', error);
});

// ---- About us: team profiles from web/team.json (hand-edited; see web/README.md) ----
async function loadTeam() {
  try {
    if (window.ATLAS_PREVIEW_DATA && 'team.json' in window.ATLAS_PREVIEW_DATA) return cleanTeam(window.ATLAS_PREVIEW_DATA['team.json']);
    const response = await fetch(new URL('team.json', import.meta.url), { cache: 'no-cache' });
    return response.ok ? cleanTeam(await response.json()) : null;
  } catch { return null; }
}
const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0].toUpperCase()).join('');
function renderAbout(team) {
  const grid = $('#team-grid'), intro = $('#about-intro');
  if (!grid || !intro) return;
  grid.replaceChildren();
  if (!team) {
    intro.textContent = 'Team profiles will appear here when the project roster is available.';
    intro.hidden = false;
    return;
  }
  intro.textContent = team.intro || '';
  intro.hidden = !team.intro;
  team.members.forEach((member, index) => {
    const card = el('article', 'team-card');
    const top = el('div', 'team-card-top');
    top.append(el('span', 'team-number', String(index + 1).padStart(2, '0')));
    if (member.photo) {
      const photo = el('img', 'team-photo');
      photo.src = new URL(member.photo, import.meta.url).href;
      photo.alt = 'Photo of ' + member.name;
      photo.loading = 'lazy'; photo.width = 112; photo.height = 112;
      top.append(photo);
    } else {
      const avatar = el('div', 'team-avatar', initials(member.name));
      avatar.setAttribute('aria-hidden', 'true');
      top.append(avatar);
    }
    card.append(top, el('h3', '', member.name));
    if (member.role) card.append(el('p', 'team-role', member.role));
    if (member.education) card.append(el('p', 'team-education', member.education));
    if (member.bio) card.append(el('p', 'team-bio', member.bio));
    if (member.study) {
      const focus = el('div', 'team-specialism');
      focus.append(el('span', 'team-specialism-label', 'Focus'), el('span', 'team-specialism-text', member.study));
      card.append(focus);
    }
    if (member.interests.length) {
      const tags = el('ul', 'team-tags');
      member.interests.forEach(tag => tags.append(el('li', '', tag)));
      card.append(tags);
    }
    if (member.links.length) {
      const row = el('div', 'team-links');
      member.links.forEach(link => {
        const anchor = el('a', '', link.label + ' ↗');
        anchor.href = link.url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
        row.append(anchor);
      });
      card.append(row);
    }
    grid.append(card);
  });
}
loadTeam().then(renderAbout);

// NISAR section in the Overview: filled only from validated data (data/processed/nisar_summary.json); hidden if anything is missing or malformed.
async function loadNisar() {
  try {
    if (window.ATLAS_PREVIEW_DATA && 'nisar_summary.json' in window.ATLAS_PREVIEW_DATA) return cleanNisar(window.ATLAS_PREVIEW_DATA['nisar_summary.json']);
    const response = await fetch(new URL('nisar_summary.json', DATA), { cache: 'no-cache' });
    return response.ok ? cleanNisar(await response.json()) : null;
  } catch { return null; }
}
function renderNisar(n) {
  const section = $('#overview-nisar');
  if (!section) return;
  const farm = $('#overview-farmland');
  if (!n) { section.hidden = true; if (farm) farm.hidden = true; return; }
  const month = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const one = x => (Math.round(x * 10) / 10).toFixed(1), two = x => (Math.round(x * 100) / 100).toFixed(2);
  const sign = x => (x < 0 ? '\u2212' : '') + one(Math.abs(x));
  const values = {
    r: two(n.pattern.r), blocks: new Intl.NumberFormat('en-US').format(n.pattern.blocks), percent: String(Math.round(n.weather.percent)),
    before: String(Math.round(n.weather.before)), after: String(Math.round(n.weather.after)),
    'willcox-date': month(n.willcox.date), 'willcox-rate': one(n.willcox.s1), 'willcox-years': one(n.willcox.years), 'willcox-chance': String(Math.round(n.willcox.chance * 100)),
    'eloy-rate': one(n.eloy.s1), 'eloy-date': month(n.eloy.date), overlap: (n.overlap.r < 0 ? '−' : '') + two(Math.abs(n.overlap.r)),
    's-nisar': sign(n.sinking.nisar), 's-s1': sign(n.sinking.s1), net: sign(n.playa.net), trend: sign(n.playa.trend)
  };
  const f = n.farmland, abs1 = x => one(Math.abs(x)), mn = x => (x < 0 ? '\u2212' : '') + one(Math.abs(x));
  const dr = n.directions, dm = x => (x < 0 ? '−' : '') + one(Math.abs(x));
  Object.assign(values, { span: String(dr.span), asc: dm(dr.asc), 'asc-lo': dm(dr.ascLo), 'asc-hi': dm(dr.ascHi), desc: dm(dr.desc), 'desc-lo': dm(dr.descLo), 'desc-hi': dm(dr.descHi), exp: dm(dr.exp), ew: dm(dr.ew), 'ew-lo': dm(dr.ewLo), 'ew-hi': dm(dr.ewHi) });
  Object.assign(values, {
    dates: String(f.dates), 'box-pct': one(f.boxPct), 'sink-pct': one(f.sinkPct), times: one(f.times), acres: new Intl.NumberFormat('en-US').format(Math.round(f.acres / 100) * 100),
    'rate-diff': abs1(f.diff), 'rate-lo': mn(f.lo), 'rate-hi': mn(f.hi), 'crop-sink': String(Math.round(f.cropSink)), 'desert-sink': String(Math.round(f.desertSink)),
    'auc-hh': two(f.aucHH), 'auc-hv': two(f.aucHV), 'auc-mean': two(f.aucMean), 'rho-hh': two(f.rhoHH), 'rho-hv': two(f.rhoHV), dry: String(f.dry),
    'nisar-diff': mn(f.nisarDiff), 'nisar-cells': new Intl.NumberFormat('en-US').format(f.nisarCells)
  });
  document.querySelectorAll('#overview-nisar [data-nisar], #overview-farmland [data-nisar]').forEach(node => { node.textContent = values[node.dataset.nisar] ?? ''; });
  const img = $('#nisar-figure-img');
  if (img) img.src = window.ATLAS_PREVIEW_IMAGES?.[n.figure] || new URL(n.figure, DATA).href;
  const img2 = $('#nisar-farmland-img');
  if (img2) img2.src = window.ATLAS_PREVIEW_IMAGES?.[n.farmland.figure] || new URL(n.farmland.figure, DATA).href;
  const pr = n.farmland.portrait;
  Object.entries({ 'p-dates': String(pr.dates), 'p-w': String(Math.round(pr.width)), 'p-start': month(pr.start), 'p-end': month(pr.end), 'p-pink': String(pr.pink), 'p-pivot': String(pr.pivot), 'p-all': String(pr.all) })
    .forEach(([key, text]) => document.querySelectorAll('[data-nisar="' + key + '"]').forEach(node => { node.textContent = text; }));
  const img3 = $('#nisar-portrait-img');
  if (img3) img3.src = window.ATLAS_PREVIEW_IMAGES?.[pr.file] || new URL(pr.file, DATA).href;
  section.hidden = false;
  if (farm) farm.hidden = false;
  const fl = n.farmland, mm = x => (x < 0 ? '\u2212' : x > 0 ? '+' : '') + one(Math.abs(x)) + ' mm';
  const away = x => Math.max(0, -x);
  barChart($('#viz-directions'), {
    title: 'Is the sinking visible from both sides?', sub: 'How far the sinking areas moved away from the satellite over ' + dr.span + ' days, relative to the rest (mm). Whiskers: 95% range.',
    max: 14, rows: [
      { label: 'NISAR, ascending track', value: away(dr.asc), lo: away(dr.ascHi), hi: away(dr.ascLo), text: mm(dr.asc), color: '#a64b2a' },
      { label: 'NISAR, descending track', value: away(dr.desc), lo: away(dr.descHi), hi: away(dr.descLo), text: mm(dr.desc), color: '#c77d5e' },
      { label: 'Expected from Sentinel-1\u2019s long-term rate', value: away(dr.exp), text: mm(dr.exp), color: '#52664b' }],
    note: 'Both NISAR directions point the same way as the expectation; the ascending range excludes zero.' });
  barChart($('#viz-share'), {
    title: 'Farmland is a small share of the land, a big share of the sinking', sub: 'Cropland as a share of the area (%).', max: 10, unit: '%',
    rows: [{ label: 'Whole Willcox study box', value: fl.boxPct, text: one(fl.boxPct) + '%', color: '#8a9a84' },
           { label: 'Area Sentinel-1 shows sinking', value: fl.sinkPct, text: one(fl.sinkPct) + '%', color: '#a64b2a' }],
    note: 'USDA Cropland Data Layer 2025 against Sentinel-1 rates; association, not cause.' });
  barChart($('#viz-auc'), {
    title: 'What lets NISAR tell farmland from desert?', sub: 'Separation score on dry dates: 0.5 is a coin flip (left edge), 1 is perfect.', min: 0.5, max: 1,
    rows: [{ label: 'Yearly swing in HH', value: fl.aucHH, text: two(fl.aucHH), color: '#a64b2a' },
           { label: 'Yearly swing in HV', value: fl.aucHV, text: two(fl.aucHV), color: '#c77d5e' },
           { label: 'HV to HH ratio', value: fl.aucRatio, text: two(fl.aucRatio), color: '#8a9a84' },
           { label: 'Average HV brightness', value: fl.aucMeanHV, text: two(fl.aucMeanHV), color: '#8a9a84' },
           { label: 'Average HH brightness', value: fl.aucMean, text: two(fl.aucMean), color: '#8a9a84' }],
    note: 'Change through the year separates them; average brightness barely does.' });
}
loadNisar().then(renderNisar);

// Pumping-vs-sinking section: filled only from validated data (data/processed/pumping_summary.json); hidden if anything is missing or malformed.
async function loadPumping() {
  try {
    if (window.ATLAS_PREVIEW_DATA && 'pumping_summary.json' in window.ATLAS_PREVIEW_DATA) return cleanPumping(window.ATLAS_PREVIEW_DATA['pumping_summary.json']);
    const response = await fetch(new URL('pumping_summary.json', DATA), { cache: 'no-cache' });
    return response.ok ? cleanPumping(await response.json()) : null;
  } catch { return null; }
}
function renderPumping(p) {
  const section = $('#overview-pumping');
  if (!section) return;
  if (!p) { section.hidden = true; return; }
  const n0 = x => new Intl.NumberFormat('en-US').format(Math.round(x)), one = x => (Math.round(x * 10) / 10).toFixed(1), two = x => (Math.round(x * 100) / 100).toFixed(2);
  const s2 = x => (x < 0 ? '−' : '') + two(Math.abs(x)), s1 = x => (Math.round(x * 10) === 0 ? '0.0' : (x < 0 ? '−' : '') + one(Math.abs(x)));
  const values = {
    acft: n0(Math.round(p.acreFt / 1000) * 1000), acres: n0(p.acres), fields: n0(p.fields), radius: String(p.radius),
    none: s1(p.none), low: s1(p.low), medium: s1(p.medium), high: s1(p.high),
    rho: s2(p.rho), 'rho-lo': s2(p.rhoLo), 'rho-hi': s2(p.rhoHi), 'rho-in': s2(p.rhoIn), 'rho-acres': s2(p.rhoAcres),
    partial: s2(p.partial), 'partial-lo': s2(p.partialLo), 'partial-hi': s2(p.partialHi),
    coherent: String(Math.round(p.coherent)), 'row-fields': n0(p.rowFields), 'row-with': n0(p.rowWith), 'field-n': n0(p.fieldN),
    'field-rho': s2(p.fieldRho), 'field-lo': s2(p.fieldLo), 'field-hi': s2(p.fieldHi)
  };
  section.querySelectorAll('[data-pump]').forEach(node => { node.textContent = values[node.dataset.pump] ?? ''; });
  section.hidden = false;
  const dep = x => Math.max(0, -x);
  barChart($('#viz-pump'), {
    title: 'The more estimated pumping nearby, the faster the ground sinks', sub: 'Typical sinking rate (cm/yr) by estimated pumping within ' + p.radius + ' km. Longer bar means faster sinking.', max: 2.5,
    rows: [{ label: 'No field nearby', value: dep(p.none), text: s1(p.none) + ' cm/yr', color: '#8a9a84' },
           { label: 'Low pumping', value: dep(p.low), text: s1(p.low) + ' cm/yr', color: '#d9a58c' },
           { label: 'Medium pumping', value: dep(p.medium), text: s1(p.medium) + ' cm/yr', color: '#c77d5e' },
           { label: 'High pumping', value: dep(p.high), text: s1(p.high) + ' cm/yr', color: '#a64b2a' }],
    note: 'Modelled 2024 pumping (USGS) against the ten-year Sentinel-1 rate; association, not cause.' });
}
loadPumping().then(renderPumping);

// Bar chart built from plain HTML (wraps on phones, readable by screen readers). Rows are keyboard-focusable and announce their value.
function barChart(host, { title, sub, rows, note, min = 0, max }) {
  if (!host || !rows?.length) return;
  const pct = v => Math.max(0, Math.min(100, (v - min) / (max - min) * 100));
  const wrap = el('div', 'viz-card');
  wrap.append(el('h4', '', title), el('p', 'viz-sub', sub));
  const list = el('ul', 'bars');
  rows.forEach(r => {
    const li = el('li', 'bar-row');
    li.tabIndex = 0;
    li.setAttribute('aria-label', r.label + ': ' + r.text);
    li.title = r.label + ': ' + r.text;
    const track = el('span', 'bar-track');
    const fill = el('span', 'bar-fill');
    fill.style.background = r.color;
    track.append(fill);
    if (r.lo != null && r.hi != null) {
      const ci = el('span', 'bar-ci');
      ci.style.left = pct(r.lo) + '%';
      ci.style.width = Math.max(0, pct(r.hi) - pct(r.lo)) + '%';
      track.append(ci);
    }
    li.append(el('span', 'bar-label', r.label), track, el('span', 'bar-value', r.text));
    list.append(li);
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = pct(r.value) + '%'; }));
  });
  wrap.append(list);
  if (note) wrap.append(el('p', 'viz-note', note));
  host.replaceChildren(wrap);
  host.hidden = false;
}

// Views: one part of the page at a time, with the evidence behind tabs. Every section stays in the HTML; the page only starts hiding parts once this has run
// (html.views-on), so if anything here fails the whole page is still shown exactly as before.
(function initViews() {
  try {
    const views = [...document.querySelectorAll('[data-view]')];
    const tabs = [...document.querySelectorAll('.evidence [role=tab]')];
    const panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));
    if (views.length < 4 || !tabs.length || panels.some(p => !p)) return;
    const navFor = { overview: '#overview', evidence: '#evidence', map: '#atlas', about: '#about' };   // the Evidence view now has four tabs
    const rootEl = document.documentElement;
    const available = () => tabs.filter((t, i) => !panels[i].hidden);
    function syncTabs() {
      tabs.forEach((t, i) => { t.hidden = panels[i].hidden; });
      const active = panels.findIndex(p => p.classList.contains('is-active'));
      if (active >= 0 && panels[active].hidden) { const first = available()[0]; if (first) selectPanel(panels[tabs.indexOf(first)]); }
    }
    function selectPanel(panel) {
      panels.forEach((p, i) => {
        const on = p === panel;
        p.classList.toggle('is-active', on);
        tabs[i].setAttribute('aria-selected', String(on));
        tabs[i].tabIndex = on ? 0 : -1;
      });
    }
    function route(hash, user) {
      const id = decodeURIComponent((hash || '').replace(/^#/, ''));
      const target = id ? document.getElementById(id) : null;
      const viewEl = (target && views.find(v => v.contains(target))) || views.find(v => v.dataset.view === 'overview');
      const name = viewEl.dataset.view;
      views.forEach(v => v.classList.toggle('is-active', v === viewEl));
      if (name === 'evidence') {
        const hit = target && panels.find(p => p === target || p.contains(target));
        const pick = hit && !hit.hidden ? hit : panels.find(p => !p.hidden) || panels[0];
        selectPanel(pick);
      }
      document.querySelectorAll('.masthead nav a[href^="#"]').forEach(link => {
        if (link.getAttribute('href') === navFor[name]) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
      });
      rootEl.dataset.currentView = name;            // not data-view: that attribute marks the views themselves
      if (typeof map !== 'undefined' && map) setTimeout(() => map.invalidateSize({ pan: false }), 60);
      const goTop = !target || target === viewEl;
      requestAnimationFrame(() => {
        if (goTop) window.scrollTo({ top: 0 });
        else (name === 'evidence' ? document.getElementById('evidence') : target).scrollIntoView({ block: 'start' });
        if (user) viewEl.focus({ preventScroll: true });
      });
    }
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => { location.hash = '#' + panels[i].id; });
      tab.addEventListener('keydown', ev => {
        const list = available();
        const at = list.indexOf(tab);
        let next = null;
        if (ev.key === 'ArrowRight') next = list[(at + 1) % list.length];
        else if (ev.key === 'ArrowLeft') next = list[(at - 1 + list.length) % list.length];
        else if (ev.key === 'Home') next = list[0];
        else if (ev.key === 'End') next = list[list.length - 1];
        if (next) { ev.preventDefault(); next.focus(); location.hash = '#' + panels[tabs.indexOf(next)].id; }
      });
    });
    window.addEventListener('hashchange', () => route(location.hash, true));
    if ('MutationObserver' in window) panels.forEach(p => new MutationObserver(syncTabs).observe(p, { attributes: true, attributeFilter: ['hidden'] }));
    rootEl.classList.add('views-on');
    route(location.hash, false);
    syncTabs();
  } catch (error) {
    document.documentElement.classList.remove('views-on');   // fall back to the full page
  }
})();

// Water-levels tab: filled only from validated data (data/processed/groundwater_summary.json); hidden if anything is missing or malformed.
async function loadGroundwater() {
  try {
    if (window.ATLAS_PREVIEW_DATA && 'groundwater_summary.json' in window.ATLAS_PREVIEW_DATA) return cleanGroundwater(window.ATLAS_PREVIEW_DATA['groundwater_summary.json']);
    const response = await fetch(new URL('groundwater_summary.json', DATA), { cache: 'no-cache' });
    return response.ok ? cleanGroundwater(await response.json()) : null;
  } catch { return null; }
}
function renderGroundwater(g) {
  const section = $('#overview-groundwater');
  if (!section) return;
  if (!g) { section.hidden = true; return; }
  const one = x => (Math.round(x * 10) / 10).toFixed(1), two = x => (Math.round(x * 100) / 100).toFixed(2);
  const s1 = x => (Math.round(x * 10) === 0 ? '0.0' : (x < 0 ? '\u2212' : '') + one(Math.abs(x))), s2 = x => (x < 0 ? '\u2212' : '') + two(Math.abs(x));
  const values = { wells: String(g.wells), from: String(g.from), to: String(g.to), 'recent-from': String(g.recentFrom), 'recent-to': String(g.recentTo),
    drop: String(Math.round(g.drop)), decline: one(g.decline), years: String(Math.round(g.years)), deeper: String(Math.round(g.deeper)),
    rho: s2(g.rho), 'rho-lo': s2(g.rhoLo), 'rho-hi': s2(g.rhoHi), tiles: String(g.tiles), ratio: one(g.ratio),
    'q0-rate': s1(g.q[0].rate), 'q1-rate': s1(g.q[1].rate), 'q2-rate': s1(g.q[2].rate), 'q3-rate': s1(g.q[3].rate), 'q0-sink': String(Math.round(g.q[0].sinking)) };
  section.querySelectorAll('[data-gw]').forEach(node => { node.textContent = values[node.dataset.gw] ?? ''; });
  const colors = ['#8a9a84', '#d9a58c', '#c77d5e', '#a64b2a'];
  barChart($('#viz-groundwater'), {
    title: 'The faster the water table falls, the faster the ground sinks', sub: 'Wells in four equal groups by how fast their water fell (feet per year). Bar: typical sinking rate around those wells (cm/yr).', max: 2.5,
    rows: g.q.map((x, i) => ({ label: one(x.lo) + ' to ' + one(x.hi) + ' ft/yr (' + x.n + ' wells)', value: Math.max(0, -x.rate), text: s1(x.rate) + ' cm/yr', color: colors[i] })),
    note: 'Water levels: USGS and ADWR well measurements. Sinking: ten-year Sentinel-1 rate. Association, not cause.' });
  section.hidden = false;
}
loadGroundwater().then(renderGroundwater);

// Menu button for phones and small tablets: opens and closes the navigation; closes on choosing an item, tapping outside or Escape.
// The CSS only collapses the menu once html.nav-js is set here, so if this fails the full menu stays visible.
(function initMenu() {
  try {
    const head = document.querySelector('.masthead'), btn = document.querySelector('.nav-toggle'), nav = document.getElementById('site-nav');
    if (!head || !btn || !nav) return;
    const set = open => {
      head.classList.toggle('nav-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    btn.addEventListener('click', () => set(!head.classList.contains('nav-open')));
    nav.addEventListener('click', ev => { if (ev.target.closest('a, button')) set(false); });
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && head.classList.contains('nav-open')) { set(false); btn.focus(); } });
    document.addEventListener('click', ev => { if (head.classList.contains('nav-open') && !head.contains(ev.target)) set(false); });
    window.matchMedia?.('(min-width: 861px)')?.addEventListener?.('change', ev => { if (ev.matches) set(false); });
    document.documentElement.classList.add('nav-js');
  } catch (error) {
    document.documentElement.classList.remove('nav-js');
  }
})();

// Subsurface geology for the selected study area: a schematic layer column (top = surface), facts with their sources, our measured values.
let GEOLOGY = null;
loadJSON('geology.json', cleanGeology).then(result => {
  GEOLOGY = result.status === 'ready' ? result.value : null;
  if (GEOLOGY && state.selected && !document.querySelector('#detail-content .geology')) renderDetails();
});
const GEO_KIND_LABEL = { sand: 'Sand and gravel', clay: 'Clay or silt', mixed: 'Mixed sand, silt and clay', consolidated: 'Older, firmer fill', evaporite: 'Salt and gypsum beds', rock: 'Bedrock' };
function renderGeology(slug) {
  const g = GEOLOGY?.areas?.[slug];
  if (!g) return null;
  const box = section('What lies beneath');
  box.classList.add('geology');
  box.append(el('p', 'geology-basin', g.basin), el('p', 'detail-copy', g.summary));
  const figure = el('figure', 'geo-figure');
  const column = el('ol', 'geo-column');
  column.setAttribute('aria-label', 'Layers from the surface down (schematic, not to scale)');
  const top = el('li', 'geo-surface'); top.append(el('span', '', 'Ground surface')); column.append(top);
  g.layers.forEach(layer => {
    const li = el('li', 'geo-layer kind-' + layer.kind);
    const swatch = el('span', 'geo-swatch'); swatch.setAttribute('aria-hidden', 'true');
    const text = el('div', 'geo-text');
    const name = el('strong', '', layer.name);
    text.append(name, el('span', 'geo-kind', GEO_KIND_LABEL[layer.kind]), el('p', '', layer.note));
    if (layer.compacts) text.append(el('span', 'geo-compacts', 'Compacts when the water level falls'));
    li.append(swatch, text);
    column.append(li);
  });
  figure.append(column, el('figcaption', '', 'Schematic order of layers from the sources below, not to scale.'));
  const grid = el('div', 'geo-grid'), side = el('div', 'geo-side');
  grid.append(figure, side); box.append(grid);
  const m = g.measured;
  const facts = [];
  if (isNumber(m.rate)) facts.push(['Ground motion', formatNumber(m.rate) + ' cm/yr (Sentinel-1, 2016\u20132026, line of sight)']);
  facts.push(['Water table', isNumber(m.decline) ? 'falling about ' + formatNumber(m.decline) + ' ft a year (median of ' + m.wells + ' wells, 1980s\u201390s to 2015\u201325)' : 'no wells in our water-level data for this area']);
  side.append(el('h3', 'geo-subhead', 'What we measured here'), factList(facts));
  side.append(el('h3', 'geo-subhead', 'What the studies say'));
  const list = el('ul', 'geo-facts');
  g.facts.forEach(f => {
    const li = el('li', '', f.text + ' ');
    const src = g.sources.find(s => s.id === f.source);
    if (src) { const link = el('a', 'geo-cite', '(' + src.short + ')'); link.href = src.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; li.append(link); }
    list.append(li);
  });
  side.append(list);
  if (g.caveat) side.append(note(g.caveat));
  const more = el('details', 'more');
  more.append(el('summary', '', 'Sources for this area'));
  const srcList = el('ul', 'geo-sources');
  g.sources.forEach(s => { const li = el('li'); const link = el('a', '', s.label); link.href = s.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; li.append(link); srcList.append(li); });
  more.append(srcList);
  side.append(more);
  return box;
}