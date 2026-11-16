# Space Apps 2026 project submission: paste-ready, matched to the form

Challenge: **Dancing with the SARs**. Every number matches `data/processed/` and the live site.

---

## Project Name

Sinkronized
*(Decided: the project name is Sinkronized, the same as the site. The form may still show a placeholder such as "Project RaySAR"; replace it.)*

## Summary (limit 1,500 characters)

Sinkronized is an interactive map of where southern Arizona's ground is sinking as its aquifers are pumped down, how fast, how sure we are, and what lies beneath. When the water table falls, clay layers compact and the land sinks. Much of that loss is permanent, and it cracks canals, roads and wells.

We mapped ten years of Sentinel-1 radar over five study areas around Willcox and Eloy. Four are confirmed from two opposite satellite look directions (up to 4.9 cm a year), and the Willcox-area maps match Arizona's official radar products (correlation 0.94 to 0.99). We then tested NASA's new NISAR L-band radar on its first year. After we removed its own weather error, it shows the same sinking pattern, though its record is still too short for a trustworthy speed (we estimate February 2027).

Finally we tied the sinking to water. Where well water has fallen furthest (about 69 feet in 31 years across 236 wells) and where farms are estimated to pump most, the ground sinks fastest. For each area we add its geology, mapped earth fissures, and whether the ground can recover. Every number shows its uncertainty and limits.

## Project Demonstration

[team: full public URL of the slides (7 or fewer) or video (30 seconds or less), no login]

## Project

https://sinkronized.vercel.app/web/

*(Code and data: https://github.com/mansi200304/NASA-Hackathon. Mention it in Project Details if the form allows only one link.)*

## Project Details

**What it does**
Sinkronized is a free website that opens with plain questions, such as "Where is the ground sinking?", "What does NASA's NISAR show?", "Is it the pumping?" and "Is the water table falling?". Each leads to a map or chart with a short answer; the reasoning and caveats are one click away.

The map covers five study areas around Willcox and Eloy. Click one and its report shows:
- the headline sinking rate with its uncertainty, beside a ranking against the other four areas;
- a 2016-2026 time-lapse on satellite imagery that you can play or scrub;
- a card saying whether the satellite's two opposite look directions agree, and how it was recorded;
- **what lies beneath**: the basin, a layer diagram, the clay that compacts, the falling water table, mapped earth fissures, and whether the ground can come back;
- the methods and checks, including the comparison with Arizona's official radar results.

**Two reading levels.** A switch under the header changes the whole site between *Plain language* (short, everyday wording, for anyone) and *Research detail* (methods, statistics, uncertainty budgets, cited hydrogeology and USDA soil-survey detail for researchers, water engineers and soil ecologists). Plain language keeps only the trends: where it is sinking, how fast, why it is likely happening and how sure we are. The design, data and conclusions are identical; only the wording and the depth change, and the choice is remembered.

Other layers show NASA NISAR's first year, Arizona's official sinking zones, probable mines (which move for other reasons), and places we checked and found steady, such as Phoenix and the West Valley. Code and data are at https://github.com/mansi200304/NASA-Hackathon.

**What we found**
Rates are along the satellite's line of sight; negative means sinking.
- Ten years of Sentinel-1 (2016-2026) show sinking in all five study areas: Fort Grant Road, north of Willcox (-4.9 +/- 0.6 cm/yr), Elfrida area (-3.1 +/- 0.5), Willcox basin (-2.7 +/- 0.4 over 386 km2), Bowie-San Simon (-2.6 +/- 0.6) and Eloy-Picacho (-1.3 +/- 0.4). Four are confirmed from both satellite look directions; Bowie-San Simon is seen from one direction only and is labelled unconfirmed.
- The four Willcox-area maps match Arizona Department of Water Resources (ADWR) radar products (pattern correlation 0.94 to 0.99). Eloy matches only moderately with ADWR's Sentinel-1 (0.59) and weakly with its RADARSAT-2 (0.18), and we say so.
- NASA NISAR, first year: removing its own troposphere error cut the scatter by 24%. Its one-year pattern matches the ten-year Sentinel-1 pattern across 12,850 map blocks (correlation 0.58). Its ascending look direction also sees the sinking areas moving away (range excludes zero). Its record is still too short for a trustworthy speed; we estimate it can confirm Willcox around February 2027.
- NISAR's HH and HV channels tell farmland from desert by how much they change through the year (score 0.88, where 0.5 is chance), not by brightness. A NISAR "radar portrait" shows hundreds of center-pivot fields.
- Cropland is 2.1% of the Willcox study box but 7.4% of its sinking area. Where USGS estimates the most pumping nearby (828 fields, 2024), the ground sinks a median 2.3 cm/yr, against about zero where there are no fields.
- In 236 wells the water table fell a median 69 feet over 31 years. Where it fell faster, the ground sinks faster (rank correlation -0.41, 95% range -0.55 to -0.23).
- We started with a different question: is the West Valley, where new data centers are being built, sinking? The radar said no (Buckeye, Goodyear, Surprise and Glendale are steady within about 0.5 cm/yr), so we followed the data to the Willcox basin and Eloy, where it does.

**How it works**
A reproducible Python pipeline reads NISAR interferograms (GUNW) and backscatter (GCOV) from NASA's archive. It streams only the needed window from each 7 GB file instead of downloading it. It removes the ionosphere and troposphere, references the motion to stable ground, chains the time series, and fits rates with uncertainties from spatial block resampling. It combines these with NASA JPL's OPERA Sentinel-1 displacement, USDA cropland, USGS pumping estimates and USGS/ADWR well measurements. The website is a static map app that works by keyboard and screen reader. Every number is loaded through strict checks that hide a section rather than show a wrong value.

**Geology and infrastructure**
Each study area has its own geology, because the basins differ. A side-by-side table compares all five on the same questions: the clay that can compact, our measured sinking, the falling water table, kilometres of earth fissure mapped by the Arizona Geological Survey (data as of 2016), and whether the ground can come back. "Can it come back?" is marked **studied here** only where a study tested it (Eloy: the ground kept sinking even after water levels rose up to 150 ft; Willcox: wetter years gave only temporary recharge). For the other three areas it is labelled **not studied here**: our reading of the geology, not a measurement. In the Research view each area also lists quantitative hydrogeology quoted from the cited USGS reports (for example the Picacho Basin's three hydrostratigraphic units, transmissivity ranges, water-level declines, the Eloy extensometer record, Willcox pumping history and aquifer properties, and the San Simon storage coefficient), each with its citation. General findings from USGS reports, Arizona law and ADWR records explain:
- what lies beneath: basin fill, and at least 140 ft of Lake Cochise clay under Willcox Playa;
- why most of the sinking is permanent, because squeezed clay does not spring back;
- how uneven sinking opens earth fissures that have damaged Arizona highways, canals, pipelines and drains;
- what documented practice suggests: check the state fissure maps, take care at basin edges, design crossings for movement, re-check drains, monitor, and slow the water-table decline.

**Benefits and impact**
Aquifer storage lost to compaction does not come back. Showing where it is happening, how fast, and how confident we are helps people decide where to look first. NISAR's free 12-day L-band data can make this monitoring routine, and our pipeline is ready to rerun on NISAR's validated reprocessing planned for 2027.

**What makes it creative**
It treats a brand-new satellite honestly: it tests what NISAR can already show and when it will be able to confirm a rate. It uses NISAR's polarizations to see farming as change through the year, and it ties the radar to the aquifer through wells measured on the ground.

**Factors we considered (the limits are on the site)**
- NISAR's record is short.
- Radar measures slanted line-of-sight motion, not straight down.
- C-band radar can over-read sinking over farmland.
- Pumping figures are model estimates, and the well data come from two programs.
- Mapped earth-fissure data are as of 2016; a place with no mapped fissure is not proof that none exist.
- The "can it come back?" answer is a study result for Eloy and Willcox only; for the other areas it is our inference and is labelled that way.
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
- **Images:** the logo was generated with ChatGPT. The site labels it: a small "AI" tag on the header logo, an "AI-generated logo" caption under the large logo on the Overview page, and a footer note. The team portraits on the About us page are real photographs, so they need no SI label (replace any placeholder images with the real photos before the deadline).
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
| Google Fonts: DM Sans | https://fonts.google.com/specimen/DM+Sans |
| Python libraries (asf_search, h5py, NumPy, SciPy, rasterio, pyproj, Shapely, pyshp, Matplotlib, Pillow, requests, defusedxml) | https://github.com/mansi200304/NASA-Hackathon/blob/main/requirements.txt |
| Epstein (1987), land subsidence near Eloy, USGS WRI 87-4143 | https://doi.org/10.3133/wri874143 |
| Pool, Carruth & Meehan (2001), Hydrogeology of Picacho Basin, USGS WRI 00-4277 | https://pubs.usgs.gov/publication/wri004277 |
| Job et al. (2023), Willcox Groundwater Basin, Geosciences 13(6) 176 | https://doi.org/10.3390/geosciences13060176 |
| Peng et al. (2022), Willcox Basin subsidence from InSAR, Remote Sensing of Environment 271 | https://doi.org/10.1016/j.rse.2022.112894 |
| Devlin (2025), vegetation and agriculture effects on InSAR, Cornell dissertation | https://ecommons.cornell.edu/entities/publication/5e298b2f-9ae6-4861-abfe-a8c194323c08 |
| Saporta, Gomba & De Zan (2021), InSAR phase bias, EGU21-3503 | https://meetingorganizer.copernicus.org/EGU21/EGU21-3503.html |
| USGS Water Science School: Land Subsidence | https://www.usgs.gov/water-science-school/science/land-subsidence |
| Galloway et al. (1999), Land Subsidence in the United States, USGS Circular 1182 | https://doi.org/10.3133/cir1182 |
| Pool, Carruth & Meehan (2001), Hydrogeology of Picacho Basin, USGS WRI 00-4277 (full report) | https://pubs.usgs.gov/wri/2000/4277/report.pdf |
| Coates & Cushman (1955), Douglas Basin geology and ground water, USGS WSP 1354 | https://pubs.usgs.gov/publication/wsp1354 |
| White & Hardt (1965), San Simon Basin hydrologic analysis, USGS WSP 1809-R | https://pubs.usgs.gov/wsp/1809r/report.pdf |
| Konieczki (2006), Willcox and Douglas Basins monitoring network, USGS Fact Sheet 2006-3055 | https://pubs.usgs.gov/fs/2006/3055/ |
| Brown & Schumann (1969), Willcox Basin geohydrology, USGS WSP 1859-F | https://doi.org/10.3133/wsp1859F |
| Smilovsky (2025), persistent subsidence in the Willcox Basin, GSA Connects abstract | https://gsameetings.secure-platform.com/connects25/solicitations/103002/sessiongallery/schedule/items/95198/application/10103 |
| Arizona Revised Statutes § 32-2117 (earth fissure maps) | https://www.azleg.gov/ars/32/02117.htm |
| ADWR Willcox Active Management Area | https://www.azwater.gov/node/5934 |
| USDA NRCS Soil Survey (SSURGO) via Soil Data Access | https://sdmdataaccess.sc.egov.usda.gov/ |
| Arizona Geological Survey, earth fissure maps (data last updated 2016) | https://github.com/azgs/EarthFissureViewer |
| Arizona Geological Survey, earth fissure study areas | https://azgs.arizona.edu/earth-fissure-study-areas-arizona |
| Site logo, generated with ChatGPT (OpenAI) from the team's brief | https://chatgpt.com/ |
| Hosting: Vercel | https://vercel.com/ |
| Source code and data: GitHub | https://github.com/mansi200304/NASA-Hackathon |
