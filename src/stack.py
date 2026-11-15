"""Chain consecutive GUNW pairs on ONE track into a cumulative LOS displacement series and fit a linear rate.
Usage: python stack.py --hotspot willcox --track 128 --frame 72 --dir D
Steps per pair: valid mask -> subtract ionosphere screen -> phase to mm (sign UNVERIFIED) -> subtract median over reference circle.
Then cumulative sum along time. Rate = OLS slope of the region-mean series; sigma = OLS standard error (white-noise; optimistic)."""
import argparse, glob, json, os, re, sys, datetime as dt, numpy as np
from gunw import read_window, ref_median
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOX = {"eloy": (-111.9, 32.6, -111.4, 33.0), "buckeye": (-112.8, 33.3, -112.2, 33.6), "willcox": (-110.1, 31.9, -109.6, 32.4)}
REF = {"willcox": (-109.98, 31.95)}   # Dragoon Mountains, UNVERIFIED coordinates. Others set by --ref lon lat.
ap = argparse.ArgumentParser()
ap.add_argument("--hotspot", required=True); ap.add_argument("--track", type=int, required=True); ap.add_argument("--frame", type=int, required=True)
ap.add_argument("--dir", required=True, choices=["D", "A"]); ap.add_argument("--ref", nargs=2, type=float); ap.add_argument("--ref-km", type=float, default=5.0)
ap.add_argument("--coh", type=float, default=0.4); ap.add_argument("--tag", default=""); ap.add_argument("--start", default="", help="ISO date: drop pairs whose reference date is earlier (e.g. to leave out Beta-maturity pairs)"); ap.add_argument("--tropo", action="store_true", help="also subtract NISAR hydrostatic+wet troposphere screens")
a = ap.parse_args()
box = BOX[a.hotspot]
import corrections as C
dem = C.dem_for_box(box, a.hotspot) if a.tropo else None
refpt = tuple(a.ref) if a.ref else REF.get(a.hotspot)
if refpt is None: sys.exit("give --ref lon lat")
pat = f"{ROOT}/data/raw/NISAR_L2_*_GUNW_*_{a.track:03d}_{a.dir}_{a.frame:03d}_*.h5"
best = {}
for p in glob.glob(pat):
    k = re.sub(r"_[PX]\d{5}_", "_", os.path.basename(p))
    if k not in best or "_P0" in p and "_X0" in best[k]: best[k] = p
pairs = []
for k, p in sorted(best.items()):
    try: w = read_window(p, box, coh_min=a.coh, dem=dem)
    except Exception as e: print("skip (unreadable/incomplete):", os.path.basename(p)[:60], type(e).__name__); continue
    if w is None: continue
    r, nref = ref_median(w, refpt, a.ref_km)
    if not np.isfinite(r): print("skip (no valid reference pixels):", w["ref_date"]); continue
    pairs.append(dict(ref=w["ref_date"], sec=w["sec_date"], days=w["temporal_days"], d=(w["disp_mm"] - r).astype("float32"), nref=nref, tb=w["temporal_days"]))
pairs.sort(key=lambda q: q["ref"])
if a.start: pairs = [q for q in pairs if q["ref"] >= a.start]
print(f"{len(pairs)} usable pairs; temporal baselines (days): {sorted({q['days'] for q in pairs})}")
# keep the longest unbroken chain (sec of pair i == ref of pair i+1)
chains, cur = [], [pairs[0]]
for q in pairs[1:]:
    if q["ref"] == cur[-1]["sec"]: cur.append(q)
    else: chains.append(cur); cur = [q]
chains.append(cur)
print("chain lengths:", [len(c) for c in chains], "(breaks = missing acquisition cycle; pairs on both sides cannot be summed)")
chain = max(chains, key=len)
D = np.stack([q["d"] for q in chain]); cum = np.concatenate([np.zeros((1,) + D.shape[1:], "float32"), np.nancumsum(D, 0)])
complete = np.all(np.isfinite(D), 0)
dates = [chain[0]["ref"]] + [q["sec"] for q in chain]
t = np.array([(dt.date.fromisoformat(s) - dt.date.fromisoformat(dates[0])).days for s in dates], float) / 365.25
n_c = int(complete.sum()); print(f"pixels valid in ALL {len(chain)} pairs: {n_c} ({n_c/complete.size*100:.1f}% of window)")
if n_c < 50: sys.exit("too few complete pixels")
series = np.array([np.nanmean(cum[i][complete]) for i in range(len(dates))])
A = np.c_[t, np.ones_like(t)]; coef, *_ = np.linalg.lstsq(A, series, rcond=None)
res = series - A @ coef; dof = max(len(t) - 2, 1); s2 = (res ** 2).sum() / dof
se = np.sqrt(s2 / ((t - t.mean()) ** 2).sum())
print(f"LOS rate = {coef[0]/10:.2f} +/- {se/10:.2f} cm/yr (1 sigma, white-noise OLS) | residual rms {res.std():.1f} mm | span {t[-1]*12:.1f} months | n={len(t)} dates")
print("cumulative mm:", dict(zip(dates, np.round(series, 1).tolist())))
# per-pixel rate over complete pixels
tc = t - t.mean(); rate_px = np.full(complete.shape, np.nan, "float32")
cp = cum[:, complete]; rate_px[complete] = (tc[:, None] * (cp - cp.mean(0))).sum(0) / (tc ** 2).sum()
rp = rate_px[complete] / 10
print(f"per-pixel LOS rate (cm/yr): median {np.median(rp):.2f}, 5th pct {np.percentile(rp,5):.2f}, 95th pct {np.percentile(rp,95):.2f}")
out = dict(hotspot=a.hotspot, units="mm", track=f"{a.track}{a.dir}", frame=a.frame, reference=dict(lonlat=list(refpt), radius_km=a.ref_km, note="unverified hand-picked"),
           dates=dates, displacement_mm=np.round(series, 2).tolist(), rate_cm_yr=round(float(coef[0] / 10), 3), rate_sigma_cm_yr=round(float(se / 10), 3),
           n_pixels=n_c, coherence_min=a.coh, sign_convention="d=-(lambda/4pi)*phi, UNVERIFIED", troposphere_corrected=bool(a.tropo))
os.makedirs(f"{ROOT}/data/processed", exist_ok=True)
json.dump(out, open(f"{ROOT}/data/processed/stack_{a.hotspot}_{a.track}{a.dir}{a.tag}.json", "w"), indent=1)
np.save(f"{ROOT}/data/processed/cache/rate_{a.hotspot}_{a.track}{a.dir}{a.tag}.npy", rate_px) if os.path.isdir(f"{ROOT}/data/processed/cache") else None
