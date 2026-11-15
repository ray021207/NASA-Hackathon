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
| Esri basemap tiles | Map background | Esri terms of use; attribution is shown on the map. Not redistributed. |
| Copernicus GLO-30 DEM | Ground heights to apply NISAR's troposphere tables (not redistributed; cached locally) | Free licence from Copernicus/ESA; EGM2008 heights; public distribution needs the source notice "Contains modified Copernicus data" and credit to DLR and Airbus for modified data. |
| Leaflet 1.9.4 | Map library (`web/vendor/`) | BSD-2-Clause, `web/vendor/LICENSE-leaflet`. |
| Logo | Site identity | Generated with ChatGPT (OpenAI) from our own design brief, then edited by us. |

Python dependencies are listed with versions in `requirements.txt`.

## Reproduce
1. `pip install -r requirements.txt`
2. Put an Earthdata token in `.env` (never commit it).
3. Run the `src/` scripts in the order described in `docs/STATUS.md`, then `python src/export_contract.py` to rebuild `data/processed/`.
4. Serve the repo root (`python -m http.server`) and open `/web/`.
