"""Write data/processed/pumping_summary.json for the website from pumping_vs_sinking.json (src/pumping_vs_sinking.py).
Usage: python export_pumping.py"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = f"{ROOT}/data/processed"
r = json.load(open(f"{P}/pumping_vs_sinking.json"))
nb, fs = r["neighbourhood"], r["field_scale"]
bins = {b["label"]: b for b in nb["bins"]}
cov = r["coverage_by_crop"]
grains = [v for k, v in cov.items() if k in ("SG", "ALF", "CV", "CRNS", "CRNU", "COT")]
out = dict(
    fields=r["n_fields"], acres=r["acres_total"], withdrawal_acre_ft=r["withdrawal_total_acre_ft"],
    rate_none=bins["no field within 2 km"]["median_rate"], rate_low=bins["low pumping density"]["median_rate"], rate_medium=bins["medium pumping density"]["median_rate"],
    rate_high=bins["high pumping density"]["median_rate"], radius_km=nb["radius_km"],
    rho=nb["spearman_pumping_vs_rate"], rho_lo=nb["ci95_pumping"][0], rho_hi=nb["ci95_pumping"][1],
    rho_in=nb["spearman_within_pumped_area"], rho_in_lo=nb["ci95_within_pumped_area"][0], rho_in_hi=nb["ci95_within_pumped_area"][1],
    rho_acres=nb["spearman_acreage_vs_rate"], partial=nb["partial_pumping_given_acreage"], partial_lo=nb["ci95_partial"][0], partial_hi=nb["ci95_partial"][1],
    field_n=fs["n"], field_rho=fs["spearman_depth_vs_rate"], field_lo=fs["ci95"][0], field_hi=fs["ci95"][1],
    field_coherent_pct=round(100 * r["n_fields_with_rate"] / r["n_fields"]),
    rowcrop_fields=sum(v["fields"] for v in grains), rowcrop_with_rate=sum(v["with_rate"] for v in grains),
    source="USGS data release, Estimated crop irrigation water use withdrawals in Willcox Groundwater Basin, Arizona for 2024, DOI 10.5066/P1ZU6T5N (CC0)",
)
json.dump(out, open(f"{P}/pumping_summary.json", "w"), indent=1)
print(json.dumps(out, indent=1))
