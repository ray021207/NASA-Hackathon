"""Surface soils of each study area from the USDA NRCS Soil Survey (SSURGO) via Soil Data Access (SDA).

SDA times out on large polygons, so each study box is sampled with points: `n` random points in the whole box and `n` random
points inside the sinking zone (the red pixels of rate_<slug>.png). Each point returns its soil map unit (mukey); the map units'
components, horizons, restrictions, landforms and ecological sites are then read from SDA and combined, weighting every sample
point equally and sharing its weight across the map unit's components by their percentage (comppct_r).

Output: data/processed/soils.json. Soils here are the surface soils (top ~2 m) described by the soil survey. They are NOT the
aquifer layers (those come from the USGS reports, see geology.json) and SSURGO holds no microbial or biological-crust data.
Usage: python src/soils_nrcs.py [points_per_set]     (needs network; about 10 minutes)
"""
import json, os, random, re, sys, time, urllib.request, urllib.error
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import export_web  # noqa: E402

SDA = "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest"
N = int(sys.argv[1]) if len(sys.argv) > 1 else 90


def sda(q, tries=4):
    body = json.dumps({"query": q, "format": "json+columnname"}).encode()
    for k in range(tries):
        try:
            req = urllib.request.Request(SDA, data=body, headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=120) as r:
                d = json.loads(r.read().decode())
            tbl = d.get("Table")
            if not tbl:
                return []
            head = tbl[0]
            return [dict(zip(head, row)) for row in tbl[1:]]
        except Exception as e:  # network hiccup or timeout: retry
            time.sleep(1.5 * (k + 1))
    return None


def f(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def in_list(vals):
    return ",".join("'%s'" % v for v in vals)


def points_for(h):
    w, s, e, n = h["bbox"]
    rng = random.Random(hash(h["id"]) % 10**6 + 7)
    box = [(rng.uniform(w, e), rng.uniform(s, n)) for _ in range(N)]
    zone = []
    meta = json.load(open(f"{ROOT}/data/processed/rate_{h['id']}.json"))
    (S, W), (Nn, E) = meta["bounds"]
    png = Image.open(f"{ROOT}/data/processed/rate_{h['id']}.png").convert("RGBA")
    a = np.asarray(png).astype(int)
    mask = (a[..., 3] > 40) & (a[..., 0] > a[..., 2] + 20)     # red, opaque = sinking
    ys, xs = np.nonzero(mask)
    if len(ys) >= 30:
        idx = [rng.randrange(len(ys)) for _ in range(N)]
        for i in idx:
            lon = W + (xs[i] + rng.random()) / png.width * (E - W)
            lat = Nn - (ys[i] + rng.random()) / png.height * (Nn - S)
            zone.append((lon, lat))
    return box, zone, int(mask.sum())


def mukeys(pts):
    def one(p):
        r = sda("SELECT mukey FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('point(%.6f %.6f)')" % p)
        return str(r[0]["mukey"]) if r else None
    with ThreadPoolExecutor(4) as ex:
        return list(ex.map(one, pts))


def chunks(seq, k=80):
    seq = list(seq)
    return [seq[i:i + k] for i in range(0, len(seq), k)]


def fetch_tables(mus):
    out = {"mapunit": [], "component": [], "horizon": [], "restr": [], "eco": [], "geo": [], "tex": []}
    for ch in chunks(mus):
        L = in_list(ch)
        out["mapunit"] += sda(f"SELECT mukey, musym, muname, mukind FROM mapunit WHERE mukey IN ({L})") or []
        out["component"] += sda(f"SELECT mukey, cokey, compname, comppct_r, majcompflag, taxorder, taxsuborder, taxgrtgroup, taxsubgrp, taxclname, taxtempregime, taxmoistscl, drainagecl, hydgrp, slope_r, runoff, erocl, elev_r FROM component WHERE mukey IN ({L})") or []
    cok = sorted({c["cokey"] for c in out["component"]})
    for ch in chunks(cok, 70):
        L = in_list(ch)
        out["horizon"] += sda(f"SELECT cokey, chkey, hzname, hzdept_r, hzdepb_r, sandtotal_r, silttotal_r, claytotal_r, om_r, ph1to1h2o_r, ec_r, sar_r, caco3_r, gypsum_r, cec7_r, awc_r, ksat_r FROM chorizon WHERE cokey IN ({L})") or []
        out["restr"] += sda(f"SELECT cokey, reskind, reshard, resdept_r, resdepb_r FROM corestrictions WHERE cokey IN ({L})") or []
        out["eco"] += sda(f"SELECT cokey, ecoclassid, ecoclassname, ecoclasstypename FROM coecoclass WHERE cokey IN ({L})") or []
        out["geo"] += sda(f"SELECT cokey, geomfname, geomftname FROM cogeomordesc WHERE cokey IN ({L}) AND rvindicator = 'Yes'") or []
    chk = sorted({h["chkey"] for h in out["horizon"] if h["hzdept_r"] in ("0", 0, None, "") or f(h["hzdept_r"]) == 0.0})
    for ch in chunks(chk, 80):
        out["tex"] += sda(f"SELECT t.chkey, t.texture, t.texdesc FROM chtexturegrp t WHERE t.rvindicator = 'Yes' AND t.chkey IN ({in_list(ch)})") or []
    return out


def layer_mean(hzs, top, bot, key):
    num = den = 0.0
    for h in hzs:
        v = f(h.get(key)); t, b = f(h["hzdept_r"]), f(h["hzdepb_r"])
        if v is None or t is None or b is None:
            continue
        ov = min(b, bot) - max(t, top)
        if ov > 0:
            num += v * ov; den += ov
    return num / den if den else None


PROPS = [("clay_pct", "claytotal_r"), ("silt_pct", "silttotal_r"), ("sand_pct", "sandtotal_r"), ("organic_matter_pct", "om_r"), ("ph", "ph1to1h2o_r"),
         ("ec_dS_m", "ec_r"), ("sar", "sar_r"), ("caco3_pct", "caco3_r"), ("gypsum_pct", "gypsum_r"), ("cec_meq_100g", "cec7_r"),
         ("awc_cm_cm", "awc_r"), ("ksat_um_s", "ksat_r")]


def summarise(samples, tables):
    mu = {m["mukey"]: m for m in tables["mapunit"]}
    comps = defaultdict(list)
    for c in tables["component"]:
        comps[c["mukey"]].append(c)
    hz = defaultdict(list)
    for h in tables["horizon"]:
        hz[h["cokey"]].append(h)
    tex = {t["chkey"]: t for t in tables["tex"]}
    restr, eco, geo = defaultdict(list), defaultdict(list), defaultdict(list)
    for r in tables["restr"]:
        restr[r["cokey"]].append(r)
    for r in tables["eco"]:
        eco[r["cokey"]].append(r)
    for r in tables["geo"]:
        geo[r["cokey"]].append(r)
    n_total = len(samples)
    covered = [m for m in samples if m and m in comps]
    share = defaultdict(float)                # keyed shares, each point contributes weight 1 spread over its components
    cats = {k: defaultdict(float) for k in ("order", "suborder", "greatgroup", "mapunit", "landform", "ecosite", "drainage", "hydgrp", "temp", "moisture", "restriction", "texture0")}
    acc = {(p, layer): [0.0, 0.0] for p, _ in PROPS for layer in ("0-30", "30-100")}
    slopes, depths = [], []
    for m in covered:
        cs = comps[m]
        tot = sum(f(c["comppct_r"]) or 0 for c in cs) or 1.0
        for c in cs:
            w = (f(c["comppct_r"]) or 0) / tot
            if w <= 0:
                continue
            cats["order"][c["taxorder"] or "unclassified / miscellaneous area"] += w
            if c["taxsuborder"]:
                cats["suborder"][c["taxsuborder"]] += w
            if c["taxgrtgroup"]:
                cats["greatgroup"][c["taxgrtgroup"]] += w
            cats["mapunit"][mu[m]["muname"]] += w
            if c["drainagecl"]:
                cats["drainage"][c["drainagecl"]] += w
            if c["hydgrp"]:
                cats["hydgrp"][c["hydgrp"]] += w
            if c["taxtempregime"]:
                cats["temp"][c["taxtempregime"]] += w
            if c["taxmoistscl"]:
                cats["moisture"][c["taxmoistscl"]] += w
            for g in geo.get(c["cokey"], [])[:1]:
                cats["landform"][g["geomfname"]] += w
            for e in eco.get(c["cokey"], [])[:1]:
                cats["ecosite"][(e["ecoclassname"] or e["ecoclassid"])] += w
            rs = restr.get(c["cokey"], [])
            if rs:
                for r in rs[:1]:
                    cats["restriction"][r["reskind"]] += w
                    d = f(r["resdept_r"])
                    if d is not None:
                        depths.append((d, w))
            else:
                cats["restriction"]["none recorded"] += w
            sl = f(c["slope_r"])
            if sl is not None:
                slopes.append((sl, w))
            top = sorted(hz.get(c["cokey"], []), key=lambda h: f(h["hzdept_r"]) or 0)
            if top:
                t0 = tex.get(top[0]["chkey"])
                if t0 and t0["texdesc"]:
                    cats["texture0"][t0["texdesc"]] += w
            for p, key in PROPS:
                for layer, (a0, a1) in (("0-30", (0, 30)), ("30-100", (30, 100))):
                    v = layer_mean(hz.get(c["cokey"], []), a0, a1, key)
                    if v is not None:
                        acc[(p, layer)][0] += v * w; acc[(p, layer)][1] += w
    def top(d, k=6):
        tot = sum(d.values()) or 1.0
        return [{"name": n, "pct": round(100 * v / tot, 1)} for n, v in sorted(d.items(), key=lambda kv: -kv[1])[:k]]
    props = {}
    for (p, layer), (num, den) in acc.items():
        props.setdefault(p, {})[layer] = round(num / den, 2) if den else None
    wmean = lambda xs: round(sum(v * w for v, w in xs) / sum(w for _, w in xs), 1) if xs else None
    return {"points": n_total, "points_with_soil_data": len(covered),
            "orders": top(cats["order"]), "suborders": top(cats["suborder"]), "great_groups": top(cats["greatgroup"], 8),
            "map_units": top(cats["mapunit"], 8), "landforms": top(cats["landform"], 6), "ecological_sites": top(cats["ecosite"], 6),
            "drainage": top(cats["drainage"], 5), "hydrologic_group": top(cats["hydgrp"], 4), "temperature_regime": top(cats["temp"], 3),
            "moisture_regime": top(cats["moisture"], 3), "restrictive_layers": top(cats["restriction"], 5), "surface_texture": top(cats["texture0"], 6),
            "properties_weighted_mean": props, "slope_pct_mean": wmean(slopes), "restriction_depth_cm_mean": wmean(depths)}


def main():
    out = {"source": "USDA NRCS Soil Survey (SSURGO) via Soil Data Access (sdmdataaccess.sc.egov.usda.gov), point sampling; queried " + time.strftime("%Y-%m-%d"),
           "source_url": "https://sdmdataaccess.sc.egov.usda.gov/",
           "note": "Surface soils (top about 2 m) as mapped by the soil survey; not the aquifer layers. Each study area was sampled with random points (%d in the whole box, %d in the sinking zone). SSURGO has no microbial or biological-crust data." % (N, N), "areas": {}}
    for h in export_web.HOTSPOTS:
        t0 = time.time()
        box, zone, zone_px = points_for(h)
        print(h["id"], "sampling", len(box), "box +", len(zone), "zone points", flush=True)
        mk_box, mk_zone = mukeys(box), mukeys(zone) if zone else []
        allm = sorted({m for m in mk_box + mk_zone if m})
        print("  unique map units:", len(allm), flush=True)
        tables = fetch_tables(allm)
        entry = {"box": summarise(mk_box, tables), "sinking_zone": summarise(mk_zone, tables) if zone else None, "sinking_zone_pixels": zone_px}
        out["areas"][h["id"]] = entry
        print("  done in %.0fs; covered box %d/%d zone %s" % (time.time() - t0, entry["box"]["points_with_soil_data"], len(box), (entry["sinking_zone"] or {}).get("points_with_soil_data")), flush=True)
        json.dump(out, open(f"{ROOT}/data/processed/soils.json", "w"), indent=1)
    print("saved data/processed/soils.json")


if __name__ == "__main__":
    main()
