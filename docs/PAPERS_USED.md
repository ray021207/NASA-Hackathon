# Papers read, and exactly what we use from each

Written 15 November 2026. For each paper: how much of it we could read, every detail we take from it, and where that detail appears on the site. Unit conversions (km³ to acre-feet, metres to feet, hectares to acres) are ours and are marked as such on the page. The seven foundational USGS and ADWR reports we read in full (Brown and Schumann 1969, Coates and Cushman 1955, White and Hardt 1965, Epstein 1987, Galloway and others 1999, Pool and others 2001, Konieczki 2006) are cited fact by fact in the Geology tab and in `src/geology_areas.py`.

The same ledger appears in the site: Resources dialog, research reading level, "Papers read, and exactly what we use from each".

## Read in full

### Job, Ochoa, Jarvis & Kennedy (2023), *Geosciences* 13(6), 176 · doi 10.3390/geosciences13060176 (open access, CC BY)
Read from the open-access PDF. Used on Evidence > Geology > Willcox (nine research-detail entries) and North of Willcox (one entry). Page-level extraction was checked against the text (the PDF carries a duplicated review layer, so numbers were confirmed with a second extraction method).

| Detail used | Value in the paper |
|---|---|
| Basin size, fill thickness | about 4,950 km² (Cochise and Graham counties); fill up to about 1,800 m |
| Natural recharge, irrigation return, storage | 0.02-0.06 km³/yr; 0.08 km³ in 2015 (ADWR 2018); 51.8-72.8 km³ in storage (ADWR Water Atlas 2009) |
| Agriculture's share of withdrawal | 90% (ADWR) |
| Agricultural pumping | about 0.17 km³ (2000) to 0.26 km³ (2020), "56% rise" in the paper (USGS estimates) |
| 2020 crops, share of irrigation demand | corn 34.5%, alfalfa 20.8%, small grains 19.9%, orchards 9.9%, legumes 5.2%; sprinklers, 88% average efficiency |
| Cropland (USDA Cropland Data Layer) | +29%, 18,326 to 23,652 ha (2008-2021); reclassified accuracy 97.3-99.2% |
| Registered wells | 3,937 to 4,759 (+20.9%); average depth 105.9 to 125.0 m (+18.0%), 2006-2021 |
| Water-level change, 149 wells, WY2006 to WY2021 | +4.1 m rise to -38.8 m fall; 93.2% fell by more than 1 m; 3.4% rose by more than 1 m; mean -13.8 m (SE 0.7) or -13.1 m: the text and the table give the mean and median in opposite order |
| 52 annually measured index wells | mean depth to water 56.4 m (2008) to 93.2 m (2021); the authors attribute the bigger change to the small sample and index-well characteristics |
| Correlation with cropland | Spearman 0.89, p < 0.001, n = 14 (2008-2021) |
| Projections to 2031 | depth to water 116.8 m; cropland 27,603 ha |
| Rain (PRISM 1991-2020) | over 950 mm/yr on parts of the Chiricahua and Pinaleno ranges; under 350 mm over much of the basin interior; Mann-Kendall: playa tau -0.11 (p 0.21), Chiricahua none, Pinaleno tau -0.35 (p < 0.01, Sen's slope -13.4 mm/yr) |
| Consequences cited | nearly 30% of registered wells 50 m or less deep; $420,000 (2017) for a 365 m irrigation well; ADWR forecast of 29.6 km³ removed from storage by 2115; subsidence up to 0.15 m/yr and over 60 km of fissures (ADWR 2019) |
| Authors' limits | no continuous pumping record; only 2008-2021 land cover; hydrogeologic units poorly known; hand-drawn contours ("a generalized representation"); master's capstone origin |

Our additions, marked "our note" or "our conversion" on the site: the unit conversions, the flag that the paper swaps mean and median, and the point that two rising series correlate without proving cause.
Not used: its groundwater contour map and cross-sections (we did not re-derive them).

### Devlin & Lohman (2025), *Earth and Space Science* 12(6) · doi 10.1029/2024EA004062 (open access)
We read the author preprint on EarthArXiv (same title), in full. The publisher's page blocked our download, and we did not compare the preprint line by line with the published version.

Used in Evidence > Farmland ("Farmland can fool this radar") and the Limits:
- Sentinel-1 C-band, descending track 144, 129 acquisitions Aug 2019 to Sep 2021, southern San Joaquin Valley, California.
- Apparent subsidence bias of about 2-4 cm/yr in some fields; the largest in cotton (strongly seasonal, decorrelating July-September); almond and pistachio orchards also show a clear seasonal bias; grapes, tomatoes and winter wheat small to negligible. The bias tracks vegetation growth (NDVI).
- Spatial averaging spreads field bias onto nearby roads (about 2 cm/yr difference along one road); masking field pixels before filtering reduces it.
- Peak San Joaquin subsidence is about 30 cm/yr, an order of magnitude larger than the bias; the authors say regions with smaller signals may need these methods.
- The paper tests C-band only. It does not compare with L-band.

## Read as an abstract only

### Peng, Lu, Zhao, Motagh, Bai & Conway (2022)
The journal article (*Remote Sensing of Environment* 271, 112894, doi 10.1016/j.rse.2022.112894) was not accessible to us in full (an attempt to retrieve the publisher's accepted manuscript was declined, so we did not pursue it). We read the authors' EGU 2022 abstract of the same study, EGU22-4147 (doi 10.5194/egusphere-egu22-4147, CC BY 4.0), and cite it as such. Used in Evidence > Geology > Willcox ("Aquifer response (2022)"): ALOS (L-band) and Sentinel-1 (C-band) 2006-2020; two major subsidence zones with a rising mean rate; storage coefficients 6.0e-4 to 0.02 (2006-2011) and 2.3e-5 to 0.087 (2015-2020), average 0.008 to 0.005; depletion of 3.7e8 m³ in 1990-2006; the authors' reading that the deformation is irreversible; independent component analysis improved accuracy by more than 13% (not shown on the site). The journal article may contain more or differ.
Note: an earlier summary of ours described this as a *Water Resources Research* paper. Crossref confirms *Remote Sensing of Environment* 271 (March 2022), which is what the site cites.

### Smilovsky (2025), GSA Connects 2025 abstract · doi 10.1130/abs/2025AM-10103
Abstract only; no paper was available. Used in Evidence > Geology > Willcox ("InSAR record (2025)", "How our numbers compare") and the "Can the ground come back?" column: two zones above 15 cm/yr; more than 11 ft (about 3.4 m) of cumulative displacement since the mid-20th century; recent wet years gave only temporary, local recharge, mainly in playa sediments; deficits above 100,000 acre-ft a year. We cannot see its methods or uncertainties.

### Devlin (2025), Cornell PhD dissertation · doi 10.7298/9hek-gm02
Embargoed (the repository still lists no access). Abstract only. One statement used: the largest C-band versus L-band (ALOS-2) differences were in orchard crops such as almonds and pistachios (Farmland caution). Its other findings (co- and cross-polarized data, a per-crop correction) are not used.

### Saporta, Gomba & De Zan (2021), EGU21-3503 · doi 10.5194/egusphere-egu21-3503
EGU abstract only. Used in the Farmland caution: in a Sentinel-1 stack of 184 images (2014-2018) over eastern Sicily, a short-term systematic phase bias gave velocity errors of up to several mm/yr, correlated with soil moisture and land cover. It is C-band and not from Arizona.

## What changed after reading in full
- The Farmland caution now says which paper found which number (it had said "published studies" for all three) and that the L-band comparison comes from the dissertation abstract only.
- The earlier wording "bias of up to several millimetres a year in general" was too broad: that figure is from one Sicilian stack.
- Peng and others (2022) is cited as an abstract, not as a read paper.
