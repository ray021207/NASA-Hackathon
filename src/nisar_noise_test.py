"""Does subtracting NISAR's own troposphere / solid-earth-tide screens make the Willcox series cleaner?
Same 25-pair chain as stack.py, same pixels, same reference; only the correction changes. Both signs of each screen are tried,
because the sign convention is not something we can verify from here: the sign that REDUCES scatter is the physical one.
Usage: python nisar_noise_test.py"""
import glob, re, os, json, datetime as dt, numpy as np
from gunw import read_window, ref_median
import corrections as C
BOX = (-110.1, 31.9, -109.6, 32.4)
REF = (-109.98, 31.95)
ROOT = C.ROOT
best = {}
for p in glob.glob(f"{ROOT}/data/raw/NISAR_L2_*_GUNW_*_128_D_072_*.h5"):
    k = re.sub(r"_[PX]\d{5}_", "_", os.path.basename(p))
    if k not in best or "_P0" in p and "_X0" in best[k]:
        best[k] = p
dem = C.dem_for_box(BOX, "willcox")
print("DEM", dem[0].shape, "range", np.nanmin(dem[0]), np.nanmax(dem[0]))
VAR = {"iono only": {}, "+tide": {"tide": 1}, "+hydro": {"hydro": 1}, "+wet": {"wet": 1}, "+hydro+wet": {"hydro": 1, "wet": 1}, "+tropo+tide": {"hydro": 1, "wet": 1, "tide": 1},
       "-tide": {"tide": -1}, "-hydro": {"hydro": -1}, "-wet": {"wet": -1}, "-hydro-wet": {"hydro": -1, "wet": -1}, "-tropo-tide": {"hydro": -1, "wet": -1, "tide": -1}}
pairs = []
for k, p in sorted(best.items()):
    try:
        w = read_window(p, BOX)
    except Exception as e:
        print("skip", k[:40], type(e).__name__)
        continue
    if w is None:
        continue
    h = C.heights_on_grid(dem, w["epsg"], w["x"], w["y"])
    lam = w["lam"]
    sc = {n: C.screen_on_grid(p, n, w["x"], w["y"], h) for n in C.SCREENS}
    conv = -(lam / (4 * np.pi)) * 1000.0
    d = {}
    for name, comb in VAR.items():
        x = w["disp_mm"].copy()
        for n, s in comb.items():
            x = x - s * conv * sc[n]
        r, _ = ref_median(dict(w, disp_mm=x), REF, 5.0)
        d[name] = (x - r).astype("float32")
    pairs.append(dict(ref=w["ref_date"], sec=w["sec_date"], d=d, std={n: float(np.nanstd(d[n])) for n in d}))
pairs.sort(key=lambda q: q["ref"])
chains, cur = [], [pairs[0]]
for q in pairs[1:]:
    if q["ref"] == cur[-1]["sec"]:
        cur.append(q)
    else:
        chains.append(cur)
        cur = [q]
chains.append(cur)
chain = max(chains, key=len)
print("pairs", len(pairs), "chain", len(chain))
dates = [chain[0]["ref"]] + [q["sec"] for q in chain]
t = np.array([(dt.date.fromisoformat(s) - dt.date.fromisoformat(dates[0])).days for s in dates], float) / 365.25
complete = np.all([np.isfinite(q["d"]["iono only"]) for q in chain], 0)
print("complete pixels", int(complete.sum()))


def ols(t, y):
    A = np.c_[t, np.ones_like(t)]
    c, *_ = np.linalg.lstsq(A, y, rcond=None)
    r = y - A @ c
    se = np.sqrt((r ** 2).sum() / max(len(t) - 2, 1) / ((t - t.mean()) ** 2).sum())
    return c[0] / 10, se / 10, r.std()


print(f"{'variant':14s} {'spatial sd mm':>13s} {'jump sd mm':>10s} {'lag1':>6s} {'resid mm':>8s} {'rate cm/yr':>16s} {'rate to Aug22':>14s}")
rows = {}
for name in VAR:
    ser = np.array([0.0] + list(np.cumsum([np.nanmean(q["d"][name][complete]) for q in chain])))
    inc = np.diff(ser)
    lag1 = np.corrcoef(inc[:-1], inc[1:])[0, 1]
    rate, se, rr = ols(t, ser)
    m = np.array([dt.date.fromisoformat(s) <= dt.date(2026, 8, 22) for s in dates])
    r2 = ols(t[m], ser[m])[0]
    sp = np.mean([q["std"][name] for q in chain])
    rows[name] = dict(spatial_sd_mm=round(float(sp), 2), jump_sd_mm=round(float(inc.std()), 2), lag1=round(float(lag1), 2), resid_mm=round(float(rr), 2),
                      rate=round(float(rate), 2), sigma=round(float(se), 2), rate_to_aug22=round(float(r2), 2))
    print(f"{name:14s} {sp:13.2f} {inc.std():10.2f} {lag1:6.2f} {rr:8.2f} {rate:8.2f} +/-{se:4.2f} {r2:14.2f}")
json.dump(dict(dates=dates, variants=rows), open(f"{ROOT}/data/processed/cache/nisar_noise_test.json", "w"), indent=1)
