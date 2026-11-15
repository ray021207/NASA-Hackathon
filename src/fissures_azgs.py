"""Mapped earth fissures inside each study box, from the Arizona Geological Survey (AZGS) fissure maps.

Input (not committed, data/raw is gitignored): the GeoJSON files the AZGS published with its Earth Fissure Viewer,
  https://github.com/azgs/EarthFissureViewer/tree/gh-pages/data  (earth_fissures.json, earth_fissure_study_areas.json)
The repository is marked obsolete by AZGS (last updated 2016-02-04); current maps are on the AZGS Natural Hazards viewer.
So these are the fissures mapped up to about 2016. A place with no mapped fissure is not proof that none exist.

Output: data/processed/fissures_summary.json, per study box: kilometres of mapped fissure by AZGS class
(continuous, discontinuous, reported/unconfirmed) and the AZGS study areas they belong to.
Lengths: line segments clipped to the box (Liang-Barsky), great-circle length (haversine, R = 6371.0088 km).
Usage: python src/fissures_azgs.py
"""
import json, math, os, sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = f"{ROOT}/data/raw/geology/azgs_fissures"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import export_web  # noqa: E402  (study boxes)

CONFIRMED = ("Continuous earth fissure", "Discontinuous earth fissure")


def haversine_km(a, b):
    (lo1, la1), (lo2, la2) = a, b
    p1, p2 = math.radians(la1), math.radians(la2)
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lo2 - lo1) / 2) ** 2
    return 2 * 6371.0088 * math.asin(math.sqrt(h))


def clip(p, q, box):
    (x0, y0), (x1, y1) = p, q
    w, s, e, n = box
    t0, t1, dx, dy = 0.0, 1.0, x1 - x0, y1 - y0
    for pp, qq in ((-dx, x0 - w), (dx, e - x0), (-dy, y0 - s), (dy, n - y0)):
        if pp == 0:
            if qq < 0:
                return None
        else:
            t = qq / pp
            if pp < 0:
                t0 = max(t0, t)
            else:
                t1 = min(t1, t)
            if t0 > t1:
                return None
    return (x0 + t0 * dx, y0 + t0 * dy), (x0 + t1 * dx, y0 + t1 * dy)


def rings(g):
    return [g["coordinates"][0]] if g["type"] == "Polygon" else [poly[0] for poly in g["coordinates"]]


def inside(pt, ring):
    x, y, c = pt[0], pt[1], False
    for (xa, ya), (xb, yb) in zip((r[:2] for r in ring[:-1]), (r[:2] for r in ring[1:])):
        if (ya > y) != (yb > y) and x < (xb - xa) * (y - ya) / (yb - ya) + xa:
            c = not c
    return c


def main():
    areas = json.load(open(f"{RAW}/earth_fissure_study_areas.json"))["features"]
    fissures = json.load(open(f"{RAW}/earth_fissures.json"))["features"]

    def study_area(pt):
        for a in areas:
            if any(inside(pt, r) for r in rings(a["geometry"])):
                return a["properties"]["Label"]
        return None

    out = {"source": "Arizona Geological Survey earth fissure maps, as published with its Earth Fissure Viewer (data last updated 2016-02-04)",
           "source_url": "https://github.com/azgs/EarthFissureViewer",
           "current_maps_url": "https://azgs.arizona.edu/earth-fissure-study-areas-arizona",
           "note": "Kilometres of mapped fissure inside each study box. Confirmed = continuous + discontinuous; reported = reported, unconfirmed. "
                   "Mapping covers AZGS study areas up to about 2016; a place with no mapped fissure is not proof that none exist.",
           "areas": {}}
    for h in export_web.HOTSPOTS:
        w, s, e, n = h["bbox"]
        by_class, by_area = defaultdict(float), defaultdict(float)
        for f in fissures:
            cs, length, first = f["geometry"]["coordinates"], 0.0, None
            for p, q in zip(cs[:-1], cs[1:]):
                c = clip(p[:2], q[:2], (w, s, e, n))
                if c:
                    length += haversine_km(*c)
                    first = first or c[0]
            if length > 0:
                by_class[f["properties"]["Label"]] += length
                name = study_area(first)
                if name:
                    by_area[name] += length
        confirmed = sum(by_class[k] for k in CONFIRMED)
        out["areas"][h["id"]] = {"km_total": round(sum(by_class.values()), 1), "km_confirmed": round(confirmed, 1),
                                 "km_reported": round(by_class["Reported, unconfirmed earth fissure"], 1),
                                 "azgs_study_areas": [k for k, _ in sorted(by_area.items(), key=lambda kv: -kv[1]) if by_area[k] >= 0.5]}
        print(h["id"], out["areas"][h["id"]])
    json.dump(out, open(f"{ROOT}/data/processed/fissures_summary.json", "w"), indent=1)
    print("saved data/processed/fissures_summary.json")


if __name__ == "__main__":
    main()
