// Build a portable preview from the same source used by the real app.
// No measured fixture values are created. Basemap tiles still require internet.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { normalizeHotspots } from './model.mjs';
const root = new URL('./', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const [html, css, mapCSS, designCSS, leafletCSS, leaflet, model, app, motion] = await Promise.all([
  read('index.html'), read('styles.css'), read('map.css'), read('design-system.css'), read('vendor/leaflet.css'),
  read('vendor/leaflet.js'), read('model.mjs'), read('app.js'), read('motion.js')
]);
const data = {}, images = {};
for (const name of await readdir(new URL('../data/processed/', root))) {
  if (/^(hotspots|adwr_subsidence|mines_excluded|checked_flat)\.geojson$/.test(name) || /^(timeseries_|rate_|cumulative_).*\.json$/.test(name) || name === 'nisar_summary.json' || name === 'pumping_summary.json' || name === 'groundwater_summary.json') {
    // A malformed optional file must not silently become a valid measurement.
    try { data[name] = JSON.parse(await read('../data/processed/' + name)); }
    catch { console.warn('Skipped malformed JSON: ' + name); }
  }
}
try { data['team.json'] = JSON.parse(await read('team.json')); } catch { console.warn('No usable team.json: the About us section will be empty in the preview.'); }
for (const feature of normalizeHotspots(data['hotspots.geojson']).features) {
  const name = 'rate_' + feature.properties.slug + '.png';
  try { images[name] = 'data:image/png;base64,' + (await readFile(new URL('../data/processed/' + name, root))).toString('base64'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
try { images['nisar_vs_sentinel1_willcox.png'] = 'data:image/png;base64,' + (await readFile(new URL('../data/processed/nisar_vs_sentinel1_willcox.png', root))).toString('base64'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
try { images['gcov_farmland_willcox.png'] = 'data:image/png;base64,' + (await readFile(new URL('../data/processed/gcov_farmland_willcox.png', root))).toString('base64'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
try { images['nisar_radar_portrait_willcox.jpg'] = 'data:image/jpeg;base64,' + (await readFile(new URL('../data/processed/nisar_radar_portrait_willcox.jpg', root))).toString('base64'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const inlineJS = 'window.ATLAS_PREVIEW_DATA=' + json(data) + ';window.ATLAS_PREVIEW_IMAGES=' + json(images) + ';\n' +
  model.replace(/^export /gm, '') + '\n' + app.replace(/^import .*?;\r?\n/, '');
let preview = html
  .replace('<link rel="stylesheet" href="./vendor/leaflet.css">', () => '<style>' + leafletCSS + '</style>')
  .replace('<link rel="stylesheet" href="./styles.css">', () => '<style>' + css + '</style>')
  .replace('<link rel="stylesheet" href="./map.css">', () => '<style>' + mapCSS + '</style>')
  .replace('<link rel="stylesheet" href="./design-system.css">', () => '<style>' + designCSS + '</style>')
  .replace('<script src="./vendor/leaflet.js" defer></script>', () => '<script>' + leaflet.replace(/<\/script/gi, '<\\/script') + '</script>')
  .replace('<script src="./motion.js" defer></script>', () => '<script type="module">' + motion.replace(/<\/script/gi, '<\\/script') + '</script>')
  .replace('<script type="module" src="./app.js"></script>', () => '<script type="module">' + inlineJS.replace(/<\/script/gi, '<\\/script') + '</script>')
  .replace('Independent team project · Preliminary research', 'Portable preview · Preliminary research');
const output = new URL('preview.html', root);
await writeFile(output, preview);
console.log('Created ' + output.pathname);

