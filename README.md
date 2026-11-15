# Sinkronized

*The desert sinks, and the radar keeps the beat.*

**Live site: https://sinkronized.vercel.app** (updates by itself a few minutes after a merge into `main`)

NASA Space Apps 2026 — **Dancing with the SARs** (NISAR). 

Arizona's aquifers are being pumped faster than they refill, and the ground is sinking. NISAR's L-band radar can measure that motion to the millimetre. This project maps where central Arizona is sinking, how fast, and what sits on top of it: farms, new data centers, and wildlife habitat.

## Study areas

| Hotspot | Story |
|---|---|
| Eloy / Casa Grande | Decades of farm pumping. Validation site: our rates are checked against ADWR's published values. |
| Buckeye / Goodyear | Data-center growth in the West Valley, where few measurements are published. |
| Willcox | Fastest subsidence in Arizona, next to Willcox Playa sandhill crane habitat. |

## Current radar decision

Track 128 descending misses the Eloy/Casa Grande core in the recorded test-file checks. Test track 077 ascending / frame 018 over Eloy first, with 056 descending / frame 072 as the alternative. Selection remains pending a raw-file quality and reference-area check. Keep 128 descending for Willcox.

See [Track selection and next checkpoint](docs/track_selection.md). Some pairs span 24 days, and the track-077 late-2025 and mid-2026 segments are disconnected; use actual acquisition dates and do not chain across the missing interval.

## Method

1. Read NISAR L2 GUNW (geocoded unwrapped interferogram) products from ASF.
2. Convert unwrapped phase to line-of-sight displacement: `d = -(λ / 4π) · φ`, with λ and the sign convention read from the file metadata.
3. Mask low-coherence pixels and unreliable connected components.
4. Reference to a stable area.
5. Deduplicate processing versions, then chain connected acquisition pairs from one track/frame using their actual dates (12- or 24-day pairs in the current catalogue). Fit a rate with uncertainty over the supported interval.
6. Validate at Eloy against ADWR InSAR rates, then repeat for the other hotspots.
7. Overlay ADWR's official subsidence areas, probable mines and places checked with no sinking, and publish an interactive web map.

## Progress

- [x] Stage 1: opened a test GUNW file (track 128, descending, Oct 9 → Oct 21 2026). Grid: EPSG:32612, 80 m pixels, wavelength 24.2 cm (1 rad ≈ 19.25 mm of line-of-sight motion), mean coherence 0.68 over valid pixels.
- [x] Stage 1b: valid-pixel rule, ionosphere check (phase still contains it, correlation 0.98), coverage check (track 128 misses Eloy core; covers Willcox).
- [x] Stage 2: one-pair displacement; ionosphere correction cuts the spread about 3x
- [x] Stage 3: NISAR stacks built after the coverage checks (Willcox: track 128 D, 25 pairs; Eloy: track 077 A, 9 pairs; 056 D not used). Rates are not yet reliable (noise, short record)
- [x] Stage 4: rates compared with ADWR's own InSAR products (strong in the southeast, weak at Eloy); see `docs/adwr_validation.md`
- [ ] Stage 5: other hotspots
- [ ] Stage 6: overlays
- [x] Stage 7 (v0): data contract for the front end in `data/processed/` (see `docs/UI_DATA_CONTRACT.md`)

## Limits

- The catalogue spans about a year, but the connected provisional Eloy candidates currently cover only June–October 2026. Report that shorter interval explicitly; annualised short-record rates are preliminary.
- Sinking indicates groundwater stress. It does not prove which user caused it.
- Radar loses coherence over plowed fields and construction.
- Radar measures line-of-sight motion; we assume motion is mostly vertical.
- Radar cannot see wildlife; habitat links come from outside maps.
- NISAR data is Provisional / Uncalibrated, so numbers are preliminary.

## Data

NASA NISAR L2 GUNW (Provisional) and OPERA DISP-S1 (Sentinel-1) displacement, checked against Arizona Department of Water Resources (ADWR) subsidence products, with OpenStreetMap used to flag probable mines. Sources, terms and the reproduce steps are in [docs/DATA_AND_LICENSES.md](docs/DATA_AND_LICENSES.md).

## Licence

Code: MIT, see [LICENSE](LICENSE). Derived data in `data/processed/` may be reused with attribution to this project and its sources. Dependencies: `requirements.txt`. How to cite: `CITATION.cff`.

See [AGENTS.md](AGENTS.md) for the full project brief.

## Run the map locally

From the repository root:

```
python -m http.server 8765
```

Open http://localhost:8765/web/index.html. The app reads its data from `data/processed/`, so the server must be started at the repository root.

To rebuild the data files from the processed cubes: `python src/export_web.py` then `python src/export_contract.py`.
