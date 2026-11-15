import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSeries, normalizeRate, normalizeHotspots, validateGeoJSON, safeSourceURL, formatNumber, cleanInsights, normalizeCumulative, cleanTeam, cleanNisar, cleanPumping, cleanGroundwater } from '../model.mjs';
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

test('NISAR summary: the real file validates; any bad or missing field hides the section', async () => {
  const raw = JSON.parse(await readFile(new URL('../../data/processed/nisar_summary.json', import.meta.url), 'utf8'));
  const n = cleanNisar(raw);
  assert.ok(n, 'real summary is valid');
  assert.ok(n.pattern.r > 0 && n.pattern.r <= 1 && n.pattern.blocks > 1000);
  assert.match(n.willcox.date, /^\d{4}-\d{2}-\d{2}$/);
  const bad = (path, value) => { const c = JSON.parse(JSON.stringify(raw)); let o = c; const k = path.split('.'); k.slice(0, -1).forEach(x => { o = o[x]; }); o[k.at(-1)] = value; return cleanNisar(c); };
  assert.equal(bad('pattern.r', null), null);
  assert.equal(bad('pattern.r', 3), null);
  assert.equal(bad('confirm.willcox.date', '2027-13-45'), null);
  assert.equal(bad('figure', '../evil.png'), null);
  assert.equal(bad('sinking.nisar_cm_yr', 'NaN'), null);
  assert.equal(bad('farmland.auc_hh_spread', 0.2), null);
  assert.equal(bad('farmland.portrait.checks_passed', false), null, 'portrait hidden if its caption checks failed');
  assert.equal(bad('farmland.portrait.file', '../x.jpg'), null);
  assert.ok(n.farmland.portrait && n.farmland.portrait.pink > 70);
  assert.equal(bad('farmland.figure', 'x/../y.png'), null);
  assert.equal(bad('farmland.rate_diff_lo', null), null);
  assert.equal(bad('directions.asc_mm', 'x'), null);
  assert.equal(bad('directions.span_days', null), null);
  assert.equal(cleanNisar(null), null);
  assert.equal(cleanNisar({}), null);
});

test('Overview: the NISAR section sits right after the hero, is hidden until data validates, and the hero links to it', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const i = html.indexOf('id="overview-nisar"');
  assert.ok(i > html.indexOf('id="evidence"') && i < html.indexOf('id="atlas"'), 'the NISAR panel lives in the Evidence view');
  assert.match(html.slice(i - 80, i + 200), /hidden/);
  assert.match(html, /href="#overview-nisar"/);
  const spans = [...html.matchAll(/data-nisar="([a-z0-9-]+)"/g)].map(m => m[1]);
  assert.ok(spans.length >= 15);
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  for (const key of new Set(spans)) assert.ok(app.includes(key === 'r' || /^[a-z]+$/.test(key) ? key : "'" + key + "'"), 'app.js fills ' + key);
});

test('Pumping summary: the real file validates; any bad or missing field hides the section', async () => {
  const raw = JSON.parse(await readFile(new URL('../../data/processed/pumping_summary.json', import.meta.url), 'utf8'));
  const p = cleanPumping(raw);
  assert.ok(p, 'real summary is valid');
  assert.ok(p.high < p.none, 'sinking is faster where pumping is highest');
  const bad = (k, v) => cleanPumping({ ...raw, [k]: v });
  assert.equal(bad('rho', null), null);
  assert.equal(bad('rho', 2), null);
  assert.equal(bad('rate_high', 'x'), null);
  assert.equal(bad('fields', 0), null);
  assert.equal(cleanPumping(null), null);
  assert.equal(cleanPumping({}), null);
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const i = html.indexOf('id="overview-pumping"');
  assert.ok(i > html.indexOf('id="overview-nisar"') && i < html.indexOf('id="atlas"'));
  assert.match(html.slice(i - 20, i + 200), /hidden/);
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  for (const key of new Set([...html.matchAll(/data-pump="([a-z0-9-]+)"/g)].map(m => m[1]))) assert.ok(app.includes(key === 'acft' || /^[a-z]+$/.test(key) ? key : "'" + key + "'"), 'app.js fills ' + key);
});

test('views: four views and three evidence tabs exist, every tab has its panel, and the page works without the script', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const v of ['overview', 'evidence', 'map', 'about']) assert.equal((html.match(new RegExp('data-view="' + v + '"', 'g')) || []).length, 1, v);
  const tabs = [...html.matchAll(/role="tab" id="tab-[a-z]+" aria-controls="([a-z-]+)"/g)].map(m => m[1]);
  assert.deepEqual(tabs, ['overview-nisar', 'overview-farmland', 'overview-pumping', 'overview-groundwater']);
  for (const id of tabs) assert.match(html, new RegExp('<section id="' + id + '"[^>]*role="tabpanel"'));
  const css = await readFile(new URL('../design-system.css', import.meta.url), 'utf8');
  assert.match(css, /html\.views-on \[data-view\]:not\(\.is-active\)\{display:none/, 'hiding is gated on html.views-on, so a failed script leaves the full page');
  assert.ok(!/\[data-view\]:not\(\.is-active\)\{display:none/.test(css.replace(/html\.views-on \[data-view\]:not\(\.is-active\)\{display:none/, '')), 'no ungated hiding rule');
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /classList\.remove\('views-on'\)/, 'falls back to the full page on error');
});

test('nothing was removed: the text of every earlier section is still on the page', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const phrase of ['Arizona is our home.', 'A familiar landscape.', 'A clearer view of the ground we share.', 'What the research already tells us', 'Why look in both directions?',
    'NASA’s newest radar satellite, tested on Arizona.', 'Radar also shows what covers the ground', 'Where farms are estimated to pump the most', 'Farmland can fool this radar', 'From the other side',
    'What this does not show', 'Other cautions', 'Where NISAR and Sentinel-1 do not agree', 'The people behind', 'Explore study regions'])
    assert.ok(html.includes(phrase), phrase);
});

test('app.js and model.mjs parse as modules (a duplicate declaration or typo would break the whole page)', async () => {
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { execFileSync } = await import('node:child_process');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'syntax-'));
  for (const name of ['app.js', 'motion.js', 'model.mjs']) {
    const file = join(dir, name.replace(/\.js$/, '.mjs'));
    writeFileSync(file, await readFile(new URL('../' + name, import.meta.url), 'utf8'));
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });   // throws with the error text if the syntax is invalid
  }
});

test('footer text is dark enough for the light footer background (it was pale sand on cream, 1.2:1)', async () => {
  const css = await readFile(new URL('../design-system.css', import.meta.url), 'utf8');
  const rules = [...css.matchAll(/\.page-footer\{([^}]*)\}/g)].map(m => m[1]);
  const last = (prop) => rules.map(r => (r.match(new RegExp('(?:^|;)\s*' + prop + ':\s*([^;]+)')) || [])[1]).filter(Boolean).pop();
  assert.equal(last('background'), 'var(--canvas)');
  assert.equal(last('color'), 'var(--ink)', 'the final footer text colour must be the dark ink, not the pale surface colour');
});

test('navigation items share one style (no pill, no odd colour), and the current view is marked', async () => {
  const css = await readFile(new URL('../design-system.css', import.meta.url), 'utf8');
  const i = css.indexOf('.masthead nav>a[href],.masthead nav>button[type]{font:');
  assert.ok(i > 0, 'one shared rule for every nav link and button');
  const rule = css.slice(i, css.indexOf('}', i));
  for (const part of ['font:600 13px/1.25 var(--sans)', 'color:var(--ink)', 'background:none', 'border-radius:0']) assert.ok(rule.includes(part), part);
  assert.ok(i > css.lastIndexOf('.masthead nav .nav-explore{'), 'the shared rule comes after the old pill rule');
  assert.match(css, /\.masthead nav>a\[href\]\[aria-current=page\]\{color:var\(--rust\)/);
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const nav = html.slice(html.indexOf('<nav aria-label="Site navigation">'), html.indexOf('</nav>', html.indexOf('<nav aria-label="Site navigation">')));
  assert.equal((nav.match(/<a /g) || []).length + (nav.match(/<button /g) || []).length, 7, 'Overview, Evidence, Study regions, How we measured, Limits, About us, Resources');
});

test('Groundwater summary: the real file validates; bad fields hide the tab', async () => {
  const raw = JSON.parse(await readFile(new URL('../../data/processed/groundwater_summary.json', import.meta.url), 'utf8'));
  const g = cleanGroundwater(raw);
  assert.ok(g, 'real summary is valid');
  assert.ok(g.wells > 100 && g.rho < 0 && g.rhoHi < 0, 'a negative link whose range excludes zero');
  assert.equal(cleanGroundwater({ ...raw, rho: 2 }), null);
  assert.equal(cleanGroundwater({ ...raw, q: raw.q.slice(0, 3) }), null);
  assert.equal(cleanGroundwater({ ...raw, wells: null }), null);
  assert.equal(cleanGroundwater(null), null);
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  for (const key of new Set([...html.matchAll(/data-gw="([a-z0-9-]+)"/g)].map(m => m[1]))) assert.ok(app.includes(/^[a-z]+$/.test(key) ? key + ':' : "'" + key + "'"), 'app.js fills ' + key);
});
