"""Groundwater levels vs sinking in the Willcox basin.
Water levels: depth to water below land surface (feet).
  - historic readings: USGS Water Data OGC API, parameter 72019 (includes ADWR measurements, agency AZ014); only readings qualified "Static"
    (resting water level, not while pumping) from 1980 to 2000; the baseline is the median of a well's readings in its earliest 5-year window;
  - recent reading: ADWR Groundwater Site Inventory (GWSI) Well Sites service, the well's LAST water level (WL_DTW, LASTWLDATE), 2015 or later.
  Wells are matched by their 15-digit site ID. Decline rate = (recent depth - baseline depth) / years; positive = the water table has dropped.
Sinking: Sentinel-1 OPERA DISP-S1 rate 2016-2026 (cm/yr, LOS, negative = sinking), 300 m map, median within 600 m of the well.
Caveats built in: the two ends come from different programs; ADWR's single latest reading carries no pumping/static flag here; wells differ in depth
and aquifer; the water-level span (about 30 years) is longer than the radar's 10 years. Association only.
Output: data/processed/groundwater_vs_sinking.json, docs/groundwater_vs_sinking_willcox.png.   Usage: python groundwater_vs_sinking.py"""
import json, os, datetime as dt, numpy as np
from scipy.stats import rankdata
from pyproj import Transformer
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = f"{ROOT}/data/processed"
G = f"{ROOT}/data/raw/groundwater"
rng = np.random.default_rng(21)
usgs = json.load(open(f"{G}/willcox_72019.json", encoding="utf-8"))["features"]
adwr = json.load(open(f"{G}/adwr_gwsi_sites.json", encoding="utf-8"))["rows"]
D = lambda ms: (dt.datetime(1970, 1, 1) + dt.timedelta(milliseconds=ms)).date()

hist = {}
for f in usgs:
    p = f["properties"]
    q = p.get("qualifier") or []
    if "Static" not in q or p["value"] in (None, ""):
        continue
    t = dt.date.fromisoformat(p["time"][:10])
    if t.year < 1980 or t.year > 2000:
        continue
    sid = p["monitoring_location_id"].split("-", 1)[1]
    hist.setdefault(sid, dict(lonlat=f["geometry"]["coordinates"], obs=[]))["obs"].append((t, float(p["value"])))

wells = []
for r in adwr:
    sid = str(r["SITE_ID"])
    if sid not in hist or r.get("WL_DTW") is None or not r.get("LASTWLDATE"):
        continue
    t1 = D(r["LASTWLDATE"])
    if t1.year < 2015 or r["WL_DTW"] <= 0:
        continue
    obs = sorted(hist[sid]["obs"])
    t0first = obs[0][0]
    early = [v for t, v in obs if (t - t0first).days <= 5 * 365]
    tmid = obs[0][0] + (obs[len(early) - 1][0] - obs[0][0]) / 2
    base = float(np.median(early))
    years = (t1 - tmid).days / 365.25
    if years < 15:
        continue
    wells.append(dict(site=sid, lon=r["DD_LONG"], lat=r["DD_LAT"], depth_ft=r.get("WELL_DEPTH"), base_year=tmid.year, recent_date=t1.isoformat(),
                      base_dtw=base, recent_dtw=float(r["WL_DTW"]), years=round(years, 1), decline_ft_yr=(float(r["WL_DTW"]) - base) / years))
print("wells with a 1980-2000 static baseline and a 2015+ ADWR reading, >= 15 years apart:", len(wells))
dec = np.array([w["decline_ft_yr"] for w in wells])
drop = np.array([w["recent_dtw"] - w["base_dtw"] for w in wells])
print(f"water-table change: median {np.median(dec):.2f} ft/yr (positive = deeper); median total {np.median(drop):.0f} ft over a median {np.median([w['years'] for w in wells]):.0f} years; "
      f"{(dec > 0).mean()*100:.0f}% of wells got deeper")

# sinking rate near each well
cube = np.load(f"{P}/cache/scan_southeast.npz")
sx, sy, srate = cube["x"], cube["y"], cube["rate"]
tr = Transformer.from_crs(4326, 32612, always_xy=True)
SX, SY = np.meshgrid(sx, sy)
for w in wells:
    x, y = tr.transform(w["lon"], w["lat"])
    m = (np.hypot(SX - x, SY - y) <= 600) & np.isfinite(srate)
    w["rate"] = float(np.median(srate[m])) if m.sum() >= 3 else np.nan
    w["x"], w["y"] = x, y
ok = [w for w in wells if np.isfinite(w["rate"])]
print("wells with a Sentinel-1 rate nearby:", len(ok))
dec = np.array([w["decline_ft_yr"] for w in ok])
rt = np.array([w["rate"] for w in ok])
wx = np.array([w["x"] for w in ok]); wy = np.array([w["y"] for w in ok])


def spearman(a, b):
    return float(np.corrcoef(rankdata(a), rankdata(b))[0, 1])


tid = (np.floor(wx / 5000) * 10000 + np.floor(wy / 5000)).astype(int)
tiles = np.unique(tid)
groups = {t: np.flatnonzero(tid == t) for t in tiles}
boot = []
for _ in range(2000):
    idx = np.concatenate([groups[t] for t in rng.choice(tiles, len(tiles))])
    boot.append(spearman(dec[idx], rt[idx]))
rho = spearman(dec, rt)
ci = [round(float(np.percentile(boot, 2.5)), 2), round(float(np.percentile(boot, 97.5)), 2)]
print(f"Spearman(water-table decline, sinking rate) = {rho:.2f} (95% {ci}, {len(tiles)} 5-km tiles); expected negative if deeper water goes with faster sinking")
qs = np.quantile(dec, [0, .25, .5, .75, 1])
bins = []
for k in range(4):
    m = (dec >= qs[k]) & (dec <= qs[k + 1] if k == 3 else dec < qs[k + 1])
    bins.append(dict(decline_range_ft_yr=[round(float(qs[k]), 2), round(float(qs[k + 1]), 2)], n=int(m.sum()), median_rate=round(float(np.median(rt[m])), 2),
                     share_sinking=round(float((rt[m] <= -1).mean()), 2)))
print("by decline quartile:", [(b["decline_range_ft_yr"], b["n"], b["median_rate"], b["share_sinking"]) for b in bins])
# compaction per metre of head decline in the sinking area (a rough aquifer-system indicator)
sink = rt <= -1
ratio = None
if sink.sum() >= 10 and (dec[sink] > 0.2).sum() >= 10:
    sel = sink & (dec > 0.2)
    ratio = float(np.median(-rt[sel] / (dec[sel] * 0.3048 * 100)))      # cm/yr of sinking per cm/yr of water-table decline
    print(f"in sinking areas: median sinking is {ratio*100:.1f}% of the water-table decline rate (both in cm/yr), from {int(sel.sum())} wells")
out = dict(n_wells=len(ok), median_decline_ft_yr=round(float(np.median(dec)), 2), median_total_drop_ft=round(float(np.median([w['recent_dtw'] - w['base_dtw'] for w in ok])), 1),
           median_years=round(float(np.median([w['years'] for w in ok])), 1), share_deeper=round(float((dec > 0).mean()), 2),
           spearman=round(rho, 3), ci95=ci, tiles=int(len(tiles)), bins=bins, sinking_to_decline_ratio=None if ratio is None else round(ratio, 3),
           baseline_years=[int(min(w["base_year"] for w in ok)), int(max(w["base_year"] for w in ok))], recent_years=[min(w["recent_date"][:4] for w in ok), max(w["recent_date"][:4] for w in ok)],
           sources=["USGS Water Data OGC API field-measurements, parameter 72019 (incl. ADWR AZ014), static readings 1980-2000",
                    "ADWR Groundwater Site Inventory Well Sites service, last water level 2015 or later"],
           wells=[{k: (round(v, 3) if isinstance(v, float) else v) for k, v in w.items() if k not in ("x", "y")} for w in ok])
json.dump(out, open(f"{P}/groundwater_vs_sinking.json", "w"), indent=1)

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
fig, ax = plt.subplots(1, 2, figsize=(11, 4.2))
ax[0].scatter(dec, rt, s=12, alpha=.6, color="#a64b2a")
ax[0].axhline(0, color="#999", lw=.8); ax[0].axvline(0, color="#999", lw=.8)
ax[0].set_xlabel("Water-table decline (ft/yr, positive = deeper)"); ax[0].set_ylabel("Sentinel-1 rate near the well (cm/yr)")
ax[0].set_title(f"{len(ok)} wells: rank correlation {rho:.2f} (95% {ci[0]} to {ci[1]})")
ax[1].bar([f"{b['decline_range_ft_yr'][0]:.1f} to {b['decline_range_ft_yr'][1]:.1f}\n(n={b['n']})" for b in bins], [b["median_rate"] for b in bins], color=["#8a9a84", "#d9a58c", "#c77d5e", "#a64b2a"])
ax[1].axhline(0, color="#666", lw=.8); ax[1].set_xlabel("Water-table decline (ft/yr)"); ax[1].set_ylabel("Median sinking rate (cm/yr)")
ax[1].set_title("Faster-falling water, faster-sinking ground?")
fig.tight_layout(); fig.savefig(f"{ROOT}/docs/groundwater_vs_sinking_willcox.png", dpi=130)
print("saved")
