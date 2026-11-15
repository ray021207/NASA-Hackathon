"""NISAR "radar portrait" of the Willcox basin: a false-colour image made from the 28 dates of GCOV backscatter (gcov_extract.py cache).
Red   = how much the HH signal swings through the year (farming changes; dry dates only, so rain does not drive it)
Green = average HV signal (volume scattering: shrubs, crops, rough ground)
Blue  = average HH signal (overall ground brightness)
It is a data visualisation, not a photograph. Before captioning it, two claims are tested here:
  1. the dark area in the middle is Willcox Playa: the playa reference point (32.10 N, 109.84 W) must fall in it;
  2. the pink circles are irrigated fields: pink pixels must mostly be cropland in the USDA Cropland Data Layer.
Output: data/processed/nisar_radar_portrait_willcox.jpg and data/processed/nisar_portrait.json.   Usage: python gcov_portrait.py"""
import glob, json, os, numpy as np
from PIL import Image
from pyproj import Transformer
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = f"{ROOT}/data/processed"
fs = sorted(glob.glob(f"{P}/cache/gcov/*.npz"))
Z = [np.load(f) for f in fs]
dates = [os.path.basename(f)[:8] for f in fs]
x0, y1, nx, ny, epsg = float(Z[0]["x0"]), float(Z[0]["y1"]), int(Z[0]["nx"]), int(Z[0]["ny"]), int(Z[0]["epsg"])
hh = 10 * np.log10(np.stack([z["hh"] for z in Z]))
hv = 10 * np.log10(np.stack([z["hv"] for z in Z]))
rain = json.load(open(f"{P}/cache/rain_vs_backscatter.json"))
assert rain["dates"] == dates
dry = np.array(rain["rain_3d"]) < 1.0
spread, mhv, mhh = np.nanstd(hh[dry], 0), np.nanmean(hv[dry], 0), np.nanmean(hh[dry], 0)


def stretch(a, lo, hi):
    return (np.clip((np.nan_to_num(a, nan=lo) - lo) / (hi - lo), 0, 1) * 255).astype("uint8")


rgb = np.dstack([stretch(spread, 0.6, 3.2), stretch(mhv, -26, -17), stretch(mhh, -20, -9)])

# ---- check 1: the playa point
tr = Transformer.from_crs(4326, epsg, always_xy=True)
px, py = tr.transform(-109.84, 32.10)
c, r = int((px - x0) / 80), int((y1 - py) / 80)
win = (slice(max(r - 6, 0), r + 7), slice(max(c - 6, 0), c + 7))
playa_brightness = float(rgb[win].mean())
scene_brightness = float(rgb.mean())
print(f"playa point at pixel ({c},{r}); mean RGB value there {playa_brightness:.0f} vs scene {scene_brightness:.0f} (dark = lower)")

# ---- check 2: pink pixels vs USDA cropland
import rasterio
cdl = rasterio.open(f"{ROOT}/data/raw/cdl/extracted/2025_30m_cdls.tif")
xs = x0 + 80 * (np.arange(nx) + .5)
ys = y1 - 80 * (np.arange(ny) + .5)
XX, YY = np.meshgrid(xs, ys)
t2 = Transformer.from_crs(epsg, cdl.crs, always_xy=True)
cx, cy = t2.transform(XX, YY)
from rasterio.windows import from_bounds
w = from_bounds(cx.min() - 300, cy.min() - 300, cx.max() + 300, cy.max() + 300, cdl.transform).round_offsets().round_lengths()
a = cdl.read(1, window=w)
wt = cdl.window_transform(w)
col = np.clip(((cx - wt.c) / wt.a).astype(int), 0, a.shape[1] - 1)
row = np.clip(((cy - wt.f) / wt.e).astype(int), 0, a.shape[0] - 1)
code = a[row, col]
crop = np.isin(code, list(range(1, 61)) + list(range(66, 78)) + list(range(204, 255)) + [61])     # crops and fallow/idle cropland
R, G, B = (rgb[..., k].astype(int) for k in range(3))
pink = (R > 170) & (R > G + 40)
share_pink_crop = float(crop[pink].mean())
share_all_crop = float(crop.mean())
print(f"pink pixels: {int(pink.sum())}; {share_pink_crop*100:.0f}% of them are cropland or fallow cropland in the CDL (whole image: {share_all_crop*100:.0f}%)")

ok_playa = playa_brightness < 0.6 * scene_brightness
ok_pink = share_pink_crop > 0.7
print("caption claims supported:", dict(playa=ok_playa, pink_is_cropland=ok_pink))

# ---- check 3: are the round fields center pivots? (USGS 2024 irrigation-system records)
import shapefile
sr = shapefile.Reader(f"{ROOT}/data/raw/usgs_2024/extracted/WX_2024_est_FV_wthdrwls_crop")
nm = [f[0] for f in sr.fields[1:]]
recs = [dict(zip(nm, x)) for x in sr.records() if x[nm.index("Year")] == "2024"]
tot = sum(x["Acres"] or 0 for x in recs)
pivot = sum((x["Acres"] or 0) for x in recs if str(x["Irrig_Sys"]).startswith("SPR-OVH"))   # "Center pivot or lateral move sprinkler" in the release's metadata
pivot_share = round(pivot / tot, 2)
print(f"center-pivot or lateral-move sprinkler share of irrigated acres (USGS 2024): {pivot_share*100:.0f}%")
im = Image.fromarray(rgb, "RGB").resize((nx * 2, ny * 2), Image.LANCZOS)
im.save(f"{P}/nisar_radar_portrait_willcox.jpg", quality=86, optimize=True, progressive=True)
D = lambda s: f"{s[:4]}-{s[4:6]}-{s[6:]}"
meta = dict(file="nisar_radar_portrait_willcox.jpg", dates=len(dates), dry_dates=int(dry.sum()), start=D(dates[0]), end=D(dates[-1]),
            width_km=round(nx * 0.08, 1), height_km=round(ny * 0.08, 1), playa_check=ok_playa, pink_cropland_share=round(share_pink_crop, 2),
            image_cropland_share=round(share_all_crop, 2), pivot_acre_share=pivot_share, channels=dict(red="yearly swing of HH (dry dates)", green="average HV", blue="average HH"))
json.dump(meta, open(f"{P}/nisar_portrait.json", "w"), indent=1)
print(json.dumps(meta), "| jpeg", round(os.path.getsize(f"{P}/nisar_radar_portrait_willcox.jpg") / 1024), "KB")
