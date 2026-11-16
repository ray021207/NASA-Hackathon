# Data, third-party material and licences

**Our code** (`src/`, `web/` except `web/vendor/`) is MIT-licensed, see `LICENSE`.
**Our derived data** (`data/processed/`) is published for reuse with attribution to this project and to the sources below. It is a derived, preliminary product, not an official record.

| Material | Used for | Source and terms |
|---|---|---|
| NISAR L2 GUNW, Provisional (DOI 10.5067/NIL2GUNW-P1) | Early ground-motion record, Willcox and Eloy | NASA/ISRO NISAR mission, distributed by the ASF DAAC. NASA's Earth science data policy makes data available fully and openly, without restrictions (the NISAR Data User Guide says NISAR follows NASA's standard Data Use and Citation Guidance; we cite the collections, the User Guide and the Science Users' Handbook). Provisional = intended for exploration and process studies, partially validated (per the ASF/Earthdata catalog entry). |
| OPERA DISP-S1 (Sentinel-1 displacement) | 2016-2026 sinking map and study-area rates | NASA JPL OPERA project via ASF DAAC. Derived from Copernicus Sentinel-1 data (ESA). Open with citation. |
| ADWR land-subsidence products | Check of our results; official sinking zones | Arizona Department of Water Resources. Used here as a published reference for comparison. **Terms not independently verified by us; attribute ADWR and do not present our maps as ADWR products.** |
| OpenStreetMap | Identifying probable mines and farmland near clusters | (c) OpenStreetMap contributors, ODbL. `mines_excluded` and `checked_flat` are derived from it. |
| USGS irrigation withdrawals, Willcox basin, 2024 (DOI 10.5066/P1ZU6T5N) | Field polygons with modelled irrigation withdrawals (acre-feet per year) for the pumping-vs-sinking analysis | USGS Arizona Water Science Center (Read, Kahler, Porter, Potteiger), published 2025-08-13, CC0 1.0 (public domain). Modelled estimates (modified Blaney-Criddle consumptive use); the release states no uncertainty. |
| USGS Water Data API (groundwater levels, parameter 72019) and ADWR GWSI Well Sites | Water-table decline per well, compared with sinking | Public government services; read without a key. Terms of reuse not independently verified; credited. |
| Esri basemap tiles | Map background | Esri terms of use; attribution is shown on the map. Not redistributed. |
| Copernicus GLO-30 DEM | Ground heights to apply NISAR's troposphere tables (not redistributed; cached locally) | Free licence from Copernicus/ESA; EGM2008 heights; for modified data the licence requires the notice: "produced using Copernicus WorldDEM-30 (c) DLR e.V. 2010-2014 and (c) Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved" (text from the Copernicus WorldDEM-30 licence). We do not redistribute the DEM; the notice is carried in docs/REFERENCES.md. |
| Leaflet 1.9.4 | Map library (`web/vendor/`) | BSD-2-Clause, `web/vendor/LICENSE-leaflet`. |
| Logo | Site identity | Generated with ChatGPT (OpenAI) from our own design brief, then edited by us. |

Python dependencies are listed with versions in `requirements.txt`.

## Reproduce
1. `pip install -r requirements.txt`
2. Put an Earthdata token in `.env` (never commit it).
3. Run the `src/` scripts in the order listed in the README ("Reproduce the data"), then `python src/export_contract.py` to rebuild `data/processed/`.
4. Serve the repo root (`python -m http.server`) and open `/web/`.

## Arizona Geological Survey earth fissure maps

- Source: GeoJSON in https://github.com/azgs/EarthFissureViewer (gh-pages/data), published by the Arizona Geological Survey with its Earth Fissure Viewer; data last updated 2016-02-04. The repository states no licence. We do not redistribute the raw lines; we publish only per-study-area totals (`data/processed/fissures_summary.json`), credited to the AZGS, with the data date.

## Phone Overview backdrop

- `web/assets/arizona-backdrop.svg` is original artwork made for this project (see AI_USAGE.md), released under the project licence. No third-party image is used.

## USDA NRCS Soil Survey (SSURGO) via Soil Data Access

- Source: USDA Natural Resources Conservation Service, Soil Survey Geographic Database (SSURGO), read through Soil Data Access (https://sdmdataaccess.sc.egov.usda.gov/). U.S. government data, public domain; credit NRCS.
- What we use (`src/soils_nrcs.py`, output `data/processed/soils.json`): for each study area, 120 random points in the whole box and 120 in the sinking zone are matched to soil map units; each map unit's components, horizons, restrictions, landforms and NRCS ecological sites are combined into shares (soil order, great group, landform, ecological site, texture, drainage) and weighted means (sand, silt, clay, organic matter, pH, EC, SAR, CaCO3, gypsum, CEC, available water capacity, Ksat) for the top 0-30 cm and 30-100 cm. Queried 2026-11-15.
- Limits: these are the soils of the top ~2 m as mapped by the survey, not the aquifer layers (see geology.json). The survey has no microbial or biological-crust data. Sampling is by points, so shares carry sampling error (120 points per set). Weighted means can hide patches.
- Salinity and sodicity flags use the standard USDA Salinity Laboratory thresholds (EC 4 dS/m, SAR 13; Handbook 60).
