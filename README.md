# Sinkronized

*The desert sinks, and the radar keeps the beat.*

**Live site: https://sinkronized.vercel.app/web/**

NASA Space Apps 2026, challenge **Dancing with the SARs** (NISAR). An independent team project, not an official NASA or agency product.

Arizona's aquifers are being pumped faster than they refill, so the ground is sinking, and much of that loss is permanent. Sinkronized is a free, interactive website that shows where southern Arizona is sinking, how fast, how sure we are, and what lies beneath. It uses ten years of Sentinel-1 radar as the long record and tests NASA's new NISAR L-band radar on its first year.

This README is the one place that explains the whole project. The few other documents are listed under [Documents](#documents).

## Contents

[Why this matters](#why-this-matters) · [What we found](#what-we-found) · [How the plan changed](#how-the-plan-changed) · [What the website offers](#what-the-website-offers) · [Method](#method) · [Limits](#limits) · [Data](#data) · [Papers and sources](#papers-and-sources) · [Repository layout](#repository-layout) · [Run it](#run-it) · [Reproduce the data](#reproduce-the-data) · [Use of AI](#use-of-ai) · [Team](#team) · [Licence](#licence) · [Documents](#documents)

## Why this matters

Groundwater loss is invisible. When water levels fall, clay layers in the aquifer compact and the land surface sinks, and the part of that compaction that goes past the clay's previous limit is largely permanent: the aquifer loses storage it never gets back. Sinking cracks canals, wells, roads and foundations and opens earth fissures. Southern Arizona has some of the best-documented subsidence in the United States (for example 1.09 m of measured sinking near Eloy in 1965-1983), and the Willcox basin is under the same pressure today. Radar from space turns this slow change into a measured number across a whole region.

The site is for planners and water managers, researchers, conservation groups, and the public. It does not tell anyone who caused the sinking and it is not engineering advice.

## What we found

Rates are along the satellite's line of sight; negative means sinking. Every number is on the site with its uncertainty and limits.

| Study area | Rate, 2016-2026 (cm/yr) | Look directions |
|---|---|---|
| Fort Grant Road, north of Willcox | -4.9 +/- 0.6 | both agree |
| Elfrida area, south of Willcox | -3.1 +/- 0.5 | both agree |
| Willcox basin (386 km2) | -2.7 +/- 0.4 | both agree |
| Bowie - San Simon, east of Willcox | -2.6 +/- 0.6 | one only (unconfirmed) |
| Eloy - Picacho | -1.3 +/- 0.4 | both agree |

- The four Willcox-area maps match Arizona Department of Water Resources (ADWR) radar products (pattern correlation 0.94 to 0.99). Eloy matches only moderately with ADWR's Sentinel-1 (0.59) and weakly with its RADARSAT-2 (0.18).
- NISAR's first year: removing its own troposphere error cut the scatter by 24%; its pattern matches the ten-year Sentinel-1 pattern across 12,850 map blocks (correlation 0.58). One year is too short for a trustworthy speed, so we publish none; we estimate NISAR can confirm Willcox around February 2027.
- Cropland is 2.1% of the Willcox study box but 7.4% of its sinking area. Where estimated pumping is highest the ground sinks a median 2.3 cm/yr; in 236 wells the water table fell a median 69 feet over 31 years, and where it fell faster the ground sinks faster (rank correlation -0.41). This shows association, not cause.
- We first looked at the West Valley, where data centers are being built. Ten years of radar show it is steady (within about 0.5 cm/yr), so it is marked as checked and is not a study area.

## How the plan changed

The first plan was three hotspots (Eloy as the validation site, Buckeye/Goodyear for data centers, Willcox for the wildlife story), with NISAR stacks giving the headline rates. The data changed it:

- **NISAR could not carry the headline.** Its record is about a year at Willcox and under four months at Eloy, too short and noisy for a trustworthy rate. The headline rates come from ten years of Sentinel-1, and NISAR is tested alongside it (pattern, weather correction, two look directions, farmland from backscatter).
- **Buckeye was dropped.** Sentinel-1 shows the West Valley steady, so the data-center story has nothing to show. The site says so instead of inventing a result.
- **Five study areas instead of three,** found by scanning whole Sentinel-1 frames for sinking clusters and checking each in both look directions.
- **Not built:** data-center, protected-habitat and Active Management Area overlays, a coherence layer, a time slider (replaced by a 2016-2026 time-lapse and scrubbable graph in each report) and the Sedona flood sidebar.
- **Added:** the cause-side evidence (estimated pumping, 236 wells), per-area geology, mapped earth fissures, soils, and two reading levels.

## What the website offers

- Plain-language questions that lead to a chart and a short answer, with the reasoning one click away.
- A map of the five study areas with ten years of ground motion, NISAR's first year, ADWR's official sinking zones, probable mines and places we checked and found steady.
- A report for each study area: headline rate and ranking, a 2016-2026 time-lapse, whether both satellite look directions agree, what lies beneath (basin, clay layers, falling water table, mapped earth fissures, whether the ground can come back), and the methods and checks.
- A side-by-side geology comparison of all five areas, "How we measured", "Limits", and every source.
- Two reading levels, chosen with a switch under the header: **Plain language** for everyone, and **Research detail** with methods, statistics, uncertainty budgets, USDA soil survey and cited hydrogeology for researchers and water engineers (the same design and data; only the wording and depth change).
- It works by keyboard and screen reader, and on phones.

## Method

1. Read NISAR L2 GUNW (geocoded unwrapped interferograms) and GCOV (backscatter) from ASF, streaming only the window needed from each large file.
2. Convert unwrapped phase to line-of-sight displacement, `d = -(wavelength / 4 pi) * phase`, with the wavelength and sign convention read from the file.
3. Mask low-coherence pixels and unreliable connected components; remove the ionosphere and troposphere; reference to stable ground.
4. Chain connected pairs on one track, fit rates with uncertainty from spatial block resampling, and never mix ascending and descending tracks directly.
5. Combine with NASA JPL's OPERA Sentinel-1 displacement (2016-2026), USDA cropland, USGS pumping estimates and USGS/ADWR well measurements.
6. Compare with ADWR's InSAR products and with the opposite satellite look direction.
7. Add geology from USGS reports and earth fissures mapped by the Arizona Geological Survey (data as of 2016).
8. Publish as a static site. Every value is loaded through strict checks that hide a section rather than show a wrong number.

## Limits

- NISAR's record is about a year, too short for a trusted speed. Its first year is a test, not the headline.
- Radar measures slanted line-of-sight motion, not straight down.
- C-band radar can over-read sinking over farmland (published estimates: about 2-4 cm/yr in some California fields).
- Pumping figures are model estimates; well data come from two programs.
- Sinking that matches farming and wells does not prove who caused it.
- Mapped earth-fissure data are as of 2016; no mapped fissure is not proof of none. Soil data are survey data, not a 2026 measurement.
- "Can the ground come back?" is a study result for Eloy and Willcox only; for the other areas it is our inference and is labelled that way.
- NISAR data are Provisional, so numbers are preliminary.
- Historical USGS figures (1955-2006) are cited with their years; they describe past conditions.

## Data

NASA NISAR L2 GUNW and GCOV (Provisional), OPERA DISP-S1 (Sentinel-1), checked against ADWR subsidence products, with USDA cropland and soil survey, USGS pumping estimates and well measurements, Arizona Geological Survey fissure maps, and OpenStreetMap to flag probable mines. Sources, terms and licences: [docs/DATA_AND_LICENSES.md](docs/DATA_AND_LICENSES.md).

## Papers and sources

Every claim on the site names its source. Two papers were read in full (Job and others 2023; Devlin and Lohman 2025), and four are cited from abstracts only and labelled that way (Smilovsky 2025, Peng and others 2022, Devlin 2025 dissertation, Saporta and others 2021). [docs/PAPERS_USED.md](docs/PAPERS_USED.md) lists every detail taken from each paper and where it appears; [docs/REFERENCES.md](docs/REFERENCES.md) is the reference list; [docs/fact_check.md](docs/fact_check.md) records how each claim was checked.

## Repository layout

```
web/            the website (static: HTML, CSS, JavaScript, Leaflet) and its tests
data/processed/ the data the website reads (rates, time series, tiles, summaries)
src/            the processing pipeline (Python)
docs/           references, licences, fact-check log, paper ledger, evidence notes
```

Raw downloads (`data/raw/`, large HDF5 and GeoTIFF files) are not stored in the repository; neither are credentials (`.env`).

## Run it

The site is static. From the repository root:

```
python -m http.server 8765
```

Open http://localhost:8765/web/index.html. The site reads its data from `data/processed/`, so the server must be started at the repository root. Tests (Node 18 or later): `node --test web/tests/model.test.mjs`. The page is deployed on Vercel from this repository (`vercel.json`).

## Reproduce the data

`data/processed/` already holds every output the site needs, so re-running is optional. To rebuild from source you need Python 3 with `pip install -r requirements.txt`, an Earthdata account (put `EARTHDATA_TOKEN=...` in a local `.env`, never commit it) and tens of gigabytes of disk. Each script's first lines say what it reads and writes. Approximate order:

1. **Find and fetch NISAR:** `search_tracks.py`, `list_scenes.py`, `download.py`, `gcov_remote.py`.
2. **Sentinel-1 record:** `opera_download.py`, `opera_stack.py`, then `opera_scan.py`, `opera_frames_az.py`, `opera_frames_north.py` and `opera_field_rates.py` for hotspot search and farm-scale rates.
3. **NISAR processing and tests:** `gunw.py`, `corrections.py`, `stack.py`, `nisar_noise_test.py`, `nisar_track149.py`, `nisar_two_directions.py`, `nisar_when.py`, `gcov_extract.py`, `gcov_farmland.py`, `gcov_portrait.py`, `compare_nisar_s1.py`.
4. **Validation and cause-side evidence:** `validate_adwr.py`, `groundwater_download.py`, `groundwater_vs_sinking.py`, `pumping_vs_sinking.py`, `fissures_azgs.py`, `soils_nrcs.py`, `geocode_clusters.py`, `geology_areas.py`.
5. **Export for the site:** `export_web.py`, then `export_contract.py`, `export_nisar.py`, `export_pumping.py`, `export_groundwater.py`, `insights.py`, and `optimize_images.py`.

## Use of AI

An AI coding assistant helped write and debug code and draft text. The logo was generated with ChatGPT and is labelled on the site; the phone background illustration is AI-assisted artwork and is labelled. No measured value came from an AI tool. Details: [AI_USAGE.md](AI_USAGE.md).

## Team

Reshma Panibhate (radar processing and validation), Mansi Ganga Nayak (interactive map and engineering), Ritam Bhabak (design and regional storytelling).

## Licence

Code: MIT, see [LICENSE](LICENSE). Derived data in `data/processed/` may be reused with attribution to this project and its sources. Dependencies: `requirements.txt`. How to cite: `CITATION.cff`.

## Documents

| File | What it is |
|---|---|
| [AI_USAGE.md](AI_USAGE.md) | AI assistance and AI-generated image disclosure |
| [docs/DATA_AND_LICENSES.md](docs/DATA_AND_LICENSES.md) | Every dataset, its terms and licence |
| [docs/REFERENCES.md](docs/REFERENCES.md) | Reference list |
| [docs/PAPERS_USED.md](docs/PAPERS_USED.md) | What we use from each paper, and how much of it we could read |
| [docs/fact_check.md](docs/fact_check.md) | How each claim was checked |
| [docs/overview_evidence.md](docs/overview_evidence.md) | Evidence-to-claim notes behind the Overview |
| [docs/adwr_validation.md](docs/adwr_validation.md) | Comparison with ADWR's radar products |
