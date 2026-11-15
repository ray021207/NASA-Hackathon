"""NISAR vs Sentinel-1 over the Willcox basin, compared SPATIALLY (thousands of 300 m blocks, not one point).
Both are descending, almost the same look direction (NISAR track 128 D, Sentinel-1 track 129 D), both LOS.
Test A: change over the months both satellites watched (NISAR Oct 26 2025 to Apr 12 2026 vs Sentinel-1 nearest dates).
Test B: NISAR per-pixel rate over its whole year (troposphere-corrected) vs the 10-year Sentinel-1 rate on the same blocks.
Each map is shifted by its own median over the common blocks first, because the two use different reference areas.
Output: data/processed/nisar_vs_sentinel1.json and docs/nisar_vs_sentinel1_willcox.png
Usage: python compare_nisar_s1.py"""
import glob, re, os, json, datetime as dt, numpy as np
from gunw import read_window, ref_median
import corrections as C
ROOT = C.ROOT
BOX = (-110.1, 31.9, -109.6, 32.4)
REF = (-109.98, 31.95)
PLAYA = (-109.84, 32.10)
cube = np.load(f"{ROOT}/data/processed/cache/scan_southeast.npz")
sx, sy, scum, srate = cube["x"], cube["y"], cube["cum"], cube["rate"]
sdates = [str(d) for d in cube["dates"]]
EPSG = 32612
print("Sentinel-1 cube dates:", sdates)
print("cube cum range", float(np.nanmin(scum)), float(np.nanmax(scum)), "(units checked below)")


def near(date_iso):
    t = dt.date.fromisoformat(date_iso)
    ds = [dt.date(int(s[:4]), int(s[4:6]), int(s[6:])) for s in sdates]
    i = int(np.argmin([abs((d - t).days) for d in ds]))
    return i, ds[i]


# NISAR chain, corrected
best = {}
for p in glob.glob(f"{ROOT}/data/raw/NISAR_L2_*_GUNW_*_128_D_072_*.h5"):
    k = re.sub(r"_[PX]\d{5}_", "_", os.path.basename(p))
    if k not in best or "_P0" in p and "_X0" in best[k]:
        best[k] = p
dem = C.dem_for_box(BOX, "willcox")
pairs = []
for k, p in sorted(best.items()):
    w = read_window(p, BOX, dem=dem)
    r, _ = ref_median(w, REF, 5.0)
    pairs.append(dict(ref=w["ref_date"], sec=w["sec_date"], d=(w["disp_mm"] - r).astype("float32")))
    x, y = w["x"], w["y"]
pairs.sort(key=lambda q: q["ref"])
dates = [pairs[0]["ref"]] + [q["sec"] for q in pairs]
print("NISAR pairs", len(pairs), dates[0], "->", dates[-1])


def block_mean(arr, x, y):
    """average an 80 m NISAR array into the Sentinel-1 300 m grid cells (UTM 12N both)."""
    dx = sx[1] - sx[0]; dy = sy[0] - sy[1]
    X, Y = np.meshgrid(x, y)
    ix = np.round((X - sx[0]) / dx).astype(int); iy = np.round((sy[0] - Y) / dy).astype(int)
    ok = np.isfinite(arr) & (ix >= 0) & (ix < len(sx)) & (iy >= 0) & (iy < len(sy))
    flat = iy[ok] * len(sx) + ix[ok]
    s = np.bincount(flat, weights=arr[ok], minlength=len(sx) * len(sy)); n = np.bincount(flat, minlength=len(sx) * len(sy))
    out = np.where(n >= 4, s / np.maximum(n, 1), np.nan).reshape(len(sy), len(sx))
    return out


def stats(a, b, label):
    m = np.isfinite(a) & np.isfinite(b)
    a, b = a[m] - np.median(a[m]), b[m] - np.median(b[m])
    r = float(np.corrcoef(a, b)[0, 1]); slope = float((a * b).sum() / (a * a).sum())   # S1 = slope * NISAR
    rms = float(np.sqrt(np.mean((a - b) ** 2)))
    print(f"{label}: {m.sum()} blocks | r = {r:.2f} | slope (S1 per NISAR) = {slope:.2f} | rms diff {rms:.2f}")
    return dict(n_blocks=int(m.sum()), r=round(r, 3), slope=round(slope, 3), rms=round(rms, 3))


# ---- Test B: full-year NISAR rate vs 10-yr S1 rate
D = np.stack([q["d"] for q in pairs])
complete = np.all(np.isfinite(D), 0)
cum = np.concatenate([np.zeros((1,) + D.shape[1:], "float32"), np.nancumsum(D, 0)])
t = np.array([(dt.date.fromisoformat(s) - dt.date.fromisoformat(dates[0])).days for s in dates], float) / 365.25
tc = t - t.mean()
rate_n = np.full(complete.shape, np.nan, "float32")
cp = cum[:, complete]
rate_n[complete] = (tc[:, None] * (cp - cp.mean(0))).sum(0) / (tc ** 2).sum() / 10      # cm/yr
rate_nb = block_mean(rate_n, x, y)
resB = stats(rate_nb, srate, "B  NISAR 1-yr rate vs Sentinel-1 10-yr rate")
# drop the one bad date (Sep 15 2026) and refit: tests whether one acquisition drives it
keep = [i for i, s in enumerate(dates) if s != "2026-09-15"]
tk = t[keep]; tkc = tk - tk.mean(); ck = cum[keep][:, complete]
rate_k = np.full(complete.shape, np.nan, "float32"); rate_k[complete] = (tkc[:, None] * (ck - ck.mean(0))).sum(0) / (tkc ** 2).sum() / 10
resB2 = stats(block_mean(rate_k, x, y), srate, "B2 same, without the Sep 15 date")
# endpoint estimator: net change first to last date / years. A bad MIDDLE date cancels in a chain sum, so only the two end dates matter.
rate_e = np.full(complete.shape, np.nan, "float32"); rate_e[complete] = cum[-1][complete] / t[-1] / 10
resB3 = stats(block_mean(rate_e, x, y), srate, "B3 endpoints only (net change / years)")

# ---- Test A: change over the overlap
ia, da = near("2025-10-26"); ib, db = near("2026-04-12")
print("Sentinel-1 dates used:", da, db)
iN = [i for i, s in enumerate(dates) if s <= "2026-04-12"]
comp_a = np.all(np.isfinite(D[: len(iN) - 1]), 0)
chg_n = np.where(comp_a, cum[iN[-1]] - cum[0], np.nan)
chg_s = (scum[ib] - scum[ia])
resA = stats(block_mean(chg_n, x, y), chg_s, f"A  change {da} to {db}")

# basin-mean numbers
mask_sink = np.isfinite(rate_nb) & np.isfinite(srate)
print("blocks with both:", int(mask_sink.sum()), "| NISAR median", float(np.nanmedian(rate_nb[mask_sink])), "S1 median", float(np.nanmedian(srate[mask_sink])))
sink = mask_sink & (srate <= -1.0)
resSink = None
if sink.sum() > 50:
    print(f"in blocks where Sentinel-1 shows sinking (<= -1 cm/yr): {sink.sum()} | NISAR rate relative to the rest: "
          f"{np.nanmedian(rate_nb[sink]) - np.nanmedian(rate_nb[mask_sink & (srate > -1.0)]):.2f} cm/yr | S1: {np.nanmedian(srate[sink]) - np.nanmedian(srate[mask_sink & (srate > -1.0)]):.2f} cm/yr")
    resSink = dict(n_blocks=int(sink.sum()), nisar_minus_rest=round(float(np.nanmedian(rate_nb[sink]) - np.nanmedian(rate_nb[mask_sink & (srate > -1.0)])), 2),
                   s1_minus_rest=round(float(np.nanmedian(srate[sink]) - np.nanmedian(srate[mask_sink & (srate > -1.0)])), 2))

# playa time series for the chart
X, Y = np.meshgrid(x, y)
from pyproj import Transformer
cx, cy = Transformer.from_crs(4326, EPSG, always_xy=True).transform(*PLAYA)
pm = (np.hypot(X - cx, Y - cy) <= 3000) & complete
ser_n = [float(np.nanmean(cum[i][pm])) / 10 for i in range(len(dates))]
SX, SY = np.meshgrid(sx, sy)
sm = (np.hypot(SX - cx, SY - cy) <= 3000) & np.isfinite(scum[0])
ser_s = [float(np.nanmean(scum[i][sm])) / 10 for i in range(len(sdates))]   # cube is in mm -> cm
print("playa circle (3 km): NISAR px", int(pm.sum()), "| S1 blocks", int(sm.sum()))

out = dict(note="Spatial comparison of NISAR (track 128 D, troposphere-corrected) with Sentinel-1 (frame 34478) over the Willcox box, 300 m blocks; each map shifted by its median over common blocks.",
           test_B_rate_pattern=resB, test_B_without_sep15=resB2, test_B_endpoints_only=resB3, test_A_overlap_change=dict(s1_dates=[str(da), str(db)], **resA), sinking_blocks=resSink,
           nisar_dates=dates, nisar_playa_cm=[round(v, 3) for v in ser_n], s1_dates=sdates, s1_playa_cm=[round(v, 3) for v in ser_s])
json.dump(out, open(f"{ROOT}/data/processed/nisar_vs_sentinel1.json", "w"), indent=1)

# figure
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
fig, ax = plt.subplots(1, 2, figsize=(11, 4.3))
m = np.isfinite(rate_nb) & np.isfinite(srate)
a_, b_ = rate_nb[m] - np.median(rate_nb[m]), srate[m] - np.median(srate[m])
ax[0].hexbin(a_, b_, gridsize=45, extent=(-12, 12, -8, 8), bins="log", cmap="Greys", mincnt=1)
bins = np.linspace(-8, 8, 17); idx = np.digitize(a_, bins)
cx_, cy_ = [], []
for i in range(1, len(bins)):
    s = idx == i
    if s.sum() >= 30: cx_.append(a_[s].mean()); cy_.append(np.median(b_[s]))
ax[0].plot(cx_, cy_, "-o", color="#b2182b", ms=3, label="median per NISAR bin")
ax[0].axhline(0, color="#999", lw=.5); ax[0].axvline(0, color="#999", lw=.5)
ax[0].set_xlabel("NISAR 1-year rate (cm/yr, shifted)"); ax[0].set_ylabel("Sentinel-1 10-year rate (cm/yr, shifted)")
ax[0].set_title(f"Same pattern? r = {resB['r']:.2f}, {resB['n_blocks']:,} blocks"); ax[0].legend(frameon=False, fontsize=8, loc="upper left")
dN = [dt.date.fromisoformat(s) for s in dates]
op = json.load(open(f"{ROOT}/data/processed/opera_willcox.json"))["points"]["Willcox-playa"]
A_ = np.c_[t, np.ones_like(t)]; cn, *_ = np.linalg.lstsq(A_, np.array(ser_n), rcond=None)
ax[1].plot(dN, ser_n, "-o", ms=3, color="#b2182b", label=f"NISAR (corrected), playa circle: net {ser_n[-1]:.1f} cm in {t[-1]:.2f} yr")
for rate_, lab, col, ls in ((op["rate_cm_yr"], f"Sentinel-1 10-year trend ({op['rate_cm_yr']:.1f} cm/yr)", "#2166ac", "--"),
                            (op["rate_last3y_cm_yr"], f"Sentinel-1 last 3 years ({op['rate_last3y_cm_yr']:.1f} cm/yr)", "#67a9cf", ":")):
    ax[1].plot(dN, [rate_ * tt for tt in t], ls, color=col, label=lab)
ax[1].set_ylabel("Line-of-sight change (cm, negative = away)"); ax[1].legend(frameon=False, fontsize=7.5, loc="lower left"); ax[1].set_title("Willcox playa: NISAR year vs Sentinel-1 trends")
res_n = np.array(ser_n) - A_ @ cn
out["playa_nisar_fit_cm_yr"] = round(float(cn[0]), 2); out["playa_nisar_net_change_cm"] = round(float(ser_n[-1]), 2); out["playa_nisar_years"] = round(float(t[-1]), 2); out["playa_nisar_resid_cm"] = round(float(res_n.std()), 2)
out["playa_s1_trend_cm_yr"] = op["rate_cm_yr"]; out["playa_s1_last3y_cm_yr"] = op["rate_last3y_cm_yr"]
json.dump(out, open(f"{ROOT}/data/processed/nisar_vs_sentinel1.json", "w"), indent=1)
print("playa NISAR fit", out["playa_nisar_fit_cm_yr"], "cm/yr | resid", out["playa_nisar_resid_cm"], "cm | S1 10y", op["rate_cm_yr"], "3y", op["rate_last3y_cm_yr"])
fig.autofmt_xdate(); fig.tight_layout(); fig.savefig(f"{ROOT}/docs/nisar_vs_sentinel1_willcox.png", dpi=130)
print("saved docs/nisar_vs_sentinel1_willcox.png")
