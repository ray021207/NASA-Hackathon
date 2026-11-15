"""Download groundwater-level measurements (depth to water below land surface, parameter 72019, feet) for the Willcox basin area
from the USGS Water Data OGC API (api.waterdata.usgs.gov, collection field-measurements; the legacy NWIS gwlevels service was retired in fall 2025).
It includes measurements by USGS and by the Arizona Department of Water Resources (agency code AZ014). No key needed.
Output: data/raw/groundwater/willcox_72019.json (all features, raw).   Usage: python groundwater_download.py"""
import json, os, time, requests
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = f"{ROOT}/data/raw/groundwater"
os.makedirs(OUT, exist_ok=True)
BBOX = "-110.15,31.85,-109.45,32.60"          # covers the Willcox study box and the USGS irrigated-field area
url = ("https://api.waterdata.usgs.gov/ogcapi/v0/collections/field-measurements/items"
       f"?f=json&bbox={BBOX}&parameter_code=72019&datetime=1980-01-01T00:00:00Z/..&limit=5000")
feats, pages = [], 0
s = requests.Session()
s.headers["User-Agent"] = "subsidence-research-script"
while url:
    for attempt in range(4):
        try:
            r = s.get(url, timeout=120)
            r.raise_for_status()
            break
        except Exception as e:
            if attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))
    d = r.json()
    feats += d.get("features", [])
    pages += 1
    url = next((l["href"] for l in d.get("links", []) if l.get("rel") == "next"), None)
    print(f"page {pages}: {len(d.get('features', []))} rows (total {len(feats)})", flush=True)
json.dump(dict(source="USGS Water Data OGC API, field-measurements, parameter 72019 (depth to water, ft below land surface)", bbox=BBOX,
               downloaded=time.strftime("%Y-%m-%d"), features=feats), open(f"{OUT}/willcox_72019.json", "w"))
print("saved", len(feats), "measurements")
