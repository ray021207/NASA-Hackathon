# Space Apps 2026 project submission: paste-ready, matched to the form

Challenge: **Dancing with the SARs**. Every number matches `data/processed/` and the live site.

---

## Project Name

Sinkronized
*(The form currently shows "Project RaySAR". Use the name the team registered, and keep it the same as the site.)*

## Summary (limit 1,500 characters)

Sinkronized is an interactive map of where southern Arizona's ground is sinking as its aquifers drain, how fast, how sure we are, and what sits on top. Farms in basins like Willcox pump groundwater faster than it refills. As the water table falls, clay layers compact and the land sinks, cracking canals and wells and permanently losing storage.

We put NASA's new NISAR L-band radar to the test on its first year of data. We corrected it with its own weather tables and checked it against ten years of Sentinel-1 data and Arizona's official records. NISAR sees the same sinking basin, though its record is still too short for a trustworthy speed, which we estimate around February 2027. We then linked the sinking to people's water use. Where farms are estimated to pump the most, and where well water has fallen furthest (about 69 feet in 31 years across 236 wells), the ground sinks fastest. Every number shows its uncertainty and its limits, so planners, water managers and residents can see where to look first.

## Project Demonstration

[team: full public URL of the slides (7 or fewer) or video (30 seconds or less), no login]

## Project

https://sinkronized.vercel.app/web/

*(Code and data: https://github.com/mansi200304/NASA-Hackathon. Mention it in Project Details if the form allows only one link.)*

## Project Details

**What it does**
Sinkronized is a free website that opens with plain questions, such as "Where is the ground sinking?", "What does NASA's NISAR show?", "Is it the pumping?" and "Is the water table falling?". Each one leads to a map or chart with a short answer, and the reasoning and caveats are one click away. The map shows ten years of ground motion across southern Arizona, five study areas, Arizona's official subsidence zones, probable mines (which move for other reasons), and places we checked and found steady, such as Phoenix and the West Valley. Code and data are at https://github.com/mansi200304/NASA-Hackathon.

**What we found**
Rates are along the satellite's line of sight. Negative means sinking.
- Sinking confirmed from both satellite look directions: the Willcox basin (-2.7 cm/yr over 386 km2), north of Willcox (-4.9 cm/yr), the Elfrida area (-3.1 cm/yr) and Eloy-Picacho (-1.3 cm/yr). Bowie-San Simon (-2.6 cm/yr) is seen from one direction only.
- Our Willcox-area maps match the Arizona Department of Water Resources' radar products (pattern correlation 0.95 to 0.99). Eloy matches less well, and we say so.
- NISAR: its own troposphere correction cut the scatter by 24%. Its one-year pattern matches the ten-year Sentinel-1 pattern across 12,850 map blocks (correlation 0.58), and its second look direction also sees the sinking areas moving away.
- NISAR's HH and HV channels tell farmland from desert by how much they change through the year (score 0.88, where 0.5 is chance), not by brightness. A NISAR "radar portrait" shows hundreds of center-pivot fields.
- Cropland is 2.1% of the Willcox study box but 7.4% of its sinking area. Areas with the most estimated pumping nearby sink at a median 2.3 cm/yr, against about zero where there are no fields.
- In 236 wells the water table fell a median 69 feet over 31 years. Where it fell faster, the ground sinks faster (rank correlation -0.41, 95% range -0.55 to -0.23).

**How it works**
A reproducible Python pipeline reads NISAR interferograms (GUNW) and backscatter (GCOV) from NASA's archive. It streams only the needed window from each 7 GB file instead of downloading it. It removes the ionosphere and troposphere, references the motion to stable ground, chains the time series, and fits rates with uncertainties from spatial block resampling. It combines these with NASA JPL's OPERA Sentinel-1 displacement, USDA cropland, USGS pumping estimates and USGS/ADWR well measurements. The website is a static map app that works by keyboard and screen reader. Every number is loaded through strict checks that hide a section rather than show a wrong value.

**Benefits and impact**
Aquifer storage lost to compaction does not come back. Showing where it is happening, how fast, and how confident we are helps people decide where to look first. NISAR's free 12-day L-band data can make this monitoring routine, and our pipeline is ready to rerun on NISAR's validated reprocessing planned for 2027.

**What makes it creative**
It treats a brand-new satellite honestly: it tests what NISAR can already show and when it will be able to confirm a rate. It uses NISAR's polarizations to see farming as change through the year, and it ties the radar to the aquifer through wells measured on the ground.

**Factors we considered (the limits are on the site)**
- NISAR's record is short.
- Radar measures slanted line-of-sight motion, not straight down.
- C-band radar can over-read sinking over farmland.
- Pumping figures are model estimates, and the well data come from two programs.
- Matching places does not prove which user caused the sinking.

**Tools**
- Python (asf_search, h5py, NumPy, SciPy, rasterio, pyproj, Shapely, Matplotlib).
- JavaScript, HTML and CSS with Leaflet.
- Data access: NASA Earthdata and ASF Vertex.
- Hosting: GitHub and Vercel.
- The code is MIT-licensed.

## Use of Super Intelligence (SI)

Select every option that applies. This answer is not shown to judges.
- **Code:** an AI coding assistant helped write and debug code.
- **Text:** an AI assistant helped draft explanatory text.
- **Images:** the logo was generated with ChatGPT. **The rule requires a visible watermark on SI-generated images.** Add an "AI-generated" label to the logo on the site before submitting, and check whether the team portraits were AI-generated or AI-stylised.
- **Code and data acknowledgement:** "acknowledge SI generation in descriptive text and metadata" is covered by `AI_USAGE.md` in the repository. No measured value was generated by an AI tool; all come from our processing of the real data.

## NASA Data (Link Text / Link Url)

| Link Text | Link Url |
|---|---|
| NISAR L2 Geocoded Unwrapped Interferogram (GUNW), Provisional | https://doi.org/10.5067/NIL2GUNW-P1 |
| NISAR L2 GUNW, Beta (one early pair) | https://doi.org/10.5067/NIL2GUNW-B1 |
| NISAR L2 Geocoded Polarimetric Covariance (GCOV), Provisional | https://doi.org/10.5067/NIL2GCOV-P1 |
| NISAR L2 GCOV, Validated | https://doi.org/10.5067/NIL2GCOV-V1 |
| NISAR L2 GCOV, Beta | https://doi.org/10.5067/NIL2GCOV-B1 |
| OPERA Surface Displacement from Sentinel-1 (DISP-S1), NASA JPL | https://doi.org/10.5067/SNWG/OPL3DISPS1-V1 |
| Alaska Satellite Facility DAAC, NISAR data search (Vertex) | https://search.asf.alaska.edu/ |
| NISAR Data User Guide (ASF) | https://doi.org/10.5281/ZENODO.20075813 |
| NISAR Mission Science Users' Handbook, 2nd ed. | https://doi.org/10.48577/jpl.UD4HV3 |
| NASA-ISRO NISAR mission | https://nisar.jpl.nasa.gov/ |

## Space Agency Partner & Other Data (Link Text / Link Url)

| Link Text | Link Url |
|---|---|
| Copernicus Sentinel-1 data 2016-2026 (ESA/EU), via OPERA DISP-S1 | https://doi.org/10.5067/SNWG/OPL3DISPS1-V1 |
| Copernicus DEM GLO-30 (ESA/EU; (c) DLR e.V. 2010-2014 and (c) Airbus Defence and Space GmbH 2014-2018) | https://registry.opendata.aws/copernicus-dem/ |
| ERA5 global reanalysis (Copernicus Climate Change Service), Hersbach et al. 2020 | https://doi.org/10.1002/qj.3803 |
| Open-Meteo Historical Weather API (ERA5 rainfall access) | https://open-meteo.com/ |
| USDA NASS Cropland Data Layer 2025 | https://croplandcros.scinet.usda.gov/ |
| USGS data release: Willcox crop irrigation withdrawals 2024 (Read et al. 2025) | https://doi.org/10.5066/P1ZU6T5N |
| USGS Water Data API, groundwater field measurements | https://api.waterdata.usgs.gov/ogcapi/v0/collections/field-measurements |
| ADWR Groundwater Site Inventory, well sites | https://services3.arcgis.com/iuNbZYJOrAYBrPyC/ArcGIS/rest/services/Well_Sites/FeatureServer |
| ADWR land subsidence monitoring | https://www.azwater.gov/hydrology/field-services/land-subsidence-arizona |
| ADWR GIS data (subsidence features and radar products) | https://www.azwater.gov/gis |
| ADWR Willcox Groundwater Basin | https://www.azwater.gov/find-info-on/how-do-i/willcox-groundwater-basin |
| OpenStreetMap contributors (ODbL) | https://www.openstreetmap.org/copyright |
| Esri basemap tiles (Esri, Maxar, Earthstar Geographics, HERE, Garmin, USGS, NGA, EPA, USDA, NPS) | https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer |
| Leaflet 1.9.4 (BSD-2-Clause) | https://leafletjs.com/ |
| Google Fonts: DM Sans and Space Grotesk | https://fonts.google.com/ |
| Python libraries (asf_search, h5py, NumPy, SciPy, rasterio, pyproj, Shapely, pyshp, Matplotlib, Pillow, requests, defusedxml) | https://github.com/mansi200304/NASA-Hackathon/blob/main/requirements.txt |
| Epstein (1987), land subsidence near Eloy, USGS WRI 87-4143 | https://doi.org/10.3133/wri874143 |
| Pool, Carruth & Meehan (2001), Hydrogeology of Picacho Basin, USGS WRI 00-4277 | https://pubs.usgs.gov/publication/wri004277 |
| Job et al. (2023), Willcox Groundwater Basin, Geosciences 13(6) 176 | https://doi.org/10.3390/geosciences13060176 |
| Peng et al. (2022), Willcox Basin subsidence from InSAR, Remote Sensing of Environment 271 | https://doi.org/10.1016/j.rse.2022.112894 |
| Devlin (2025), vegetation and agriculture effects on InSAR, Cornell dissertation | https://ecommons.cornell.edu/entities/publication/5e298b2f-9ae6-4861-abfe-a8c194323c08 |
| Saporta, Gomba & De Zan (2021), InSAR phase bias, EGU21-3503 | https://meetingorganizer.copernicus.org/EGU21/EGU21-3503.html |
| USGS Water Science School: Land Subsidence | https://www.usgs.gov/water-science-school/science/land-subsidence |
| Site logo, generated with ChatGPT (OpenAI) from the team's brief | https://chatgpt.com/ |
| Hosting: Vercel | https://vercel.com/ |
| Source code and data: GitHub | https://github.com/mansi200304/NASA-Hackathon |
