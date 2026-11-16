# Sinkronized — Overview evidence and source register

Updated: November 14–15, 2026 (Arizona). This document explains **which claims in the public Overview have external support**, what those sources measured, and what we cannot infer from the new satellite pipeline.

## 1. The established process

**Claim:** Extensive groundwater withdrawal can lower the water table and cause fine-grained aquifer sediments to compact, lowering the land surface. Some compaction is irreversible and permanently reduces groundwater storage.

- **Source:** U.S. Geological Survey, *Land Subsidence* (USGS Water Science School): https://www.usgs.gov/water-science-school/science/land-subsidence
- **Source:** U.S. Geological Survey, *Aquifer Compaction due to Groundwater Pumping*: https://www.usgs.gov/centers/land-subsidence-in-california/science/aquifer-compaction-due-groundwater-pumping
- **Important nuance:** Pumping does not produce identical subsidence everywhere. Effects depend on changes in hydraulic head and the sediment's compressibility and preconsolidation history. Mining, hydrocompaction, organic-soil drainage and other mechanisms can also move land.

## 2. Eloy/Picacho: direct historical groundwater-related subsidence

**Claim:** A USGS extensometer and leveling study near Eloy documented **1.09 metres of land subsidence caused by groundwater withdrawal during 1965–1983**, accompanied by measured aquifer compaction.

- **Source:** Epstein, V.J. (1987), *Hydrologic and geologic factors affecting land subsidence near Eloy, Arizona*. USGS Water-Resources Investigations Report 87-4143. DOI: [10.3133/wri874143](https://doi.org/10.3133/wri874143). Accessible record: https://pubs.usgs.gov/publication/wri874143
- **Related regional hydrogeology:** Pool, D.R., Carruth, R., and Meehan, W.D. (2001), *Hydrogeology of Picacho Basin, south-central Arizona*. USGS Water-Resources Investigations Report 2000-4277. DOI: [10.3133/wri004277](https://doi.org/10.3133/wri004277). https://pubs.usgs.gov/publication/wri004277
- **Important nuance:** 1.09 m is a **historical, site-specific measurement**, not the land lowering in every modern project study polygon or a rate measured by our satellite stacks.

## 3. Willcox: farming is a major groundwater-use pressure

**Claim:** Agricultural irrigation is the largest estimated water-use sector in the Willcox groundwater basin. The Arizona Department of Water Resources reports **2022 sector use** of **155,805 acre-feet agricultural**, **11,268 acre-feet industrial** and **910 acre-feet municipal**.

- **Source:** Arizona Department of Water Resources, *Willcox Groundwater Basin*, questions on major water uses and attribution: https://www.azwater.gov/find-info-on/how-do-i/willcox-groundwater-basin
- **Related peer-reviewed paper:** *A Spatiotemporal Characterization of Water Resource Conditions and Demands as Influenced by the Hydrogeologic Framework of the Willcox Groundwater Basin, Southeastern Arizona, USA*, *Geosciences* **13**(6), 176 (2023). DOI: [10.3390/geosciences13060176](https://doi.org/10.3390/geosciences13060176). The authors observed a **29% increase in agricultural land cover between 2008 and 2021**, falling measured groundwater levels and a strong association between agricultural land cover extent and groundwater depth.
- **Related peer-reviewed InSAR paper:** *Mapping land subsidence and aquifer system properties of the Willcox Basin, Arizona, from InSAR observations and independent component analysis*, *Remote Sensing of Environment* (2022): https://www.sciencedirect.com/science/article/pii/S0034425722000086 . This study uses radar and groundwater records to link regional subsidence to long-term excessive groundwater exploitation.
- **USGS irrigation-data release:** Read, A.L., and Porter, T.J. (2023), *Estimated crop irrigation water use withdrawals in Willcox Groundwater Basin, Arizona for 2022*: https://www.usgs.gov/data/estimated-crop-irrigation-water-use-withdrawals-willcox-groundwater-basin-arizona-2022
- **Important nuance:** Sector estimates are estimates for the **basin and year stated**, not measurements of pumping by an individual operation. ADWR explicitly notes that it cannot quantify or attribute general water-level decline to specific water users. A statistical association between agricultural expansion and declining groundwater is supporting evidence within a broader body of hydrologic research; the correlation alone does not identify an individual cause of subsidence at an image pixel.

## 4. The project's own radar measurements

The project reads processed exports from `data/processed/` and distinguishes Sentinel-1 historical line-of-sight displacement/rate from short-record, provisional NISAR observations. Real observation dates, source tracks, reference areas, reported uncertainty and limitations are shown in the map interface.

- Data exports: `data/processed/hotspots.geojson`, `timeseries_<slug>.json`, `rate_<slug>.json` and `rate_<slug>.png`
- ADWR comparison method: `docs/adwr_validation.md`
- NISAR product metadata and sources: https://nisar.jpl.nasa.gov/ and https://search.asf.alaska.edu/
- ADWR source records: https://www.azwater.gov/gis and https://www.azwater.gov/hydrology/field-services/land-subsidence-arizona

**Do not blur these categories:** the published historical findings above are **not numbers generated by Sinkronized**. The team's data demonstrate ground movement along radar look directions, with error and reference constraints. They do **not** on their own apportion water use or establish that a particular farm, data center, road, mine or other feature caused a specific pixel's displacement.

## 5. Public communication principles

1. Say directly that **groundwater withdrawal is an established subsidence mechanism** in Arizona, and identify agricultural irrigation as a **major regional pumping pressure where evidence supports it**.
2. Clearly label locations, years, physical quantities, study scale, and source agency next to every factual number.
3. Do not assert that all sinking in the current study areas is caused by farming; some patterns may reflect geology, atmospheric noise, mining or other factors.
4. Separate independent, peer-reviewed and agency **historical research** from the team's **current experimental remote-sensing output**.
5. Do not present one look direction's motion as a verified vertical subsidence rate.
6. Treat missing, uncertain and provisional evidence as such; avoid inferring a source of groundwater withdrawals at the pixel level.

The Overview cards link directly to the corresponding original sources. The app's **Resources** dialog includes the full selected bibliography as well as data/code origins.
