import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSeries, normalizeRate, normalizeHotspots, validateGeoJSON, safeSourceURL, formatNumber, cleanInsights, normalizeCumulative, cleanTeam } from '../model.mjs';
import { readFile } from 'node:fs/promises';

const series = extra => ({ hotspot: 'eloy', units: 'cm', reference: 'Synthetic test reference', dates: ['2026-01-01', '2026-01-13'], displacement: [0, -1], rate_cm_yr: -2, rate_sigma: 0.2, ...extra });
test('pending nulls never become zero, while a real zero remains valid', () => {
  const pending = normalizeSeries(series({ dates: [], displacement: [], reference: '', rate_cm_yr: null, rate_sigma: null }), 'eloy');
  assert.equal(pending.hasData, false);
  assert.equal(pending.rate_cm_yr, null);
  assert.equal(formatNumber(null), 'Pending');
  const zero = normalizeSeries(series({ displacement: [0, 0], rate_cm_yr: 0, rate_sigma: 0 }), 'eloy');
  assert.equal(zero.hasData, true);
  assert.equal(zero.rate_cm_yr, 0);
});
test('null chart gaps survive normalization', () => {
  const result = normalizeSeries(series({ dates: ['2026-01-01', '2026-01-13', '2026-01-25'], displacement: [0, null, -1] }), 'eloy');
  assert.equal(result.points[1].value, null);
});
test('stable-ground noise retains zero and gaps on matching acquisition dates', () => {
  const result = normalizeSeries(series({ stable_ground_displacement: [0, null] }), 'eloy');
  assert.deepEqual(result.stablePoints, [{ date: '2026-01-01', value: 0 }, { date: '2026-01-13', value: null }]);
  assert.deepEqual(normalizeSeries(series({}), 'eloy').stablePoints, []);
  for (const stable_ground_displacement of [[0], [0, '1'], 'invalid']) assert.throws(() => normalizeSeries(series({ stable_ground_displacement }), 'eloy'));
});
test('ADWR comparisons preserve exported median differences and unknown values', () => {
  const raw = series({ adwr_rate_cm_yr: 0, adwr_rs2_rate_cm_yr: null, adwr_comparison: { ours_median: -1.23, adwr_s1_median: -1.57, diff_s1: 0.34, corr_s1: 0.587, corr_rs2: null } });
  const result = normalizeSeries(raw, 'eloy');
  assert.equal(result.adwr_comparison.diff_s1, 0.34);
  assert.notEqual(result.rate_cm_yr - result.adwr_comparison.adwr_s1_median, result.adwr_comparison.diff_s1);
  assert.equal(result.adwr_rate_cm_yr, 0);
  assert.equal(result.adwr_rs2_rate_cm_yr, null);
  for (const bad of [{ corr_rs2: 2 }, { diff_s1: '0.34' }, []]) assert.throws(() => normalizeSeries(series({ adwr_comparison: bad }), 'eloy'));
  assert.throws(() => normalizeSeries(series({ adwr_rs2_rate_cm_yr: '0' }), 'eloy'));
});
test('measured data requires a reference and honest units', () => {
  assert.throws(() => normalizeSeries(series({ reference: '' }), 'eloy'));
  assert.throws(() => normalizeSeries(series({ units: 'mm' }), 'eloy'));
  assert.throws(() => normalizeSeries(series({ rate_sigma: -1 }), 'eloy'));
  assert.throws(() => normalizeSeries(series({ displacement: [0, '1'] }), 'eloy'));
});
test('duplicate, out-of-order and nonexistent dates are rejected', () => {
  for (const dates of [['2026-01-01', '2026-01-01'], ['2026-01-13', '2026-01-01'], ['2026-02-30', '2026-03-15']]) {
    assert.throws(() => normalizeSeries(series({ dates }), 'eloy'));
  }
});
test('raster bounds are validated as latitude/longitude with a real display domain', () => {
  const meta = { bounds: [[32.6, -111.9], [33, -111.4]], units: 'cm/yr', vmin: -5, vmax: 0, dates: ['2026-01-01', '2026-01-13'] };
  assert.equal(normalizeRate(meta), meta);
  assert.throws(() => normalizeRate({ ...meta, bounds: [[-111.9, 32.6], [-111.4, 33]] }));
  assert.throws(() => normalizeRate({ ...meta, vmax: -5 }));
  assert.throws(() => normalizeRate({ ...meta, crs: 'EPSG:32612' }));
});
test('GeoJSON rejects projected coordinates; popup links reject executable schemes', () => {
  const feature = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-111, 33] }, properties: {} }] };
  assert.equal(validateGeoJSON(feature), feature);
  assert.throws(() => validateGeoJSON({ ...feature, features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [400000, 3600000] } }] }));
  assert.equal(safeSourceURL('javascript:alert(1)'), null);
  assert.equal(safeSourceURL('https://example.com/source'), 'https://example.com/source');
});
test('new study identities and file order come from data, without a fixed count', () => {
  const area = slug => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[-111, 32], [-110, 32], [-110, 33], [-111, 32]]] }, properties: { slug, name: slug, story: 'Synthetic study' } });
  const raw = { type: 'FeatureCollection', features: [area('new_basin'), area('other-basin')] };
  assert.deepEqual(normalizeHotspots(raw).features.map(f => f.properties.slug), ['new_basin', 'other-basin']);
  assert.equal(normalizeHotspots({ ...raw, features: [area('unseen_site')] }).features.length, 1);
  for (const features of [[], [area('duplicate'), area('duplicate')], [area('../private')]]) {
    assert.throws(() => normalizeHotspots({ ...raw, features }));
  }
});
test('every current pipeline study loads its own supported measurement and raster record', async () => {
  const root = new URL('../../data/processed/', import.meta.url);
  const read = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));
  const areas = normalizeHotspots(await read('hotspots.geojson'));
  for (const { properties: { slug } } of areas.features) {
    assert.equal(normalizeSeries(await read('timeseries_' + slug + '.json'), slug).hasData, true);
    normalizeRate(await read('rate_' + slug + '.json'));
  }
});

test('plain-language insights are optional, text-only and level-checked', async () => {
  assert.equal(cleanInsights(null), null);
  assert.equal(cleanInsights({ summary: '   ' }), null);
  const odd = cleanInsights({ summary: ' Short. ', confidence: { where: 'certain', how_fast: 'low' }, points: [{ heading: 'A', text: 'b' }, { heading: 5, text: 'x' }, { heading: 'C' }, null] });
  assert.equal(odd.summary, 'Short.'); assert.equal(odd.confidence, null); assert.deepEqual(odd.points, [{ heading: 'A', text: 'b' }]);
  const ok = cleanInsights({ summary: 'S', confidence: { where: 'high', how_fast: 'low' }, points: [] });
  assert.equal(ok.confidence.where_label, 'Where it is sinking'); assert.equal(ok.confidence.how_fast, 'low');
  // every exported study carries usable insights
  const root = new URL('../../data/processed/', import.meta.url);
  const areas = normalizeHotspots(JSON.parse(await readFile(new URL('hotspots.geojson', root), 'utf8')));
  for (const { properties: { slug } } of areas.features) {
    const series = JSON.parse(await readFile(new URL('timeseries_' + slug + '.json', root), 'utf8'));
    const ins = cleanInsights(series.insights);
    assert.ok(ins && ins.confidence && ins.points.length >= 5, slug + ' needs insights');
    assert.ok(series.sign_convention && series.data_release, slug + ' needs sign convention and data release');
  }
});

test('time-slider pictures are strictly validated', async () => {
  const ok = { hotspot: 'eloy', units: 'cm', bounds: [[32, -112], [33, -111]], vmin: -60, vmax: 10, dates: ['2016-01-01', '2016-07-01'],
    frames: ['cumulative/cum_eloy_00.png', 'cumulative/cum_eloy_01.png'], masks: { sinking: 'cumulative/mask_sinking_eloy.png' } };
  assert.equal(normalizeCumulative(ok, 'eloy').frames.length, 2);
  assert.throws(() => normalizeCumulative(ok, 'willcox'), /matching/);
  assert.throws(() => normalizeCumulative({ ...ok, frames: ['cumulative/a.png'] }, 'eloy'), /one safe picture per date/);
  assert.throws(() => normalizeCumulative({ ...ok, frames: ['../secret.png', 'cumulative/b.png'] }, 'eloy'), /safe picture/);
  assert.throws(() => normalizeCumulative({ ...ok, frames: ['https://example.com/x.png', 'cumulative/b.png'] }, 'eloy'), /safe picture/);
  assert.throws(() => normalizeCumulative({ ...ok, dates: ['2016-07-01', '2016-01-01'] }, 'eloy'), /increasing/);
  assert.throws(() => normalizeCumulative({ ...ok, masks: { sinking: '../x.png' } }, 'eloy'), /Unsafe/);
  // every exported study has a matching, complete set of pictures on disk
  const root = new URL('../../data/processed/', import.meta.url);
  const areas = normalizeHotspots(JSON.parse(await readFile(new URL('hotspots.geojson', root), 'utf8')));
  for (const { properties: { slug } } of areas.features) {
    const cum = normalizeCumulative(JSON.parse(await readFile(new URL('cumulative_' + slug + '.json', root), 'utf8')), slug);
    const series = normalizeSeries(JSON.parse(await readFile(new URL('timeseries_' + slug + '.json', root), 'utf8')), slug);
    assert.deepEqual(cum.dates, series.dates, slug + ': pictures and chart must use the same dates');
    for (const file of [...cum.frames, ...Object.values(cum.masks)]) await readFile(new URL(file, root));
  }
});

test('About us content is optional, strict and text-only', async () => {
  assert.equal(cleanTeam(null), null); assert.equal(cleanTeam({ members: [] }), null); assert.equal(cleanTeam({ members: [{ role: 'x' }] }), null);
  const t = cleanTeam({ intro: ' Hi ', members: [
    { name: ' Ada ', role: 'Lead', study: 'Physics', interests: 'radar, water ,', bio: 'b', photo: 'assets/team/ada.jpg',
      links: [{ label: 'Site', url: 'https://example.com/a' }, { label: 'Bad', url: 'javascript:alert(1)' }, { label: '', url: 'https://x.org' }] },
    { name: 'Bo', photo: '../secret.png' }, { name: 5 }] });
  assert.equal(t.intro, 'Hi'); assert.equal(t.members.length, 2);
  const [a, b] = t.members;
  assert.deepEqual(a.interests, ['radar', 'water']); assert.deepEqual(a.links, [{ label: 'Site', url: 'https://example.com/a' }]);
  assert.equal(a.photo, 'assets/team/ada.jpg'); assert.equal(b.photo, null);
  // the shipped file is valid, and the page links to a section that exists
  const team = cleanTeam(JSON.parse(await readFile(new URL('../team.json', import.meta.url), 'utf8')));
  assert.ok(team && team.members.length >= 1);
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /href="#about"/); assert.match(html, /id="about"/);
});

test('header: name and tagline come before the navigation, and the tagline is one sentence', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const header = html.slice(html.indexOf('<header class="masthead">'), html.indexOf('</header>'));
  assert.ok(header.indexOf('class="wordmark"') < header.indexOf('class="project-label"') && header.indexOf('class="project-label"') < header.indexOf('<nav'));
  const label = header.match(/class="project-label">([^<]+)</)[1];
  assert.equal((label.match(/[.!?](\s|$)/g) || []).length, 1, 'exactly one sentence: ' + label);
});
