"""Subsurface geology for each study area, for the study-area report panel: data/processed/geology.json.
The text is hand-written from primary sources that were read in full (see docs/fact_check.md); every fact names its source.
Layers are a SCHEMATIC top-to-bottom order (not to scale) from the same sources. 'compacts' marks fine-grained layers that the sources
describe as clay, silt or playa deposits (the material that compacts when water levels fall).
Measured values are ours: Sentinel-1 rate (timeseries_<slug>.json) and the median water-table decline of wells inside the study box
(groundwater_vs_sinking.json), shown only when at least 5 wells are inside.   Usage: python geology_areas.py"""
import json, os, numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = f"{ROOT}/data/processed"

S = {
    "brown1969": ("Brown, S. G. & Schumann, H. H. (1969). Geohydrology and Water Utilization in the Willcox Basin, Graham and Cochise Counties, Arizona. USGS Water-Supply Paper 1859-F", "https://doi.org/10.3133/wsp1859F"),
    "konieczki2006": ("Konieczki, A. D. (2006). Investigation of the Hydrologic Monitoring Network of the Willcox and Douglas Basins of Southeastern Arizona. USGS Fact Sheet 2006-3055", "https://pubs.usgs.gov/fs/2006/3055/"),
    "galloway1999": ("Galloway, D., Jones, D. R. & Ingebritsen, S. E. (1999). Land Subsidence in the United States. USGS Circular 1182", "https://doi.org/10.3133/cir1182"),
    "pool2001": ("Pool, D. R., Carruth, R. L. & Meehan, W. D. (2001). Hydrogeology of Picacho Basin, South-Central Arizona. USGS Water-Resources Investigations Report 00-4277", "https://pubs.usgs.gov/wri/2000/4277/report.pdf"),
    "epstein1987": ("Epstein, V. J. (1987). Hydrologic and Geologic Factors Affecting Land Subsidence near Eloy, Arizona. USGS Water-Resources Investigations Report 87-4143", "https://doi.org/10.3133/wri874143"),
    "coates1955": ("Coates, D. R. & Cushman, R. L. (1955). Geology and Ground-Water Resources of the Douglas Basin, Arizona. USGS Water-Supply Paper 1354", "https://pubs.usgs.gov/publication/wsp1354"),
    "white1965": ("White, N. D. & Hardt, W. F. (1965). Electrical-Analog Analysis of Hydrologic Data for San Simon Basin, Cochise and Graham Counties, Arizona. USGS Water-Supply Paper 1809-R", "https://pubs.usgs.gov/wsp/1809r/report.pdf"),
    "smilovsky2025": ("Smilovsky, D. (2025). Recharged but Not Recovered: InSAR Observations of Persistent Land Subsidence in Arizona's Willcox Basin. GSA Connects 2025 abstract", "https://gsameetings.secure-platform.com/connects25/solicitations/103002/sessiongallery/schedule/items/95198/application/10103"),
    "job2023": ("Job, C., Ochoa, C., Jarvis, W. & Kennedy, R. (2023). A Spatiotemporal Characterization of Water Resource Conditions and Demands as Influenced by the Hydrogeologic Framework of the Willcox Groundwater Basin, Southeastern Arizona, USA. Geosciences 13(6), 176", "https://doi.org/10.3390/geosciences13060176"),
    "peng2022": ("Peng, M. and others (2022). Use of satellite remote sensing and independent component analysis to assess land subsidence and aquifer system properties over the Willcox Basin, USA. EGU General Assembly 2022, abstract EGU22-4147 (journal version, RSE 271, 112894, not read)", "https://doi.org/10.5194/egusphere-egu22-4147"),
    "adwr_ama": ("Arizona Department of Water Resources. Willcox Active Management Area", "https://www.azwater.gov/node/5934"),
    "azgs_fissures": ("Arizona Geological Survey. Earth fissure maps, as published with its Earth Fissure Viewer (data last updated February 2016)", "https://github.com/azgs/EarthFissureViewer"),
}
# Can the ground come back? 'studied' = a source tested or observed it in this area; 'inferred' = not studied here, our reading of the
# geology plus the general USGS finding that compaction of clay below its previous lowest water level is largely permanent (Galloway 1999).
RECOVERY = {
    "eloy": ("studied", "Largely no. Water levels rose by up to 150 feet, yet some ground kept sinking as the thick clay kept draining.", "galloway1999"),
    "willcox": ("studied", "Not so far. Recent wetter years gave only temporary, local recharge, and the sinking continued.", "smilovsky2025"),
    "north_willcox": ("inferred", "Not studied here. The same lake clay lies beneath and the water table is still falling, which the USGS links to permanent compaction.", "galloway1999"),
    "south": ("inferred", "Not studied here, and unclear. There are clay lenses but no basin-wide clay layer, so how much would rebound is not known.", "konieczki2006"),
    "east": ("inferred", "Not studied here. A blue clay layer lies beneath and the water table is still falling, which the USGS links to permanent compaction.", "galloway1999"),
}
WILLCOX_BASIN = "Willcox basin, northern Sulphur Springs Valley: about 1,500 square miles, of which the valley floor is about 950 (Brown and Schumann, 1969)."
AREAS = {
    "eloy": dict(
        basin="Picacho Basin (Pinal County)",
        summary="A deep, fault-bounded basin filled with sediment. A thick old-lake (playa) layer of silt and clay sits in the middle of the fill, and that layer is what squeezes when the water is pumped out.",
        layers=[("Upper unit", "sand", "Sand and gravel, including Gila River gravels; part of the upper aquifer.", False),
                ("Middle unit (playa facies)", "clay", "Silt, clay, mudstone and gypsum: the middle confining unit, far more compressible than the layers below.", True),
                ("Lower unit", "evaporite", "Conglomerate and thick salt and gypsum beds; the lower aquifer system.", False),
                ("Bedrock", "rock", "The floor of the faulted basin.", False)],
        facts=[("The basin is a sediment-filled, tilted rift (graben) of about 900 square miles; the sediment is thickest along its east side, and the middle and upper units together are up to 1,500 feet thick.", "pool2001"),
               ("As much as 80 percent of the water taken from storage in the Eloy area came from squeezing pore space, that is, from compaction.", "pool2001"),
               ("At an extensometer near Eloy, the land sank 1.09 m in 1965-83. A single highly compressible clay layer about 24 m (80 ft) thick drives the compaction and is expected to keep compacting after water levels stop falling.", "epstein1987"),
               ("By 1977 about 625 square miles around Eloy had sunk, by as much as 12.5 feet. The Picacho earth fissure, about 10 miles long, damaged the Central Arizona Project canal where it crosses.", "galloway1999"),
               ("Even after water levels in the Picacho Basin recovered by up to 150 feet, some areas kept sinking (up to 0.3 inch a year) as the thick clays kept draining.", "galloway1999")],
        caveat="The sources describe the Picacho Basin and the Eloy area; layer depths vary across the basin. The diagram is schematic, not to scale."),
    "willcox": dict(
        basin="Willcox basin (Cochise County), including the Kansas Settlement farming area",
        summary="A closed basin with no outlet. Under and around Willcox Playa lies thick black clay left by ancient Lake Cochise; around it, water comes from layers of sand and gravel within silt and clay, and to the east (Kansas Settlement) from older, more consolidated alluvium.",
        layers=[("Stream deposits", "sand", "Gravel, sand, silt and clay in lenses: the most productive water-bearing layers.", False),
                ("Lake-bed clay (ancient Lake Cochise)", "clay", "Uniform black to grey clay under and around the playa: at least 140 ft at the playa centre; confines the water below.", True),
                ("Poorly and moderately consolidated alluvium", "consolidated", "Older fill; the aquifer in the Kansas Settlement area, less permeable but more uniform.", False),
                ("Bedrock of the mountain blocks", "rock", "Igneous, metamorphic and sedimentary rocks.", False)],
        facts=[(WILLCOX_BASIN, "brown1969"),
               ("A test hole 140 feet deep at the centre of the playa found only black clay; along the playa's east edge, clay continued more than 50 feet down.", "brown1969"),
               ("The lake-bed clay can confine the water beneath it, creating artesian conditions, or hold water perched above it.", "konieczki2006"),
               ("In the Kansas Settlement area, water levels fell about 74 feet in 1952-64, more than 10 feet a year in some wells in 1962-63.", "brown1969"),
               ("Water levels fell more than 200 feet in nine Willcox Basin wells in 1954-75, and an earth crack opened south of Willcox in August 2005.", "konieczki2006"),
               ("A 2025 study found that recent wetter years gave only temporary, local recharge, while subsidence persists and in some zones is speeding up.", "smilovsky2025")],
        caveat="The playa clay is mapped mainly under and near the playa; its full extent below ground is not known accurately from drillers' logs (Brown and Schumann, 1969). The diagram is schematic, not to scale."),
    "north_willcox": dict(
        basin="Northern Willcox basin (Graham and Cochise counties), along Fort Grant Road",
        summary="The northern end of the same closed basin. Here the lake clay lies deeper than at the playa, under more stream-laid sand and gravel, because streams kept building the north end while the lake clay was laid down farther south.",
        layers=[("Stream deposits", "sand", "Sand and gravel with silt and clay lenses; thicker here, where streams kept depositing.", False),
                ("Lake-bed clay", "clay", "The ancient Lake Cochise clay, at lower altitudes north of the playa.", True),
                ("Poorly and moderately consolidated alluvium", "consolidated", "Older basin fill.", False),
                ("Bedrock of the mountain blocks", "rock", "Igneous, metamorphic and sedimentary rocks.", False)],
        facts=[(WILLCOX_BASIN, "brown1969"),
               ("The top of the black clay is about 4,136 feet above sea level at the playa but lower to the north; the authors think clay deposition shifted south while streams kept depositing in the north end of the basin.", "brown1969"),
               ("In the Stewart area, just south of the Graham-Cochise county line, water levels fell 10 to more than 60 feet after 1952, and that pumping also lowered levels in the Sierra Bonita Ranch area to the north.", "brown1969"),
               ("About 5 feet of subsidence was measured northwest of Willcox between 1937 and 1974.", "konieczki2006"),
               ("Since 2025 the whole Willcox basin is an Active Management Area, after the state presented evidence of land subsidence and fissuring; irrigation is limited to land already legally irrigated.", "adwr_ama")],
        caveat="How deep the clay lies at any one point here is not given in the sources. The diagram is schematic, not to scale."),
    "south": dict(
        basin="Douglas basin (Cochise County), southern Sulphur Springs Valley, around Elfrida",
        summary="A different basin from Willcox. Its fill is sand and gravel lenses mixed with silt and clay lenses, with no basin-wide clay layer, though clay and caliche lie near the surface between the streams.",
        layers=[("Caliche and clay near the surface", "clay", "Between the stream channels, caliche and clay at shallow depth limit recharge from rain and irrigation.", True),
                ("Valley fill", "mixed", "Sand and gravel lenses interbedded with silt and clay lenses: coarse near the mountains, finer toward the basin centre. The sand and gravel supply the water.", True),
                ("Bedrock", "rock", "Igneous, metamorphic and sedimentary rocks of the surrounding mountains.", False)],
        facts=[("There are no large-scale confining (clay) layers in the Douglas Basin, only local areas where water is confined or perched.", "konieczki2006"),
               ("The fill grades from coarse at the mountain fronts to fine in the basin centre; caliche and clay at shallow depth between the streams prevent much recharge from rain or irrigation.", "coates1955"),
               ("The Elfrida area was the most heavily pumped part of the basin by 1951: its water table fell more than 11 feet in 1947-51 alone.", "coates1955"),
               ("Where the clay is spread through many lenses, the USGS notes that what controls compaction is the total (aggregate) thickness of the fine-grained layers.", "galloway1999")],
        caveat="The Douglas basin sources are older (1955) or general; they do not map clay thickness near Elfrida. The diagram is schematic, not to scale."),
    "east": dict(
        basin="San Simon basin (Cochise County), Bowie and San Simon areas",
        summary="A basin with two aquifers stacked one over the other: a 'blue clay' layer separates a deeper, pressurised (artesian) aquifer from the upper water-table aquifer; at the basin edges the two join.",
        layers=[("Upper unit", "sand", "Interfingering sand, gravel, silt and clay: the upper (water-table) aquifer.", False),
                ("Blue clay unit", "clay", "Clay that confines the lower aquifer; some water leaks up through it.", True),
                ("Lower unit", "sand", "The lower aquifer, under artesian pressure; thickest beneath San Simon Creek.", False),
                ("Bedrock", "rock", "Rocks of the surrounding mountains.", False)],
        facts=[("The fill is interfingering beds and lenses of clay, silt, sand and gravel, divided into a lower unit, a blue clay unit, an upper unit and a marginal zone at the basin edges.", "white1965"),
               ("Water in the lower aquifer is under artesian pressure; the upper aquifer and the marginal zone, where the two join, are water-table aquifers.", "white1965"),
               ("Bowie is on the west side of the basin, about 3 miles from the Dos Cabezas Mountains; San Simon is near San Simon Creek on the east side, where the lower aquifer is thickest.", "white1965"),
               ("A 1965 model predicted water-level declines of up to 120 feet at Bowie and 160 feet at San Simon between 1960 and 1980 (a prediction, not a measurement).", "white1965")],
        caveat="Our radar sees this area from one direction only, and the San Simon sources are from 1965. The diagram is schematic, not to scale."),
}


# ---- Two reading levels. PLAIN: short, everyday wording for the public. DETAIL: quantitative hydrogeology for researchers and
# water engineers, each line quoted or closely paraphrased from the cited report (read in full; see docs/fact_check.md). ----
PLAIN = {
    "eloy": dict(
        summary="Under Eloy lies a deep basin filled with sand, gravel and a thick layer of old lake-bed clay. When water is pumped out, the clay squeezes like a sponge and the land above sinks.",
        layers=["Sand and gravel that hold water.", "Old lake-bed clay and silt. It squeezes when the water is removed.", "Deep, firm rock and salt layers.", "The solid floor of the basin."],
        facts=[("Near Eloy the ground sank by about 3.6 feet between 1965 and 1983, measured at one site.", "epstein1987"),
               ("By 1977 an area of about 625 square miles around Eloy had sunk, by up to 12.5 feet.", "galloway1999"),
               ("Even after water levels rose by up to 150 feet, some ground kept sinking, because the clay drains slowly.", "galloway1999")]),
    "willcox": dict(
        summary="Willcox sits in a closed valley with a dry lake bed in the middle. Under it lies thick black clay from an ancient lake. Farms pump water from the sand and gravel around it.",
        layers=["Sand and gravel that hold water. Farms pump from here.", "Thick black clay from the ancient lake. It squeezes when the water is removed.", "Older, firmer fill.", "The solid floor of the valley."],
        facts=[("A test hole in the middle of the dry lake bed found only black clay for 140 feet.", "brown1969"),
               ("In the Kansas Settlement farming area, the water table fell about 74 feet between 1952 and 1964.", "brown1969"),
               ("A 2025 study found that wetter years helped only briefly and locally, while the sinking continues.", "smilovsky2025")]),
    "north_willcox": dict(
        summary="This is the northern end of the same valley. The old lake clay lies deeper here, under more sand and gravel washed in by streams.",
        layers=["Thicker sand and gravel here.", "Old lake clay, lying deeper than at the dry lake bed.", "Older, firmer fill.", "The solid floor of the valley."],
        facts=[("North of the dry lake bed the lake clay sits lower, and streams kept adding sand and gravel on top.", "brown1969"),
               ("Near Stewart, water levels fell from 10 to more than 60 feet after 1952.", "brown1969"),
               ("About 5 feet of sinking was measured northwest of Willcox between 1937 and 1974.", "konieczki2006")]),
    "south": dict(
        summary="This is a different valley from Willcox. It has no single big clay layer. Sand, gravel and clay are mixed together, with clay and hard soil near the surface.",
        layers=["Hard soil and clay near the surface keep rain and irrigation water from soaking in.", "A mix of sand, gravel, silt and clay.", "The solid floor of the valley."],
        facts=[("Scientists found no large clay layers in this basin, only small local ones.", "konieczki2006"),
               ("Around Elfrida the water table fell more than 11 feet in just five years (1947 to 1951).", "coates1955"),
               ("When clay is spread through many small lenses, what matters is the total thickness of all the clay.", "galloway1999")]),
    "east": dict(
        summary="Two water-bearing layers lie one above the other, separated by a layer of clay. The deeper one is under pressure.",
        layers=["Sand, gravel and clay that hold water near the top.", "A clay layer that separates the two water layers.", "A deeper water layer, under pressure.", "The solid floor of the valley."],
        facts=[("The ground here is layers of clay, silt, sand and gravel.", "white1965"),
               ("The deeper water is under pressure, like water in a closed pipe.", "white1965"),
               ("A 1965 model predicted water levels could fall up to 120 feet at Bowie and 160 feet at San Simon by 1980. That was a prediction, not a measurement.", "white1965")]),
}
DETAIL = {
    "eloy": [
        ("Layering", "Three hydrostratigraphic units rest on bedrock. The lower unit is several thousand feet thick (conglomerate, and a playa facies with thick evaporites). The middle unit is largely playa deposits, up to 1,500 ft thick. The upper unit is alluvium of interbedded sand, gravel, silt and clay, generally 500 to 1,500 ft thick. Water occurs in lower and upper aquifer systems separated by the middle confining unit.", "pool2001"),
        ("Compressibility", "Hydraulic properties and compressibility of the middle and upper units are much greater than those of the lower unit.", "pool2001"),
        ("Where it compacts", "Most aquifer-system compaction has occurred in the middle confining unit and the fine-grained interbeds of the upper aquifer system. Most storage loss came from dewatering pores in the upper aquifer system, with significant loss of pore volume in the middle confining unit.", "pool2001"),
        ("Transmissivity (upper unit)", "From specific-capacity data: below 6,750 ft2/d in the central basin southwest of Eloy and between Coolidge and Eloy; above 12,000 ft2/d near Coolidge and along the Gila River; above 25,000 ft2/d between Picacho Peak and the Silverbell Mountains. These values probably underestimate the whole saturated thickness.", "pool2001"),
        ("Water-level decline", "Upper aquifer system: more than 150 ft through most of the basin by 1977, more than 300 ft in the southeast, and more than 350 ft there by 1985. About 250 ft in the lower aquifer system south of the Casa Grande Mountains, where data were too sparse to map.", "pool2001"),
        ("Subsidence", "More than 12 ft along the primary level line by 1984, and more than 15 ft south of Eloy by 1985.", "pool2001"),
        ("Extensometer record", "At the Eloy extensometer, leveling showed 1.09 m of subsidence in 1965-83 against 0.82 m of recorded compaction (the extensometer only partly penetrates the compressible sediments). A one-dimensional model reproduced cumulative daily compaction to within an average of 0.0038 m. Compaction was most sensitive to the specific storage (compressibility) of the fine-grained sediments; preconsolidation stress and hydraulic conductivity also matter.", "epstein1987"),
        ("Permanent compaction", "Inelastic compaction occurs when effective stress exceeds the previous maximum (the preconsolidation stress). The first recognized earth fissure (1927, about 3 mi southeast of Picacho) came before significant water-level declines, which suggests some sediments were already near their preconsolidation stress.", "pool2001"),
        ("Picacho fissure over time", "The Picacho earth fissure was a single crack in an October 1967 aerial photograph; by June 1989 it had become a system of multiple parallel cracks, with a scarp showing as much as 2 ft of vertical offset (west side down-dropped).", "galloway1999"),
        ("Subsidence follows decline", "Repeat leveling and borehole extensometers (Eloy, Higley Road and Luke Air Force Base from the late 1960s) showed the greatest subsidence in the areas of greatest water-level decline (Schumann and Poland, 1970, as cited by the USGS).", "galloway1999"),
    ],
    "willcox": [
        ("Pumping history", "Irrigation pumping grew from about 4,000 acre-ft in 1928 to about 180,000 acre-ft a year by 1963. About 1.86 million acre-ft had been pumped through 1963: 680,000 from the Stewart area, 990,000 from Kansas Settlement and 190,000 from Pearce-Cochise.", "brown1969"),
        ("Before pumping", "The system was probably near equilibrium: about 75,000 acre-ft a year left by evapotranspiration in the playa area, and about 54,000 acre-ft a year moved as underflow toward the playa.", "brown1969"),
        ("Aquifer properties", "Transmissibility estimated from specific capacity ranged from 58,000 to 160,000 gal/d per ft. In Kansas Settlement, wells in poorly and moderately consolidated alluvium had a specific capacity of only 7.4 gal/min per 100 ft of saturated material: much less permeable than the Stewart area aquifer, but more homogeneous.", "brown1969"),
        ("Declines 1952-64", "Average water-level declines were about 29 ft in the Stewart area, 19 ft in Pearce-Cochise and 74 ft in Kansas Settlement. In 1962-63 some Kansas Settlement wells fell more than 10 ft a year.", "brown1969"),
        ("Later record", "Combined pumpage in the Willcox and Douglas basins from 1915 to 2000 exceeded 12 million acre-ft. Water levels fell more than 200 ft in nine Willcox wells in 1954-75, and about 5 ft of subsidence was measured northwest of Willcox in 1937-74.", "konieczki2006"),
        ("InSAR record (2025)", "Sentinel-1 and ALOS InSAR time series, checked against GPS benchmarks and groundwater-level records, show two major deformation zones with rates above 15 cm/yr and cumulative vertical displacement above 11 ft (about 3.4 m) in some places since the mid-20th century. Above-average rain in recent years gave temporary, local recharge and some water-level improvement, mainly in the fine-grained sediments of the Willcox Playa, but subsidence persists and in some zones is still accelerating. Natural recharge does not offset long-term deficits above 100,000 acre-ft a year.", "smilovsky2025"),
        ("How our numbers compare", "Our fastest 300 m cell in this study box reads about -8.5 cm/yr (Sentinel-1, 2016-2026, line of sight), below the rates above 15 cm/yr reported for two zones in that study. The sensors, periods and resolutions differ and we did not test which of these explains the gap.", "smilovsky2025"),
        ("National assessment", "The USGS national subsidence assessment lists the Cochise County farming areas near Willcox and Bowie among Arizona's subsidence areas; by 1980 water levels had fallen at least 100 ft in each listed area and 300 to 500 ft in most.", "galloway1999"),
        ("Basin and storage (2023)", "A closed basin of about 4,950 km2 in Cochise and Graham counties; the basin fill is up to about 1,800 m thick. Recharge from mountain-front runoff and seepage is estimated at 0.02-0.06 km3 a year (about 16,000-49,000 acre-ft, our conversion), plus about 0.08 km3 of irrigation return in 2015 (ADWR). Groundwater in storage is estimated at 51.8-72.8 km3 (ADWR Water Atlas, 2009, as cited). Lake-bed clay near the playa holds confined or perched water, so water is shallower there than elsewhere in the basin.", "job2023"),
        ("Pumping and crops (2023)", "ADWR estimates that 90% of the basin's groundwater withdrawal is for irrigation (Water Atlas, as cited). USGS estimates put agricultural pumping at about 0.17 km3 in 2000 and 0.26 km3 in 2020, a 56% rise by the paper's figure (about 138,000 to 211,000 acre-ft, our conversion). In 2020 corn (34.5% of irrigation demand), alfalfa (20.8%), small grains (19.9%) and orchards (9.9%) made up over 85%; sprinklers were the main method, at an average efficiency of 88%. These are USGS 2020 estimates, not the ADWR 2022 and USGS 2024 figures on the Pumping tab.", "job2023"),
        ("Cropland and wells (2023)", "Cropland from the USDA Cropland Data Layer (30 m cells, regrouped as cropland or not; overall accuracy 97.3-99.2% from NASS statewide error matrices) grew about 29% in 2008-2021, from 18,326 to 23,652 ha (about 45,300 to 58,400 acres, our conversion), with the greatest increase in the south of the basin. ADWR-registered wells rose 20.9%, from 3,937 to 4,759, and their average registered depth rose 18.0%, from 105.9 to 125.0 m, in 2006-2021.", "job2023"),
        ("Water-level change (2023)", "At 149 wells measured in water years 2006 and 2021, levels changed by between a 4.1 m rise and a 38.8 m fall; 93.2% fell by more than 1 m and 3.4% rose by more than 1 m. The mean and median are about -13 to -14 m (about -43 to -45 ft, our conversion); the paper's text and its table give the two values in opposite order (-13.1 and -13.8 m), and the standard error of the mean is 0.7 m. The largest declines are south of the playa, with some over 20 m north of the town of Willcox; the only rises are in the Chiricahua foothills.", "job2023"),
        ("Index wells and cropland (2023)", "For the 52 wells measured every year, mean depth to water deepened each year, from 56.4 m in 2008 to 93.2 m in 2021; the authors attribute the larger change to the small sample and the index wells' particular characteristics. Against basin cropland area for 2008-2021 the Spearman rank correlation was 0.89 (p < 0.001, n = 14). Their trend projections to 2031 are 116.8 m depth to water and 27,603 ha of cropland. Both series rise with time, so the correlation alone shows association, not cause (our note); the study did not measure pumping.", "job2023"),
        ("Rain (2023)", "PRISM 1991-2020 normals: over 950 mm a year on parts of the Chiricahua and Pinaleno ranges, under 350 mm across much of the basin interior. Mann-Kendall tests on three points over 30 years found no meaningful trend at the playa (1,271 m: tau -0.11, p = 0.21, Sen's slope -1.5 mm a year) or in the Chiricahuas, and a moderate decline in the Pinalenos (tau -0.35, p < 0.01, -13.4 mm a year). Three points only, so local rain changes elsewhere are not ruled out.", "job2023"),
        ("Consequences and costs (2023)", "Nearly 30% of registered wells report a depth of 50 m or less, so declines of this size put shallow wells at risk of going dry; the authors cite an estimated $420,000 in 2017 to drill an irrigation well to 365 m. The ADWR forecast they cite removes 29.6 km3 from storage by 2115 (about 24 million acre-ft, our conversion). They also cite subsidence as fast as 0.15 m a year and over 60 km of documented earth fissures, some damaging infrastructure (ADWR 2019 monitoring report).", "job2023"),
        ("Limits stated by the authors (2023)", "There is no continuous record of pumping outside Active Management Areas, so pumping is inferred from cropland change; the Cropland Data Layer gives only 2008-2021; the extent and depth of the hydrogeologic units is poorly known across much of the basin; and the groundwater contour map mixes interpolation with hand-drawn contours and is 'a generalized representation', not definitive. The work grew out of a master's capstone project.", "job2023"),
        ("Aquifer response (2022)", "From L-band ALOS and C-band Sentinel-1 radar (2006-2020) plus water levels, the authors find two major subsidence zones with the mean rate rising over time, and attribute the sinking to compaction from heavy pumping of the deep aquifer system. Storage coefficients were 6.0e-4 to 0.02 in 2006-2011 and 2.3e-5 to 0.087 in 2015-2020; the average fell from 0.008 to 0.005, which they read as irreversible deformation and degraded storage. Storage depletion in 1990-2006 was 3.7e8 m3 (about 300,000 acre-ft, our conversion). Source: the authors' EGU 2022 abstract; we did not read the journal article.", "peng2022"),
    ],
    "north_willcox": [
        ("Aquifer", "In the Stewart area most irrigation wells draw from the stream deposits. Transmissibility estimated from specific capacity ranged from 58,000 to 160,000 gal/d per ft across the basin's main aquifers.", "brown1969"),
        ("Declines", "Water levels fell about 29 ft on average in the Stewart area from spring 1952 to spring 1964, and declines in 1962-63 exceeded 7 ft a year there. Pumping near Stewart also lowered levels in the Sierra Bonita Ranch area to the north.", "brown1969"),
        ("Clay depth", "The top of the black lake clay is at about 4,136 ft above sea level at the playa but lower to the north. The authors infer that clay deposition shifted south while streams kept depositing in the north end of the basin. Clay depth at any single point here is not reported.", "brown1969"),
        ("Subsidence record", "About 5 ft of subsidence was measured northwest of Willcox between 1937 and 1974. Some of the earth cracks and fissures in the Willcox Basin could be related to that subsidence and to water-level decline.", "konieczki2006"),
        ("Basin-wide change (2023)", "In the 2023 basin study, 149 wells measured in water years 2006 and 2021 changed by between a 4.1 m rise and a 38.8 m fall (93.2% fell by more than 1 m), and declines over 20 m were mapped north of the town of Willcox. The study gives no figure for this area alone, so we cannot say whether it is one of those wells.", "job2023"),
    ],
    "south": [
        ("Well characteristics", "Most irrigation wells in the Douglas basin are less than 200 ft deep and usually yield less than 400 gal/min. The average specific capacity is about 12 gal/min per ft of drawdown. Some parts of the basin are artesian, but all irrigation wells must be pumped.", "coates1955"),
        ("Pumping and decline", "Ground water has been pumped for irrigation since 1910. The Elfrida area was the most heavily pumped part, with a decline of more than 11 ft in 1947-51.", "coates1955"),
        ("Regulatory history", "In 1965 much of the basin was declared a Critical Groundwater area, and new irrigation wells were prohibited except as replacements. It became the Douglas Irrigated Non-Expansion Area under the 1980 Groundwater Management Act, so only land irrigated in 1975-80 may be irrigated with groundwater.", "konieczki2006"),
        ("Confining layers", "There are no large-scale confining (clay) layers in the Douglas Basin, only local areas of confined or perched water. Where fine-grained layers are spread through many lenses, compaction depends on their aggregate thickness.", "konieczki2006"),
    ],
    "east": [
        ("Hydrologic system", "A blue clay unit confines the lower aquifer, which is under artesian pressure. The upper aquifer and the marginal zone, where the two join, behave as water-table aquifers.", "white1965"),
        ("Aquifer properties", "The lower aquifer has a transmissibility of about 20,000 gal/d per ft. Analysis of withdrawals gave a storage coefficient of about 0.1, typical of a water-table aquifer, and about 10 million acre-ft of water available from the lower aquifer (counting only water released by lowering the artesian head to the base of the confining layer).", "white1965"),
        ("Model prediction", "An electrical-analog model of the basin predicted declines from 1960 to 1980 of as much as 120 ft at Bowie and 160 ft at San Simon. The result depends directly on how closely future pumpage matched the hypothesized amounts and distribution.", "white1965"),
        ("National assessment", "Subsidence-related earth fissures near Bowie are among the well-known Arizona occurrences listed in the USGS national assessment; by 1980 water levels in the listed Arizona subsidence areas had fallen at least 100 ft, and 300 to 500 ft in most.", "galloway1999"),
        ("Caveat", "The sources for this area date from 1965, and our radar covers it from one look direction only. No measurement of compaction in the blue clay is cited here.", "white1965"),
    ],
}
RECOVERY_PLAIN = {
    "eloy": "Largely no. Water levels rose by up to 150 feet, yet some ground kept sinking.",
    "willcox": "Not so far. Wetter years helped only briefly, and the sinking continued.",
    "north_willcox": "Not studied here. The same clay lies below and the water is still falling, so the sinking is probably permanent.",
    "south": "Unclear. Clay is mixed in rather than in one layer, so we cannot tell how much would bounce back.",
    "east": "Not studied here. A clay layer lies below and the water is still falling, so the sinking is probably permanent.",
}

ts = {s: json.load(open(f"{P}/timeseries_{s}.json")) for s in AREAS}
boxes = {}
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import export_web
for h in export_web.HOTSPOTS:
    boxes[h["id"]] = h["bbox"]
gw = json.load(open(f"{P}/groundwater_vs_sinking.json"))["wells"]
SHORT = {"brown1969": "Brown and Schumann, 1969", "konieczki2006": "Konieczki, 2006", "galloway1999": "Galloway and others, 1999", "pool2001": "Pool and others, 2001",
         "epstein1987": "Epstein, 1987", "coates1955": "Coates and Cushman, 1955", "white1965": "White and Hardt, 1965", "smilovsky2025": "Smilovsky, 2025", "job2023": "Job and others, 2023", "peng2022": "Peng and others, 2022 (abstract)", "adwr_ama": "ADWR, Willcox AMA",
         "azgs_fissures": "AZGS fissure maps, 2016"}
fis = json.load(open(f"{P}/fissures_summary.json"))["areas"]   # from src/fissures_azgs.py
out = {"note": "Subsurface geology per study area from primary USGS and Arizona sources; layer diagrams are schematic, not to scale.", "sources": {k: dict(label=v[0], url=v[1], short=SHORT[k]) for k, v in S.items()}, "areas": {}}
for slug, a in AREAS.items():
    w, s, e, n = boxes[slug]
    inside = [x for x in gw if w <= x["lon"] <= e and s <= x["lat"] <= n]
    measured = dict(rate_cm_yr=ts[slug]["rate_cm_yr"], wells=len(inside),
                    decline_ft_yr=round(float(np.median([x["decline_ft_yr"] for x in inside])), 2) if len(inside) >= 5 else None)
    status, text, rsrc = RECOVERY[slug]
    f = fis[slug]
    used = sorted({src for _, src in a["facts"]} | {src for _, src in PLAIN[slug]["facts"]} | {src for _, _, src in DETAIL[slug]} | {rsrc, "azgs_fissures"})
    out["areas"][slug] = dict(basin=a["basin"], summary=a["summary"],
                              layers=[dict(name=l[0], kind=l[1], note=l[2], compacts=l[3]) for l in a["layers"]],
                              facts=[dict(text=t, source=src) for t, src in a["facts"]], measured=measured, sources=used, caveat=a["caveat"],
                              recovery=dict(status=status, text=text, plain=RECOVERY_PLAIN[slug], source=rsrc),
                              plain=dict(summary=PLAIN[slug]["summary"], layer_notes=PLAIN[slug]["layers"], facts=[dict(text=t, source=src) for t, src in PLAIN[slug]["facts"]]),
                              detail=[dict(label=l, text=t, source=src) for l, t, src in DETAIL[slug]],
                              fissures=dict(km_confirmed=f["km_confirmed"], km_reported=f["km_reported"], azgs_study_areas=f["azgs_study_areas"], source="azgs_fissures"))
    print(f"{slug:14s} wells inside: {len(inside):3d} | decline {measured['decline_ft_yr']} ft/yr | rate {measured['rate_cm_yr']} cm/yr | sources {used}")
json.dump(out, open(f"{P}/geology.json", "w"), indent=1)
print("saved data/processed/geology.json")
