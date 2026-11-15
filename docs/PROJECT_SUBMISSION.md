# Space Apps 2026 project page: paste-ready text

Challenge: **Dancing with the SARs**. Every number below comes from `data/processed/` and matches the live site. Field names follow the current Project Submission Guide: Project Name, High-Level Project Summary, How does it address the challenge?, Detailed Project Description, and Space Agency Partner Data and Other References. Character limits were not visible to us, so check each box; shorter versions are given where useful.

---

## Project Name

Sinkronized

## Links

- Live site: https://sinkronized.vercel.app/web/
- Code and data: https://github.com/mansi200304/NASA-Hackathon
- Demo (7 slides or a video of 30 seconds or less, viewable without a login): **[team to add the link]**

## High-Level Project Summary

Arizona's farms pump groundwater faster than rain refills it. As the water table falls, clay layers underground squeeze together and the land surface sinks, cracking canals, wells and roads, and permanently losing storage space. Sinkronized is an interactive map that shows where southern Arizona is sinking, how fast, how sure we are, and what sits on top.

We put NASA's new NISAR radar satellite to the test on its first year of data. We corrected it with its own weather tables, checked it against ten years of Sentinel-1 data and Arizona's official records, and found that it sees the same sinking basin around Willcox. It is not yet long enough for a trustworthy speed, which we estimate around February 2027. We then linked the sinking to people's water use. Where farms pump the most, and where well water has fallen the furthest (about 69 feet in 31 years), the ground sinks the fastest. Every number shows its uncertainty and its limits.

*(Short version, about 300 characters:)* An interactive map of where southern Arizona is sinking as its aquifers drain. It tests NASA's new NISAR satellite against ten years of radar and state records, and links the sinking to farm pumping and to falling water in 236 wells, with every number's uncertainty shown.

## How does it address the challenge?

The challenge asks teams to use NISAR data to track and visualise change on Earth's surface, to explore it over time and across polarizations, to combine it with other data, to explain human and physical drivers, and to look ahead to what NISAR will make possible. Sinkronized does each of these:

- **NISAR at the centre.** We processed NISAR's interferograms (GUNW) from three tracks and its backscatter (GCOV) from 28 dates. We applied NISAR's own troposphere correction, testing both signs; it cuts the scatter by 24%. NISAR's one-year sinking pattern matches the ten-year Sentinel-1 pattern across 12,850 map blocks (correlation 0.58), and a second NISAR look direction confirms the sinking areas move away from the satellite.
- **Change over time.** Ten-year Sentinel-1 time series with an interactive chart that drives the map, plus NISAR's first year.
- **Polarizations.** NISAR's HH and HV channels tell farmland from desert by how much they change through the year (score 0.88, where 0.5 is chance), not by brightness (0.50). A NISAR "radar portrait" shows hundreds of irrigated center-pivot fields.
- **Other data and human drivers.** USDA cropland, USGS field-by-field pumping estimates, and 236 wells measured by USGS and the Arizona Department of Water Resources.
- **Physical driver.** Falling water tables match faster sinking (correlation -0.41), consistent with clay compaction.
- **What NISAR adds next.** From the noise we measured, NISAR should confirm the Willcox sinking rate around February 2027 if observations continue.

## Detailed Project Description

**What it does.** Sinkronized is a free website for anyone, including planners, water managers, farmers, conservation groups and residents. It opens with plain-language questions, such as "Where is the ground sinking?", "Is the water table falling?" and "How sure are we?". It answers each with a map, a chart and a short explanation, and the reasoning and caveats sit one click away. The map shows ten years of ground motion across southern Arizona, five study areas, the state's official subsidence zones, probable mines (which move for other reasons), and places we checked and found steady, such as Phoenix and the West Valley.

**Key results.** Rates are along the satellite's line of sight, in centimetres per year. A negative rate means sinking.
- Sinking areas confirmed from both satellite look directions: the Willcox basin (-2.7 cm/yr over 386 km2), north of Willcox (-4.9), the Elfrida area (-3.1) and Eloy-Picacho (-1.3). Bowie-San Simon (-2.6) is seen from one direction only.
- Our Willcox-area maps match the Arizona Department of Water Resources' own radar products (pattern correlation 0.95 to 0.99). Eloy matches less well (0.59 and 0.18), and we say so.
- Cropland is 2.1% of the Willcox study box but 7.4% of its sinking area. Areas with the most estimated pumping nearby sink at a median 2.3 cm/yr, against about zero where there are no fields.
- In 236 wells the water table fell a median 69 feet over 31 years (about 2.2 feet a year). Wells where it fell fastest sit on faster-sinking ground.

**How it works.** A reproducible Python pipeline reads only the parts of each satellite file it needs, by streaming windows from 7 GB NISAR files instead of downloading them. It applies ionosphere and troposphere corrections, references the motion to stable ground, chains the time series, and fits rates with uncertainty from block resampling. The website is a static, buildless map app (Leaflet), accessible by keyboard and screen reader. Every number is loaded from data files through strict validators that hide a section rather than show a wrong value.

**Why it matters.** Lost aquifer storage from compaction does not come back. Showing where it is happening, how fast, and how confident we are helps people decide where to look first. NISAR's free 12-day L-band data will make this monitoring routine.

**Honest limits, shown on the site.**
- NISAR's record is still too short for a reliable rate.
- Radar measures slanted line-of-sight motion, not straight down.
- C-band radar can over-read sinking over farmland.
- Pumping figures are model estimates, and the well data come from two programs.
- Matching places is not proof of cause.

**Tools.**
- Python: asf_search, h5py, NumPy, SciPy, rasterio, pyproj, Shapely, Matplotlib.
- Front end: JavaScript with Leaflet.
- Data access: NASA Earthdata and ASF.
- Hosting: GitHub and Vercel.
- The code is open source under the MIT licence.

## Space Agency Partner Data and Other References

- **NASA/ISRO NISAR:** Level-2 GUNW and GCOV products (Provisional, Beta and Validated releases), from NASA's ASF DAAC. DOIs 10.5067/NIL2GUNW-P1 and 10.5067/NIL2GCOV-P1.
- **NASA JPL OPERA:** Sentinel-1 surface displacement (DISP-S1), DOI 10.5067/SNWG/OPL3DISPS1-V1. Contains modified Copernicus Sentinel data 2016-2026 (European Union / ESA).
- **Copernicus GLO-30 DEM** (ESA/EU), used for NISAR's troposphere correction. ERA5 reanalysis rainfall (Copernicus Climate Change Service).
- **Other data:**
  - USDA Cropland Data Layer 2025.
  - USGS irrigation withdrawals for the Willcox basin, 2024 (DOI 10.5066/P1ZU6T5N).
  - USGS Water Data API and ADWR Groundwater Site Inventory (well water levels).
  - ADWR land-subsidence products.
  - OpenStreetMap.

The full list, with exact citations and licence notices, is in `docs/REFERENCES.md`. It is ready to paste into the References field.

## Use of AI tools (if the form asks)

An AI coding assistant helped write code and draft text; the team reviewed and ran everything. All measured values come from our processing of the real data, and none was generated by an AI tool. The site logo was generated with ChatGPT from the team's design brief. Details are in `AI_USAGE.md`.
