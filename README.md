# Sinkronized

*The desert sinks, and the radar keeps the beat.*

**Live site: https://sinkronized.vercel.app/web/**

NASA Space Apps 2026, challenge **Dancing with the SARs** (NISAR).

Arizona's aquifers are being pumped faster than they refill, so the ground is sinking, and much of that loss is permanent. Sinkronized is a free, interactive website that shows where southern Arizona is sinking, how fast, how sure we are, and what lies beneath. It uses ten years of Sentinel-1 radar as the long record and tests NASA's new NISAR L-band radar on its first year.

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

## What the website offers

- Plain-language questions that lead to a chart and a short answer, with the reasoning one click away.
- A map of the five study areas with ten years of ground motion, NISAR's first year, ADWR's official sinking zones, probable mines and places we checked and found steady.
- A report for each study area: headline rate and ranking, a 2016-2026 time-lapse, whether both satellite look directions agree, what lies beneath (basin, clay layers, falling water table, mapped earth fissures, whether the ground can come back), and the methods and checks.
- A side-by-side geology comparison of all five areas, "How we measured", "Limits", and every source.
- Two reading levels, chosen with a switch under the header: **Plain language** for everyone, and **Research detail** with methods, statistics, uncertainty budgets and cited hydrogeology for researchers and water engineers (the same design and data; only the wording and depth change).
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

## Repository layout

```
web/            the website (static: HTML, CSS, JavaScript, Leaflet)
data/processed/ the data the website reads (rates, time series, tiles, summaries)
src/            the processing pipeline (Python)
docs/           the story, submission text, sources, fact-check log, method notes
```

Start with [docs/PROJECT_NARRATIVE.md](docs/PROJECT_NARRATIVE.md) for the whole story, [docs/PROJECT_SUBMISSION.md](docs/PROJECT_SUBMISSION.md) for the submission text, and [docs/REFERENCES.md](docs/REFERENCES.md) for sources. Raw downloads (`data/raw/`) are not stored in the repository.

## Limits

- NISAR's record is about a year, too short for a trusted speed. Its first year is a test, not the headline.
- Radar measures slanted line-of-sight motion, not straight down.
- C-band radar can over-read sinking over farmland.
- Pumping figures are model estimates; well data come from two programs.
- Sinking that matches farming and wells does not prove who caused it.
- Mapped earth-fissure data are as of 2016; no mapped fissure is not proof of none.
- "Can the ground come back?" is a study result for Eloy and Willcox only; for the other areas it is our inference and is labelled that way.
- NISAR data are Provisional, so numbers are preliminary.

## Data

NASA NISAR L2 GUNW and GCOV (Provisional), OPERA DISP-S1 (Sentinel-1), checked against ADWR subsidence products, with USDA cropland, USGS pumping estimates and well measurements, Arizona Geological Survey fissure maps, and OpenStreetMap to flag probable mines. Sources, terms and licences: [docs/DATA_AND_LICENSES.md](docs/DATA_AND_LICENSES.md).

## Use of AI

An AI coding assistant helped write and debug code and draft text. The logo was generated with ChatGPT and is labelled on the site; the phone background illustration is AI-assisted artwork and is labelled. No measured value came from an AI tool. Details: [AI_USAGE.md](AI_USAGE.md).

## Team

Reshma Panibhate (radar processing and validation), Mansi Ganga Nayak (interactive map and engineering), Ritam Bhabak (design and regional storytelling). An independent team project, not an official NASA or agency product.

## Licence

Code: MIT, see [LICENSE](LICENSE). Derived data in `data/processed/` may be reused with attribution to this project and its sources. Dependencies: `requirements.txt`. How to cite: `CITATION.cff`.

## Run the website locally

From the repository root:

```
python -m http.server 8765
```

Open http://localhost:8765/web/index.html. The site reads its data from `data/processed/`, so the server must be started at the repository root. To rebuild the data files from the processed cubes: `python src/export_web.py` then `python src/export_contract.py`.
