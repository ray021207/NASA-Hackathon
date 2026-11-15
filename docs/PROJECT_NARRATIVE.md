# Sinkronized: the whole story, from the beginning

Written for the team, as the spoken backbone of the presentation. It follows what actually happened, in order, including the dead ends. Every number matches `data/processed/` and the live site. Rates are along the satellite's line of sight; negative means sinking.

---

## 1. Where it started

Arizona's groundwater is invisible. You cannot see an aquifer drop, but you can see what it does to the land above it. When water is pumped out faster than rain and rivers refill it, the clay layers that were held up by that water compact, and the surface sinks. Some of that is permanent: the aquifer loses storage it never gets back. The sinking cracks canals, roads and wells and opens earth fissures, long cracks in the ground.

The challenge, "Dancing with the SARs", asked us to do something with NASA's new NISAR radar satellite. NISAR is a joint NASA and Indian Space Research Organisation mission. It measures how the ground moves with L-band radar about every 12 days, and its data archive starts in late 2025. Radar can turn a slow, hidden crisis into a measured number, so our plan was simple: map where Arizona is sinking, how fast, and what sits on top of it.

Our first plan had three stories. Eloy and Casa Grande, one of the best-documented subsidence areas in the United States, would be our check: if our numbers matched the official ones there, the method could be trusted. Buckeye and Goodyear, where data centers are being built in the West Valley, would be the new pressure. Willcox, in the southeast, would be the conservation story, with its sandhill crane habitat.

## 2. First contact with a NISAR file

We began with one file. A NISAR GUNW product is an unwrapped interferogram: it compares two radar passes, and the change in the signal's phase tells you how much the distance to the ground changed. Our test file was a valid 2.4 GB HDF5 file, a 12-day pair in October 2026.

Before trusting any number we asked what the file really contained. Three things came out of that first day:

- **Which pixels to trust.** About 4.1% of pixels sat inside a "valid" region but had a phase of exactly zero, scattered across the frame with low coherence. That was filler from the unwrapping, not real stillness, so we dropped them.
- **The ionosphere was still in the data.** The file's "correction applied" flags turned out to describe geolocation, not phase. The phase correlated 0.98 with the file's own ionosphere screen, and subtracting it cut the scatter from 7.5 radians to 1.4. Without that step, every later number would have been wrong.
- **The physics.** NISAR's wavelength is 24.2 cm, so one radian is 19 mm of motion along the line of sight. We read the sign convention from the product rather than assuming it.

## 3. The first surprise: coverage

Then came the first real problem. Our test file came from track 128, and it covered only 20% of the Eloy box and none of Eloy town or Casa Grande. It covered Willcox very well (94% of the box valid) and did not reach Buckeye at all.

So we went back to the archive. By satellite footprint, two other tracks contained Eloy: 077 ascending and 056 descending. But the scene list showed something else: NISAR's coverage is thin. The 077 track had nothing between December 2025 and June 2026, and the 056 track began in June 2026. We confirmed this was real by checking the radar's raw acquisition dates, not a search artifact. Over Eloy, only about four months of connected NISAR data existed. Willcox, on track 128, had the full year.

The honest consequence: Eloy could not be our NISAR centerpiece.

## 4. Willcox first, and a noisy answer

We built the Willcox time series from 25 consecutive pairs from October 2025 to October 2026, chaining each pair onto the last. The first answer looked like a result: about -3.4 cm a year.

It was not a result. Dropping the last two months moved the rate from about -3.4 to about -0.6 cm a year. Looking closer, pair-to-pair jumps were as large as 72 mm, and consecutive pairs were negatively correlated (-0.39), which is the signature of independent errors on single dates: a bad date contaminates both pairs that use it. Chaining consecutive pairs gives no redundancy to average those errors out.

So we removed NISAR's own troposphere (water-vapour) and solid-earth-tide corrections, which the product ships as separate screens. We tested the sign of each empirically. That cut the scatter by 24% (17.8 mm to 13.5 mm). It was a real improvement, but it did not turn one year of data into a trustworthy speed. We decided then not to publish a NISAR rate.

## 5. Widening the lens: ten years of Sentinel-1

A year of NISAR cannot say how fast the ground sinks, but ten years of Sentinel-1 can. NASA JPL's OPERA project publishes ready-made Sentinel-1 displacement (2016-2026), so we used it as the long record and NISAR as the new test alongside it.

Rather than only measuring the places we had chosen, we searched whole Sentinel-1 frames across southern Arizona for ground that sinks, and we checked every cluster:

- Some clusters were **mines** (Sierrita, Ray and others). Open pits move for reasons unrelated to groundwater, so we marked them and set them aside.
- Some were **outside Arizona** (the Cerro Prieto geothermal field in Mexicali, Caborca in Sonora).
- Some places were **flat**: Tucson, Marana, Yuma, the Phoenix valley, and the West Valley.

That last result changed the project. The West Valley towns (Buckeye, Goodyear, Surprise, Glendale) are steady to within about 0.5 cm a year over ten years. There was no sinking to explain around the data centers. As a team we dropped that story and said so on the map, with "checked: no sinking found" markers, instead of forcing it.

The sinking was elsewhere: the Willcox basin and its neighbours in southeast Arizona, and the Eloy-Picacho belt.

## 6. Confirming it from both sides

A single satellite direction can be fooled. Sentinel-1 looks at the ground on southbound (descending) passes and northbound (ascending) passes. We checked every study area from the second direction too. Four areas agree in both directions: the Willcox basin, Fort Grant Road north of Willcox, the Elfrida area to the south, and Eloy-Picacho. Bowie-San Simon is covered from one direction only, so we label it unconfirmed on the page.

The two directions agree in sign and ranking but not exactly in size; in three of four areas the ascending value is a quarter to a third smaller. We say that, rather than hide it.

We then compared our maps with Arizona's own radar products from the Department of Water Resources. In the four Willcox-area study boxes the patterns match closely (correlation 0.94 to 0.99). At Eloy they match only moderately with ADWR's Sentinel-1 (0.59) and weakly with its RADARSAT-2 (0.18). We kept that on the page.

Our rates, ten years of Sentinel-1: Fort Grant Road north of Willcox -4.9 +/- 0.6 cm a year, Elfrida area -3.1 +/- 0.5, Willcox basin -2.7 +/- 0.4 over 386 square kilometres, Bowie-San Simon -2.6 +/- 0.6, and Eloy-Picacho -1.3 +/- 0.4.

## 7. What NISAR can already tell us

We put the new satellite to the test instead of ignoring it, and each result is stated at its true strength:

- **Where, not how fast.** NISAR's one-year pattern matches the ten-year Sentinel-1 pattern across 12,850 map blocks (correlation 0.58).
- **Both directions.** NISAR's ascending look direction also sees the sinking areas moving away, and its uncertainty range excludes zero.
- **A direct check on a short window.** At Willcox playa, NISAR and Sentinel-1 move the same way over the same half year (168 days), but not by the same amount, and NISAR had only 20 usable pixels there. We call it a consistency check, not validation.
- **When can it confirm a rate?** From the noise we measured, we estimate NISAR can confirm Willcox's rate around February 2027 if it keeps observing.

## 8. Farmland: what NISAR sees that others do not

NISAR records two polarizations, HH and HV. Using its GCOV backscatter product, we compared irrigated cropland (from the USDA Cropland Data Layer) with desert. NISAR does not tell them apart by brightness (a score of 0.50, a coin flip). It tells them apart by how much the signal changes through the year (0.88, where 1.0 is perfect). Farming shows up as change over time.

Rain, however, brightens every land type at once, so we only used dry dates for that comparison. NISAR also lets us draw a false-colour "radar portrait" of the Willcox basin, in which hundreds of round center-pivot fields appear as pink circles around the dark dry lake bed of the playa.

We also checked the known weakness of the older C-band radar: over farmland, changing soil moisture can add apparent sinking. Cropland is 2.1% of the Willcox study box but 7.4% of its sinking area, and we state that the farmland reading may be inflated.

## 9. Why it is sinking, as far as evidence goes

Radar shows where the ground moves, not why. So we added the cause-side evidence:

- **Pumping.** The USGS estimated 2024 irrigation withdrawals for 828 fields in the Willcox basin. Where estimated pumping nearby is highest, the ground sinks a median 2.3 cm a year; where there are no fields, about zero.
- **Wells.** In 236 wells measured by USGS and ADWR, the water table fell a median 69 feet over 31 years, and 92% of wells are deeper than in the 1980s. Where the water table fell faster, the ground sinks faster (rank correlation -0.41, 95% range -0.55 to -0.23).

This is association, not proof of who caused it, and the site says exactly that.

## 10. What lies beneath, and whether it comes back

The ground does not behave the same way everywhere, so we gave every study area its own geology, taken from USGS reports we read in full:

- **Willcox** sits on at least 140 feet of old Lake Cochise clay under the playa.
- **Eloy-Picacho** has a thick playa clay layer in the middle of its basin fill. USGS recorded a metre of sinking at one extensometer in 1965-83, and the ground kept sinking even after water levels rose by up to 150 feet.
- **Elfrida** is a different basin with no basin-wide clay layer at all.
- **Bowie-San Simon** has a "blue clay" layer separating two aquifers.

We put all five side by side: the clay that can compact, our measured sinking, the falling water table, the kilometres of earth fissure mapped by the Arizona Geological Survey (data as of 2016), and the question people care about most: **can the ground come back?** Where a study tested it (Eloy, Willcox) we write **studied here**. For the other three we write **not studied here**, because that answer is our reading of the geology, not a measurement. In Willcox the state responded in December 2024 by creating an Active Management Area, citing evidence of subsidence and fissuring.

## 11. The website, and how people use it

All of this lives in one free, static website that works without a backend, by keyboard and screen reader, and on a phone.

- **It opens with plain questions**, not a data dump: "Where is the ground sinking?", "What does NASA's NISAR show?", "Is it the pumping?", "Is the water table falling?". Each leads to a chart and a short answer, with the reasoning one click away.
- **The map** shows ten years of ground motion, NISAR's first year, Arizona's official sinking zones, probable mines, and places checked and found steady. NISAR's layers are off by default and drawn relative to their own median, because shown raw they turned each box uniformly red and would have been misread as fast sinking.
- **Each study area has a report.** It opens with the headline rate beside a ranking against the other four, then has three tabs: **Summary** (the story of the place and a ten-year time-lapse on satellite imagery you can play), **What lies beneath** (layers, measured values, sources), and **Methods & checks** (records, the comparison with ADWR, the limits). A card says whether the two satellite directions agree and how that was recorded.
- **The graph** beside the map can be scrubbed through time, minimized, expanded or resized, and highlights the sinking and stable pixels on the map as you go.
- **"How we measured" and "Limits"** explain the method in plain language and list what we do not claim. **"Resources"** gives every source.
- **Every value is loaded through strict checks.** If a number is missing or malformed, its section hides itself instead of showing something wrong.

## 12. Mistakes we caught, and what we changed

We are proudest of what we corrected, because it is why the numbers can be trusted:

- The first Willcox rate depended on its last two months, so we did not publish a NISAR speed.
- A rank-correlation calculation mishandled ties, and the corrected value is the one on the site.
- We had written that the Willcox basin covers 950 square miles; the USGS says about 1,500, of which the valley floor is 950. We fixed it.
- A USGS report we found for "San Simon" turned out to describe a different place in western Arizona, so we discarded it.
- We dropped the West Valley data-center story when the radar said it is steady.
- A text colour on the report header was almost invisible against its background (1.1:1 contrast); we fixed it and checked the rest for contrast.

## 13. How we used AI

We used an AI assistant to help write and debug code and to draft explanatory text. The logo was generated with ChatGPT and is labelled as AI-generated on the site. No measured value came from an AI tool: every number comes from our processing of real data, with code in the public repository.

## 14. What we would do next

NISAR keeps observing. When its validated reprocessing arrives and the record reaches about 15 months, we expect to be able to confirm a rate at Willcox, and our pipeline is ready to rerun. We would also add the newest mapped fissures, test "can it come back?" directly at the areas not yet studied, and bring in more of Arizona's basins.

## 15. The closing line

Groundwater loss is invisible until the ground moves, and the ground it moves does not come back. A new satellite makes it measurable every 12 days. Sinkronized shows where it is happening, how fast, how sure we are, and what lies beneath, and it is honest about what we do not yet know.
