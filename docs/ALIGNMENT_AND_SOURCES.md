# Where the project stands: sources, drift from the plan, and fit with the challenge

Written for the team on 15 November 2026, the day of the deadline. It is an honest self-assessment, not marketing.

## 1. Are the numbers and facts current?

**Measured by us (recent).** Every headline number comes from data covering 2016 to 2026: OPERA Sentinel-1 displacement (July 2016 to April 2026), NASA NISAR (October 2025 to November 2026), USGS and ADWR well measurements (latest readings 2015 to 2025), the USGS irrigation-withdrawal estimates for 2024, USDA Cropland 2025, ERA5 rain, and ADWR's radar products (to 2026). The site's numbers are loaded from `data/processed/` and checked by tests.

**Published studies, recent.** Job and others 2023 (read in full), Devlin and Lohman 2025 (read in full, author preprint), Smilovsky 2025 (Willcox InSAR, GSA abstract), Peng and others 2022 (EGU abstract), Devlin 2025 (dissertation abstract), Saporta and others 2021 (EGU abstract), ADWR's Active Management Area order (December 2024), ADWR's 2022 water-use estimates, the NISAR handbook and user guide (2025).

**Published studies, older (by necessity).** The basin geology rests on seven foundational USGS reports: Coates and Cushman 1955, White and Hardt 1965, Brown and Schumann 1969, Epstein 1987, Galloway and others 1999, Pool and others 2001 and Konieczki 2006. They remain the standard published sources for basin structure, aquifer properties and subsidence history. But the conditions they describe (pumping totals, water-level declines, subsidence amounts) are historical, so the site always gives the year or period. We did not find newer replacements that we could read in full.

**Other vintages to know about.**
- Earth-fissure maps are as of 2016 (Arizona Geological Survey); the site says so and says a place with no mapped fissure is not proof of none.
- The soil survey database (USDA SSURGO) was last refreshed in September 2026, but the soils were mapped at different times and Soil Data Access does not show those dates. Soil properties change slowly, but treat the soil section as survey data, not a 2026 measurement.
- ADWR sector water use is for 2022.

**What was and was not checked.**
- Checked: every number on the site against the data files (tests), and every literature figure against reports read in full text (USGS reports 1955 to 2006, Circular 1182, Epstein 1987).
- Read in full: Job and others 2023 and Devlin and Lohman 2025 (from the author preprint; the publisher's page blocked the download). Every number we take from them is listed in `docs/PAPERS_USED.md` and in the Resources dialog.
- Checked only from abstracts: Smilovsky 2025 (GSA abstract), Peng and others 2022 (we read the authors' EGU 2022 abstract, not the journal article), Devlin 2025 (dissertation embargoed, abstract only) and Saporta and others 2021 (EGU abstract). They are cited only for what those abstracts state.
- Not independently verified: the ADWR figure of 155,805 acre-feet (taken from ADWR's page) and the USDA thresholds (EC 4 dS/m, SAR 13; Handbook 60, from standard knowledge, not re-read).

## 2. Original plan versus now

| Original plan (AGENTS.md) | Now |
|---|---|
| NISAR GUNW stacks give the headline rates | **Changed.** NISAR's record is too short and noisy for a trustworthy rate, so the headline rates come from ten years of Sentinel-1. NISAR is tested alongside it (pattern, weather correction, two directions, farmland from backscatter). |
| Three hotspots: Eloy (validation), Buckeye/Goodyear (data centers), Willcox (cranes) | **Changed.** Five areas. Buckeye was dropped because the radar showed it steady (within about 0.5 cm/yr). Eloy is kept but only weakly validated against ADWR. |
| Overlays: farmland, data centers, protected and riparian areas, AMA boundaries, coherence | **Partly.** Farmland (analysis and a radar portrait), probable mines, ADWR subsidence zones are in. Data centers, protected areas and habitat, AMA boundaries and a coherence layer are not. |
| Time slider | **Done differently:** a 2016-2026 time-lapse and a scrubbable graph in each area's report. |
| Validation against ADWR | **Done.** Strong at the Willcox-area sites (0.94 to 0.99), weak at Eloy (0.59 and 0.18), stated openly. |
| Honest limits, plain language | **Kept and expanded**, plus two reading levels (plain and research). |
| Sedona flood sidebar | Not built. |
| Not in the plan | Cause-side evidence (pumping, 236 wells), per-area geology, fissures, soils. |

**Reading of the drift.** The goal (where, how fast, what sits on top, how sure we are) is intact. The route changed because the data told us to: NISAR could not carry the headline, and the West Valley had nothing to show. The cost is that NISAR is no longer the star and the data-center and habitat story is gone.

## 3. Fit with the judging criteria (Impact, Creativity, Validity, Relevance, Presentation)

- **Impact.** Strong: shows where Arizona's aquifers are costing it land, with numbers planners can read and limits they can trust.
- **Creativity.** Strong: an honest test of a brand-new satellite (including when it can confirm a rate), farm detection from NISAR's two polarizations, radar tied to wells, pumping, geology and soils, and two reading levels.
- **Validity.** Strong on process (uncertainty on every rate, two look directions, ADWR comparison, strict checks, public code, a fact-check log). Weak spots we state: short NISAR record, Eloy's weak ADWR match, line-of-sight not vertical, association not cause.
- **Relevance (to NISAR).** The risk. We use NISAR's two products (GUNW and GCOV) and say plainly what it can and cannot do yet, but the headline rates are Sentinel-1. Frame it as "we tested NISAR's first year rigorously", which is true and is what the data supports.
- **Presentation.** Good: plain-language default, a research view, phone layout, accessible. Still needed: the demo (7 slides or a 30-second video).

## 4. Still open

- The demo link (public, no login).
- The submission form paste from `docs/PROJECT_SUBMISSION.md`.
- Decide whether to add a short "what we could not do" note about data centers and habitat; the site currently says only that the West Valley is steady.
