# References (paste-ready for the Space Apps "References" field)

Every entry below was checked against its own source on Nov 14-15 2026: DOIs against the DOI resolver, bibliographic details against Crossref or the publisher, and licence or credit wording against the licence text. What was not verified is marked. `docs/fact_check.md` records how each was checked.

Sections 1-5 are the paste block. Section 6 lists what the team made itself.

## 1. NASA and satellite data

1. NASA/ISRO NISAR mission. *NISAR L2 Geocoded Unwrapped Interferogram (GUNW), Provisional, Version 1.* ASF DAAC. https://doi.org/10.5067/NIL2GUNW-P1 (one early pair from the Beta collection, https://doi.org/10.5067/NIL2GUNW-B1).
2. NASA/ISRO NISAR mission. *NISAR L2 Geocoded Polarimetric Covariance (GCOV), Provisional, Version 1.* ASF DAAC. https://doi.org/10.5067/NIL2GCOV-P1 (Beta collection https://doi.org/10.5067/NIL2GCOV-B1 for one date; Validated collection https://doi.org/10.5067/NIL2GCOV-V1 for two dates; a few granules came from the NISAR urgent-response collection NISAR_UR_L2, for which no DOI was checked).
3. NASA JPL OPERA project. *OPERA Surface Displacement from Sentinel-1 (DISP-S1), Version 1.* ASF DAAC. https://doi.org/10.5067/SNWG/OPL3DISPS1-V1. Contains modified Copernicus Sentinel data 2016-2026 (European Union / ESA); the displacement product is processed by NASA JPL.
4. Copernicus DEM GLO-30 (WorldDEM-30), used only to find ground heights for NISAR's troposphere correction, read from the AWS Open Data registry https://registry.opendata.aws/copernicus-dem/. Produced using Copernicus WorldDEM-30 (c) DLR e.V. 2010-2014 and (c) Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved. (Notice text taken from the Copernicus WorldDEM-30 licence.)
5. Hersbach, H., Bell, B., Berrisford, P., et al. (2020). The ERA5 global reanalysis. *Quarterly Journal of the Royal Meteorological Society*, 146(730), 1999-2049. https://doi.org/10.1002/qj.3803. Daily rainfall was read through the Open-Meteo Historical Weather API (https://open-meteo.com/); generated using Copernicus Climate Change Service information, as that service requests.

## 2. Agriculture, water and land-use data

6. USDA National Agricultural Statistics Service (2026). *2025 Cropland Data Layer* (30 m resample of the 10 m product, published 2026-02-27). https://croplandcros.scinet.usda.gov/ (accessed Nov 2026).
7. Read, A. L., Kahler, A. J., Porter, T. J., & Potteiger, S. E. (2025). *Estimated crop irrigation water use withdrawals in Willcox Groundwater Basin, Arizona for 2024* [data release]. U.S. Geological Survey. https://doi.org/10.5066/P1ZU6T5N (CC0 1.0).
8. Arizona Department of Water Resources. Land subsidence monitoring pages and GIS data (official subsidence features and InSAR-based subsidence products used for comparison). https://www.azwater.gov/hydrology/field-services/land-subsidence-arizona and https://www.azwater.gov/gis (accessed Nov 2026). Reuse terms not independently verified; credited here and not presented as ADWR products.
9a. U.S. Geological Survey. *Water Data API, field measurements* (depth to water below land surface, parameter 72019; includes measurements by the Arizona Department of Water Resources, agency code AZ014). https://api.waterdata.usgs.gov/ogcapi/v0/collections/field-measurements (accessed Nov 15 2026; the legacy NWIS groundwater-levels service was retired in fall 2025).
9b. Arizona Department of Water Resources. *Groundwater Site Inventory (GWSI), Well Sites* (latest water level per well). https://services3.arcgis.com/iuNbZYJOrAYBrPyC/ArcGIS/rest/services/Well_Sites/FeatureServer (accessed Nov 15 2026; reuse terms not independently verified).
9. Arizona Department of Water Resources. *Willcox Groundwater Basin* (sector water-use estimates and groundwater conditions). https://www.azwater.gov/find-info-on/how-do-i/willcox-groundwater-basin
10. OpenStreetMap contributors. Map data used to identify probable mines and nearby land use (Nominatim and Overpass). (c) OpenStreetMap contributors, ODbL. https://www.openstreetmap.org/copyright

## 3. Documentation for the NISAR products

11. Kristenson, H., et al. (2026). *NISAR Data User Guide.* Alaska Satellite Facility. Zenodo. https://doi.org/10.5281/ZENODO.20075813 (author list as shown by the guide's own citation line, "Kristenson et al. (2026)"; full list not retrieved).
12. NASA-ISRO SAR (NISAR) Mission Science Users' Handbook, Second Edition (2025). https://doi.org/10.48577/jpl.UD4HV3

## 4. Research cited

13. Epstein, V. J. (1987). *Hydrologic and geologic factors affecting land subsidence near Eloy, Arizona.* U.S. Geological Survey Water-Resources Investigations Report 87-4143. https://doi.org/10.3133/wri874143
14. Pool, D. R., Carruth, R. L., & Meehan, W. D. (2001). *Hydrogeology of Picacho Basin, south-central Arizona.* U.S. Geological Survey Water-Resources Investigations Report 00-4277.
15. Job, C., Ochoa, C., Jarvis, W., & Kennedy, R. (2023). A spatiotemporal characterization of water resource conditions and demands as influenced by the hydrogeologic framework of the Willcox Groundwater Basin, southeastern Arizona, USA. *Geosciences*, 13(6), 176. https://doi.org/10.3390/geosciences13060176
16. Peng, M., Lu, Z., Zhao, C., Motagh, M., Bai, L., Conway, B., & Chen, H. (2022). Mapping land subsidence and aquifer system properties of the Willcox Basin, Arizona, from InSAR observations and independent component analysis. *Remote Sensing of Environment*, 271, 112894. https://doi.org/10.1016/j.rse.2022.112894
17. Devlin, K. (2025). *More Than Just Noise: Effects of Vegetation and Agriculture on InSAR Time Series Analysis.* Doctoral dissertation, Cornell University. https://ecommons.cornell.edu/entities/publication/5e298b2f-9ae6-4861-abfe-a8c194323c08 (a dissertation, not a journal article).
18. Saporta, P., Gomba, G., & De Zan, F. (2021). Analyzing an InSAR short-term systematic phase bias with regards to soil moisture and landcover. EGU General Assembly 2021, abstract EGU21-3503. https://meetingorganizer.copernicus.org/EGU21/EGU21-3503.html (a conference abstract).
19a. Galloway, D., Jones, D. R., & Ingebritsen, S. E. (1999). *Land Subsidence in the United States.* U.S. Geological Survey Circular 1182. https://doi.org/10.3133/cir1182
19b. Brown, S. G., & Schumann, H. H. (1969). *Geohydrology and Water Utilization in the Willcox Basin, Graham and Cochise Counties, Arizona.* U.S. Geological Survey Water-Supply Paper 1859-F. https://doi.org/10.3133/wsp1859F
19c. Smilovsky, D. (2025). Recharged but Not Recovered: InSAR Observations of Persistent Land Subsidence in Arizona's Willcox Basin. GSA Connects 2025, abstract. https://gsameetings.secure-platform.com/connects25/solicitations/103002/sessiongallery/schedule/items/95198/application/10103
19d. Arizona Revised Statutes § 32-2117, Earth fissure maps; posting; immunity. https://www.azleg.gov/ars/32/02117.htm
19e. Arizona Department of Water Resources. *Willcox Active Management Area* (designation order Dec 19 2024; date of designation Jan 8 2025). https://www.azwater.gov/node/5934
19f. Pool, D. R., Carruth, R. L., & Meehan, W. D. (2001), as item 14, read in full at https://pubs.usgs.gov/wri/2000/4277/report.pdf
19g. Coates, D. R., & Cushman, R. L. (1955). *Geology and Ground-Water Resources of the Douglas Basin, Arizona.* U.S. Geological Survey Water-Supply Paper 1354. https://pubs.usgs.gov/publication/wsp1354
19h. White, N. D., & Hardt, W. F. (1965). *Electrical-Analog Analysis of Hydrologic Data for San Simon Basin, Cochise and Graham Counties, Arizona.* U.S. Geological Survey Water-Supply Paper 1809-R. https://pubs.usgs.gov/wsp/1809r/report.pdf
19i. Konieczki, A. D. (2006). *Investigation of the Hydrologic Monitoring Network of the Willcox and Douglas Basins of Southeastern Arizona.* U.S. Geological Survey Fact Sheet 2006-3055. https://pubs.usgs.gov/fs/2006/3055/
19j. Arizona Geological Survey. *Earth fissure maps* (GeoJSON published with the AZGS Earth Fissure Viewer, data last updated February 2016). https://github.com/azgs/EarthFissureViewer ; study areas: https://azgs.arizona.edu/earth-fissure-study-areas-arizona
19k. USDA Natural Resources Conservation Service. *Soil Survey Geographic Database (SSURGO)*, via Soil Data Access. https://sdmdataaccess.sc.egov.usda.gov/ (public domain).
19l. Richards, L. A. (Ed.) (1954). *Diagnosis and Improvement of Saline and Alkali Soils.* USDA Agriculture Handbook 60 (thresholds EC 4 dS/m and SAR 13 for saline and sodic soils).
19. U.S. Geological Survey. *Land Subsidence* (USGS Water Science School). https://www.usgs.gov/water-science-school/science/land-subsidence

## 5. Software, services and design

20. Code: Python 3 with asf_search, h5py, NumPy, SciPy, pyproj, Shapely, pyshp, rasterio, affine, Pillow, requests, Matplotlib and defusedxml (versions in `requirements.txt`). Our code is MIT-licensed (`LICENSE`).
21. Leaflet 1.9.4 (c) 2010-2023 Volodymyr Agafonkin, BSD-2-Clause (`web/vendor/LICENSE-leaflet`).
22. Basemap tiles from Esri, shown with their attribution on the map: "Esri, HERE, Garmin, USGS, NGA, EPA, USDA, NPS" and "Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community".
23. Font DM Sans, served by Google Fonts. Open-source licensed (SIL Open Font License per the designers' and Google Fonts' descriptions; the licence line on Google's own DM Sans page was not retrieved).
24. Hosting: GitHub (source) and Vercel (website).
25. NISAR product downloads and searches via the Alaska Satellite Facility (https://search.asf.alaska.edu/) and NASA Earthdata.

## 6. Made by the team (no outside copyright)

- All processing code (`src/`), the website (`web/`), and the text.
- The NISAR radar portrait of the Willcox basin (false-colour image from 28 GCOV dates): made by the team from items 2, 6 and 7.
- All measured numbers: computed by our own pipeline from items 1-3 and 6-7; none generated by an AI tool (see `AI_USAGE.md`).
- Team portraits in `web/assets/team/`: the team's own photos.
- Logo: generated with ChatGPT (OpenAI) from the team's own design brief and edited by the team. Please confirm you are comfortable listing it this way.
- AI assistance in coding and drafting is disclosed in `AI_USAGE.md`.
