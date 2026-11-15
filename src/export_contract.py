"""Write the data contract the Field-atlas UI reads (AGENTS.md section 13) into data/processed/, from the same cubes as the map.
Files: hotspots.geojson, timeseries_<slug>.json, rate_<slug>.png/.json  (+ extra region layers, see docs/UI_DATA_CONTRACT.md).
Values: LOS cm and cm/yr, negative = sinking (ground moving away from the satellite). Unknown = null, never 0.
Usage: python export_contract.py   (run export_web.py first is not required; this script loads the cubes itself)"""
import json, os, numpy as np
from PIL import Image
import export_web as ew
import insights
ADWRJ = json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data/processed/adwr_validation.json"))) if os.path.exists(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data/processed/adwr_validation.json")) else {}

ROOT = ew.ROOT; OUT = f"{ROOT}/data/processed"
TAG = {  # tagline, county (all text is plain, factual, and matches docs/UI_DATA_CONTRACT.md)
    "eloy": ("The long sink", "Pinal"), "willcox": ("The largest sink", "Cochise"), "north_willcox": ("The fastest patch", "Graham"),
    "south": ("The southern sink", "Cochise"), "east": ("Unconfirmed: one look direction", "Cochise")}
FARM = {"eloy": "yes", "willcox": "yes", "north_willcox": "unchecked", "south": "yes", "east": "little"}   # from the OpenStreetMap land-use check (docs/STATUS.md)
SIGN_S1 = "Positive values mean the ground moved toward the satellite; negative values mean it moved away (sinking). Measured along the satellite's slanted view, not straight down. (OPERA product convention.)"
SIGN_NISAR = "NISAR sign convention not yet verified against the product specification; read with care."
REL_NISAR = "NASA NISAR L2 GUNW, Provisional release (production CRID P05023)"
REL_NISAR_W = "NASA NISAR L2 GUNW, Provisional release (CRID P05023); the first pair, Oct 26 to Nov 7 2025, is Beta"
rel_s1 = lambda a, b: f"OPERA L3 DISP-S1 v1.0 (Sentinel-1), records {a} to {b}"
REF_TEXT = {"central": "median ground of the whole Sentinel-1 frame 7091 (descending, track 27); not a hand-picked site",
            "southeast": "median ground of the whole Sentinel-1 frame 34478 (descending, track 129); not a hand-picked site"}
TRACK = {"central": "Sentinel-1 track 27 descending, frame 7091", "southeast": "Sentinel-1 track 129 descending, frame 34478"}
CAVEATS = ["Line-of-sight motion, not purely vertical.", "Referenced to the median ground of the whole satellite frame; a few mm/yr of bias is possible.",
           "Troposphere (water vapour) is not corrected; solid-earth tide and ionosphere are.",
           "Uncertainty combines the straight-line fit error with the disagreement between descending and ascending satellite tracks; reference-site bias is not separately included.",
           "Sinking does not by itself show who or what caused it."]

def crop_png(frame_names, bbox, slug):
    """Sentinel-1 rate over the hotspot's study box on a lat/lon grid -> PNG (RGBA)."""
    w, s, e, n = bbox; lons = np.arange(w, e, ew.RES) + ew.RES / 2; lats = np.arange(n, s, -ew.RES) - ew.RES / 2
    LO, LA = np.meshgrid(lons, lats); rate = np.full(LO.shape, np.nan, "float32")
    for fr in frame_names:
        v = ew.sample(fr, LO, LA); fill = np.isnan(rate) & np.isfinite(v); rate[fill] = v[fill]
    Image.fromarray(ew.ramp(rate), "RGBA").save(f"{OUT}/rate_{slug}.png", optimize=True)
    return float(np.isfinite(rate).mean() * 100)

CUM_VMIN, CUM_VMAX = -60, 10     # cm; one scale for every study so areas can be compared
CUM_STOPS = [(-60, (103, 0, 13, 235)), (-30, (203, 24, 29, 225)), (-15, (252, 146, 114, 205)), (-5, (254, 224, 210, 110)),
             (0, (255, 255, 255, 0)), (5, (158, 202, 225, 90)), (10, (66, 146, 198, 170))]

def ramp_cum(cm):
    """Total change since the first date (cm) -> RGBA. Sinking (negative) red, unchanged transparent, rising light blue."""
    xs = [q[0] for q in CUM_STOPS]; out = np.zeros(cm.shape + (4,), "uint8"); r = np.clip(np.nan_to_num(cm, nan=0), xs[0], xs[-1])
    for c in range(4): out[..., c] = np.interp(r, xs, [q[1][c] for q in CUM_STOPS]).astype("uint8")
    out[~np.isfinite(cm), 3] = 0; return out

def export_cumulative(h, D, slug, st):
    """One map picture per satellite date (total change since the first date), plus pictures of the pixels behind each chart line.
    Pixels shown are those measured at every date (same rule as the rate map), so the pictures and the chart use identical data."""
    w, s_, e, n = h["bbox"]; lons = np.arange(w, e, ew.RES) + ew.RES / 2; lats = np.arange(n, s_, -ew.RES) - ew.RES / 2
    LO, LA = np.meshgrid(lons, lats); lo, la = ew.lonlat_grid(D)
    inbox = (lo >= w) & (lo <= e) & (la >= s_) & (la <= n) & D["ok"]
    sink = inbox & (D["rate"] <= ew.THR); stable = inbox & (np.abs(D["rate"]) <= 0.15)
    os.makedirs(f"{OUT}/cumulative", exist_ok=True); frames = []
    for t in range(D["cum"].shape[0]):
        v = ew.sample(dict(D, rate=np.where(D["ok"], D["cum"][t] / 10.0, np.nan)), LO, LA)
        name = f"cumulative/cum_{slug}_{t:02d}.png"
        Image.fromarray(ramp_cum(v), "RGBA").quantize(colors=48, method=Image.Quantize.FASTOCTREE).save(f"{OUT}/{name}", optimize=True); frames.append(name)
    masks = {}
    for kind, m, rgba in (("sinking", sink, (166, 75, 42, 150)), ("stable", stable, (98, 109, 118, 150))):
        v = ew.sample(dict(D, rate=np.where(m, 1.0, 0.0).astype("float32")), LO, LA); a = np.zeros(v.shape + (4,), "uint8"); a[np.nan_to_num(v) > 0.5] = rgba
        name = f"cumulative/mask_{kind}_{slug}.png"; Image.fromarray(a, "RGBA").quantize(colors=4, method=Image.Quantize.FASTOCTREE).save(f"{OUT}/{name}", optimize=True); masks[kind] = name
    # the chart line must equal the average of the pixels the map shows: prove it
    chart = [np.nanmean(D["cum"][t][sink]) / 10.0 for t in range(D["cum"].shape[0])]
    drift = max(abs(a - b) for a, b in zip(chart, [round(v / 10, 2) for v in st["series_mm"]]))
    assert drift < 0.011, f"{slug}: map frames and chart disagree by {drift} cm"
    json.dump({"hotspot": slug, "units": "cm", "bounds": [[s_, w], [n, e]], "vmin": CUM_VMIN, "vmax": CUM_VMAX, "crs": "EPSG:4326",
               "colormap": "custom: red = ground lower than at the first date, transparent = unchanged, blue = higher",
               "dates": st["dates"], "frames": frames, "masks": masks, "reference": REF_TEXT[h["D"]],
               "note": "Each picture is the total change since the first date, only where the radar measured at every date. Blank means not measured, not zero."},
              open(f"{OUT}/cumulative_{slug}.json", "w"), indent=1)
    return len(frames), drift

def main():
    cache = {n: ew.load(n) for n in ["central", "southeast", "f5125"]}; cache = {k: v for k, v in cache.items() if v is not None}
    feats = []; report = []
    # Uncertainty: straight-line fit error alone (0.07 to 0.15 cm/yr) ignores the biggest disagreement we measured, descending vs ascending medians.
    # systematic term s = half the descending-ascending median difference where an ascending check exists; otherwise the largest s among the others (conservative proxy).
    pre = {}
    for h in ew.HOTSPOTS:
        st0 = ew.hotspot_stats(h, cache) if h["D"] in cache else None
        if st0 is not None: pre[h["id"]] = st0
    sda = {k: abs(v["median_rate"] - v["ascending"]["median_rate"]) / 2 for k, v in pre.items() if v.get("ascending")}   # cross-direction term (areas with an ascending check)
    # measured reference offset: our median minus ADWR's own Sentinel-1 median over the same pixels (reference choice differs)
    adw = ADWRJ.get("hotspots", {})
    sadwr = {k: abs(v["diff_s1"]) for k, v in adw.items() if "diff_s1" in v}
    s_proxy = max(sda.values()) if sda else 0.0     # conservative stand-in for areas with no ascending check
    for h in ew.HOTSPOTS:
        st = ew.hotspot_stats(h, cache) if h["D"] in cache else None
        if st is None: print("skip", h["id"]); continue
        slug = h["id"]; tagline, county = TAG[slug]; w, s, e, n = h["bbox"]
        both = bool(st.get("ascending")) and st["ascending"]["median_rate"] <= ew.THR
        status = "both look directions" if both else ("single look direction" if not st.get("ascending") else "weak in second direction")
        feats.append({"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [[[w, s], [e, s], [e, n], [w, n], [w, s]]]},
                      "properties": {"slug": slug, "name": h["name"], "tagline": tagline, "county": county, "story": h["story"], "confirmation": status,
                                     "land_use_note": h["land"], "source_note": "Sentinel-1 OPERA DISP-S1, 2016 to 2026; outline is the study box, not the sinking area",
                                     "adwr_feature": ", ".join(k for k, v in ADWRJ.get("feature_overlap", {}).get(slug, {}).items() if k != "outside_any_feature" and v >= 50)}})
        sys_term = max(sda.get(h["id"], s_proxy), sadwr.get(h["id"], 0.0))
        D = cache[h["D"]]; stable = st.get("stable_series_mm")
        nis = ew.nisar_block(h["nisar"])
        nisar = None if nis is None else {"track": nis["track"], "dates": nis["dates"], "displacement": [round(v / 10, 2) for v in nis["series_mm"]],
                                          "rate_cm_yr": nis["rate_cm_yr"], "rate_sigma": nis["rate_sigma"], "n_pixels": nis["n_px"], "reliable": False,
                                          "scope": nis["scope"], "status_note": "Provisional NISAR data; short record; rate not yet reliable."}
        ts = {"hotspot": slug, "units": "cm", "reference": REF_TEXT[h["D"]], "track": TRACK[h["D"]],
              "dates": st["dates"], "displacement": [round(v / 10, 2) for v in st["series_mm"]],
              "rate_cm_yr": st["series_rate"], "rate_sigma": round(float(np.hypot(st["series_sigma"], sys_term)), 2), "adwr_rate_cm_yr": adw.get(h["id"], {}).get("adwr_s1_median"), "adwr_rs2_rate_cm_yr": adw.get(h["id"], {}).get("adwr_rs2_median"),
              "adwr_feature": ADWRJ.get("feature_overlap", {}).get(h["id"]), "adwr_comparison": adw.get(h["id"]),
              "adwr_note": "ADWR value is its own published InSAR deformation raster (units inferred as metres) averaged over the same pixels. Sentinel-1 2017-2026 is the same satellite as ours (a consistency check); RADARSAT-2 2010-2026 is an independent sensor over a longer period.",
              "rate_sigma_fit_only": st["series_sigma"], "rate_sigma_systematic": round(float(sys_term), 2),
              "rate_sigma_note": ("Combines the straight-line fit error with the larger of: half the descending-vs-ascending difference, or our difference from ADWR's own Sentinel-1 rate over the same pixels (reference choice)." if h["id"] in sda else
                                  "No ascending check here, so the systematic part is the largest seen at the other study areas (a conservative proxy, not a measurement)."),
              "median_rate_cm_yr": st["median_rate"], "p5_rate_cm_yr": st["p5_rate"], "fastest_rate_cm_yr": st["fastest"], "area_km2": st["area_km2"],
              "sinking_threshold_cm_yr": ew.THR, "ascending_check": st.get("ascending"), "confirmation": status,
              "stable_ground_displacement": None if stable is None else [round(v / 10, 2) for v in stable],
              "nisar": nisar, "caveats": CAVEATS, "source": "Sentinel-1 OPERA DISP-S1 block-final granules, 6-month steps"}
        ts["sign_convention"] = SIGN_S1; ts["data_release"] = rel_s1(st["dates"][0], st["dates"][-1])
        names_in = [k for k, v in ADWRJ.get("feature_overlap", {}).get(slug, {}).items() if k != "outside_any_feature" and v >= 50]
        ts["insights"] = insights.build(ts, FARM[slug], names_in)
        json.dump(ts, open(f"{OUT}/timeseries_{slug}.json", "w"), indent=1)
        pct = crop_png([D], h["bbox"], slug)
        json.dump({"bounds": [[s, w], [n, e]], "units": "cm/yr", "vmin": -6, "vmax": 2, "colormap": "custom: red = sinking (away from satellite), transparent = stable, blue = rising",
                   "track": TRACK[h["D"]], "dates": [st["dates"][0], st["dates"][-1]], "crs": "EPSG:4326", "valid_pct_of_box": round(pct, 1),
                   "sign_convention": SIGN_S1, "data_release": rel_s1(st["dates"][0], st["dates"][-1])}, open(f"{OUT}/rate_{slug}.json", "w"), indent=1)
        nfr, drift = export_cumulative(h, D, slug, st); print(f"  {slug}: {nfr} dated map pictures + 2 masks; chart-vs-map difference {drift:.4f} cm")
        report.append((slug, len(st["dates"]), st["series_rate"], status))
    json.dump({"type": "FeatureCollection", "features": feats}, open(f"{OUT}/hotspots.geojson", "w"), indent=1)
    # extra, region-wide layers: copy the mosaics with UI-friendly metadata
    first = min(f["properties"] for f in feats[:1]) if False else None
    src_dir = f"{ROOT}/data/processed/cache/web"
    d0 = cache["central"]["dates"][0]; d1 = cache["southeast"]["dates"][-1]; iso = lambda d: f"{d[:4]}-{d[4:6]}-{d[6:]}"
    for name, out, trk in [("s1_rate_desc", "rate_sentinel1_descending", "Sentinel-1 descending frames, mosaic"), ("s1_rate_asc", "rate_sentinel1_ascending", "Sentinel-1 ascending frame 5125 (cross-check)"),
                           ("nisar_willcox", "rate_nisar_willcox", "NISAR track 128 descending, rate relative to box median, PRELIMINARY"),
                           ("nisar_eloy", "rate_nisar_eloy", "NISAR track 077 ascending, rate relative to box median, PRELIMINARY (under 4 months)")]:
        if not os.path.exists(f"{src_dir}/{name}.png"): continue
        b = json.load(open(f"{src_dir}/{name}.json")); Image.open(f"{src_dir}/{name}.png").save(f"{OUT}/{out}.png", optimize=True)
        dates = ["2025-10-26", "2026-10-21"] if name == "nisar_willcox" else ["2026-06-19", "2026-10-17"] if name == "nisar_eloy" else [iso(d0), iso(d1)]
        json.dump({"bounds": b["bounds"], "units": "cm/yr", "vmin": -6, "vmax": 2, "colormap": "custom: red = sinking, transparent = stable, blue = rising", "track": trk,
                   "dates": dates, "crs": "EPSG:4326",
                   "sign_convention": SIGN_NISAR if name.startswith("nisar") else SIGN_S1,
                   "data_release": (REL_NISAR_W if name == "nisar_willcox" else REL_NISAR) if name.startswith("nisar") else rel_s1(dates[0], dates[1])}, open(f"{OUT}/{out}.json", "w"), indent=1)
    ex = json.load(open(f"{src_dir}/excluded.json")); fl = json.load(open(f"{src_dir}/flat.json"))
    pt = lambda lon, lat, p: {"type": "Feature", "geometry": {"type": "Point", "coordinates": [lon, lat]}, "properties": p}
    json.dump({"type": "FeatureCollection", "features": [pt(x["lon"], x["lat"], {"name": x["name"], "reason": x["why"], "source": "OpenStreetMap place and land-use lookup"}) for x in ex]},
              open(f"{OUT}/mines_excluded.geojson", "w"), indent=1)
    json.dump({"type": "FeatureCollection", "features": [pt(x["lon"], x["lat"], {"name": x["name"], "median_rate_cm_yr": x["median_rate"], "p5_rate_cm_yr": x["p5_rate"],
              "note": "Median within 3 km, Sentinel-1 2016 to 2026; no sinking found"}) for x in fl]}, open(f"{OUT}/checked_flat.geojson", "w"), indent=1)
    for r in report: print("wrote contract for %-14s dates=%d rate=%.2f cm/yr  %s" % r)

if __name__ == "__main__":
    main()
