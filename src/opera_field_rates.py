"""Sentinel-1 (OPERA DISP-S1) sinking rate at the full 30 m pixel size over the Willcox farm area, for field-scale analysis.
Same recipe as opera_scan.py so the numbers agree with the 300 m map: per block-final granule, displacement minus solid earth tide minus ionospheric delay,
recommended_mask == 1, reference = median of the frame's 300 m block means for that block (frame-wide, a few mm/yr bias possible), blocks chained, per-pixel OLS rate (cm/yr).
Difference: the 300 m scan averages 10 x 10 pixels; here the rate is kept per 30 m pixel inside a window, and only pixels valid in EVERY block get a rate.
Output: data/processed/cache/opera30_f34478.npz (rate, x, y, epsg, dates).   Usage: python opera_field_rates.py [--frame 34478]"""
import argparse, glob, os, re, datetime as dt, numpy as np, h5py
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument("--frame", type=int, default=34478)
ap.add_argument("--xmin", type=float, default=587900)
ap.add_argument("--xmax", type=float, default=645100)
ap.add_argument("--ymin", type=float, default=3525000)
ap.add_argument("--ymax", type=float, default=3603400)
a = ap.parse_args()
files = {}
for p in glob.glob(f"{ROOT}/data/raw/opera/OPERA_L3_DISP-S1_IW_F{a.frame:05d}_*.nc"):
    m = re.search(r"VV_(\d{8})T\d+Z_(\d{8})T\d+Z", p)
    files[(m.group(1), m.group(2))] = p
blocks = {}
for (r, s), p in files.items():
    if r not in blocks or s > blocks[r][0]:
        blocks[r] = (s, p)
order = sorted(blocks)
F = 10
D = []
dates = [order[0]]
win = None
for r in order:
    s, p = blocks[r]
    with h5py.File(p, "r") as f:
        x = f["x"][:]
        y = f["y"][:]
        _w = f["spatial_ref"].attrs["crs_wkt"]
        _w = _w.decode() if isinstance(_w, bytes) else _w
        epsg = int(re.findall(r'ID\["EPSG",(\d+)\]', _w)[-1])
        ny, nx = (len(y) // F) * F, (len(x) // F) * F
        d = (f["displacement"][:ny, :nx] - f["corrections/solid_earth_tide"][:ny, :nx] - f["corrections/ionospheric_delay"][:ny, :nx]) * 1000
        d[f["recommended_mask"][:ny, :nx] != 1] = np.nan
    c = d.reshape(ny // F, F, nx // F, F)
    cnt = np.isfinite(c).sum((1, 3))
    dm = np.where(cnt >= 30, np.nanmean(c, (1, 3)), np.nan)
    ref = np.nanmedian(dm)                           # the same frame-median reference as opera_scan.py
    if win is None:
        ix = np.where((x[:nx] >= a.xmin) & (x[:nx] <= a.xmax))[0]
        iy = np.where((y[:ny] >= a.ymin) & (y[:ny] <= a.ymax))[0]
        win = (slice(iy[0], iy[-1] + 1), slice(ix[0], ix[-1] + 1))
        wx, wy = x[win[1]], y[win[0]]
    D.append((d[win] - ref).astype("float32"))
    dates.append(s)
    print("block", r, "->", s, "window valid", f"{np.isfinite(D[-1]).mean()*100:.0f}%", flush=True)
D = np.stack(D)
ok = np.all(np.isfinite(D), 0)
cum = np.concatenate([np.zeros((1,) + D.shape[1:], "float32"), np.nancumsum(D, 0)])
t = np.array([(dt.date(int(q[:4]), int(q[4:6]), int(q[6:])) - dt.date(int(dates[0][:4]), int(dates[0][4:6]), int(dates[0][6:]))).days for q in dates]) / 365.25
tc = t - t.mean()
rate = np.full(ok.shape, np.nan, "float32")
cp = cum[:, ok]
rate[ok] = (tc[:, None] * (cp - cp.mean(0))).sum(0) / (tc ** 2).sum() / 10
print(f"window {rate.shape}, pixels valid in all {len(order)} blocks: {ok.sum()} ({ok.mean()*100:.1f}%), rate median {np.nanmedian(rate):.2f} cm/yr, EPSG {epsg}")
np.savez_compressed(f"{ROOT}/data/processed/cache/opera30_f{a.frame}.npz", rate=rate, x=wx, y=wy, epsg=epsg, dates=np.array(dates), t=t)
print("saved")
