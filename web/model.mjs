// Data contracts are intentionally strict: null and missing values never become zero.
export const isNumber = value => typeof value === 'number' && Number.isFinite(value);
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function normalizeSeries(raw, slug) {
  if (!raw || raw.hotspot !== slug || raw.units !== 'cm') throw new Error('Expected the matching hotspot and displacement units cm.');
  const dates = raw.dates, values = raw.displacement;
  if (!Array.isArray(dates) || !Array.isArray(values) || dates.length !== values.length) throw new Error('Dates and displacement must have equal lengths.');
  if (dates.some((v, i) => !validDate(v) || (i > 0 && v <= dates[i - 1]))) throw new Error('Dates must be unique, valid and increasing.');
  if (values.some(v => v !== null && !isNumber(v))) throw new Error('Displacement must be finite numbers or null gaps.');
  for (const key of ['rate_cm_yr', 'rate_sigma', 'adwr_rate_cm_yr', 'adwr_rs2_rate_cm_yr', 'median_rate_cm_yr']) {
    if (raw[key] != null && !isNumber(raw[key])) throw new Error(`${key} must be a finite number or null.`);
  }
  if (isNumber(raw.rate_sigma) && raw.rate_sigma < 0) throw new Error('Uncertainty cannot be negative.');
  const points = dates.map((date, i) => ({ date, value: values[i] }));
  const stable = raw.stable_ground_displacement;
  if (stable != null && (!Array.isArray(stable) || stable.length !== dates.length || stable.some(v => v !== null && !isNumber(v)))) throw new Error('Stable-ground observations must align with dates and contain finite numbers or null gaps.');
  const stablePoints = Array.isArray(stable) ? dates.map((date, i) => ({ date, value: stable[i] })) : [];
  const comparison = raw.adwr_comparison;
  if (comparison != null) {
    if (typeof comparison !== 'object' || Array.isArray(comparison)) throw new Error('Expected an ADWR comparison record.');
    for (const key of ['ours_median', 'adwr_s1_median', 'adwr_rs2_median', 'diff_s1', 'corr_s1', 'corr_rs2']) {
      if (comparison[key] != null && !isNumber(comparison[key])) throw new Error('ADWR comparison values must be finite numbers or null.');
    }
    for (const key of ['corr_s1', 'corr_rs2']) if (isNumber(comparison[key]) && Math.abs(comparison[key]) > 1) throw new Error('Correlation must be between -1 and 1.');
  }
  const hasData = values.some(isNumber);
  if ((hasData || isNumber(raw.rate_cm_yr)) && !(typeof raw.reference === 'string' && raw.reference.trim())) throw new Error('A stable reference description is required for measured values.');
  if (isNumber(raw.rate_cm_yr) && !hasData) throw new Error('A reported rate needs a nonempty supporting time series.');
  return { ...raw, points, stablePoints, hasData, rate_cm_yr: raw.rate_cm_yr ?? null, rate_sigma: raw.rate_sigma ?? null, adwr_rate_cm_yr: raw.adwr_rate_cm_yr ?? null };
}
export function normalizeRate(raw) {
  const b = raw?.bounds;
  if (!Array.isArray(b) || b.length !== 2 || b.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(isNumber))) throw new Error('Raster bounds must be [[south, west], [north, east]].');
  const [[s, w], [n, e]] = b;
  if (!(s < n && w < e && s >= -90 && n <= 90 && w >= -180 && e <= 180)) throw new Error('Invalid WGS84 raster bounds.');
  if (raw.units !== 'cm/yr' || !isNumber(raw.vmin) || !isNumber(raw.vmax) || raw.vmin >= raw.vmax) throw new Error('Expected cm/yr and a finite, increasing display range.');
  if (raw.crs && !['EPSG:4326', '4326'].includes(raw.crs)) throw new Error('Reproject the image bounds to EPSG:4326.');
  if (!Array.isArray(raw.dates) || raw.dates.length < 2 || !raw.dates.every(validDate) || raw.dates[0] >= raw.dates.at(-1)) throw new Error('Raster metadata needs a valid date range.');
  return raw;
}
export function validateGeoJSON(raw) {
  if (raw?.type !== 'FeatureCollection' || !Array.isArray(raw.features)) throw new Error('Expected a GeoJSON FeatureCollection.');
  const allowed = new Set(['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString', 'Point', 'MultiPoint']);
  for (const feature of raw.features) {
    if (feature?.type !== 'Feature' || !allowed.has(feature.geometry?.type)) throw new Error('Unsupported or missing GeoJSON geometry.');
    const visit = coords => {
      if (!Array.isArray(coords) || !coords.length) throw new Error('Empty coordinates.');
      if (typeof coords[0] === 'number') {
        if (coords.length < 2 || !coords.every(isNumber) || Math.abs(coords[0]) > 180 || Math.abs(coords[1]) > 90) throw new Error('Expected longitude/latitude coordinates in WGS84.');
      } else coords.forEach(visit);
    };
    visit(feature.geometry.coordinates);
  }
  return raw;
}
// Study identity and order belong to the pipeline, not to the interface.
export function normalizeHotspots(raw) {
  validateGeoJSON(raw);
  if (!raw.features.length) throw new Error('The study file contains no areas.');
  const slugs = new Set();
  for (const feature of raw.features) {
    const p = feature.properties || {};
    if (!['Polygon', 'MultiPolygon'].includes(feature.geometry.type) ||
        typeof p.slug !== 'string' || !/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(p.slug) ||
        slugs.has(p.slug) || typeof p.name !== 'string' || !p.name.trim() ||
        typeof p.story !== 'string' || !p.story.trim()) {
      throw new Error('Studies require polygons, unique file-safe slugs, names and stories.');
    }
    slugs.add(p.slug);
  }
  return raw;
}
export function safeSourceURL(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function formatNumber(value) { return isNumber(value) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value) : 'Pending'; }
export function cleanInsights(raw) {
  // Plain-language insights are optional and text-only. Anything malformed is dropped rather than shown.
  if (!raw || typeof raw.summary !== 'string' || !raw.summary.trim()) return null;
  const levels = new Set(['high', 'medium', 'low']), c = raw.confidence;
  const confidence = c && levels.has(c.where) && levels.has(c.how_fast)
    ? { where: c.where, how_fast: c.how_fast,
        where_label: typeof c.where_label === 'string' && c.where_label.trim() ? c.where_label : 'Where it is sinking',
        how_fast_label: typeof c.how_fast_label === 'string' && c.how_fast_label.trim() ? c.how_fast_label : 'How fast' }
    : null;
  const points = (Array.isArray(raw.points) ? raw.points : []).filter(p => typeof p?.heading === 'string' && p.heading.trim() && typeof p?.text === 'string' && p.text.trim())
    .map(p => ({ heading: p.heading.trim(), text: p.text.trim() }));
  return { summary: raw.summary.trim(), confidence, points };
}
const safeFrame = p => typeof p === 'string' && /^cumulative\/[A-Za-z0-9_.-]+\.png$/.test(p);
export function normalizeCumulative(raw, slug) {
  // Dated map pictures for the time slider. Strict: matching study, cm, increasing dates, one picture per date,
  // pictures only from the cumulative/ folder (no paths that could point elsewhere).
  if (!raw || raw.hotspot !== slug || raw.units !== 'cm') throw new Error('Expected the matching study and units cm.');
  const b = raw.bounds;
  if (!Array.isArray(b) || b.length !== 2 || b.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(isNumber))) throw new Error('Bounds must be [[south, west], [north, east]].');
  const [[s, w], [n, e]] = b;
  if (!(s < n && w < e && s >= -90 && n <= 90 && w >= -180 && e <= 180)) throw new Error('Invalid WGS84 bounds.');
  if (!isNumber(raw.vmin) || !isNumber(raw.vmax) || raw.vmin >= raw.vmax) throw new Error('Expected a finite, increasing display range.');
  const { dates, frames } = raw;
  if (!Array.isArray(dates) || dates.length < 2 || !dates.every(validDate) || dates.some((d, i) => i > 0 && d <= dates[i - 1])) throw new Error('Dates must be valid, unique and increasing.');
  if (!Array.isArray(frames) || frames.length !== dates.length || !frames.every(safeFrame)) throw new Error('Expected one safe picture per date.');
  const masks = {};
  for (const kind of ['sinking', 'stable']) {
    if (raw.masks?.[kind] == null) continue;
    if (!safeFrame(raw.masks[kind])) throw new Error('Unsafe mask path.');
    masks[kind] = raw.masks[kind];
  }
  return { ...raw, masks };
}
const teamText = (value, max) => typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : null;
const TEAM_PHOTO = /^assets\/team\/[A-Za-z0-9_.-]+\.(png|jpe?g|webp)$/i;
export function cleanTeam(raw) {
  // Hand-written About us content (web/team.json). Optional, text-only and strict: a malformed field is dropped, never shown.
  if (!raw || !Array.isArray(raw.members)) return null;
  const members = [];
  for (const m of raw.members.slice(0, 12)) {
    const name = teamText(m?.name, 80);
    if (!name) continue;
    const interests = (Array.isArray(m.interests) ? m.interests : typeof m.interests === 'string' ? m.interests.split(',') : [])
      .map(t => teamText(t, 40)).filter(Boolean).slice(0, 12);
    const links = (Array.isArray(m.links) ? m.links : []).map(l => ({ label: teamText(l?.label, 40), url: safeSourceURL(l?.url) }))
      .filter(l => l.label && l.url).slice(0, 6);
    members.push({ name, role: teamText(m.role, 120), study: teamText(m.study, 160), bio: teamText(m.bio, 600), interests, links,
      photo: typeof m.photo === 'string' && TEAM_PHOTO.test(m.photo) ? m.photo : null });
  }
  return members.length ? { intro: teamText(raw.intro, 400), members } : null;
}
