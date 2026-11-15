"""Write data/processed/groundwater_summary.json for the website from groundwater_vs_sinking.json (src/groundwater_vs_sinking.py).
Usage: python export_groundwater.py"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = f"{ROOT}/data/processed"
r = json.load(open(f"{P}/groundwater_vs_sinking.json"))
b = r["bins"]
out = dict(wells=r["n_wells"], decline_ft_yr=r["median_decline_ft_yr"], total_drop_ft=r["median_total_drop_ft"], years=r["median_years"], share_deeper_pct=round(r["share_deeper"] * 100),
           rho=r["spearman"], rho_lo=r["ci95"][0], rho_hi=r["ci95"][1], tiles=r["tiles"],
           q=[dict(lo=x["decline_range_ft_yr"][0], hi=x["decline_range_ft_yr"][1], n=x["n"], rate=x["median_rate"], sinking_pct=round(x["share_sinking"] * 100)) for x in b],
           ratio_pct=None if r["sinking_to_decline_ratio"] is None else round(r["sinking_to_decline_ratio"] * 100, 1),
           baseline_from=r["baseline_years"][0], baseline_to=r["baseline_years"][1], recent_from=int(r["recent_years"][0]), recent_to=int(r["recent_years"][1]),
           source="USGS Water Data OGC API (parameter 72019, incl. ADWR measurements) and ADWR Groundwater Site Inventory; Sentinel-1 OPERA DISP-S1")
json.dump(out, open(f"{P}/groundwater_summary.json", "w"), indent=1)
print(json.dumps(out, indent=1))
