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
    members.push({ name, role: teamText(m.role, 120), study: teamText(m.study, 160), education: teamText(m.education, 200), bio: teamText(m.bio, 600), interests, links,
      photo: typeof m.photo === 'string' && TEAM_PHOTO.test(m.photo) ? m.photo : null });
  }
  return members.length ? { intro: teamText(raw.intro, 400), members } : null;
}
// NISAR results shown in the Overview (data/processed/nisar_summary.json, written by src/export_nisar.py). Strict: any bad field hides the whole section.
const nz = (v, lo, hi) => isNumber(v) && v >= lo && v <= hi ? v : null;
const nisarArea = a => {
  if (!a || typeof a !== 'object') return null;
  const area = { name: teamText(a.name, 60), s1: nz(a.s1_rate_cm_yr, 0, 50), years: nz(a.years, 0, 50), date: validDate(a.date) ? a.date : null, chance: nz(a.chance_at_one_year, 0, 1) };
  return Object.values(area).every(v => v !== null) ? area : null;
};
const cleanDirections = x => {
  if (!x || typeof x !== 'object') return null;
  const o = { span: nz(x.span_days, 1, 1000), asc: nz(x.asc_mm, -1000, 1000), ascLo: nz(x.asc_lo, -1000, 1000), ascHi: nz(x.asc_hi, -1000, 1000),
    desc: nz(x.desc_mm, -1000, 1000), descLo: nz(x.desc_lo, -1000, 1000), descHi: nz(x.desc_hi, -1000, 1000), exp: nz(x.expected_mm, -1000, 1000),
    ew: nz(x.ew_mm, -1000, 1000), ewLo: nz(x.ew_lo, -1000, 1000), ewHi: nz(x.ew_hi, -1000, 1000) };
  return Object.values(o).every(v => v !== null) ? o : null;
};
const cleanFarmland = f => {
  if (!f || typeof f !== 'object') return null;
  const o = {
    boxPct: nz(f.crop_share_box_pct, 0, 100), sinkPct: nz(f.crop_share_sinking_pct, 0, 100), times: nz(f.enrichment, 0, 1000), acres: nz(f.crop_acres_sinking, 0, 1e8),
    diff: nz(f.rate_diff_cm_yr, -100, 100), lo: nz(f.rate_diff_lo, -100, 100), hi: nz(f.rate_diff_hi, -100, 100),
    cropSink: nz(f.share_sinking_cropland_pct, 0, 100), desertSink: nz(f.share_sinking_desert_pct, 0, 100),
    aucHH: nz(f.auc_hh_spread, 0.5, 1), aucHV: nz(f.auc_hv_spread, 0.5, 1), aucMean: nz(f.auc_mean_hh, 0.5, 1), aucMeanHV: nz(f.auc_mean_hv, 0.5, 1), aucRatio: nz(f.auc_hvhh, 0.5, 1),
    rhoHH: nz(f.rain_rho_hh, -1, 1), rhoHV: nz(f.rain_rho_hv, -1, 1), dates: nz(f.n_dates, 1, 1000), dry: nz(f.dry_dates, 0, 1000),
    nisarDiff: nz(f.nisar_diff_cm_yr, -100, 100), nisarCells: nz(f.nisar_cells, 1, 1e9),
    figure: typeof f.figure === 'string' && /^[A-Za-z0-9_.-]+\.png$/.test(f.figure) ? f.figure : null
  };
  return Object.values(o).every(v => v !== null) ? o : null;
};
export function cleanNisar(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw.pattern || {}, w = raw.weather_fix || {}, s = raw.sinking || {}, y = raw.playa || {}, o = raw.overlap || {}, c = raw.confirm || {};
  const out = {
    pattern: { r: nz(p.r, -1, 1), blocks: nz(p.n_blocks, 1, 1e7) },
    weather: { before: nz(w.residual_before_mm, 0, 1000), after: nz(w.residual_after_mm, 0, 1000), percent: nz(w.percent, -100, 100) },
    sinking: { nisar: nz(s.nisar_cm_yr, -100, 100), s1: nz(s.s1_cm_yr, -100, 100), blocks: nz(s.n_blocks, 1, 1e7) },
    playa: { net: nz(y.net_cm, -100, 100), years: nz(y.years, 0, 20), trend: nz(y.s1_trend_cm_yr, -100, 100), last3: nz(y.s1_last3y_cm_yr, -100, 100) },
    overlap: { r: nz(o.r, -1, 1) },
    willcox: nisarArea(c.willcox), eloy: nisarArea(c.eloy),
    figure: typeof raw.figure === 'string' && /^[A-Za-z0-9_.-]+\.png$/.test(raw.figure) ? raw.figure : null,
    farmland: cleanFarmland(raw.farmland),
    directions: cleanDirections(raw.directions)
  };
  const ok = [out.pattern, out.weather, out.sinking, out.playa, out.overlap].every(g => Object.values(g).every(v => v !== null)) && out.willcox && out.eloy && out.figure && out.farmland && out.directions;
  return ok ? out : null;
}
// Pumping-vs-sinking numbers for the Overview (data/processed/pumping_summary.json, src/export_pumping.py). Strict like cleanNisar: any bad field hides the section.
export function cleanPumping(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const o = {
    fields: nz(raw.fields, 1, 1e6), acres: nz(raw.acres, 1, 1e8), acreFt: nz(raw.withdrawal_acre_ft, 1, 1e9), radius: nz(raw.radius_km, 0.1, 100),
    none: nz(raw.rate_none, -100, 100), low: nz(raw.rate_low, -100, 100), medium: nz(raw.rate_medium, -100, 100), high: nz(raw.rate_high, -100, 100),
    rho: nz(raw.rho, -1, 1), rhoLo: nz(raw.rho_lo, -1, 1), rhoHi: nz(raw.rho_hi, -1, 1), rhoIn: nz(raw.rho_in, -1, 1), rhoInLo: nz(raw.rho_in_lo, -1, 1), rhoInHi: nz(raw.rho_in_hi, -1, 1),
    rhoAcres: nz(raw.rho_acres, -1, 1), partial: nz(raw.partial, -1, 1), partialLo: nz(raw.partial_lo, -1, 1), partialHi: nz(raw.partial_hi, -1, 1),
    fieldN: nz(raw.field_n, 1, 1e6), fieldRho: nz(raw.field_rho, -1, 1), fieldLo: nz(raw.field_lo, -1, 1), fieldHi: nz(raw.field_hi, -1, 1), coherent: nz(raw.field_coherent_pct, 0, 100),
    rowFields: nz(raw.rowcrop_fields, 1, 1e6), rowWith: nz(raw.rowcrop_with_rate, 0, 1e6)
  };
  return Object.values(o).every(v => v !== null) ? o : null;
}