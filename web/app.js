import { cleanSoils, cleanGeology, cleanGroundwater, cleanPumping, normalizeSeries, normalizeRate, normalizeHotspots, validateGeoJSON, safeSourceURL, formatNumber, isNumber, cleanInsights, normalizeCumulative, cleanTeam, cleanNisar } from './model.mjs';

const $ = selector => document.querySelector(selector);
// Reading level: 'plain' (default, for everyone) or 'research' (detail for researchers and water engineers). Set on <html data-audience>.
const aud = () => document.documentElement.dataset.audience === 'research' ? 'research' : 'plain';
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
// The graph is drawn W units wide (300 by default, the original drawing). When the panel is widened, W grows instead of the
// drawing being scaled up, so the text keeps its normal size.
const CHART_BASE_W = 300, CHART_PX_PER_UNIT = 1.3;
function makeChart(series, hooks = null) {
  const wrap = el('div', 'chart');
  let svg = null, W = CHART_BASE_W;
  const valid = series.points.filter(p => isNumber(p.value));
  const stable = series.stablePoints.filter(p => isNumber(p.value));
  const build = () => {
  const drawn = svgNode('svg', { viewBox: '0 0 ' + W + ' 170', role: 'img', 'aria-label': 'Cumulative displacement in centimetres relative to ' + series.reference });
  const svg = drawn;
  const start = Date.parse(series.dates[0]), end = Date.parse(series.dates.at(-1));
  const extent = [...valid, ...stable].map(p => p.value);
  let lo = Math.min(...extent), hi = Math.max(...extent);
  const pad = Math.max((hi - lo) * 0.15, 0.1);
  lo -= pad; hi += pad;
  const x = date => 42 + (Date.parse(date) - start) / (end - start || 1) * (W - 56);
  const y = value => 130 - (value - lo) / (hi - lo) * 112;
  [lo, (lo + hi) / 2, hi].forEach(value => {
    svg.append(svgNode('line', { x1: 42, x2: W - 14, y1: y(value), y2: y(value), stroke: '#C9C0B2', 'stroke-width': 0.7 }));
    svg.append(svgNode('text', { x: 35, y: y(value) + 3, 'text-anchor': 'end', class: 'chart-label' }, formatNumber(value)));
  });
  svg.append(svgNode('text', { x: 35, y: 8, 'text-anchor': 'end', class: 'chart-label chart-unit' }, 'cm'));
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
  if (series.dates.length > 1) svg.append(svgNode('text', { x: W - 14, y: 168, 'text-anchor': 'end', class: 'chart-label' }, series.dates.at(-1)));
  if (hooks) addChartScrubbing(wrap, drawn, series, x, y, sinkPath, stablePath, hooks, W);
  return drawn;
  };
  svg = build();
  wrap.append(svg);
  // Called when the graph panel is resized: redraw at the new width, keeping the normal text size.
  wrap.resizeTo = width => {
    const nextW = Math.round(Math.max(CHART_BASE_W, (width || 0) / CHART_PX_PER_UNIT));
    if (nextW === W) return false;
    W = nextW;
    const fresh = build(); svg.replaceWith(fresh); svg = fresh;
    return true;
  };
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
function addChartScrubbing(wrap, svg, series, x, y, sinkPath, stablePath, hooks, W = 300) {
  const n = series.points.length;
  const hidden = { visibility: 'hidden', 'pointer-events': 'none' };
  const cursor = svgNode('line', { y1: 12, y2: 130, stroke: COLORS.ink, 'stroke-width': 0.8, 'stroke-dasharray': '2 2', ...hidden });
  const dotSink = svgNode('circle', { r: 4, fill: COLORS.rust, stroke: '#F4EFE6', 'stroke-width': 1, ...hidden });
  const dotStable = svgNode('circle', { r: 3.5, fill: COLORS.slate, stroke: '#F4EFE6', 'stroke-width': 1, ...hidden });
  const tip = svgNode('g', hidden);
  const tipBox = svgNode('rect', { rx: 2, fill: '#F4EFE6', stroke: '#C9C0B2', 'stroke-width': 0.7, opacity: 0.96 });
  const tipText = svgNode('text', { class: 'chart-tip' });
  tip.append(tipBox, tipText);
  const hit = svgNode('rect', { x: 42, y: 8, width: W - 56, height: 126, fill: 'transparent', style: 'touch-action:pan-y;cursor:crosshair' });
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
    const w = Math.max(...lines.map(t => t.length)) * 4.9 + 14, h = lines.length * 11 + 7, tx = px > W / 2 + 10 ? px - w - 7 : px + 7;
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
    const r = svg.getBoundingClientRect(), px = (clientX - r.left) / (r.width || W) * W;
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
  const bar = document.getElementById('map-time-bar'); if (bar) { bar.hidden = true; bar.replaceChildren(); }
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
      const scale = el('span', 'timelapse-labels');
      scale.append(el('span', '', formatNumber(meta.vmin) + ' cm'), el('span', '', '0'), el('span', '', '+' + formatNumber(meta.vmax)));
      const strip = el('span', 'timelapse-strip'); strip.setAttribute('aria-hidden', 'true');
      legend.append(el('strong', '', 'Ground change since ' + monthYear(meta.dates[0])), el('div', 'legend-asof', 'As of ' + monthYear(meta.dates[index])),
        strip, scale, el('small', '', 'Red = lower than at the start (' + meta.dates[0] + '). Blank = not measured.'));
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
// Graph panel on the map (laptops): minimize to a slim bar, expand to the map's width, or drag the left edge to any width.
// The size is kept when another study area is opened. Phones show the graph under the map, so these tools are hidden there.
const CHART_MIN_W = 280;
function chartPanelTools(panel) {
  const size = state.chartSize || (state.chartSize = { mode: 'normal', width: null });
  const tools = el('div', 'chart-tools');
  tools.append(el('span', 'chart-tools-title', 'Graph'));
  const btn = (cls, label) => { const b = el('button', 'chart-tool ' + cls); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; const i = el('span', 'chart-tool-icon'); i.setAttribute('aria-hidden', 'true'); b.append(i); return b; };
  const minBtn = btn('tool-min', 'Minimize graph'), maxBtn = btn('tool-max', 'Expand graph');
  tools.append(minBtn, maxBtn);
  const handle = el('div', 'chart-resize');
  handle.setAttribute('role', 'separator'); handle.setAttribute('aria-orientation', 'vertical'); handle.tabIndex = 0;
  handle.setAttribute('aria-label', 'Resize graph. Use the left and right arrow keys, or drag.');
  panel.prepend(handle, tools);
  const maxWidth = () => Math.max(CHART_MIN_W, (panel.parentElement?.clientWidth || 900) - 40);
  const apply = () => {
    panel.classList.toggle('is-min', size.mode === 'min');
    panel.classList.toggle('is-max', size.mode === 'max');
    const w = size.mode === 'max' ? maxWidth() : size.width;
    if (w && size.mode !== 'min') { panel.style.setProperty('--chart-w', Math.round(Math.min(maxWidth(), Math.max(CHART_MIN_W, w))) + 'px'); panel.classList.add('has-w'); }
    else { panel.style.removeProperty('--chart-w'); panel.classList.remove('has-w'); }
    minBtn.setAttribute('aria-label', size.mode === 'min' ? 'Show graph' : 'Minimize graph'); minBtn.title = minBtn.getAttribute('aria-label');
    minBtn.setAttribute('aria-expanded', String(size.mode !== 'min'));
    maxBtn.setAttribute('aria-label', size.mode === 'max' ? 'Return graph to normal size' : 'Expand graph'); maxBtn.title = maxBtn.getAttribute('aria-label');
    maxBtn.setAttribute('aria-pressed', String(size.mode === 'max'));
    handle.hidden = size.mode === 'min';
    const now = Math.round(panel.getBoundingClientRect().width) || CHART_MIN_W;
    handle.setAttribute('aria-valuemin', String(CHART_MIN_W)); handle.setAttribute('aria-valuemax', String(maxWidth())); handle.setAttribute('aria-valuenow', String(now));
    const chart = panel.querySelector('.chart');
    if (chart?.resizeTo) {
      const redraw = () => {
        const resized = panel.classList.contains('has-w') && !panel.classList.contains('is-min');
        if (!chart.resizeTo(resized ? chart.clientWidth : 0)) return;
        const t = state.time;
        if (t?.chart === chart) { chart.setCursor?.(t.hover ?? t.pinned); chart.emphasise?.(t.masks.sinking ? 'sinking' : t.masks.stable ? 'stable' : null); }
      };
      if (panel.classList.contains('is-resizing')) redraw(); else requestAnimationFrame(redraw);
    }
  };
  minBtn.addEventListener('click', () => { size.mode = size.mode === 'min' ? 'normal' : 'min'; apply(); });
  maxBtn.addEventListener('click', () => { size.mode = size.mode === 'max' ? 'normal' : 'max'; apply(); });
  const setWidth = w => { size.mode = 'normal'; size.width = Math.min(maxWidth(), Math.max(CHART_MIN_W, w)); apply(); };
  handle.addEventListener('keydown', ev => {
    const w = panel.getBoundingClientRect().width || size.width || 400;
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); setWidth(w + 40); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); setWidth(w - 40); }
    else if (ev.key === 'Home') { ev.preventDefault(); setWidth(CHART_MIN_W); }
    else if (ev.key === 'End') { ev.preventDefault(); setWidth(maxWidth()); }
  });
  handle.addEventListener('pointerdown', ev => {
    ev.preventDefault();
    const startX = ev.clientX, startW = panel.getBoundingClientRect().width;
    panel.classList.add('is-resizing');
    const move = e => setWidth(startW + (startX - e.clientX));
    const up = () => { panel.classList.remove('is-resizing'); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });
  apply();
}
// Compact controls: a round play button and two real checkboxes whose colour squares match the map.
// On phones they float on the map itself, so the effect is visible where you tap (no scrolling back and forth).
const PHONE = window.matchMedia ? window.matchMedia('(max-width: 800px)') : { matches: false };
function placeTimeControls() {
  const node = state.time?.ui?.node, bar = $('#map-time-bar');
  if (!node || !bar) return;
  const home = state.time.ui.home;
  if (PHONE.matches) { bar.replaceChildren(node); bar.hidden = false; }
  else { if (home && node.parentNode !== home) home.append(node); bar.hidden = true; bar.replaceChildren(); }
}
if (PHONE.addEventListener) PHONE.addEventListener('change', placeTimeControls);
function makeTimeControls() {
  const t = state.time, node = el('div', 'time-controls'), idle = 'Move along the chart to watch the map change. Click (or tap) to hold a date.';
  const play = el('button', 'time-play'); play.type = 'button'; play.setAttribute('aria-pressed', 'false');
  const icon = el('span', 'time-play-icon'); icon.setAttribute('aria-hidden', 'true');
  const playText = el('span', 'time-play-text', 'Play');
  play.append(icon, playText);
  const check = (label, kind) => {
    const wrap = el('label', 'time-check kind-' + kind), box = el('input');
    box.type = 'checkbox'; box.dataset.kind = kind;
    const swatch = el('span', 'time-swatch'); swatch.setAttribute('aria-hidden', 'true');
    const [first, ...rest] = label.split(' ');
    const text = el('span', 'time-check-text', first);
    if (rest.length) text.append(el('span', 'time-check-extra', ' ' + rest.join(' ')));
    wrap.append(box, swatch, text);
    return { wrap, box };
  };
  const sink = check('Sinking area', 'sinking'), stab = check('Stable ground', 'stable');
  const back = el('button', 'time-reset', 'Back to the rate map'); back.type = 'button';
  const chip = el('span', 'time-date'); chip.hidden = true;
  const status = el('p', 'metric-note time-status', idle); status.setAttribute('aria-live', 'polite');
  const row = el('div', 'time-row'); row.append(play, sink.wrap, stab.wrap, chip, back); node.append(row, status);
  if (!t.meta.masks.sinking) sink.wrap.hidden = true;
  if (!t.meta.masks.stable) stab.wrap.hidden = true;
  const ui = { node, home: null, sync() {
    const index = t.hover ?? t.pinned, playing = Boolean(t.timer);
    playText.textContent = playing ? 'Pause' : 'Play';
    play.setAttribute('aria-label', playing ? 'Pause' : 'Play through time');
    play.setAttribute('aria-pressed', String(playing)); play.classList.toggle('is-playing', playing);
    sink.box.checked = Boolean(t.masks.sinking); stab.box.checked = Boolean(t.masks.stable);
    back.hidden = t.pinned == null && !playing;
    node.classList.toggle('has-date', index != null);
    chip.hidden = index == null; chip.textContent = index == null ? '' : monthYear(t.meta.dates[index]);
    status.textContent = index == null ? idle : 'Map: total change since ' + t.meta.dates[0] + ', as of ' + t.meta.dates[index] + (t.hover == null && t.pinned === index ? ' (held)' : '') + '.';
  } };
  play.addEventListener('click', togglePlay);
  sink.box.addEventListener('change', () => { if (sink.box.checked !== Boolean(t.masks.sinking)) toggleMask('sinking'); });
  stab.box.addEventListener('change', () => { if (stab.box.checked !== Boolean(t.masks.stable)) toggleMask('stable'); });
  back.addEventListener('click', () => timeHooks().clear());
  ui.sync();
  return ui;
}
// Research view: the numbers behind the headline rate, straight from the exported record (nothing is recomputed in the browser).
function renderResearchStats(root, s) {
  if (!s || !isNumber(s.rate_cm_yr)) return;
  const box = el('section', 'research-stats detail-section'); box.dataset.aud = 'research';
  const head = el('div', 'detail-section-heading'); head.append(el('h2', '', 'Key statistics')); box.append(head);
  const rows = [['Fitted rate', formatNumber(s.rate_cm_yr) + (isNumber(s.rate_sigma) ? ' \u00b1 ' + formatNumber(s.rate_sigma) : '') + ' cm/yr, line of sight']];
  if (isNumber(s.rate_sigma_fit_only) && isNumber(s.rate_sigma_systematic)) rows.push(['Uncertainty budget', 'Fit error ' + formatNumber(s.rate_sigma_fit_only) + ' and systematic term ' + formatNumber(s.rate_sigma_systematic) + ' cm/yr, combined in quadrature']);
  if (isNumber(s.area_km2) && isNumber(s.sinking_threshold_cm_yr)) rows.push(['Sinking area', formatNumber(s.area_km2) + ' km\u00b2 of pixels at or below ' + formatNumber(s.sinking_threshold_cm_yr) + ' cm/yr (300 m cells)']);
  if (isNumber(s.median_rate_cm_yr)) rows.push(['Median of those pixels', formatNumber(s.median_rate_cm_yr) + ' cm/yr']);
  if (isNumber(s.p5_rate_cm_yr) && isNumber(s.fastest_rate_cm_yr)) rows.push(['Fastest 5% and fastest cell', formatNumber(s.p5_rate_cm_yr) + ' and ' + formatNumber(s.fastest_rate_cm_yr) + ' cm/yr']);
  const asc = s.ascending_check;
  rows.push(['Ascending-track check', asc && isNumber(asc.median_rate) ? 'median ' + formatNumber(asc.median_rate) + ' cm/yr over ' + new Intl.NumberFormat('en-US').format(asc.n_px) + ' cells (5th percentile ' + formatNumber(asc.p5_rate) + ')' : 'not available: this area is outside the ascending frame']);
  const c = s.adwr_comparison;
  if (c && isNumber(c.corr_s1)) rows.push(['ADWR comparison', 'Sentinel-1 pattern correlation ' + formatNumber(c.corr_s1) + (isNumber(c.corr_rs2) ? '; RADARSAT-2 ' + formatNumber(c.corr_rs2) : '') + (isNumber(c.diff_s1) ? '; our median minus ADWR\u2019s ' + formatNumber(c.diff_s1) + ' cm/yr' : '')]);
  rows.push(['Record', s.dates.length + ' dates, ' + s.dates[0] + ' to ' + s.dates.at(-1) + (s.track ? ' \u00b7 ' + s.track : '')]);
  if (s.reference) rows.push(['Reference', s.reference]);
  box.append(factList(rows));
  root.append(box);
}
function renderInsights(root, series) {
  const ins = cleanInsights(series?.insights);
  if (!ins) return;
  const box = el('section', 'insights report-highlights');
  const header = el('div', 'insights-header'), heading = el('div', 'insights-heading');
  heading.append(el('span', 'report-eyebrow', 'AT A GLANCE'), el('h2', 'insights-title', 'What the satellites show'));
  const help = explainButton('confidence'); help.textContent = 'Explain confidence ↗︎';
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
    if (![0, 2, 3].includes(index)) item.dataset.aud = 'research';   // everyone: what we found, why it sinks, why it matters
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
const FIELD_NOTES_PLAIN = {
  confidence: ['How sure are we?', 'Confidence says how strong the evidence is, not how worrying a place is. More observations, a good reference and two viewing directions that agree make us more confident.', 'Confidence labels come from our processed data.'],
  rate: ['What does the speed mean?', 'It is how fast the ground moved over the period we measured. The radar looks at a slant, so this is not exactly the straight-down sinking rate. A minus sign means sinking.', 'The \u00b1 number is the margin of error. A speed on its own does not tell us the cause.'],
  chart: ['How do I read the graph?', 'Each dot is a real measurement on a real date. Tap or focus a dot to see its date and value. A gap means no measurement, not zero movement.', 'The dashed line is stable ground. It shows how big the measurement noise is.'],
  record: ['Why do the details matter?', 'Which satellite, orbit, direction and dates we used decide what can fairly be compared with what.', 'Different viewing angles or time periods cannot simply be mixed.'],
  validation: ['What does the official comparison show?', 'The state water agency (ADWR) publishes its own radar results. We compare ours with theirs over the same ground to see whether they agree.', 'Agreement is a good sign, but the periods and methods differ, so it is not a full proof.'],
  study: ['What is a study outline?', 'The box shows the area we chose to study. It is not the exact shape of the sinking ground.', ''],
  directions: ['Why two viewing directions?', 'On some orbits the satellite sees the ground from one side and on others from the other side. If both show sinking, it is much more likely to be real.', 'One direction alone cannot tell us exactly how much of the movement is straight down.']
};
function showFieldNote(title, description, footnote = '') {
  $('#explain-title').textContent = title;
  $('#explain-text').textContent = description;
  $('#explain-note').textContent = footnote;
  $('#explain-drawer').hidden = false;
}
function explainButton(key) {
  const button = el('button', 'explain-trigger', 'Explain ↗︎'); button.type = 'button';
  button.setAttribute('aria-label', 'Explain: ' + FIELD_NOTES[key][0]);
  button.addEventListener('click', () => showFieldNote(...(aud() === 'research' ? FIELD_NOTES : FIELD_NOTES_PLAIN)[key]));
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
  const look = lookCard(p.confirmation, series);
  if (look) root.append(look);
  const summaryPanel = el('div', 'report-summary');
  renderInsights(summaryPanel, series);
  renderResearchStats(summaryPanel, series);
  const hasRate = series && isNumber(series.rate_cm_yr);
  const metric = el('section', 'metric' + (hasRate ? '' : ' pending'));
  const labelPlain = el('p', 'metric-label', 'How fast the ground is sinking'); labelPlain.dataset.aud = 'plain';
  const labelResearch = el('p', 'metric-label', 'Reported displacement rate · line of sight'); labelResearch.dataset.aud = 'research';
  metric.append(labelPlain, labelResearch);
  const value = el('div', 'metric-value', hasRate ? formatNumber(series.rate_cm_yr) : 'Measurement pending');
  if (hasRate) value.append(el('small', '', (isNumber(series.rate_sigma) ? '± ' + formatNumber(series.rate_sigma) + ' ' : '') + 'cm/yr'));
  metric.append(value);
  if (hasRate) {
    const plainNote = note('A minus sign means the ground is sinking. The \u00b1 number is the margin of error. Measured along the satellite\u2019s slanted view.'); plainNote.dataset.aud = 'plain';
    const n1 = note(isNumber(series.rate_sigma) ? (series.rate_sigma_note || 'Uncertainty supplied by the processing pipeline.') : 'Uncertainty has not been supplied.'); n1.dataset.aud = 'research';
    const n2 = note(series.sign_convention || 'Sign convention not supplied. This value is not labelled as vertical sinking.'); n2.dataset.aud = 'research';
    metric.append(plainNote, n1, n2);
  } else metric.append(note(dataError(result, 'Awaiting a referenced time series and fitted rate.')));
  const rateHelp = explainButton('rate'); rateHelp.textContent = 'Explain this rate ↗︎';
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
    if (timeMeta) { const ui = makeTimeControls(); state.time.ui = ui; ui.home = chartSection; chartSection.append(ui.node); }
  } else {
    const wait = el('div', 'chart-wait');
    wait.append(el('span', 'waiting-mark'), el('p', '', 'No observations to plot yet'), el('small', '', dataError(result, 'The chart will use the measured record. Pending does not mean zero movement.')));
    chartSection.append(wait);
  }
  const chartTarget = $('#study-chart');
  chartTarget.hidden = false;
  chartTarget.replaceChildren(chartSection);
  placeTimeControls();
  const chartFooter = el('a', 'map-chart-details', 'Read the full ' + p.name + ' study report ↓');
  chartFooter.href = '#details';
  chartTarget.append(chartFooter);
  chartPanelTools(chartTarget);
  const technical = el('div', 'report-methods'); technical.dataset.aud = 'research';
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
    ['methods', 'Methods & checks', methodsPanel(series, technical)]
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
  const capPlain = el('figcaption', '', 'Red means the ground is lower than it was in ' + monthYear(meta.dates[0]) + '. Blank means we could not measure it, not that nothing moved. The white line is the study area.'); capPlain.dataset.aud = 'plain';
  const capResearch = el('figcaption', '', 'Red: ground lower than in ' + monthYear(meta.dates[0]) + ', measured along the satellite\u2019s slanted view (Sentinel-1). Blank: not measured at every date, not zero. White line: study outline.'); capResearch.dataset.aud = 'research';
  fig.append(box, controls, legend, capPlain, capResearch);
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
// "Both look directions" / "single look direction", explained in a small card: what it means and how it was recorded.
// Sentinel-1 views the ground from two opposite angles: southbound (descending) and northbound (ascending) passes.
function lookCard(status, series) {
  if (status !== 'both look directions' && status !== 'single look direction') return null;
  const both = status === 'both look directions';
  const card = el('section', 'look-card ' + (both ? 'look-both' : 'look-single'));
  card.setAttribute('aria-label', 'Look direction');
  const icon = el('span', 'look-icon'); icon.setAttribute('aria-hidden', 'true');
  icon.append(el('i', 'look-arrow down'));
  if (both) icon.append(el('i', 'look-arrow up'));
  const body = el('div', 'look-body');
  body.append(el('strong', 'look-title', both ? 'Seen from both sides' : 'Seen from one side only'));
  body.append(el('p', 'look-line', both
    ? 'The Sentinel-1 satellite looks at this ground from two opposite angles, on its southbound (descending) and northbound (ascending) passes. Both views show it sinking, so it is unlikely to be a measurement error.'
    : 'Only the satellite\u2019s southbound (descending) passes cover this area in our data. Without the opposite view we cannot rule out a measurement error, so treat this result as unconfirmed.'));
  const asc = series?.ascending_check;
  const rec = ['Southbound: ' + (series?.track || 'Sentinel-1 descending')];
  if (both) rec.push('Northbound: Sentinel-1 ascending frame 5125' + (asc && isNumber(asc.median_rate) ? ' (median ' + formatNumber(asc.median_rate) + ' cm/yr over ' + asc.n_px + ' measured cells)' : ''));
  else rec.push('Our northbound (ascending) frame does not reach this area');
  rec.push('2016\u20132026, OPERA DISP-S1');
  const recorded = el('p', 'look-record', 'How it was recorded: ' + rec.join(' \u00b7 ') + '.'); recorded.dataset.aud = 'research';
  body.append(recorded);
  card.append(icon, body);
  return card;
}
// Study report tabs. The chosen tab is kept when another study area is opened, so areas can be compared section by section.
// Methods & checks: everyone gets "how sure are we, what could be wrong, does the official record agree"; research also gets the full technical record.
function methodsPanel(series, technical) {
  const wrap = el('div', 'report-methods-wrap');
  const plain = el('div', 'report-methods-plain'); plain.dataset.aud = 'plain';
  const ins = cleanInsights(series?.insights);
  const sure = section('How sure are we?');
  if (ins?.confidence) {
    sure.append(factList([[ins.confidence.where_label, 'Confidence: ' + ins.confidence.where], [ins.confidence.how_fast_label, 'Confidence: ' + ins.confidence.how_fast]]));
  } else sure.append(el('p', 'detail-copy', 'We have not rated our confidence for this area yet.'));
  plain.append(sure);
  const wrong = section('What could make this wrong?');
  const list = el('ul', 'plain-bullets');
  ['The radar looks at a slant, so this is not exactly the straight-down sinking.', 'The ground we compare against is not perfectly still, so a few millimetres a year of error is possible.', 'A match with farming or wells does not prove who or what caused the sinking.'].forEach(t => list.append(el('li', '', t)));
  wrong.append(list); plain.append(wrong);
  const agree = section('Does the state\u2019s own radar record agree?', 'validation');
  const c = series?.adwr_comparison;
  if (c && isNumber(c.corr_s1)) {
    agree.append(el('p', 'detail-copy', c.corr_s1 >= 0.9
      ? 'Yes. Over the same ground, our map and the Arizona Department of Water Resources\u2019 map agree closely (match score ' + formatNumber(c.corr_s1) + ' out of 1).'
      : 'Only partly. Over the same ground, our map and the Arizona Department of Water Resources\u2019 map agree weakly (match score ' + formatNumber(c.corr_s1) + ' out of 1), so treat this area\u2019s result with more care.'));
  } else agree.append(el('p', 'detail-copy', 'We have not compared this area with the state\u2019s record yet.'));
  plain.append(agree);
  wrap.append(plain, technical);
  return wrap;
}
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
const METHOD_PLAIN = `<p>A satellite sends a radar pulse down and times the echo, so it knows how far away the ground is. Each time it passes over the same spot, it can tell whether the ground moved closer or farther by a few millimetres.</p><ol><li><strong>Compare two passes.</strong> If the ground moved between two passes, the radar waves come back slightly out of step. That shift tells us how far it moved.</li><li><strong>Add up many passes.</strong> One pair is noisy, so we add up many over years. Steady sinking builds up; random noise cancels out.</li><li><strong>Check it twice.</strong> We compare two satellites (Sentinel-1 for ten years, NASA\u2019s new NISAR for its first year), two viewing directions, and the state\u2019s own radar results.</li></ol><p>Numbers are measured along the satellite\u2019s slanted view, not straight down.</p>`;
const METHOD_RESEARCH = `<p>Interferometric SAR (InSAR) measures the change in round-trip phase between two acquisitions. For L-band NISAR (wavelength 24.2 cm) one radian of unwrapped phase is about 19 mm of line-of-sight displacement, d = \u2212(\u03bb / 4\u03c0) \u00b7 \u03c6; the sign convention is read from each product.</p><ol><li><strong>Products.</strong> NISAR L2 GUNW (geocoded unwrapped interferograms) and GCOV (polarimetric covariance) from the ASF archive; OPERA Sentinel-1 DISP-S1 (2016\u20132026) as the long record.</li><li><strong>Valid pixels.</strong> Finite phase, a nonzero connected component, and phase not exactly zero (fill values).</li><li><strong>Corrections.</strong> NISAR: the ionosphere screen is subtracted and the troposphere and solid-earth-tide screens shipped in the product metadata are applied; the troposphere sign was chosen empirically by testing both. Sentinel-1: the solid-earth-tide and ionosphere layers are subtracted; tropospheric delay is not corrected.</li><li><strong>Reference.</strong> Motion is relative to stable ground (the median of the whole frame for Sentinel-1), so a few mm/yr of reference bias is possible.</li><li><strong>Time series.</strong> Connected pairs on one track are chained using their actual dates and a rate is fitted with an uncertainty. Ascending and descending tracks are never combined directly.</li><li><strong>Uncertainty.</strong> The fit error is combined in quadrature with the larger of half the descending-minus-ascending difference or the difference from ADWR\u2019s own Sentinel-1 rate over the same pixels.</li><li><strong>Checks.</strong> Agreement with the opposite look direction and with ADWR\u2019s Sentinel-1 and RADARSAT-2 products; for NISAR, pattern correlation against Sentinel-1 on a 300 m grid.</li></ol><p>All values are line-of-sight. A vertical rate needs the assumption that the motion is mostly vertical, which we state wherever it is used.</p>`;
const LIMITS_PLAIN = `<ul><li><strong>Empty is not zero.</strong> Where a result is missing or the map is blank, we have no reliable measurement. That does not mean the ground is stable.</li><li><strong>Slanted, not straight down.</strong> Radar measures along its slanted line of view. If the ground moves straight down, the true drop is likely somewhat larger.</li><li><strong>Short records need care.</strong> NISAR has about a year of data at Willcox and under four months at Eloy, so we do not publish a NISAR speed.</li><li><strong>Place is not cause.</strong> A nearby farm or city does not prove it caused the sinking.</li><li><strong>Mines move too.</strong> Open-pit mines shift for reasons unrelated to groundwater. We mark the ones we found.</li></ul>`;
const LIMITS_RESEARCH = '<ul><li><strong>Pending is not zero.</strong> Empty results mean that a file is missing or has not passed the interface checks.</li><li><strong>Radar measures line-of-sight motion.</strong> A vertical sinking rate needs a justified conversion. A positive or negative value is not interpreted without its sign convention.</li><li><strong>Short records need care.</strong> Seasonal movement, atmospheric errors and the stable reference can influence a fitted rate. NISAR\u2019s record is about a year at Willcox and under four months at Eloy, so we do not publish a NISAR speed; one bad acquisition date can move a one-year fit by a centimetre or more.</li><li><strong>Data quality varies.</strong> Farming and construction can reduce coherence. Product corrections and release status must be checked.</li><li><strong>Location does not establish cause.</strong> A nearby farm or city does not prove responsibility for ground movement.</li><li><strong>Radar does not observe wildlife.</strong> Any mention of habitat comes from outside sources, not from this measurement.</li><li><strong>Mines move too.</strong> Open-pit mines and their waste piles shift for reasons unrelated to groundwater. We mark the ones we found.</li><li><strong>Blue patches are probably not real uplift.</strong> Rising values, such as on the Willcox Playa floor, most likely come from wet or swelling soil changing the radar signal. We have not verified this.</li><li><strong>Gaps are not zeros.</strong> Where the map is empty, the radar could not measure reliably (over plowed fields, for example). That does not mean the ground is stable.</li><li><strong>A study box is not a sinking zone.</strong> Outlines show the areas the team chose to investigate.</li><li><strong>Reference and uncertainty.</strong> Sentinel-1 rates are relative to the frame median; a few mm/yr of reference bias is possible and is not separately included in the uncertainty.</li><li><strong>Troposphere.</strong> Not corrected for Sentinel-1; applied for NISAR with the product\u2019s screens.</li><li><strong>Agreement in sign is not agreement in size.</strong> In three of the four areas with an ascending check, the ascending median is a quarter to a third smaller than the descending one.</li><li><strong>Not fully independent.</strong> Our Sentinel-1 rates and ADWR\u2019s Sentinel-1 product share the satellite, so that comparison is a consistency check; RADARSAT-2 is an independent sensor.</li><li><strong>Data vintage.</strong> NISAR data are Provisional (the first Willcox pair is Beta). Wells span the 1980s to 2025, the pumping estimates are for 2024 and the mapped fissures are as of 2016.</li></ul>';
const dialogCopy = {
  method: {
    title: 'How we measure ground motion',
    body: { plain: METHOD_PLAIN, research: METHOD_RESEARCH }
  },
  limits: {
    title: 'Read the map with its limits',
    body: { plain: LIMITS_PLAIN, research: LIMITS_RESEARCH }
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
      <li><a href="https://www.mdpi.com/2076-3263/13/6/176" target="_blank" rel="noopener noreferrer">Job, C., Ochoa, C., Jarvis, W. &amp; Kennedy, R. (2023) · A Spatiotemporal Characterization of Water Resource Conditions and Demands as Influenced by the Hydrogeologic Framework of the Willcox Groundwater Basin, Southeastern Arizona, USA. Geosciences, 13(6), 176</a> — Peer-reviewed study associating agricultural expansion, pumping pressure and groundwater declines; DOI: 10.3390/geosciences13060176. Read in full (open access); see “Papers read” below.</li>
      <li><a href="https://www.sciencedirect.com/science/article/pii/S0034425722000086" target="_blank" rel="noopener noreferrer">Peng, M. et al. (2022) · Mapping land subsidence and aquifer system properties of the Willcox Basin, Arizona, from InSAR observations and independent component analysis. Remote Sensing of Environment, 271, 112894</a> — Journal article that we could not read in full. We use only the authors’ EGU 2022 abstract of the same study (<a href="https://doi.org/10.5194/egusphere-egu22-4147" target="_blank" rel="noopener noreferrer">EGU22-4147</a>); see “Papers read” below.</li>
    </ol>
    <section class="paper-ledger" data-aud="research" aria-labelledby="papers-read">
      <h3 id="papers-read">Papers read, and exactly what we use from each</h3>
      <p>Each entry says how much of the paper we could read, then lists every detail we take from it and where it appears. Conversions between units (km³ to acre-feet, metres to feet, hectares to acres) are ours and are marked as such on the page. Foundational USGS and ADWR reports that we read in full (Brown and Schumann 1969, Coates and Cushman 1955, White and Hardt 1965, Epstein 1987, Galloway and others 1999, Pool and others 2001, Konieczki 2006) are cited fact by fact in the Geology tab.</p>
      <article><h4>Job, Ochoa, Jarvis &amp; Kennedy (2023), <em>Geosciences</em> 13(6), 176 · read in full</h4>
        <p>Used in Evidence › Geology › Willcox (research detail), with one entry for North of Willcox:</p>
        <ul><li>Basin size (about 4,950 km²), fill thickness (up to about 1,800 m), natural recharge (0.02–0.06 km³ a year), irrigation return (0.08 km³ in 2015), storage (51.8–72.8 km³), and shallow water near the playa from confining lake-bed clay.</li>
        <li>Agriculture as 90% of withdrawal (ADWR), pumping of 0.17 km³ in 2000 and 0.26 km³ in 2020 (USGS), the 2020 crop shares (corn 34.5%, alfalfa 20.8%, small grains 19.9%, orchards 9.9%) and 88% average sprinkler efficiency.</li>
        <li>Cropland growth of about 29% (18,326 to 23,652 ha, 2008–2021) and Cropland Data Layer accuracy (97.3–99.2%); registered wells 3,937 to 4,759 and average depth 105.9 to 125.0 m (2006–2021).</li>
        <li>Water-level change at 149 wells (range +4.1 to −38.8 m; 93.2% fell by more than 1 m; the paper&rsquo;s text and table swap mean and median, −13.1 and −13.8 m).</li>
        <li>The 52 index wells (56.4 to 93.2 m depth to water, 2008–2021), the Spearman correlation with cropland (0.89, p &lt; 0.001, n = 14) and the 2031 projections (116.8 m; 27,603 ha), with our note that two rising series correlate without proving cause.</li>
        <li>Rainfall (PRISM 1991–2020: over 950 mm and under 350 mm; Mann-Kendall results at three points), shallow-well exposure (nearly 30% of wells 50 m or less), the $420,000 well cost, the 29.6 km³ ADWR storage forecast, subsidence up to 0.15 m a year and over 60 km of fissures (both cited from ADWR 2019).</li>
        <li>The authors&rsquo; own limits: no pumping record, 2008–2021 land cover only, poorly known hydrogeologic units, hand-drawn contours.</li></ul>
        <p>Not used: its groundwater contour map and cross-sections (we did not re-derive them), and the paper&rsquo;s projections beyond 2031.</p></article>
      <article><h4>Peng, Lu, Zhao, Motagh, Bai &amp; Conway (2022) · abstract only</h4>
        <p>We could not read the Remote Sensing of Environment article (271, 112894), so we use only the authors&rsquo; EGU 2022 abstract of the same study (EGU22-4147). Used in Evidence › Geology › Willcox (&ldquo;Aquifer response&rdquo;): two subsidence zones with a rising mean rate (2006–2020, ALOS and Sentinel-1), storage coefficients (6.0e-4 to 0.02 in 2006–2011; 2.3e-5 to 0.087 in 2015–2020; average 0.008 to 0.005), storage depletion of 3.7e8 m³ in 1990–2006, and the authors&rsquo; reading that the deformation is irreversible. The journal paper may contain more or differ; check it before relying on these numbers.</p></article>
      <article><h4>Smilovsky (2025), GSA Connects abstract · abstract only</h4>
        <p>Used in Evidence › Geology › Willcox (&ldquo;InSAR record&rdquo;, &ldquo;How our numbers compare&rdquo;) and the &ldquo;Can the ground come back?&rdquo; column: two zones above 15 cm/yr, more than 11 ft of cumulative displacement since the mid-20th century, recent wet years giving only temporary, local recharge mainly in playa sediments, and deficits above 100,000 acre-ft a year. No paper was available, so the abstract&rsquo;s methods and uncertainties are unknown to us.</p></article>
      <article><h4>Devlin &amp; Lohman (2025), <em>Earth and Space Science</em> 12(6) · read in full (author preprint)</h4>
        <p>Used in the Farmland caution (Evidence › Farmland) and the Limits: C-band Sentinel-1 over the San Joaquin Valley (129 images, 2019–2021) shows an apparent subsidence bias of about 2–4 cm/yr in some fields, largest in cotton and also seasonal in almond and pistachio orchards, tied to crop growth (NDVI); removing field pixels before filtering reduces it; California&rsquo;s peak subsidence is about 30 cm/yr, so the bias is minor there. We read the preprint, not the final published version, and the paper tests C-band only.</p></article>
      <article><h4>Devlin (2025), Cornell dissertation · abstract only</h4>
        <p>The dissertation is embargoed. From its abstract we use one statement: the largest C-band versus L-band differences were in orchard crops such as almonds and pistachios. Its other findings (co- and cross-polarized data, a per-crop correction) are not used.</p></article>
      <article><h4>Saporta, Gomba &amp; De Zan (2021), EGU21-3503 · abstract only</h4>
        <p>Used in the Farmland caution: a short-term systematic phase bias in a Sentinel-1 stack of 184 images (2014–2018) over eastern Sicily gave velocity errors of up to several mm/yr, correlated with soil moisture and land cover. It is C-band and not from Arizona.</p></article>
    </section>
    <h3>Data and project methods</h3>
    <ul>
      <li><a href="https://github.com/mansi200304/NASA-Hackathon/blob/main/docs/overview_evidence.md" target="_blank" rel="noopener noreferrer">Evidence-to-claim notes, citations and limitations</a></li>
      <li><a href="https://github.com/mansi200304/NASA-Hackathon" target="_blank" rel="noopener noreferrer">Sinkronized · code and pipeline outputs</a></li>
      <li><a href="https://nisar.jpl.nasa.gov/" target="_blank" rel="noopener noreferrer">NASA-ISRO NISAR mission information</a></li>
      <li><a href="https://doi.org/10.5067/NIL2GUNW-P1" target="_blank" rel="noopener noreferrer">NISAR L2 Geocoded Unwrapped Interferogram (GUNW), Provisional · ASF DAAC</a> — DOI 10.5067/NIL2GUNW-P1; the NISAR data processed here.</li>
      <li><a href="https://api.waterdata.usgs.gov/ogcapi/v0/collections/field-measurements" target="_blank" rel="noopener noreferrer">U.S. Geological Survey \u00b7 Water Data API, groundwater field measurements</a> \u2014 depth to water below land surface (parameter 72019), including measurements by the Arizona Department of Water Resources; used for 1980\u20132000 resting water levels.</li>\n      <li><a href="https://services3.arcgis.com/iuNbZYJOrAYBrPyC/ArcGIS/rest/services/Well_Sites/FeatureServer" target="_blank" rel="noopener noreferrer">Arizona Department of Water Resources \u00b7 Groundwater Site Inventory (GWSI) well sites</a> \u2014 each well\u2019s latest water level, used for the recent end of the comparison.</li>\n      <li><a href="https://doi.org/10.5066/P1ZU6T5N" target="_blank" rel="noopener noreferrer">Read, A. L., Kahler, A. J., Porter, T. J. &amp; Potteiger, S. E. \u00b7 Estimated crop irrigation water use withdrawals in Willcox Groundwater Basin, Arizona for 2024 (USGS data release)</a> \u2014 DOI 10.5066/P1ZU6T5N, CC0; field polygons with modelled withdrawals (modified Blaney-Criddle consumptive-use model; no uncertainty stated).</li>
      <li><a href="https://doi.org/10.3133/cir1182" target="_blank" rel="noopener noreferrer">Galloway, D., Jones, D. R. &amp; Ingebritsen, S. E. (1999) \u00b7 Land Subsidence in the United States (USGS Circular 1182)</a> \u2014 why aquifer compaction is largely permanent, and the documented south-central Arizona fissures and infrastructure damage.</li>\n      <li><a href="https://doi.org/10.3133/wsp1859F" target="_blank" rel="noopener noreferrer">Brown, S. G. &amp; Schumann, H. H. (1969) \u00b7 Geohydrology and Water Utilization in the Willcox Basin (USGS Water-Supply Paper 1859-F)</a> \u2014 basin fill and the Lake Cochise clay beneath Willcox Playa.</li>\n      <li><a href="https://doi.org/10.5281/ZENODO.20075813" target="_blank" rel="noopener noreferrer">NISAR Data User Guide (Kristenson et al., 2026) · ASF</a> — DOI 10.5281/ZENODO.20075813; product definitions, maturity levels and availability used throughout this project.</li>
      <li><a href="https://doi.org/10.48577/jpl.UD4HV3" target="_blank" rel="noopener noreferrer">NASA-ISRO SAR (NISAR) Mission Science Users’ Handbook, Second Edition (2025)</a> — DOI 10.48577/jpl.UD4HV3.</li>
      <li><a href="https://doi.org/10.1029/2024EA004062" target="_blank" rel="noopener noreferrer">Devlin, K. R. &amp; Lohman, R. B. (2025) · Evaluation of Vegetation Bias in InSAR Time Series for Agricultural Areas within the San Joaquin Valley, CA. Earth and Space Science, 12(6)</a> — open access; we read the author preprint in full. Sentinel-1 (C-band) phase bias of about 2–4 cm/yr of apparent subsidence in some fields, largest in cotton.</li>
      <li><a href="https://ecommons.cornell.edu/entities/publication/5e298b2f-9ae6-4861-abfe-a8c194323c08" target="_blank" rel="noopener noreferrer">Devlin, K. (2025) · More Than Just Noise: Effects of Vegetation and Agriculture on InSAR Time Series Analysis</a> — Cornell University PhD dissertation, embargoed. We read only its abstract, which reports C-band versus L-band (ALOS-2) differences that are largest in orchard crops such as almonds and pistachios.</li>
      <li><a href="https://meetingorganizer.copernicus.org/EGU21/EGU21-3503.html" target="_blank" rel="noopener noreferrer">Saporta, Gomba &amp; De Zan (2021) · Analyzing an InSAR short-term systematic phase bias with regards to soil moisture and landcover</a> — EGU General Assembly 2021 abstract EGU21-3503 (abstract only); velocity biases of up to several mm per year in a Sentinel-1 stack over eastern Sicily.</li>
      <li><a href="https://doi.org/10.5067/SNWG/OPL3DISPS1-V1" target="_blank" rel="noopener noreferrer">OPERA Surface Displacement from Sentinel-1 (DISP-S1), Version 1 · ASF DAAC</a> — DOI 10.5067/SNWG/OPL3DISPS1-V1; the ten-year record, built from Copernicus Sentinel-1 data (ESA).</li>
      <li><a href="https://registry.opendata.aws/copernicus-dem/" target="_blank" rel="noopener noreferrer">Copernicus 30 m DEM</a> — ground heights used to apply NISAR’s troposphere correction.</li>
      <li><a href="https://search.asf.alaska.edu/" target="_blank" rel="noopener noreferrer">Alaska Satellite Facility · SAR data discovery</a></li>
      <li><a href="https://www.azwater.gov/hydrology/field-services/land-subsidence-arizona" target="_blank" rel="noopener noreferrer">ADWR · Arizona land-subsidence monitoring</a></li>
      <li><a href="https://www.azwater.gov/gis" target="_blank" rel="noopener noreferrer">ADWR GIS · official subsidence areas and radar products</a></li>
      <li><a href="https://sdmdataaccess.sc.egov.usda.gov/" target="_blank" rel="noopener noreferrer">USDA NRCS Soil Survey (SSURGO) · Soil Data Access</a> — surface soils, ecological sites and soil properties for each study area (research view).</li>
      <li><a href="https://azgs.arizona.edu/earth-fissure-study-areas-arizona" target="_blank" rel="noopener noreferrer">Arizona Geological Survey · earth fissure study areas</a> — mapped earth fissures (data as of 2016).</li>
      <li><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap · land-use reference notes</a></li>
    </ul>
    <p><strong>Interpretation:</strong> Groundwater pumping is a documented regional mechanism, and agriculture is a major groundwater-use sector in Willcox. Neither a correlation nor the Sinkronized maps alone can assign an observed pixel to a specific farm, well or other water user.</p>
    <p>Satellite/terrain basemap imagery is served by Esri, with attribution on the map. Mapping software: Leaflet 1.9.4 (BSD-2-Clause). Basemap imagery is geographic context, not a radar measurement.</p>`
  }
};
function openDialog(key) {
  const copy = dialogCopy[key]; if (!copy) return;
  $('#dialog-title').textContent = copy.title;
  $('#dialog-body').innerHTML = typeof copy.body === 'string' ? copy.body : (copy.body[aud()] || copy.body.plain); // Static, locally authored content only.
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
  renderGeoCompare();
  renderAreaStats();
  renderSoilCompare();
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
        const anchor = el('a', '', link.label + ' ↗︎');
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
  renderNisarRecord(n);
  section.hidden = false;
  if (farm) farm.hidden = false;
  const fl = n.farmland, mm = x => (x < 0 ? '\u2212' : x > 0 ? '+' : '') + one(Math.abs(x)) + ' mm';
  const away = x => Math.max(0, -x);
  barChart($('#viz-directions'), {
    title: 'Is the sinking visible from both sides?', subPlain: 'How far the sinking areas moved away from the satellite over ' + dr.span + ' days, in millimetres. A longer bar means more movement.', notePlain: 'Both views move the same way as the ten-year trend predicts.', sub: 'How far the sinking areas moved away from the satellite over ' + dr.span + ' days, relative to the rest (mm). Whiskers: 95% range.',
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
function barChart(host, { title, sub, subPlain, rows, note, notePlain, min = 0, max }) {
  if (!host || !rows?.length) return;
  const pct = v => Math.max(0, Math.min(100, (v - min) / (max - min) * 100));
  const wrap = el('div', 'viz-card');
  wrap.append(el('h4', '', title));
  if (subPlain) { const p1 = el('p', 'viz-sub', subPlain), p2 = el('p', 'viz-sub', sub); p1.dataset.aud = 'plain'; p2.dataset.aud = 'research'; wrap.append(p1, p2); }
  else wrap.append(el('p', 'viz-sub', sub));
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
  if (note && notePlain) { const n1 = el('p', 'viz-note', notePlain), n2 = el('p', 'viz-note', note); n1.dataset.aud = 'plain'; n2.dataset.aud = 'research'; wrap.append(n1, n2); }
  else if (note) wrap.append(el('p', 'viz-note', note));
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
    const audienceOk = node => !(node.dataset.aud === 'research' && aud() === 'plain') && !(node.dataset.aud === 'plain' && aud() === 'research');
    const available = () => tabs.filter((t, i) => !panels[i].hidden && audienceOk(panels[i]));
    let pending = null;   // a deep link to a tab whose data has not arrived yet (its panel starts hidden)
    function syncTabs() {
      tabs.forEach((t, i) => { t.hidden = panels[i].hidden; });
      if (pending && !pending.hidden && rootEl.dataset.currentView === 'evidence') { selectPanel(pending); pending = null; }
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
        if (hit && hit.dataset.aud === 'research' && aud() === 'plain') document.dispatchEvent(new CustomEvent('audience-request', { detail: 'research' }));   // this part is in the research view
        const pick = hit && !hit.hidden ? hit : panels.find(p => !p.hidden && audienceOk(p)) || panels[0];
        pending = hit && hit.hidden ? hit : null;
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
    document.addEventListener('audiencechange', () => {   // leaving research while on a research-only tab: move to the first tab everyone sees
      const active = panels.find(p => p.classList.contains('is-active'));
      if (active && !audienceOk(active)) { const first = available()[0]; if (first) selectPanel(panels[tabs.indexOf(first)]); }
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
  statTable($('#gw-detail'), { title: 'Water-level decline groups', cols: ['Decline (ft/yr)', 'Wells', 'Median sinking rate (cm/yr)', 'Wells on sinking ground'],
    rows: g.q.map(x => [one(x.lo) + ' to ' + one(x.hi), String(x.n), s1(x.rate), String(Math.round(x.sinking)) + '%']),
    note: g.wells + ' wells; first readings ' + g.from + '\u2013' + g.to + ' against the latest ' + g.recentFrom + '\u2013' + g.recentTo + '. Rank correlation ' + s2(g.rho) + ' (95% range ' + s2(g.rhoLo) + ' to ' + s2(g.rhoHi) + ', block bootstrap over ' + g.tiles + ' areas of 5 km). Where the ground sinks, it sinks by about ' + one(g.ratio) + '% of the rate at which the water table falls. Sinking is the ten-year Sentinel-1 rate around each well.' });
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
  renderGeoCompare();
});
// Geology tab: the same questions asked of all five study areas, one row each (from geology.json; names from hotspots.geojson).
// ---- Research tables (shown only in the research view): one helper draws them all, in the same style as the geology comparison.
function statTable(host, { title, cols, rows, note: noteText }) {
  if (!host || !rows.length) return;
  host.replaceChildren();
  host.append(el('h3', 'geo-compare-title', title));
  const wrap = el('div', 'geo-compare-wrap'), table = el('table', 'geo-compare-table');
  const hr = el('tr'); cols.forEach(c => { const th = el('th', '', c); th.scope = 'col'; hr.append(th); });
  const head = el('thead'); head.append(hr); table.append(head);
  const body = el('tbody');
  rows.forEach(r => {
    const tr = el('tr');
    r.forEach((v, i) => { const c = el(i === 0 ? 'th' : 'td'); if (i === 0) c.scope = 'row'; c.dataset.label = cols[i]; if (v instanceof Node) c.append(v); else c.textContent = v; tr.append(c); });
    body.append(tr);
  });
  table.append(body); wrap.append(table); host.append(wrap);
  if (noteText) host.append(el('p', 'geo-compare-note', noteText));
  host.hidden = false;
}
const nfmt = v => isNumber(v) ? formatNumber(v) : '\u2014';
function areaName(slug) { return state.hotspots?.features.find(f => f.properties.slug === slug)?.properties.name || slug; }
function renderAreaStats() {
  const host = document.getElementById('area-stats');
  if (!host || !state.hotspots) return;
  const rows = [];
  state.slugs.forEach(slug => {
    const r = state.series.get(slug), s = r?.status === 'ready' ? r.value : null;
    if (!s || !isNumber(s.rate_cm_yr)) return;
    const c = s.adwr_comparison, asc = s.ascending_check;
    rows.push([areaName(slug), nfmt(s.rate_cm_yr) + (isNumber(s.rate_sigma) ? ' \u00b1 ' + nfmt(s.rate_sigma) : ''), nfmt(s.median_rate_cm_yr), nfmt(s.area_km2), nfmt(s.p5_rate_cm_yr) + ' / ' + nfmt(s.fastest_rate_cm_yr),
      asc && isNumber(asc.median_rate) ? nfmt(asc.median_rate) + ' (' + new Intl.NumberFormat('en-US').format(asc.n_px) + ' cells)' : 'none',
      c ? nfmt(c.adwr_s1_median) + ' / ' + nfmt(c.adwr_rs2_median) : '\u2014', c ? nfmt(c.corr_s1) + ' / ' + nfmt(c.corr_rs2) : '\u2014', String(s.dates.length)]);
  });
  statTable(host, { title: 'Sentinel-1 statistics for every study area',
    cols: ['Study area', 'Rate \u00b1 uncertainty (cm/yr)', 'Median of sinking pixels', 'Sinking area (km\u00b2)', '5th percentile / fastest cell', 'Ascending-track median', 'ADWR median: Sentinel-1 / RADARSAT-2', 'Pattern correlation with ADWR: Sentinel-1 / RADARSAT-2', 'Dates'],
    rows, note: 'Line-of-sight rates in cm/yr (negative = sinking), Sentinel-1 2016\u20132026. Sinking pixels are 300 m cells at or below \u22121 cm/yr. The uncertainty combines the fit error with a systematic term (half the descending\u2013ascending difference, or the difference from ADWR\u2019s own Sentinel-1 rate). ADWR medians are over the same pixels (units inferred as metres).' });
}
function renderNisarRecord(n) {
  const host = document.getElementById('nisar-record'), r = n?.research;
  if (!host || !r) return;
  const rows = [];
  [['Willcox record', r.willcoxRecord], ['Eloy record', r.eloyRecord]].forEach(([label, x]) => { if (x) rows.push([label, 'Track ' + x.track + ' \u00b7 ' + x.dates + ' dates \u00b7 ' + x.start + ' to ' + x.end]); });
  rows.push(['Pattern correlation with Sentinel-1', nfmt(n.pattern.r) + ' across ' + new Intl.NumberFormat('en-US').format(n.pattern.blocks) + ' blocks' + (r.rClean !== null ? ' (' + nfmt(r.rClean) + ' without the one bad September 2026 date)' : '')]);
  rows.push(['Troposphere correction', 'Residual scatter ' + nfmt(n.weather.before) + ' to ' + nfmt(n.weather.after) + ' mm' + (r.jumpBefore !== null && r.jumpAfter !== null ? '; pair-to-pair jump scatter ' + nfmt(r.jumpBefore) + ' to ' + nfmt(r.jumpAfter) + ' mm' : '')]);
  rows.push(['Sinking-area rate, NISAR vs Sentinel-1', nfmt(n.sinking.nisar) + ' vs ' + nfmt(n.sinking.s1) + ' cm/yr over ' + new Intl.NumberFormat('en-US').format(n.sinking.blocks) + ' blocks, relative to the surroundings']);
  rows.push(['Correlation over the six months both watched', nfmt(n.overlap.r)]);
  rows.push(['Dry-lake-bed change', 'NISAR net ' + nfmt(n.playa.net) + ' cm in ' + nfmt(n.playa.years) + ' yr; Sentinel-1 ten-year trend ' + nfmt(n.playa.trend) + ' and last three years ' + nfmt(n.playa.last3) + ' cm/yr']);
  rows.push(['Time to a confirmed rate (3 sigma, 90% power)', 'Willcox ' + nfmt(n.willcox.years) + ' yr (' + n.willcox.date + '); Eloy ' + nfmt(n.eloy.years) + ' yr (' + n.eloy.date + ')']);
  if (r.release) rows.push(['Release status', r.release]);
  statTable(host, { title: 'NISAR data record and statistics', cols: ['Item', 'Value'], rows });
}
// ---- Soils (USDA soil survey): in each area's research report, and compared across areas
let SOILS = null;
loadJSON('soils.json', cleanSoils).then(result => {
  SOILS = result.status === 'ready' ? result.value : null;
  renderSoilCompare();
  if (SOILS && state.selected && !document.querySelector('#detail-content .soil-block')) renderDetails();
});
const SOIL_ROWS = [['Sand (%)', 'sand_pct', 0], ['Silt (%)', 'silt_pct', 0], ['Clay (%)', 'clay_pct', 0], ['Organic matter (%)', 'organic_matter_pct', 2], ['pH (1:1 in water)', 'ph', 1], ['Salinity, EC (dS/m)', 'ec_dS_m', 1],
  ['Sodium adsorption ratio (SAR)', 'sar', 1], ['Calcium carbonate (%)', 'caco3_pct', 1], ['Gypsum (%)', 'gypsum_pct', 2], ['Cation exchange capacity (meq/100 g)', 'cec_meq_100g', 1],
  ['Available water capacity (cm/cm)', 'awc_cm_cm', 2], ['Saturated hydraulic conductivity (\u00b5m/s)', 'ksat_um_s', 1]];
const soilPct = (arr, k = 4) => arr.slice(0, k).map(x => x.name + ' ' + (x.pct >= 1 ? Math.round(x.pct) : '<1') + '%').join('; ');
function soilBlock(slug) {
  const a = SOILS?.areas?.[slug], set = a?.zone || a?.box;
  if (!set) return null;
  const box = el('section', 'soil-block');
  box.append(el('h3', 'geo-subhead geo-detail-head', 'Surface soils and ecology (USDA soil survey)'));
  box.append(note('Map units of the USDA NRCS soil survey, sampled with ' + set.points + ' random points across ' + (a.zone ? 'the sinking zone' : 'the study box') + ' (' + set.covered + ' had soil data). Each point shares its weight across its map unit\u2019s components by their percentages. These are the soils of the top 2 m, not the aquifer layers described above, and the survey holds no microbial or biological-crust data.'));
  const rows = [['Soil orders', soilPct(set.orders)], ['Suborders', soilPct(set.suborders)], ['Great groups', soilPct(set.greatGroups, 5)], ['Map units', soilPct(set.mapUnits, 4)], ['Landforms', soilPct(set.landforms)],
    ['NRCS ecological sites', soilPct(set.ecoSites, 4)], ['Surface texture', soilPct(set.texture)], ['Drainage class', soilPct(set.drainage, 3)], ['Hydrologic soil group', soilPct(set.hydgrp, 3)],
    ['Soil temperature regime', soilPct(set.temp, 2)], ['Restrictive layers', soilPct(set.restrictions, 4)]];
  if (isNumber(set.slope)) rows.push(['Mean slope', formatNumber(set.slope) + '%']);
  box.append(factList(rows.filter(r => r[1])));
  const wrap = el('div', 'geo-compare-wrap'), table = el('table', 'geo-compare-table soil-table');
  const hr = el('tr'); ['Property (weighted mean)', 'Top 0\u201330 cm', 'Below 30\u2013100 cm'].forEach(c => { const th = el('th', '', c); th.scope = 'col'; hr.append(th); });
  const head = el('thead'); head.append(hr); table.append(head);
  const body = el('tbody');
  SOIL_ROWS.forEach(([label, key, d]) => {
    const p = set.props[key]; if (!p || (p.top === null && p.deep === null)) return;
    const tr = el('tr'), th = el('th', '', label); th.scope = 'row'; tr.append(th);
    [p.top, p.deep].forEach((v, i) => { const td = el('td', '', v === null ? '\u2014' : v.toFixed(d)); td.dataset.label = i ? 'Below 30\u2013100 cm' : 'Top 0\u201330 cm'; tr.append(td); });
    body.append(tr);
  });
  table.append(body); wrap.append(table); box.append(wrap);
  const ec = set.props.ec_dS_m.top, sar = set.props.sar.top, flags = [];
  if (ec !== null) flags.push(ec >= 4 ? 'saline on average in the top 30 cm (EC ' + ec.toFixed(1) + ' dS/m, at or above the standard USDA threshold of 4)' : 'below the USDA saline threshold of 4 dS/m on average in the top 30 cm (EC ' + ec.toFixed(1) + ')');
  if (sar !== null) flags.push(sar >= 13 ? 'sodic on average (SAR ' + sar.toFixed(1) + ', at or above the standard threshold of 13)' : 'below the sodic threshold of SAR 13 on average in the top 30 cm (' + sar.toFixed(1) + ')');
  if (flags.length) box.append(note('Reading the numbers: ' + flags.join('; ') + '. Weighted means can hide patches, so check the map units above. Thresholds are those of the USDA Salinity Laboratory (Handbook 60).'));
  return box;
}
function renderSoilCompare() {
  const host = document.getElementById('soils-compare');
  if (!host || !SOILS || !state.hotspots) return;
  const rows = [];
  state.slugs.forEach(slug => {
    const a = SOILS.areas[slug], s = a?.zone || a?.box;
    if (!s) return;
    const p = k => (s.props[k].top === null ? '\u2014' : s.props[k].top.toFixed(k === 'organic_matter_pct' ? 2 : 1));
    rows.push([areaName(slug), soilPct(s.orders, 3), soilPct(s.greatGroups, 2), soilPct(s.texture, 2), p('organic_matter_pct'), p('ph'), p('ec_dS_m'), p('sar'), p('caco3_pct'), soilPct(s.landforms, 2), soilPct(s.ecoSites, 2)]);
  });
  statTable(host, { title: 'Surface soils compared (USDA soil survey)',
    cols: ['Study area', 'Soil orders', 'Great groups', 'Surface texture', 'Organic matter % (0\u201330 cm)', 'pH', 'Salinity EC (dS/m)', 'SAR', 'CaCO\u2083 %', 'Landforms', 'NRCS ecological sites'],
    rows, note: 'Source: USDA NRCS Soil Survey (SSURGO) via Soil Data Access, sampled with random points across each area\u2019s sinking zone; shares are percentages of sample points. Values are weighted means for the top 30 cm. These are surface soils (top 2 m), not aquifer layers; the survey has no microbial or biological-crust data.' });
}
function renderGeoCompare() {
  const box = document.getElementById('geology-compare');
  if (!box || !GEOLOGY) return;
  const nameOf = slug => state.hotspots?.features.find(f => f.properties.slug === slug)?.properties.name || null;
  const rows = Object.entries(GEOLOGY.areas).filter(([, g]) => g.recovery && g.fissures)
    .sort(([, a], [, b]) => (a.measured.rate ?? 0) - (b.measured.rate ?? 0));
  if (rows.length < 2) { box.hidden = true; return; }
  const cite = (g, id) => { const s = g.sources.find(x => x.id === id); if (!s) return null; const link = el('a', 'geo-cite', '(' + s.short + ')'); link.href = s.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link; };
  box.replaceChildren();
  box.append(el('h3', 'geo-compare-title', 'The five study areas, side by side'));
  const wrap = el('div', 'geo-compare-wrap');
  const table = el('table', 'geo-compare-table');
  const head = el('thead'), hr = el('tr');
  const COLS = ['Study area', 'Clay that can compact', 'Sinking (cm/yr)', 'Water table', 'Mapped earth fissures', 'Can the ground come back?'];
  COLS.forEach((c, i) => { const th = el('th', '', c); th.scope = 'col'; if (i === 1 || i === 4) th.dataset.aud = 'research'; hr.append(th); });
  head.append(hr); table.append(head);
  const body = el('tbody');
  rows.forEach(([slug, g]) => {
    const tr = el('tr');
    const td = (i, ...kids) => { const c = el(i === 0 ? 'th' : 'td'); if (i === 0) c.scope = 'row'; c.dataset.label = COLS[i]; c.append(...kids.filter(Boolean)); tr.append(c); return c; };
    const name = nameOf(slug) || g.basin;
    const open = el('a', 'geo-compare-area', name); open.href = '#atlas';
    open.addEventListener('click', () => { if (state.slugs?.includes(slug)) setTimeout(() => selectHotspot(slug), 60); });
    const basinNote = el('small', '', g.basin); basinNote.dataset.aud = 'research';
    td(0, open, basinNote);
    const clays = g.layers.filter(l => l.compacts).map(l => l.name);
    td(1, document.createTextNode(clays.length ? clays.join('; ') : 'None named in the sources')).dataset.aud = 'research';
    td(2, el('strong', '', isNumber(g.measured.rate) ? formatNumber(g.measured.rate) : '\u2014'));
    td(3, document.createTextNode(isNumber(g.measured.decline) ? 'Falling ' + formatNumber(g.measured.decline) + ' ft/yr (' + g.measured.wells + ' wells)' : 'No wells in our data'));
    const f = g.fissures;
    const fz = el('span', '', formatNumber(f.confirmed) + ' km confirmed' + (f.reported > 0 ? ' + ' + formatNumber(f.reported) + ' km reported' : ''));
    td(4, fz, f.areas.length ? el('small', '', f.areas.join(', ')) : null).dataset.aud = 'research';
    const r = g.recovery;
    const plainAnswer = x => { const e = el('span', 'recovery-text', x.plain + ' '); e.dataset.aud = 'plain'; return e; };
    const researchAnswer = t => { const e = el('span', 'recovery-text', t + ' '); e.dataset.aud = 'research'; return e; };
    const answer = r.status === 'inferred' ? r.text.replace(/^Not studied here(, and unclear)?\. /, (m, u) => u ? 'Unclear. ' : '') : r.text;   // the chip already says "Not studied here"
    td(5, el('span', 'recovery-chip ' + r.status, r.status === 'studied' ? 'Studied here' : 'Not studied here'), plainAnswer(r), researchAnswer(answer), cite(g, r.source));
    body.append(tr);
  });
  table.append(body); wrap.append(table); box.append(wrap);
  box.append(el('p', 'geo-compare-note', 'Sinking: our Sentinel-1 rates, 2016\u20132026, along the satellite\u2019s slanted view (negative = sinking). Water table: median of the wells inside each area. Earth fissures: kilometres mapped by the Arizona Geological Survey inside each study area, with data as of 2016; "confirmed" combines its continuous and discontinuous classes, and a place with no mapped fissure is not proof that none exist. "Studied here" cites a study of that area; "Not studied here" is our reading of the geology, not a measurement. Select an area name to open it on the map.'));
  box.hidden = false;
}
const GEO_KIND_LABEL = { sand: 'Sand and gravel', clay: 'Clay or silt', mixed: 'Mixed sand, silt and clay', consolidated: 'Older, firmer fill', evaporite: 'Salt and gypsum beds', rock: 'Bedrock' };
function renderGeology(slug) {
  const g = GEOLOGY?.areas?.[slug];
  if (!g) return null;
  const box = section('What lies beneath');
  box.classList.add('geology');
  box.append(el('p', 'geology-basin', g.basin));
  const cite = id => { const src = g.sources.find(x => x.id === id); if (!src) return null; const link = el('a', 'geo-cite', '(' + src.short + ')'); link.href = src.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link; };
  const layerColumn = notes => {
    const column = el('ol', 'geo-column');
    column.setAttribute('aria-label', 'Layers from the surface down (schematic, not to scale)');
    const top = el('li', 'geo-surface'); top.append(el('span', '', 'Ground surface')); column.append(top);
    g.layers.forEach((layer, i) => {
      const li = el('li', 'geo-layer kind-' + layer.kind);
      const swatch = el('span', 'geo-swatch'); swatch.setAttribute('aria-hidden', 'true');
      const text = el('div', 'geo-text');
      text.append(el('strong', '', layer.name), el('span', 'geo-kind', GEO_KIND_LABEL[layer.kind]), el('p', '', notes?.[i] || layer.note));
      if (layer.compacts) text.append(el('span', 'geo-compacts', 'Compacts when the water level falls'));
      li.append(swatch, text); column.append(li);
    });
    return column;
  };
  const figureFor = notes => { const f = el('figure', 'geo-figure'); f.append(layerColumn(notes), el('figcaption', '', 'Schematic order of layers from the sources below, not to scale.')); return f; };
  const m = g.measured;
  const measured = plain => {
    const facts = [];
    if (isNumber(m.rate)) facts.push(['Ground motion', plain ? formatNumber(m.rate) + ' cm a year (negative means sinking)' : formatNumber(m.rate) + ' cm/yr (Sentinel-1, 2016\u20132026, line of sight)']);
    facts.push(['Water table', isNumber(m.decline)
      ? (plain ? 'Falling about ' + formatNumber(m.decline) + ' feet a year (' + m.wells + ' wells)' : 'falling about ' + formatNumber(m.decline) + ' ft a year (median of ' + m.wells + ' wells, 1980s\u201390s to 2015\u201325)')
      : 'no wells in our water-level data for this area']);
    if (g.fissures) facts.push(['Mapped earth fissures', formatNumber(g.fissures.confirmed) + ' km confirmed' + (g.fissures.reported > 0 ? ' and ' + formatNumber(g.fissures.reported) + ' km reported' : '') + (plain ? ' in this area' : ' inside this study area (Arizona Geological Survey, data as of 2016)')]);
    if (g.recovery) facts.push(['Can it come back?', plain ? g.recovery.plain : (g.recovery.status === 'studied' ? 'Studied here: ' : 'Not studied here: ') + g.recovery.text.replace(/^Not studied here(, and unclear)?\. /, m2 => m2.includes('unclear') ? 'unclear. ' : '')]);
    return factList(facts);
  };
  const factsList = facts => {
    const list = el('ul', 'geo-facts');
    facts.forEach(f => { const li = el('li', '', f.text + ' '); const link = cite(f.source); if (link) li.append(link); list.append(li); });
    return list;
  };
  // Everyone: a short summary, the layers in plain words, what we measured, three sourced facts.
  let plainDiv = null;
  if (g.plain) {
    plainDiv = el('div', 'geo-plain'); plainDiv.dataset.aud = 'plain';
    plainDiv.append(el('p', 'detail-copy', g.plain.summary));
    const grid = el('div', 'geo-grid'), side = el('div', 'geo-side');
    side.append(el('h3', 'geo-subhead', 'What we measured here'), measured(true), el('h3', 'geo-subhead', 'What the studies say'), factsList(g.plain.facts));
    grid.append(figureFor(g.plain.layerNotes), side); plainDiv.append(grid);
  }
  // Research: the full text, the sourced hydrogeology detail, and the caveat.
  const researchDiv = el('div', 'geo-research');
  if (plainDiv) researchDiv.dataset.aud = 'research';
  researchDiv.append(el('p', 'detail-copy', g.summary));
  const grid = el('div', 'geo-grid'), side = el('div', 'geo-side');
  side.append(el('h3', 'geo-subhead', 'What we measured here'), measured(false), el('h3', 'geo-subhead', 'What the studies say'), factsList(g.facts));
  grid.append(figureFor(null), side); researchDiv.append(grid);
  if (g.detail?.length) {
    researchDiv.append(el('h3', 'geo-subhead geo-detail-head', 'Hydrogeology for researchers and water engineers'));
    const dl = el('dl', 'geo-detail');
    g.detail.forEach(d => { const row = el('div'); const dd = el('dd', '', d.text + ' '); const link = cite(d.source); if (link) dd.append(link); row.append(el('dt', '', d.label), dd); dl.append(row); });
    researchDiv.append(dl);
  }
  const soil = soilBlock(slug);
  if (soil) researchDiv.append(soil);
  if (g.caveat) researchDiv.append(note(g.caveat));
  if (plainDiv) box.append(plainDiv);
  box.append(researchDiv);
  const more = el('details', 'more');
  more.append(el('summary', '', 'Sources for this area'));
  const srcList = el('ul', 'geo-sources');
  g.sources.forEach(src => { const li = el('li'); const link = el('a', '', src.label); link.href = src.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; li.append(link); srcList.append(li); });
  more.append(srcList);
  box.append(more);
  return box;
}

// Full-size image viewer: opened from a "View full size" button or by selecting the picture. Zoom with the buttons or
// Ctrl/trackpad pinch, drag to pan, arrow keys scroll; Escape or Close returns focus to the button.
(function initImageViewer() {
  const dlg = document.getElementById('image-viewer');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  const stage = dlg.querySelector('.viewer-stage'), img = stage.querySelector('img'), title = dlg.querySelector('.viewer-title');
  let zoom = 1, opener = null;
  const apply = () => {
    const fit = Math.min(stage.clientWidth / (img.naturalWidth || 1), stage.clientHeight / (img.naturalHeight || 1)) || 1;
    img.style.width = Math.round((img.naturalWidth || stage.clientWidth) * fit * zoom) + 'px';
    dlg.querySelector('[data-z="0"]').textContent = zoom === 1 ? 'Fit' : Math.round(zoom * 100) + '%';
  };
  const setZoom = (z, cx = 0.5, cy = 0.5) => {
    const before = { x: stage.scrollLeft + stage.clientWidth * cx, y: stage.scrollTop + stage.clientHeight * cy, w: img.offsetWidth || 1, h: img.offsetHeight || 1 };
    zoom = Math.min(6, Math.max(1, z)); apply();
    stage.scrollLeft = before.x / before.w * img.offsetWidth - stage.clientWidth * cx;
    stage.scrollTop = before.y / before.h * img.offsetHeight - stage.clientHeight * cy;
  };
  const open = source => {
    if (!source?.src) return;
    opener = document.activeElement;
    img.src = source.currentSrc || source.src; img.alt = source.alt || '';
    title.textContent = source.closest('figure')?.querySelector('figcaption strong')?.textContent || 'Full-size image';
    zoom = 1; dlg.showModal();
    const ready = () => { apply(); stage.focus(); };
    if (img.complete && img.naturalWidth) requestAnimationFrame(ready); else img.addEventListener('load', ready, { once: true });
  };
  document.querySelectorAll('[data-zoom]').forEach(btn => {
    const target = document.querySelector(btn.dataset.zoom);
    btn.addEventListener('click', () => open(target));
    target?.addEventListener('click', () => open(target));
    if (target) target.style.cursor = 'zoom-in';
  });
  dlg.querySelectorAll('[data-z]').forEach(b => b.addEventListener('click', () => { const d = Number(b.dataset.z); setZoom(d === 0 ? (zoom === 1 ? 2 : 1) : zoom * (d > 0 ? 1.5 : 1 / 1.5)); }));
  dlg.querySelector('.viewer-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => { img.removeAttribute('src'); opener?.focus?.(); });
  stage.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); const r = stage.getBoundingClientRect(); setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); }, { passive: false });
  let drag = null;
  stage.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') return; drag = { x: e.clientX, y: e.clientY, l: stage.scrollLeft, t: stage.scrollTop }; stage.classList.add('dragging'); });
  window.addEventListener('pointermove', e => { if (!drag) return; stage.scrollLeft = drag.l - (e.clientX - drag.x); stage.scrollTop = drag.t - (e.clientY - drag.y); });
  window.addEventListener('pointerup', () => { drag = null; stage.classList.remove('dragging'); });
  window.addEventListener('resize', () => { if (dlg.open) apply(); });
})();

// Reading-level switch. Most variants are both present in the page and shown or hidden by CSS ([data-aud]), so switching is instant.
(function initAudience() {
  const sw = document.getElementById('audience-switch'), hint = document.getElementById('audience-hint'), announce = document.getElementById('audience-announce');
  if (!sw) return;
  const HINT = {
    plain: 'The findings, explained simply.',
    research: 'Methods, statistics, uncertainties and hydrogeology detail, with sources, for researchers and water engineers.'
  };
  function set(mode, user) {
    const m = mode === 'research' ? 'research' : 'plain';
    const root = document.documentElement;
    if (m === 'research') root.setAttribute('data-audience', 'research'); else root.removeAttribute('data-audience');
    sw.setAttribute('aria-checked', String(m === 'research'));
    if (hint) hint.textContent = HINT[m];
    try { localStorage.setItem('sinkronized-audience', m); } catch (error) { /* storage unavailable: the choice lasts for this visit */ }
    if (user && announce) announce.textContent = m === 'research' ? 'Research detail is on.' : 'Plain language is on.';
    document.querySelectorAll('#evidence details.more').forEach(d => { d.open = m === 'research'; });   // researchers get the detail unfolded; everyone else gets it one click away
    document.dispatchEvent(new CustomEvent('audiencechange', { detail: m }));
  }
  sw.addEventListener('click', () => set(aud() === 'research' ? 'plain' : 'research', true));
  document.addEventListener('audience-request', e => { if (aud() !== e.detail) set(e.detail, true); });
  document.querySelectorAll('.audience-side').forEach(b => b.addEventListener('click', () => set(b.dataset.set, true)));
  sw.setAttribute('aria-checked', String(aud() === 'research'));
  if (hint) hint.textContent = HINT[aud()];
  if (aud() === 'research') document.querySelectorAll('#evidence details.more').forEach(d => { d.open = true; });
})();

// Keep the switch bar (and the sticky Evidence tabs) clear of the pinned header: measure the header and publish the heights as CSS variables.
(function pinBars() {
  const root = document.documentElement, mast = document.querySelector('.masthead'), bar = document.getElementById('audience-bar');
  if (!mast || !bar) return;
  const measure = () => {
    const pinned = getComputedStyle(mast).position === 'sticky';   // on phones the header scrolls away, only the switch stays
    const m = pinned ? mast.offsetHeight : 0;
    root.style.setProperty('--mast-top', m + 'px');
    root.style.setProperty('--top-h', (m + bar.offsetHeight) + 'px');
  };
  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(measure); ro.observe(mast); ro.observe(bar); }
})();
