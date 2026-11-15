"""NISAR L-band backscatter (HH, HV) over farmland vs desert at Willcox, tied to the Sentinel-1 sinking map.
Inputs: data/processed/cache/gcov/*.npz (gcov_extract.py, 80 m cells, linear gamma0 power),
        USDA NASS Cropland Data Layer 2025, 30 m (extracted GeoTIFF, EPSG:5070),
        data/processed/cache/scan_southeast.npz (Sentinel-1 rate, 300 m).
Questions, each ending in a measured number:
  1. How much of the Willcox box, and of the sinking zone, is irrigated cropland (acres, enrichment)?
  2. Do cropland and desert behave differently in L-band over a year, and in which polarization (HH or HV)?
  3. Do cropland cells sink faster than desert cells (Sentinel-1 rate), with an uncertainty that respects spatial correlation?
Cropland-vs-desert labels come from the CDL, NOT from the radar, so nothing here is circular.
Caveat built in: CDL 2025 describes the 2025 growing season; the radar year runs Oct 2025 to Nov 2026.
Output: data/processed/gcov_farmland.json, docs/gcov_farmland_willcox.png.   Usage: python gcov_farmland.py"""
import glob, json, os, datetime as dt, numpy as np
import rasterio
from rasterio.windows import from_bounds
from pyproj import Transformer
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = f"{ROOT}/data/processed"
TIF = f"{ROOT}/data/raw/cdl/extracted/2025_30m_cdls.tif"      # extracted from the NASS zip (data/raw is gitignored)
SINK = -1.0     # cm/yr threshold used for "sinking" everywhere on the site

# ---- CDL codes (legend: USDA NASS 2025 CDL metadata, checked Nov 15 2026)
CROP = set(range(1, 61)) | set(range(66, 78)) | set(range(204, 255))   # crops 1-60, tree crops 66-77, additional crops 204-254 (USDA legend)
FALLOW = {61}
GRASS = {62, 176}
SHRUB = {64, 152}
BARREN = {65, 131}
DEV = {82, 121, 122, 123, 124}
WATER = {83, 111}
GROUPS = {"cropland": CROP, "fallow": FALLOW, "grass_pasture": GRASS, "shrubland": SHRUB, "barren": BARREN, "developed": DEV, "water": WATER}
NAMES = {1: "corn", 2: "cotton", 4: "sorghum", 21: "barley", 24: "winter wheat", 36: "alfalfa", 37: "other hay", 43: "potatoes", 54: "tomatoes", 69: "grapes", 74: "pecans",
         75: "almonds", 76: "walnuts", 204: "pistachios", 227: "lettuce", 71: "other tree crops", 44: "other crops", 47: "misc vegs and fruits", 12: "sweet corn", 5: "soybeans",
         23: "spring wheat", 28: "oats", 53: "peas", 42: "dry beans", 48: "watermelons", 49: "onions", 216: "peppers", 57: "herbs", 58: "clover/wildflowers", 205: "triticale", 225: "double crop winter wheat/corn", 228: "double crop triticale/corn"}

# ---- radar cube
files = sorted(glob.glob(f"{P}/cache/gcov/*.npz"))
z0 = np.load(files[0])
x0, y1, nx, ny, epsg = float(z0["x0"]), float(z0["y1"]), int(z0["nx"]), int(z0["ny"]), int(z0["epsg"])
dates = [os.path.basename(f)[:8] for f in files]
HH = np.stack([np.load(f)["hh"] for f in files]); HV = np.stack([np.load(f)["hv"] for f in files])
rain = json.load(open(f"{P}/cache/rain_vs_backscatter.json"))     # ERA5 rain before each overpass (Open-Meteo), src: see docs/fact_check.md
assert rain["dates"] == dates, "rain file does not match the extracted dates"
DRY = np.array(rain["rain_3d"]) < 1.0     # dry date: under 1 mm in the 3 days before the overpass
db = lambda a: 10 * np.log10(a)
print(len(dates), "dates", dates[0], "to", dates[-1], "| grid", ny, "x", nx, "| linear HH range", float(np.nanmin(HH)), float(np.nanmax(HH)))
xs = x0 + 80 * (np.arange(nx) + .5)
ys = y1 - 80 * (np.arange(ny) + .5)
XX, YY = np.meshgrid(xs, ys)

# ---- CDL fractions per 80 m cell: sample the 30 m raster at 8 x 8 points per cell
with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"):
    ds = rasterio.open(TIF)
    print("CDL", os.path.basename(TIF), ds.crs.to_string()[:60], ds.res)
    tr = Transformer.from_crs(epsg, ds.crs, always_xy=True)
    cx, cy = tr.transform(XX, YY)
    pad = 400
    win = from_bounds(cx.min() - pad, cy.min() - pad, cx.max() + pad, cy.max() + pad, ds.transform).round_offsets().round_lengths()
    cdl = ds.read(1, window=win)
    wt = ds.window_transform(win)
code = np.zeros((ny, nx, 64), "uint8")      # sub-sample codes
sub = (np.arange(8) + .5) * 10 - 40
codes = np.zeros((ny, nx, 64), "uint8")
k = 0
for dy in sub:
    for dx in sub:
        px, py = tr.transform(XX + dx, YY + dy)
        col = ((px - wt.c) / wt.a).astype(int)
        row = ((py - wt.f) / wt.e).astype(int)
        codes[..., k] = cdl[np.clip(row, 0, cdl.shape[0] - 1), np.clip(col, 0, cdl.shape[1] - 1)]
        k += 1
frac = {g: np.isin(codes, list(s)).mean(-1) for g, s in GROUPS.items()}
PURE = 0.9
pure = {g: frac[g] >= PURE for g in GROUPS}
cell_acres = 80 * 80 / 4046.856
print("pure cells (>= 90% one class group):", {g: int(v.sum()) for g, v in pure.items()})

# ---- Sentinel-1 rate at each cell (300 m cube, nearest)
cube = np.load(f"{P}/cache/scan_southeast.npz")
sx, sy, srate = cube["x"], cube["y"], cube["rate"]
ix = np.round((XX - sx[0]) / (sx[1] - sx[0])).astype(int)
iy = np.round((sy[0] - YY) / (sy[0] - sy[1])).astype(int)
ins = (ix >= 0) & (ix < len(sx)) & (iy >= 0) & (iy < len(sy))
rate = np.full(XX.shape, np.nan, "float32")
rate[ins] = srate[iy[ins], ix[ins]]
good = np.isfinite(rate) & np.isfinite(HH).all(0)
sinking = good & (rate <= SINK)
out = dict(n_dates=len(dates), dates=[f"{d[:4]}-{d[4:6]}-{d[6:]}" for d in dates], cdl="USDA NASS Cropland Data Layer 2025 (30 m), released 2026-02-27", pure_threshold=PURE)

# ---- Q1: composition, acres, enrichment
tot = good.sum()
comp = {}
for g in GROUPS:
    f_all = frac[g][good].sum() * cell_acres
    f_sink = frac[g][sinking].sum() * cell_acres if sinking.any() else 0
    comp[g] = dict(acres_box=round(float(f_all)), acres_sinking=round(float(f_sink)), share_box=round(float(frac[g][good].mean()), 4),
                   share_sinking=round(float(frac[g][sinking].mean()), 4) if sinking.any() else None)
out["composition"] = comp
out["sinking_cells"] = int(sinking.sum()); out["sinking_area_km2"] = round(float(sinking.sum() * 0.0064), 1); out["box_area_km2"] = round(float(tot * 0.0064), 1)
c = comp["cropland"]
out["cropland_enrichment"] = round(c["share_sinking"] / max(c["share_box"], 1e-9), 2) if c["share_sinking"] is not None else None
print("box km2", out["box_area_km2"], "| sinking km2", out["sinking_area_km2"])
for g, v in comp.items():
    print(f"  {g:14s} box {v['acres_box']:>9,} acres ({v['share_box']*100:5.1f}%) | in sinking zone {v['acres_sinking']:>8,} acres ({(v['share_sinking'] or 0)*100:5.1f}%)")
print("cropland enrichment inside the sinking zone (share there / share in the box):", out["cropland_enrichment"])
# top crops
cnt = np.bincount(codes[good].ravel(), minlength=256)
top = sorted(((int(i), int(c_)) for i, c_ in enumerate(cnt) if c_ and i in CROP), key=lambda t: -t[1])[:8]
out["top_crops_box"] = [dict(code=i, name=NAMES.get(i, f"CDL {i}"), acres=round(c_ / 64 * cell_acres)) for i, c_ in top]
print("top crop classes in the box:", [(t["name"], t["acres"]) for t in out["top_crops_box"]])

# ---- Q2: time series and polarization separability
HHd, HVd = db(HH), db(HV)
series = {}
for g in ("cropland", "fallow", "shrubland", "barren"):
    m = pure[g] & good
    if m.sum() < 30:
        continue
    series[g] = dict(n=int(m.sum()), hh=[round(float(np.nanmedian(HHd[i][m])), 2) for i in range(len(dates))], hv=[round(float(np.nanmedian(HVd[i][m])), 2) for i in range(len(dates))])
out["series_db"] = series
if "cropland" in series and "shrubland" in series:
    out["diff_crop_minus_shrub_db"] = dict(hh=[round(a - b, 2) for a, b in zip(series["cropland"]["hh"], series["shrubland"]["hh"])],
                                           hv=[round(a - b, 2) for a, b in zip(series["cropland"]["hv"], series["shrubland"]["hv"])])
out["rain"] = dict(dry_dates=int(DRY.sum()), all_dates=len(dates), spearman_3d_hh=rain["spearman_3d_hh"], spearman_3d_hv=rain["spearman_3d_hv"], perm_p=rain["perm_p_3d_hh"], source=rain["source"])
for g, s in series.items():
    print(f"  {g:10s} n={s['n']:6d} HH {min(s['hh']):6.1f}..{max(s['hh']):6.1f} dB (range {max(s['hh'])-min(s['hh']):4.1f}) | HV {min(s['hv']):6.1f}..{max(s['hv']):6.1f} dB (range {max(s['hv'])-min(s['hv']):4.1f})")


def auc(a, b):
    """P(a > b) for random pairs, Mann-Whitney (ties half)."""
    a, b = a[np.isfinite(a)], b[np.isfinite(b)]
    r = np.argsort(np.argsort(np.concatenate([a, b]))) + 1
    return float((r[:len(a)].sum() - len(a) * (len(a) + 1) / 2) / (len(a) * len(b)))


crop, des = pure["cropland"] & good, pure["shrubland"] & good
feats = {"mean HH (dB)": np.nanmean(HHd, 0), "mean HV (dB)": np.nanmean(HVd, 0), "mean HV-HH (dB)": np.nanmean(HVd - HHd, 0),
         "yearly spread HH (dB std)": np.nanstd(HHd, 0), "yearly spread HV (dB std)": np.nanstd(HVd, 0)}
rng = np.random.default_rng(3)
ci = np.flatnonzero(crop.ravel()); di = np.flatnonzero(des.ravel())
n_use = min(len(ci), len(di), 20000)
cs, dsmp = rng.choice(ci, n_use, replace=False), rng.choice(di, n_use, replace=False)
sep = {}
for name, f in feats.items():
    a = auc(f.ravel()[cs], f.ravel()[dsmp])
    sep[name] = round(max(a, 1 - a), 3)          # 0.5 = no separation, 1 = perfect, direction ignored
out["separability_auc_cropland_vs_shrubland"] = sep
feats_dry = {"mean HH (dB)": np.nanmean(HHd[DRY], 0), "mean HV (dB)": np.nanmean(HVd[DRY], 0), "mean HV-HH (dB)": np.nanmean((HVd - HHd)[DRY], 0),
             "yearly spread HH (dB std)": np.nanstd(HHd[DRY], 0), "yearly spread HV (dB std)": np.nanstd(HVd[DRY], 0)}
sep_dry = {}
for name, f in feats_dry.items():
    a = auc(f.ravel()[cs], f.ravel()[dsmp]); sep_dry[name] = round(max(a, 1 - a), 3)
out["separability_auc_dry_dates_only"] = sep_dry
print("AUC, dry dates only:", sep_dry)
out["separability_cells_each"] = int(n_use)
print("AUC cropland vs shrubland (0.5 none, 1 perfect):", sep)

# ---- Q3: do cropland cells sink faster than desert? Sentinel-1 rate by class, block bootstrap (2 km tiles)
m_c, m_d = crop & np.isfinite(rate), des & np.isfinite(rate)
tile = (np.arange(ny)[:, None] // 25) * 1000 + (np.arange(nx)[None, :] // 25)      # 25 cells of 80 m = 2 km tiles
tc, td = np.unique(tile[m_c]), np.unique(tile[m_d])
diffs = []
bycell_c, bycell_d = {}, {}
for t in tc:
    bycell_c[t] = rate[m_c & (tile == t)]
for t in td:
    bycell_d[t] = rate[m_d & (tile == t)]
for _ in range(1500):
    vc = np.concatenate([bycell_c[t] for t in rng.choice(tc, len(tc))]); vd = np.concatenate([bycell_d[t] for t in rng.choice(td, len(td))])
    diffs.append(np.median(vc) - np.median(vd))
mc, md = float(np.median(rate[m_c])), float(np.median(rate[m_d]))
out["rate_by_class"] = dict(cropland_median_cm_yr=round(mc, 2), shrubland_median_cm_yr=round(md, 2), diff_cm_yr=round(mc - md, 2),
                            diff_ci95=[round(float(np.percentile(diffs, 2.5)), 2), round(float(np.percentile(diffs, 97.5)), 2)],
                            n_cropland=int(m_c.sum()), n_shrubland=int(m_d.sum()), tiles_cropland=int(len(tc)), tiles_shrubland=int(len(td)))
sink_share_c = float((rate[m_c] <= SINK).mean()); sink_share_d = float((rate[m_d] <= SINK).mean())
out["rate_by_class"].update(share_sinking_cropland=round(sink_share_c, 3), share_sinking_shrubland=round(sink_share_d, 3))
print("Sentinel-1 rate: cropland median", round(mc, 2), "| shrubland median", round(md, 2), "| difference", round(mc - md, 2), "cm/yr, 95% CI", out["rate_by_class"]["diff_ci95"],
      "| share of cells sinking <= -1 cm/yr: cropland", round(sink_share_c, 3), "shrubland", round(sink_share_d, 3))

# ---- Q3b: active vs idle cropland (radar, no CDL needed): is the yearly HV spread larger on fields that are being farmed?
spread = feats["yearly spread HV (dB std)"]
thr = np.nanpercentile(spread[des & good], 90)        # a spread larger than 90% of desert cells (weather alone) counts as 'changing'
act = crop & (spread > thr); idle = crop & (spread <= thr)
out["active_vs_idle"] = dict(threshold_db=round(float(thr), 2), active_cells=int(act.sum()), idle_cells=int(idle.sum()),
                             rate_active=round(float(np.nanmedian(rate[act & np.isfinite(rate)])), 2) if (act & np.isfinite(rate)).any() else None,
                             rate_idle=round(float(np.nanmedian(rate[idle & np.isfinite(rate)])), 2) if (idle & np.isfinite(rate)).any() else None)
ma, mi = act & np.isfinite(rate), idle & np.isfinite(rate)
ta, ti = np.unique(tile[ma]), np.unique(tile[mi])
ba = {t: rate[ma & (tile == t)] for t in ta}; bi = {t: rate[mi & (tile == t)] for t in ti}
dai = [np.median(np.concatenate([ba[t] for t in rng.choice(ta, len(ta))])) - np.median(np.concatenate([bi[t] for t in rng.choice(ti, len(ti))])) for _ in range(1500)]
out["active_vs_idle"].update(diff_cm_yr=round(float(np.median(rate[ma]) - np.median(rate[mi])), 2), diff_ci95=[round(float(np.percentile(dai, 2.5)), 2), round(float(np.percentile(dai, 97.5)), 2)], tiles_active=int(len(ta)), tiles_idle=int(len(ti)))
print("cropland cells whose yearly HV spread exceeds 90% of desert cells:", out["active_vs_idle"])

# ---- Q3c: independent check with NISAR's own L-band rate (troposphere-corrected stack of 25 pairs). C-band InSAR over irrigated fields can pick up soil-moisture
# and crop effects, so the cropland-vs-desert difference is repeated with a different sensor and wavelength. NISAR rates carry a common offset; the DIFFERENCE does not.
from gunw import read_window
gfile = sorted(glob.glob(f"{ROOT}/data/raw/NISAR_L2_*_GUNW_*_128_D_072_*.h5"))[0]
gw = read_window(gfile, (-110.1, 31.9, -109.6, 32.4), subtract_iono=False)
rn_all = np.load(f"{P}/cache/rate_willcox_128D.npy")
assert rn_all.shape == gw["disp_mm"].shape, (rn_all.shape, gw["disp_mm"].shape)
jx = np.round((XX - gw["x"][0]) / (gw["x"][1] - gw["x"][0])).astype(int)
jy = np.round((gw["y"][0] - YY) / (gw["y"][0] - gw["y"][1])).astype(int)
jin = (jx >= 0) & (jx < len(gw["x"])) & (jy >= 0) & (jy < len(gw["y"]))
rn = np.full(XX.shape, np.nan, "float32"); rn[jin] = rn_all[jy[jin], jx[jin]] / 10        # mm/yr -> cm/yr
n_c, n_d = crop & np.isfinite(rn), des & np.isfinite(rn)
tcn, tdn = np.unique(tile[n_c]), np.unique(tile[n_d])
bc = {t: rn[n_c & (tile == t)] for t in tcn}; bd = {t: rn[n_d & (tile == t)] for t in tdn}
dn = [np.median(np.concatenate([bc[t] for t in rng.choice(tcn, len(tcn))])) - np.median(np.concatenate([bd[t] for t in rng.choice(tdn, len(tdn))])) for _ in range(1500)]
out["rate_by_class_nisar"] = dict(cropland_minus_shrubland_cm_yr=round(float(np.median(rn[n_c]) - np.median(rn[n_d])), 2), ci95=[round(float(np.percentile(dn, 2.5)), 2), round(float(np.percentile(dn, 97.5)), 2)],
                                  n_cropland=int(n_c.sum()), n_shrubland=int(n_d.sum()), note="NISAR track 128 D, 25 pairs Oct 2025 to Oct 2026, troposphere-corrected; only pixels valid in all pairs")
print("NISAR L-band rate, cropland minus shrubland:", out["rate_by_class_nisar"])

# ---- outputs
json.dump(out, open(f"{P}/gcov_farmland.json", "w"), indent=1)
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
dd = [dt.date(int(d[:4]), int(d[4:6]), int(d[6:])) for d in dates]
fig, ax = plt.subplots(1, 3, figsize=(15, 4.2))
cols = {"cropland": "#b2182b", "fallow": "#ef8a62", "shrubland": "#4d9221", "barren": "#999999"}
for a_, key, ttl in ((ax[0], "hh", "HH (dB)"), (ax[1], "hv", "HV (dB)")):
    for g, s in series.items():
        a_.plot(dd, s[key], "-o", ms=3, color=cols[g], label=f"{g} ({s['n']:,} cells)")
    a_.set_title("L-band " + ttl + ", median per land type"); a_.legend(frameon=False, fontsize=8); a_.tick_params(axis="x", rotation=30)
names = list(sep)
ax[2].barh(names, [sep[n] for n in names], color="#2166ac"); ax[2].axvline(0.5, color="#999", lw=.8); ax[2].set_xlim(0.45, 1.0)
ax[2].set_title("Cropland vs desert: separability (0.5 = none)"); ax[2].tick_params(axis="y", labelsize=8)
fig.tight_layout(); fig.savefig(f"{ROOT}/docs/gcov_farmland_willcox.png", dpi=130)
print("saved docs/gcov_farmland_willcox.png and data/processed/gcov_farmland.json")
