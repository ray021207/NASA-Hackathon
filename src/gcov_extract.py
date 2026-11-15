"""Extract NISAR GCOV backscatter (HH and HV, gamma0 linear power) over the Willcox box for every acquisition of track 128 D frame 72,
reading only the window over HTTPS (src/gcov_remote.py): about tens of MB per date instead of a 7 GB file.
Each date is averaged from the 10 m grid into 80 m cells IN LINEAR POWER, using only valid samples (mask in 1..254), and cached in
data/processed/cache/gcov/YYYYMMDD.npz. Re-running skips dates already cached.
Usage: python gcov_extract.py [--max N]"""
import argparse, os, re, sys, time, numpy as np
import asf_search as asf
from pyproj import Transformer
from gcov_remote import open_granule, session, ROOT
BOX = (-110.1, 31.9, -109.6, 32.4)
WKT = "POLYGON((-110.1 31.9, -109.6 31.9, -109.6 32.4, -110.1 32.4, -110.1 31.9))"
F = 8                                   # 10 m -> 80 m
OUT = f"{ROOT}/data/processed/cache/gcov"
os.makedirs(OUT, exist_ok=True)
ap = argparse.ArgumentParser()
ap.add_argument("--max", type=int)
a = ap.parse_args()


def pick(results):
    """One granule per acquisition date: production (P) over early (X), then the highest version suffix."""
    best = {}
    for r in results:
        n = r.properties["fileName"]
        if r.properties["pathNumber"] != 128 or r.properties["frameNumber"] != 72:
            continue
        d = r.properties["startTime"][:10]
        m = re.search(r"_([PX])(\d{5})_.*?_(\d{3})\.h5$", n)
        key = (m.group(1) == "P", m.group(3), m.group(2)) if m else (False, "000", "00000")
        if d not in best or key > best[d][0]:
            best[d] = (key, r)
    return {d: v[1] for d, v in sorted(best.items())}


res = pick(asf.search(dataset=asf.DATASET.NISAR, processingLevel="GCOV", intersectsWith=WKT, maxResults=500))
print(len(res), "acquisition dates;", list(res)[0], "to", list(res)[-1], flush=True)
sess = session()
done = 0
for d, r in res.items():
    tag = d.replace("-", "")
    path = f"{OUT}/{tag}.npz"
    if os.path.exists(path):
        continue
    if a.max and done >= a.max:
        break
    t0 = time.time()
    f, rf = open_granule(r, sess)
    g = f["science/LSAR/GCOV/grids/frequencyA"]
    epsg = int(g["projection"][()])
    x, y = g["xCoordinates"][:], g["yCoordinates"][:]
    tr = Transformer.from_crs(4326, epsg, always_xy=True)
    w, s, e, n = BOX
    xs = [tr.transform(lo, la)[0] for lo in (w, e) for la in (s, n)]
    ys = [tr.transform(lo, la)[1] for lo in (w, e) for la in (s, n)]
    # snap the window to a FIXED 80 m lattice so every date lines up cell for cell
    x0 = np.ceil(min(xs) / 80) * 80
    y1 = np.floor(max(ys) / 80) * 80
    nx = int((max(xs) - x0) // 80)
    ny = int((y1 - min(ys)) // 80)
    ix0 = int(round((x0 + 5 - x[0]) / 10))          # first 10 m pixel whose cell starts at x0 (its centre is x0 + 5)
    iy0 = int(round((y[0] - y1 + 5) / 10))        # first pixel whose cell top edge is y1 (centre y1 - 5; y decreases)
    assert abs(x[ix0] - (x0 + 5)) < 1e-6 and abs(y[iy0] - (y1 - 5)) < 1e-6, (x[ix0], x0, y[iy0], y1)
    sl = (slice(iy0, iy0 + ny * F), slice(ix0, ix0 + nx * F))
    mask = g["mask"][sl]
    valid = (mask > 0) & (mask < 255)
    out = {}
    for pol in ("HHHH", "HVHV"):
        v = g[pol][sl].astype("float64")
        ok = valid & np.isfinite(v) & (v > 0)
        vv = np.where(ok, v, 0).reshape(ny, F, nx, F)
        cnt = ok.reshape(ny, F, nx, F).sum((1, 3))
        out[pol] = np.where(cnt >= F * F // 2, vv.sum((1, 3)) / np.maximum(cnt, 1), np.nan).astype("float32")   # mean linear power
        out[pol + "_n"] = cnt.astype("uint8")
    np.savez_compressed(path, hh=out["HHHH"], hv=out["HVHV"], hh_n=out["HHHH_n"], hv_n=out["HVHV_n"], x0=x0, y1=y1, nx=nx, ny=ny, epsg=epsg,
                        granule=r.properties["fileName"])
    done += 1
    f.close()
    print(f"{d}: {ny}x{nx} cells, valid {np.isfinite(out['HHHH']).mean()*100:.0f}%, {rf.requests} requests, {rf.bytes/1e6:.0f} MB, {time.time()-t0:.0f} s", flush=True)
print("finished; cached dates:", len(os.listdir(OUT)))
