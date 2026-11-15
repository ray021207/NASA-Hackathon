# UI data contract

For whoever builds the front end (`web/`). All data is produced by our pipeline (`src/export_contract.py`) into `data/processed/`. The UI only reads files; it never computes rates.
The files below already pass the validators in `web/model.mjs` on the `ui/sonoran-sand` branch (checked with node), apart from the one change in section 1.

## 1. Required UI changes (small)

1. **Study areas changed.** Buckeye was dropped (no sinking above about 0.5 cm/yr found there) and the southeast areas were added. The slugs are now:
   `eloy`, `willcox`, `north_willcox`, `south`, `east`.
   In `web/app.js`: update `SLUGS` (line 5) and the check that requires exactly three features (around line 346). Read the slug list from `hotspots.geojson` instead of hard-coding it. "Study 01" numbering should follow the file order.
2. `hotspots.geojson` features carry `slug`, `name`, `tagline`, `county`, `story`, `confirmation`, `land_use_note`, `source_note`. Polygons are the **study boxes**, not the sinking areas.

## 2. Files in `data/processed/`

| File | Content |
|---|---|
| `hotspots.geojson` | one Polygon feature per study area (properties above) |
| `timeseries_<slug>.json` | contract fields: `hotspot`, `units` ("cm"), `reference`, `dates`, `displacement`, `rate_cm_yr`, `rate_sigma`, `adwr_rate_cm_yr` (null). Extra fields: `track`, `median_rate_cm_yr`, `p5_rate_cm_yr`, `fastest_rate_cm_yr`, `area_km2`, `ascending_check`, `confirmation`, `stable_ground_displacement`, `nisar` (object or null), `caveats` (list of strings), `source` |
| `rate_<slug>.png` + `.json` | Sentinel-1 rate over the study box, EPSG:4326, `bounds` [[s,w],[n,e]], `units` "cm/yr", `vmin` -6, `vmax` 2, `dates` [first, last] |
| `rate_sentinel1_descending.png/.json` | region-wide Sentinel-1 rate mosaic (southern and central Arizona), same fields |
| `rate_sentinel1_ascending.png/.json` | ascending-track cross-check, one frame, same fields |
| `rate_nisar_willcox.png/.json`, `rate_nisar_eloy.png/.json` | NISAR rate relative to the box median. PRELIMINARY, see section 4 |
| `cumulative_<slug>.json` + `cumulative/` folder | Time-slider data: one map picture per satellite date (total change since the first date, cm), plus two masks (the pixels behind the "sinking area" and "stable ground" chart lines). See section 9 |
| `mines_excluded.geojson` | Points where the signal is probably mining, not groundwater (`name`, `reason`, `source`) |
| `checked_flat.geojson` | Points we checked and found no sinking (`name`, `median_rate_cm_yr`, `p5_rate_cm_yr`) |

Now provided: `adwr_subsidence.geojson` (the 32 official ADWR subsidence-area polygons, May 2026; the existing ADWR layer picks it up) and `adwr_rate_cm_yr` in each time series (ADWR's own Sentinel-1 deformation raster averaged over our sinking pixels). Also in each series: `adwr_rs2_rate_cm_yr` (ADWR RADARSAT-2, independent sensor), `adwr_feature`, `adwr_comparison`, `adwr_note`. Dropped from scope: data-center and habitat layers (no sourced data; the data-center story belonged to the dropped Buckeye area). The app no longer lists them.

## 3. Sign and units

- Everything is **line of sight** (LOS), in cm or cm/yr. **Negative = ground moving away from the satellite = sinking.** Positive = rising (usually wet or swelling soil, not real uplift).
- `rate_cm_yr` is a straight-line fit to the average of the sinking pixels. `median_rate_cm_yr` is the median of the sinking pixels and is the better headline number. Sinking pixels are those faster than `sinking_threshold_cm_yr` (-1).
- `rate_sigma` is the uncertainty the UI shows next to `rate_cm_yr`. It combines the straight-line fit error with half the difference between the descending and ascending satellite medians (`rate_sigma_fit_only` and `rate_sigma_systematic` give the two parts; `rate_sigma_note` explains it). For `east`, which has no ascending check, the systematic part is a conservative proxy. Do not replace it with the fit-only value: that is about 0.1 cm/yr and overstates precision.
- `displacement` is cumulative since the first date, about 6-month steps, 2016 to 2026.
- Do not present these as vertical subsidence. Say "line of sight" where numbers appear.

## 4. NISAR: how to show it honestly

- NISAR started in late 2025. Willcox has about 1 year of data and Eloy has under 4 months. Both are Provisional, with gaps.
- In `timeseries_<slug>.json`, `nisar` is an object for `eloy` and `willcox` and null elsewhere. It always has `"reliable": false`. Show its numbers with that label and the `scope` text, and do not present its rate as a result.
- The NISAR raster layers must be **off by default**. Drawn raw they paint the whole box red; the files are already relative to the box median. Badge: "Provisional, short record".
- Layer order: NISAR above Sentinel-1.

## 5. Display rules the data depends on

- `confirmation` is one of: "both look directions", "single look direction", "weak in second direction". Show it as a visible chip. "single look direction" must look unconfirmed.
- Show `caveats` in every panel (collapsed is fine, but present).
- Show `stable_ground_displacement` as a second line in the chart when present: it shows the measurement noise.
- Do not invent numbers. `null` means unknown. The ADWR comparison reads "not yet compared".
- Mines and out-of-state areas are marked; do not label them as groundwater subsidence.
- Study-area names use ADWR's official feature names (verified: every area's sinking pixels lie inside the matching ADWR feature).

## 6. Regenerating

`python src/export_contract.py` rewrites every file above from the processed cubes. Do not edit these files by hand.

## 7. Plain-language insights and what the app shows

Each `timeseries_<slug>.json` has an `insights` object, written for non-experts (about US grade 7), produced by `src/insights.py` from the study's own numbers:

- `summary`: one or two sentences (total drop over the record, in cm and inches).
- `confidence`: `where` and `how_fast`, each `high`, `medium` or `low`, from fixed rules (see `src/insights.py`), plus labels.
- `points`: list of `{heading, text}`: what we found, how sure are we, why is the ground sinking, why it matters, what about NASA's new satellite, good to know.

The app shows `insights` first ("In plain terms"), then the technical panel. Also shown: `rate_sigma_note`, `caveats`, `nisar.status_note`, `land_use_note`, `sign_convention`, `data_release`, the stable-ground chart line, the ADWR comparison and the study `confirmation`.

Layers in the panel, in four groups, each with a one-line explanation (`LAYER_INFO` in `web/app.js`): Where to look (study areas); What we measured (ground motion for the selected area, the regional `rate_sentinel1_descending` map, and one NISAR switch covering `rate_nisar_willcox` and `rate_nisar_eloy`, hidden by default, provisional); The official record (ADWR areas); Read with care (`mines_excluded`, `checked_flat`). `rate_sentinel1_ascending` is still exported (the cross-check is explained in the Overview) but is not a panel layer. Rate-image JSON carries `sign_convention` and `data_release`, shown as the layer's tooltip.

## 8. ADWR comparison: how to word it

- `adwr_rate_cm_yr` comes from the same satellite (Sentinel-1) as our rate, processed separately by ADWR. It is a **consistency check, not independent validation**. `adwr_rs2_rate_cm_yr` is an independent sensor over a longer period (2010 to 2026).
- ADWR does not document its raster units. We inferred metres from a regression against our own data (see `docs/adwr_validation.md`); say "inferred" wherever units matter.
- Eloy (Picacho) agrees only weakly: do not claim it is validated. See the table in `docs/adwr_validation.md`.

## 9. Interactive time chart (cumulative_<slug>.json)

Fields: `hotspot`, `units` ("cm"), `bounds` [[south, west], [north, east]], `vmin` (-60) and `vmax` (10) in cm, `dates` (same dates as the chart), `frames` (one picture path per date, under `cumulative/`), `masks.sinking` and `masks.stable`, `reference`, `note`.

- Each picture is the **total change since the first date**, only where the radar measured at every date. Blank means not measured, not zero. Same colour ramp for every study, so areas can be compared.
- The chart line equals the average of the pixels the pictures show; `src/export_contract.py` asserts this (difference below 0.005 cm) on every export.
- In the app: moving along the chart shows the readout and swaps the map to that date; clicking holds a date; Play steps through all dates; arrow keys, Home, End, Space and Escape work; the two buttons under the chart put the sinking-area or stable-ground pixels on the map. If the file is missing or invalid, the chart stays a plain chart (no broken controls).
- Paths must match `cumulative/<name>.png`; anything else is rejected by `normalizeCumulative()`.

## `nisar_summary.json` and `nisar_vs_sentinel1_willcox.png` (Overview, NISAR section)

Written by `src/export_nisar.py` from `nisar_vs_sentinel1.json` (`src/compare_nisar_s1.py`), `nisar_confirm.json` (`src/nisar_when.py`) and the troposphere test (`src/nisar_noise_test.py`). The Overview section `#overview-nisar` is hidden unless `cleanNisar` in `web/model.mjs` accepts the whole file (every number finite and in range, dates valid, figure name a plain `.png`). Fields: `pattern` (r, n_blocks), `weather_fix` (residual before/after in mm, percent), `sinking` (NISAR and Sentinel-1 rate relative to the rest, cm/yr), `playa` (net change, years, Sentinel-1 trends), `overlap` (r of the six-month change), `confirm.willcox` and `confirm.eloy` (Sentinel-1 rate, years for a 90% chance of 3 sigma, calendar date if no gaps, chance at one year), `figure`. The per-area plain-language NISAR sentence in `timeseries_<slug>.json` `insights` is built from the same file.

## `pumping_summary.json` (Overview, pumping section)

Written by `src/export_pumping.py` from `pumping_vs_sinking.json` (`src/pumping_vs_sinking.py`, which uses `src/opera_field_rates.py` for 30 m Sentinel-1 rates). The section `#overview-pumping` is hidden unless `cleanPumping` in `web/model.mjs` accepts the whole file. Fields: counts and totals from the USGS 2024 release, median sinking rate by pumping-density class (none, low, medium, high within `radius_km`), Spearman correlations with 95% ranges (pumping, pumped area only, acreage only, pumping given acreage), and the field-scale result with its coverage limits.

## `groundwater_summary.json` (Evidence, Water levels tab)

Written by `src/export_groundwater.py` from `groundwater_vs_sinking.json`. The tab `#overview-groundwater` is hidden unless `cleanGroundwater` accepts the whole file: well count, median decline (ft/yr) and total drop (ft), years, share of wells deeper, Spearman with 95% range and tile count, four decline quartiles (range, n, median sinking rate, share on sinking ground), sinking-to-decline ratio, baseline and recent year ranges.

## `geology.json` (study report, 'What lies beneath')

Written by `src/geology_areas.py`. `sources` maps an id to `{label, url, short}`; `areas.<slug>` has `basin`, `summary`, `layers` (top to bottom: `name`, `kind` in sand, clay, mixed, consolidated, evaporite, rock, `note`, `compacts`), `facts` (`text`, `source` id), `measured` (`rate_cm_yr`, `wells`, `decline_ft_yr` or null), `caveat`. `cleanGeology` drops any area whose facts cite unknown sources.
