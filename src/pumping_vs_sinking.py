"""Does estimated crop pumping line up with where the ground sinks? Willcox groundwater basin.
Pumping: USGS data release "Estimated crop irrigation water use withdrawals in Willcox Groundwater Basin, Arizona for 2024" (DOI 10.5066/P1ZU6T5N): one polygon per field,
I_WdrwlT = modelled irrigation withdrawal (acre-feet per year, modified Blaney-Criddle consumptive-use model, no stated uncertainty), all fields groundwater (H2O_type GW).
Sinking: Sentinel-1 OPERA DISP-S1 rate, 2016-2026, line of sight, cm/yr (negative = sinking), at 30 m (field scale) and on the 300 m map (neighbourhood scale).
Three tests, each ending in a number:
  A. Field scale: do fields with more modelled pumping per acre sit on faster-sinking ground?
  B. Neighbourhood scale: is the sinking rate related to the pumping density within 2 km? (subsidence follows regional drawdown, not single fields)
  C. Control: does the modelled pumping say more than irrigated ACREAGE alone?
Uncertainty by block bootstrap over 5 km tiles (nearby cells are not independent). Association only: this cannot show cause, the pumping is a 2024 model estimate, and
the sinking rate is a ten-year average.   Output: data/processed/pumping_vs_sinking.json, docs/pumping_vs_sinking_willcox.png.   Usage: python pumping_vs_sinking.py"""
import json, os, zipfile, numpy as np, shapefile
import defusedxml.ElementTree as ET        # the metadata XML is a downloaded file: parse it with the hardened parser
from shapely.geometry import shape
from rasterio import features
from affine import Affine
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = f"{ROOT}/data/processed"
SHP = f"{ROOT}/data/raw/usgs_2024/extracted/WX_2024_est_FV_wthdrwls_crop"
rng = np.random.default_rng(11)

# ---- crop code names straight from the release's metadata
cropname = {}
for attr in ET.parse(f"{ROOT}/data/raw/usgs_2024/WX_2024.shp.xml").getroot().iter("attr"):
    if attr.findtext("attrlabl") == "Crop1":
        for ed in attr.iter("edom"):
            cropname[ed.findtext("edomv")] = (ed.findtext("edomvd") or "").strip()
r = shapefile.Reader(SHP)
names = [f[0] for f in r.fields[1:]]
fields = []
for sr in r.shapeRecords():
    rec = dict(zip(names, sr.record))
    if rec["Year"] != "2024" or not (rec["Acres"] or 0) > 0:
        continue
    g = shape(sr.shape.__geo_interface__)
    fields.append(dict(rec, geom=g, cx=g.centroid.x, cy=g.centroid.y, wd=float(rec["I_WdrwlT"] or 0)))
print(len(fields), "fields in 2024;", f"{sum(f['Acres'] for f in fields):,.0f} acres; {sum(f['wd'] for f in fields):,.0f} acre-ft/yr modelled irrigation withdrawal")

# ---- A. field scale, 30 m rates
z = np.load(f"{P}/cache/opera30_f34478.npz")
rate30, x30, y30 = z["rate"], z["x"], z["y"]
tf = Affine(30, 0, x30[0] - 15, 0, -30, y30[0] + 15)
rows = []
for i, f in enumerate(fields):
    g = f["geom"].buffer(-30)                      # keep a one-pixel margin so edge pixels do not mix with the surroundings
    if g.is_empty:
        g = f["geom"]
    m = features.rasterize([(g, 1)], out_shape=rate30.shape, transform=tf, fill=0, dtype="uint8").astype(bool)
    v = rate30[m]
    v = v[np.isfinite(v)]
    if v.size >= 15:
        rows.append(dict(i=i, rate=float(np.median(v)), n=int(v.size), acres=f["Acres"], wd=f["wd"], depth=f["wd"] / f["Acres"], crop=f["Crop1"], cx=f["cx"], cy=f["cy"]))
print(f"fields with at least 15 valid 30 m pixels: {len(rows)} of {len(fields)} ({len(rows)/len(fields)*100:.0f}%)")
cov = {}
for i, f in enumerate(fields):
    c = cov.setdefault(f["Crop1"], [0, 0, 0.0])
    c[0] += 1
for q_ in rows:
    cov[fields[q_["i"]]["Crop1"]][1] += 1
for f in fields:
    cov[f["Crop1"]][2] += f["Acres"]
coverage_by_crop = {c: dict(name=cropname.get(c, c)[:40], fields=v[0], with_rate=v[1], share=round(v[1] / v[0], 2), acres=round(v[2])) for c, v in sorted(cov.items(), key=lambda kv: -kv[1][0]) if v[0] >= 10}
print("share of fields that kept a 30 m rate, by crop:", {c: (v["fields"], v["share"]) for c, v in coverage_by_crop.items()})
res = dict(coverage_by_crop=coverage_by_crop, n_fields=len(fields), acres_total=round(sum(f["Acres"] for f in fields)), withdrawal_total_acre_ft=round(sum(f["wd"] for f in fields)), n_fields_with_rate=len(rows))


from scipy.stats import rankdata


def rank(a):
    return rankdata(a, method="average")      # ties get the average rank (80% of blocks have exactly zero pumping)


def spearman(a, b):
    return float(np.corrcoef(rank(a), rank(b))[0, 1])


def tiles_boot(cx, cy, stat, n=1500, km=5):
    tid = (np.floor(cx / (km * 1000)) * 10000 + np.floor(cy / (km * 1000))).astype(int)
    tl = np.unique(tid)
    groups = {t: np.flatnonzero(tid == t) for t in tl}
    out = []
    for _ in range(n):
        idx = np.concatenate([groups[t] for t in rng.choice(tl, len(tl))])
        out.append(stat(idx))
    return [round(float(np.percentile(out, 2.5)), 2), round(float(np.percentile(out, 97.5)), 2)], int(len(tl))


if len(rows) >= 30:
    rt = np.array([q["rate"] for q in rows]); dp = np.array([q["depth"] for q in rows]); wdv = np.array([q["wd"] for q in rows]); ac = np.array([q["acres"] for q in rows])
    cx = np.array([q["cx"] for q in rows]); cy = np.array([q["cy"] for q in rows])
    pump = dp > 0
    rho_dp = spearman(dp[pump], rt[pump])
    ci_dp, ntil = tiles_boot(cx[pump], cy[pump], lambda idx: spearman(dp[pump][idx], rt[pump][idx]))
    qs = np.quantile(dp[pump], [0, .25, .5, .75, 1])
    quart = []
    for k in range(4):
        m = pump & (dp >= qs[k]) & (dp <= qs[k + 1] if k == 3 else dp < qs[k + 1])
        quart.append(dict(depth_range_ft=[round(float(qs[k]), 2), round(float(qs[k + 1]), 2)], n=int(m.sum()), median_rate=round(float(np.median(rt[m])), 2)))
    res["field_scale"] = dict(n=int(pump.sum()), spearman_depth_vs_rate=round(rho_dp, 3), ci95=ci_dp, tiles=ntil, depth_quartiles=quart,
                              spearman_total_vs_rate=round(spearman(wdv[pump], rt[pump]), 3), median_rate_all=round(float(np.median(rt)), 2))
    print("A. field scale: Spearman(withdrawal depth per acre, field rate) =", res["field_scale"]["spearman_depth_vs_rate"], "95% CI", ci_dp, f"({ntil} 5-km tiles) | by depth quartile:", [(q['depth_range_ft'], q['n'], q['median_rate']) for q in quart])
    # crop groups
    groups = {}
    for q in rows:
        groups.setdefault(q["crop"], []).append(q["rate"])
    res["by_crop"] = {c: dict(name=cropname.get(c, c), n=len(v), median_rate=round(float(np.median(v)), 2)) for c, v in sorted(groups.items(), key=lambda kv: -len(kv[1])) if len(v) >= 10}
    print("by crop (n >= 10):", {c: (v["name"][:22], v["n"], v["median_rate"]) for c, v in res["by_crop"].items()})

# ---- B and C. neighbourhood scale on the 300 m Sentinel-1 map
cube = np.load(f"{P}/cache/scan_southeast.npz")
sx, sy, srate = cube["x"], cube["y"], cube["rate"]
SX, SY = np.meshgrid(sx, sy)
inwin = (SX > 587900) & (SX < 645100) & (SY > 3525000) & (SY < 3603400) & np.isfinite(srate)
bx, by, br = SX[inwin], SY[inwin], srate[inwin]
fx = np.array([f["cx"] for f in fields]); fy = np.array([f["cy"] for f in fields])
fwd = np.array([f["wd"] for f in fields]); fac = np.array([f["Acres"] for f in fields])
R = 2000.0
dens_wd = np.zeros(len(bx)); dens_ac = np.zeros(len(bx))
for j in range(0, len(bx), 4000):
    sl = slice(j, j + 4000)
    d2 = (bx[sl, None] - fx[None, :]) ** 2 + (by[sl, None] - fy[None, :]) ** 2
    w = d2 <= R * R
    dens_wd[sl] = (w * fwd[None, :]).sum(1) / (np.pi * (R / 1000) ** 2)       # acre-ft per year per km2
    dens_ac[sl] = (w * fac[None, :]).sum(1) / (np.pi * (R / 1000) ** 2)       # acres per km2
print("neighbourhood blocks:", len(br), "| with any pumping within 2 km:", int((dens_wd > 0).sum()))
rho_wd = spearman(dens_wd, br); rho_ac = spearman(dens_ac, br)
ci_wd, nt = tiles_boot(bx, by, lambda idx: spearman(dens_wd[idx], br[idx]))
ci_ac, _ = tiles_boot(bx, by, lambda idx: spearman(dens_ac[idx], br[idx]))
# does the modelled pumping add information beyond acreage? partial rank correlation of rate with pumping, controlling for acreage
ra, rw, rr = rank(dens_ac).astype(float), rank(dens_wd).astype(float), rank(br).astype(float)
def partial(x, y, z):
    ex = x - np.polyval(np.polyfit(z, x, 1), z); ey = y - np.polyval(np.polyfit(z, y, 1), z); return float(np.corrcoef(ex, ey)[0, 1])
pw = partial(rw, rr, ra)
ci_pw, _ = tiles_boot(bx, by, lambda idx: partial(rw[idx], rr[idx], ra[idx]))
q = np.quantile(dens_wd[dens_wd > 0], [0, 1 / 3, 2 / 3, 1])
bins = [dict(label="no field within 2 km", n=int((dens_wd == 0).sum()), median_rate=round(float(np.median(br[dens_wd == 0])), 2))]
for k, nm in enumerate(("low", "medium", "high")):
    m = (dens_wd > 0) & (dens_wd >= q[k]) & (dens_wd <= q[k + 1] if k == 2 else dens_wd < q[k + 1])
    bins.append(dict(label=f"{nm} pumping density", range_acre_ft_per_km2=[round(float(q[k])), round(float(q[k + 1]))], n=int(m.sum()), median_rate=round(float(np.median(br[m])), 2)))
inarea = dens_wd > 0
rho_in = spearman(dens_wd[inarea], br[inarea])
ci_in, _ = tiles_boot(bx[inarea], by[inarea], lambda idx: spearman(dens_wd[inarea][idx], br[inarea][idx]))
print(f"   within the pumped area only (any field within 2 km, {int(inarea.sum())} blocks): Spearman = {rho_in:.3f} (95% {ci_in})")
res["neighbourhood"] = dict(spearman_within_pumped_area=round(rho_in, 3), ci95_within_pumped_area=ci_in, n_blocks_pumped_area=int(inarea.sum()), radius_km=R / 1000, n_blocks=int(len(br)), spearman_pumping_vs_rate=round(rho_wd, 3), ci95_pumping=ci_wd, spearman_acreage_vs_rate=round(rho_ac, 3), ci95_acreage=ci_ac,
                            partial_pumping_given_acreage=round(pw, 3), ci95_partial=ci_pw, tiles=nt, bins=bins)
print(f"B. within 2 km: Spearman(pumping density, rate) = {rho_wd:.3f} (95% {ci_wd}) | acreage alone {rho_ac:.3f} (95% {ci_ac}) | pumping given acreage {pw:.3f} (95% {ci_pw})")
print("   median rate by pumping density:", [(b["label"], b["n"], b["median_rate"]) for b in bins])
json.dump(res, open(f"{P}/pumping_vs_sinking.json", "w"), indent=1)

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
fig, ax = plt.subplots(1, 2, figsize=(11, 4.2))
ax[0].bar([b["label"].replace(" pumping density", "\npumping").replace("no field within 2 km", "no field\nwithin 2 km") for b in bins], [b["median_rate"] for b in bins], color=["#999", "#fddbc7", "#ef8a62", "#b2182b"])
ax[0].axhline(0, color="#666", lw=.8)
ax[0].set_ylabel("Sentinel-1 rate, 2016-2026 (cm/yr, median)")
ax[0].set_title("Sinking vs pumping within 2 km (300 m blocks)")
if "field_scale" in res:
    labs = [f"{q_['depth_range_ft'][0]:.1f}-{q_['depth_range_ft'][1]:.1f} ft\n(n={q_['n']})" for q_ in res["field_scale"]["depth_quartiles"]]
    ax[1].bar(labs, [q_["median_rate"] for q_ in res["field_scale"]["depth_quartiles"]], color="#2166ac")
    ax[1].axhline(0, color="#666", lw=.8)
    ax[1].set_title("Fields by modelled pumping depth per year")
    ax[1].set_ylabel("Median field rate (cm/yr)")
fig.tight_layout()
fig.savefig(f"{ROOT}/docs/pumping_vs_sinking_willcox.png", dpi=130)
print("saved")
