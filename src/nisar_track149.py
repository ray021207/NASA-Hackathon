"""Read the Willcox window from every GUNW pair of NISAR track 149 (ascending, frame 18) over HTTPS and cache the corrected, referenced
line-of-sight displacement per pair: ionosphere screen and NISAR hydrostatic + wet troposphere screens subtracted (same recipe as track 128 D),
reference = median of the 5 km circle at the Dragoon Mountains (hand-picked, UNVERIFIED), coherence >= 0.4.
Only Provisional pairs (CRID P) are used; the lone Beta pair (Nov 2025) is isolated by a gap and is skipped.
Output: data/processed/cache/tracks/149A_18/<ref>_<sec>.npz.   Usage: python nisar_track149.py"""
import os, re, time, numpy as np, asf_search as asf, h5py
from gcov_remote import RangeFile, session, ROOT
from gunw import read_window, ref_median
import corrections as C
BOX = (-110.1, 31.9, -109.6, 32.4)
REF = (-109.98, 31.95)
WKT = "POLYGON((-110.1 31.9, -109.6 31.9, -109.6 32.4, -110.1 32.4, -110.1 31.9))"
OUT = f"{ROOT}/data/processed/cache/tracks/149A_18"
os.makedirs(OUT, exist_ok=True)
res = asf.search(dataset=asf.DATASET.NISAR, processingLevel="GUNW", intersectsWith=WKT, maxResults=300)
pairs = {}
for r in res:
    if (r.properties["pathNumber"], r.properties["frameNumber"]) != (149, 18):
        continue
    n = r.properties["fileName"]
    a, b = re.search(r"_(\d{8})T\d+_\d{8}T\d+_(\d{8})T", n).groups()
    crid = re.search(r"_([PX]\d{5})_", n).group(1)
    if crid[0] == "P":
        pairs[(a, b)] = r
dem = C.dem_for_box(BOX, "willcox")
sess = session()
for (a, b), r in sorted(pairs.items()):
    path = f"{OUT}/{a}_{b}.npz"
    if os.path.exists(path):
        continue
    t0 = time.time()
    rf = RangeFile(r.properties["url"], sess)
    f = h5py.File(rf, "r")
    w = read_window(f, BOX, dem=dem)
    inc = float(np.nanmedian(f["science/LSAR/GUNW/metadata/radarGrid/incidenceAngle"][10]))
    f.close()
    ref, nref = ref_median(w, REF, 5.0)
    np.savez_compressed(path, d=(w["disp_mm"] - ref).astype("float32"), x=w["x"], y=w["y"], epsg=w["epsg"], ref_date=w["ref_date"], sec_date=w["sec_date"],
                        days=w["temporal_days"], nref=nref, incidence=inc, granule=r.properties["fileName"])
    print(f"{a}->{b}: valid {np.isfinite(w['disp_mm']).mean()*100:.0f}%, ref px {nref}, {rf.bytes/1e6:.0f} MB, {time.time()-t0:.0f} s", flush=True)
print("done", len(os.listdir(OUT)), "pairs")
