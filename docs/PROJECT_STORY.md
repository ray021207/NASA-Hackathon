# Sinkronized: the project story

For the team: what we did, in order, and how to tell it. Every number below matches `data/processed/` and the live site (https://sinkronized.vercel.app/web/). Rates are along the satellite's line of sight; negative means sinking.

---

## One sentence

Arizona's aquifers are being pumped faster than they refill, so the ground is sinking for good. We mapped where, how fast, and how sure we are, tested NASA's new NISAR radar on it, and tied it to wells, farms and the geology underneath.

## 30-second video script (about 70 words)

> Arizona's ground is sinking, because the water beneath it is pumped out faster than it returns. Squeezed clay never springs back. We mapped ten years of radar over five Arizona areas, tested NASA's brand-new NISAR satellite on its first year, and tied the sinking to wells and farms. Click an area: see how fast it sinks, what lies beneath, and whether it can come back. Every number shows its limits. This is Sinkronized.

## The story (about two minutes spoken)

**1. The problem you cannot see.** Groundwater is out of sight. When it is pumped faster than rain and rivers refill it, the water level falls, and the clay layers that were held up by that water compact. The land above sinks. Much of that loss is permanent: the aquifer loses storage it never gets back. Sinking cracks canals, roads and wells and opens earth fissures.

**2. A new tool, an honest question.** The NASA-ISRO NISAR satellite measures ground motion with L-band radar about every 12 days, and its data archive begins in late 2025. We asked two things: what is sinking in Arizona, and what can NISAR's first year already tell us?

**3. We followed the data, not the headline.** We began with the West Valley, where new data centers are being built. Ten years of Sentinel-1 radar said that ground is steady (Buckeye, Goodyear, Surprise and Glendale all within about 0.5 cm a year). So we said so on the map and followed the data to where the sinking is: the Willcox basin and its neighbours in southeast Arizona, and Eloy in Pinal County.

**4. What we measured.**
- Ten years of Sentinel-1 (2016-2026) show all five study areas sinking: Fort Grant Road north of Willcox (-4.9 +/- 0.6 cm/yr), Elfrida area (-3.1 +/- 0.5), Willcox basin (-2.7 +/- 0.4, over 386 km2), Bowie-San Simon (-2.6 +/- 0.6) and Eloy-Picacho (-1.3 +/- 0.4).
- Four are confirmed from both satellite look directions. Bowie-San Simon is seen from one direction only, so we label it unconfirmed.
- The four Willcox-area maps match Arizona's own radar products (pattern correlation 0.94 to 0.99). Eloy matches only moderately (0.59) and weakly with RADARSAT-2 (0.18), and we say so.

**5. NISAR's first year, tested.** NISAR's own weather (troposphere) tables cut its scatter by 24%. Its one-year pattern matches the ten-year Sentinel-1 pattern across 12,850 map blocks (correlation 0.58), and its ascending look direction also sees the sinking areas moving away. But a year is too short for a trustworthy speed, so we do not publish one; we estimate NISAR can confirm Willcox around February 2027. Its two polarizations also tell farmland from desert by how much they change through the year (score 0.88, where 0.5 is chance).

**6. Why it is sinking, as far as the evidence goes.** Where USGS estimates the most irrigation pumping nearby (828 fields, 2024), the ground sinks a median 2.3 cm a year; where there are no fields, about zero. In 236 wells the water table fell a median 69 feet over 31 years, and where it fell faster the ground sinks faster (rank correlation -0.41, 95% range -0.55 to -0.23). This shows association, not who caused it.

**7. What lies beneath, area by area.** Each basin differs. Willcox sits on at least 140 feet of old lake clay. Near Eloy the ground kept sinking even after water levels rose by up to 150 feet. Elfrida's basin has no continuous clay layer. We put all five side by side: clay that can compact, sinking, water table, kilometres of earth fissure mapped by the Arizona Geological Survey, and whether the ground can come back. Where a study tested it (Eloy, Willcox) we say **studied here**; elsewhere we say **not studied here**, because it is our reading of the geology, not a measurement.

**8. What it means.** Aquifer storage lost to compaction does not come back. Showing where, how fast and how sure helps planners, water managers and residents decide where to look first. In Willcox, the state made the basin an Active Management Area (order of December 19, 2024) after evidence of subsidence and fissuring. NISAR's free 12-day data can make this monitoring routine, and our pipeline is ready to rerun when its validated reprocessing arrives.

## What we did, step by step

1. Read NISAR interferograms (GUNW) and backscatter (GCOV) from NASA's archive, streaming only the needed window from each ~7 GB file.
2. Removed the ionosphere and troposphere, referenced motion to stable ground, chained the time series, and fitted rates with uncertainty from spatial block resampling.
3. Combined with NASA JPL's OPERA Sentinel-1 displacement (2016-2026), scanned whole frames for sinking, and set aside mines and out-of-state sites.
4. Checked against ADWR's radar products and against the opposite satellite look direction.
5. Linked to cause-side evidence: USDA cropland, USGS pumping estimates (828 fields), and 236 wells (USGS and ADWR).
6. Added geology per area from USGS reports, and mapped earth fissures from the Arizona Geological Survey (data as of 2016).
7. Built a static, keyboard- and screen-reader-friendly website. Every value is loaded through strict checks that hide a section rather than show a wrong number.

## What we do not claim (say this out loud)

- NISAR's record is too short for a trusted speed; its first year is a test, not the headline.
- Radar measures slanted line-of-sight motion, not straight down. If the motion is vertical, the true drop is likely somewhat larger.
- C-band radar can over-read sinking over farmland.
- Pumping figures are model estimates; well data come from two programs.
- Sinking matching farming and wells does not prove who caused it.
- Fissure maps are as of 2016; no mapped fissure is not proof of none.
- "Can it come back?" is a study result for Eloy and Willcox only; elsewhere it is labelled our inference.
- The logo is AI-generated and labelled as such.

## How it answers the five judging criteria

| Criterion | Our answer |
|---|---|
| Impact | Shows where groundwater loss is permanently sinking Arizona's land, with numbers planners can read and limits they can trust. |
| Creativity | Tests a brand-new satellite honestly (including when it can confirm a rate), reads farming from NISAR's two polarizations, and ties radar to wells and geology. |
| Validity | Ten-year Sentinel-1, two look directions, comparison with ADWR (with the weak Eloy match stated), uncertainty on every rate, strict loading checks, public code. |
| Relevance | Directly uses NISAR GUNW and GCOV (the Dancing with the SARs challenge), with Sentinel-1 for context. |
| Presentation | Plain-language questions first, one study area at a time, evidence one click away, works by keyboard and on phones. |

## Seven-slide outline

1. **Sinkronized**: the one-sentence pitch and a hero image of the map.
2. **The problem**: invisible groundwater, permanent clay compaction, cracked canals.
3. **What we did**: Sentinel-1 for ten years, NISAR for its first year, wells and farms for the cause side.
4. **Where it sinks**: the five areas and their rates.
5. **NISAR, tested**: 24% cleaner, pattern 0.58, a year not yet enough, February 2027.
6. **What lies beneath**: the five-area table and "can it come back?" (studied vs not).
7. **Honest limits and next steps**: the list above, the link, the team.

## Questions judges may ask

- **Is NISAR enough on its own?** No. Its first year matches the ten-year pattern but is too short for a trusted speed, so the headline rates come from Sentinel-1 and NISAR is tested alongside.
- **Did you prove farming or pumping caused it?** No. Sinking is stronger where estimated pumping is higher and where wells fell faster; that is association. Cause needs other evidence.
- **Is that vertical sinking?** It is motion along the satellite's slanted view, not straight down. We label it so everywhere.
- **Why is Eloy only -1.3 cm/yr, when it is famous for sinking?** Our window is 2016-2026. The big sinking there was in the 1960s to 1980s. USGS documents continuing compaction of up to 0.3 inch a year even after water levels recovered; ours is the same order of size, but we do not claim they match.
- **Why drop the data centers?** The radar showed the West Valley is steady within about 0.5 cm/yr, so we say so on the map instead of forcing a story.
- **Is the ADWR comparison validation?** Partly. Sentinel-1 is the same satellite, so it is a consistency check; RADARSAT-2 is an independent sensor. Willcox-area agreement is strong; Eloy's is weak, and we state that.
- **How current are the fissure maps?** As of 2016, from the Arizona Geological Survey, and labelled so.
- **What did AI do?** Helped write and debug code and draft text. The logo was generated with ChatGPT and is labelled. No measured value came from an AI tool; all come from our processing of real data.

## Before submitting (deadline Sunday 15 November 2026, 11:59 pm Arizona time)

- [ ] Demo link: slides (7 or fewer) or a video (30 seconds or less), public, no login.
- [ ] Project name: RaySAR or Sinkronized. Use the name registered, the same as the site.
- [ ] Paste the Summary, Project Details, SI answers and the two link tables from `docs/PROJECT_SUBMISSION.md`.
- [ ] Team registered on the Space Apps portal.
- [ ] Team portraits: if AI-generated or AI-stylised, add the visible label.
- [ ] Open the live site once on a phone and once on a laptop.
