"""NISAR seen from two directions over the same months at Willcox: ascending track 149 (frame 18) vs descending track 128 (frame 72).
Both cover June 23-24 to Oct 9-10 2026 as 8 chained 12-24 day pairs, one day apart, so the comparison is like for like.
Same recipe for both: ionosphere and hydrostatic + wet troposphere screens subtracted, referenced to the 5 km circle at the Dragoon Mountains (hand-picked, UNVERIFIED).
Compared on the 300 m Sentinel-1 grid (UTM 12N) after shifting each map by its median over the common blocks (different references).
Vertical motion gives the SAME sign of line-of-sight change in both directions (incidence is about 41 degrees in both); east-west motion gives OPPOSITE signs, so
(ascending minus descending) isolates the east-west part. With only 3.5 months this is exploratory.
Output: data/processed/nisar_two_directions.json, docs/nisar_two_directions_willcox.png.   Usage: python nisar_two_directions.py"""
import glob, json, os, re, datetime as dt, numpy as np
from gunw import read_window, ref_median
import corrections as C
ROOT = C.ROOT
P = f"{ROOT}/data/processed"
BOX = (-110.1, 31.9, -109.6, 32.4)
REF = (-109.98, 31.95)
D0 = "2026-06-23"
D = lambda s: dt.date.fromisoformat(s)

# ---- ascending (cached remote reads)
fa = sorted(glob.glob(f"{P}/cache/tracks/149A_18/*.npz"))
A = [np.load(f) for f in fa]
A_pairs = [(str(z["ref_date"]), str(z["sec_date"]), z["d"]) for z in A]
A_pairs.sort()
ax, ay = A[0]["x"], A[0]["y"]
inc_a = float(np.median([float(z["incidence"]) for z in A]))
# ---- descending (local files, same recipe)
best = {}
for p in glob.glob(f"{ROOT}/data/raw/NISAR_L2_*_GUNW_*_128_D_072_*.h5"):
    k = re.sub(r"_[PX]\d{5}_", "_", os.path.basename(p))
    if k not in best or "_P0" in p and "_X0" in best[k]:
        best[k] = p
dem = C.dem_for_box(BOX, "willcox")
D_pairs = []
for k, p in sorted(best.items()):
    w = read_window(p, BOX, dem=dem)
    if w["ref_date"] < D0 or w["sec_date"] > "2026-10-10":
        continue
    r, _ = ref_median(w, REF, 5.0)
    D_pairs.append((w["ref_date"], w["sec_date"], (w["disp_mm"] - r).astype("float32")))
    dx, dy = w["x"], w["y"]
D_pairs.sort()


def chain(pairs):
    out = [pairs[0]]
    for q in pairs[1:]:
        assert q[0] == out[-1][1], ("broken chain", out[-1][1], q[0])
        out.append(q)
    return out


A_pairs, D_pairs = chain(A_pairs), chain(D_pairs)
print("ascending dates:", [A_pairs[0][0]] + [q[1] for q in A_pairs])
print("descending dates:", [D_pairs[0][0]] + [q[1] for q in D_pairs])


def cumulative(pairs):
    S = np.stack([q[2] for q in pairs])
    complete = np.all(np.isfinite(S), 0)
    cum = np.concatenate([np.zeros((1,) + S.shape[1:], "float32"), np.nancumsum(S, 0)])
    return cum, complete


cumA, compA = cumulative(A_pairs)
cumD, compD = cumulative(D_pairs)
chgA = np.where(compA, cumA[-1], np.nan)      # mm of LOS change, first to last date
chgD = np.where(compD, cumD[-1], np.nan)
span_days = (D(A_pairs[-1][1]) - D(A_pairs[0][0])).days
print(f"complete pixels: ascending {int(compA.sum())} ({compA.mean()*100:.0f}% of window), descending {int(compD.sum())} ({compD.mean()*100:.0f}%) | span {span_days} d")

# ---- 300 m Sentinel-1 grid
cube = np.load(f"{P}/cache/scan_southeast.npz")
sx, sy, srate = cube["x"], cube["y"], cube["rate"]


def to_grid(arr, x, y):
    dxs = sx[1] - sx[0]
    dys = sy[0] - sy[1]
    X, Y = np.meshgrid(x, y)
    ix = np.round((X - sx[0]) / dxs).astype(int)
    iy = np.round((sy[0] - Y) / dys).astype(int)
    ok = np.isfinite(arr) & (ix >= 0) & (ix < len(sx)) & (iy >= 0) & (iy < len(sy))
    flat = iy[ok] * len(sx) + ix[ok]
    s = np.bincount(flat, weights=arr[ok], minlength=len(sx) * len(sy))
    n = np.bincount(flat, minlength=len(sx) * len(sy))
    return np.where(n >= 4, s / np.maximum(n, 1), np.nan).reshape(len(sy), len(sx))


gA, gD = to_grid(chgA, ax, ay), to_grid(chgD, dx, dy)
common = np.isfinite(gA) & np.isfinite(gD) & np.isfinite(srate)
print("common 300 m blocks:", int(common.sum()))
a_, d_, s_ = gA[common], gD[common], srate[common]
a_ -= np.median(a_)
d_ -= np.median(d_)
s_ = s_ - np.median(s_)
r = lambda u, v: round(float(np.corrcoef(u, v)[0, 1]), 3)
res = dict(n_blocks=int(common.sum()), span_days=span_days, incidence_asc_deg=round(inc_a, 1),
           r_asc_vs_desc=r(a_, d_), r_asc_vs_s1=r(a_, s_), r_desc_vs_s1=r(d_, s_))
print("pattern of 3.5-month change: ascending vs descending r =", res["r_asc_vs_desc"], "| ascending vs Sentinel-1 10-yr rate r =", res["r_asc_vs_s1"], "| descending vs Sentinel-1 r =", res["r_desc_vs_s1"])
# size in the Sentinel-1 sinking blocks relative to the rest
sink = srate[common] <= -1.0
rest = ~sink
exp_mm = float(np.median(srate[common][sink]) - np.median(srate[common][rest])) * 10 * span_days / 365.25      # cm/yr -> mm over the span
res["sinking_blocks"] = dict(n=int(sink.sum()), asc_mm=round(float(np.median(a_[sink]) - np.median(a_[rest])), 2), desc_mm=round(float(np.median(d_[sink]) - np.median(d_[rest])), 2),
                             expected_from_s1_mm=round(exp_mm, 2))
print("sinking blocks vs the rest, LOS change over the span (mm): ascending", res["sinking_blocks"]["asc_mm"], "| descending", res["sinking_blocks"]["desc_mm"], "| expected from Sentinel-1 rate", res["sinking_blocks"]["expected_from_s1_mm"])
# block bootstrap over 2 km tiles for the sinking-vs-rest differences
ys_, xs_ = np.where(common)
tile = (ys_ // 7) * 1000 + (xs_ // 7)          # 7 cells of 300 m ~ 2 km
rng = np.random.default_rng(5)
tl = np.unique(tile)
groups = {t: np.flatnonzero(tile == t) for t in tl}
bs = {"asc": [], "desc": [], "diff": []}
for _ in range(1000):
    idx = np.concatenate([groups[t] for t in rng.choice(tl, len(tl))])
    sk = sink[idx]
    if sk.sum() < 20 or (~sk).sum() < 20:
        continue
    ea = np.median(a_[idx][sk]) - np.median(a_[idx][~sk])
    ed = np.median(d_[idx][sk]) - np.median(d_[idx][~sk])
    bs["asc"].append(ea); bs["desc"].append(ed); bs["diff"].append(ea - ed)
ci = lambda v: [round(float(np.percentile(v, 2.5)), 2), round(float(np.percentile(v, 97.5)), 2)]
res["sinking_blocks"].update(asc_ci95=ci(bs["asc"]), desc_ci95=ci(bs["desc"]))
res["east_west_check"] = dict(asc_minus_desc_mm=round(res["sinking_blocks"]["asc_mm"] - res["sinking_blocks"]["desc_mm"], 2), ci95=ci(bs["diff"]),
                              note="vertical motion cancels in this difference; a value near zero means no sign of east-west motion at this noise level")
print("ascending minus descending in sinking blocks (east-west part), mm:", res["east_west_check"])
print("95% ranges: ascending", res["sinking_blocks"]["asc_ci95"], "descending", res["sinking_blocks"]["desc_ci95"])

# ---- per-date noise and whether the two tracks share their date errors
def incr(cum, comp):
    ser = np.array([np.nanmean(cum[i][comp]) for i in range(len(cum))])
    return ser, np.diff(ser)


serA, incA = incr(cumA, compA)
serD, incD = incr(cumD, compD)
res["date_noise"] = dict(asc_s_d_mm=round(float(incA.std(ddof=1) / np.sqrt(2)), 1), desc_s_d_mm=round(float(incD.std(ddof=1) / np.sqrt(2)), 1),
                         asc_lag1=round(float(np.corrcoef(incA[:-1], incA[1:])[0, 1]), 2), desc_lag1=round(float(np.corrcoef(incD[:-1], incD[1:])[0, 1]), 2),
                         r_increments_asc_desc=round(float(np.corrcoef(incA, incD)[0, 1]), 2), n_increments=len(incA))
print("per-date error (mm): ascending", res["date_noise"]["asc_s_d_mm"], "descending", res["date_noise"]["desc_s_d_mm"], "| lag-1:", res["date_noise"]["asc_lag1"], res["date_noise"]["desc_lag1"],
      "| correlation of the two tracks' date-to-date increments:", res["date_noise"]["r_increments_asc_desc"], f"(n={len(incA)})")
res["dates_asc"] = [A_pairs[0][0]] + [q[1] for q in A_pairs]
res["dates_desc"] = [D_pairs[0][0]] + [q[1] for q in D_pairs]
json.dump(res, open(f"{P}/nisar_two_directions.json", "w"), indent=1)

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
fig, ax = plt.subplots(1, 2, figsize=(11, 4.2))
ax[0].hexbin(d_, a_, gridsize=45, extent=(-30, 30, -30, 30), bins="log", cmap="Greys", mincnt=1)
ax[0].plot([-30, 30], [-30, 30], color="#999", lw=.8)
ax[0].set_xlabel("Descending (track 128): LOS change over 3.5 months (mm, shifted)")
ax[0].set_ylabel("Ascending (track 149): same months (mm, shifted)")
ax[0].set_title(f"Two look directions, same months: r = {res['r_asc_vs_desc']:.2f}")
lab = ["Ascending\n(track 149)", "Descending\n(track 128)", "Expected from\nSentinel-1 rate"]
vals = [res["sinking_blocks"]["asc_mm"], res["sinking_blocks"]["desc_mm"], res["sinking_blocks"]["expected_from_s1_mm"]]
err = [[vals[0] - res["sinking_blocks"]["asc_ci95"][0], vals[1] - res["sinking_blocks"]["desc_ci95"][0], 0], [res["sinking_blocks"]["asc_ci95"][1] - vals[0], res["sinking_blocks"]["desc_ci95"][1] - vals[1], 0]]
ax[1].bar(lab, vals, yerr=err, color=["#b2182b", "#ef8a62", "#2166ac"], capsize=4)
ax[1].axhline(0, color="#999", lw=.8)
ax[1].set_ylabel("Change in sinking blocks relative to the rest (mm)")
ax[1].set_title("Is the sinking visible in 3.5 months?")
fig.tight_layout()
fig.savefig(f"{ROOT}/docs/nisar_two_directions_willcox.png", dpi=130)
print("saved")
