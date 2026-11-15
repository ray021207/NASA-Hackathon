"""Collect the NISAR results the website shows into ONE small file, data/processed/nisar_summary.json, and copy the comparison figure next to it.
Reads nisar_vs_sentinel1.json (compare_nisar_s1.py), nisar_confirm.json (nisar_when.py) and cache/nisar_noise_test.json (nisar_noise_test.py),
so every number on the page traces back to a script. Re-run those three first if the NISAR data change.
Usage: python export_nisar.py"""
import json, os, shutil
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = f"{ROOT}/data/processed"
cmp_ = json.load(open(f"{P}/nisar_vs_sentinel1.json"))
conf = json.load(open(f"{P}/nisar_confirm.json"))
noise = json.load(open(f"{P}/cache/nisar_noise_test.json"))["variants"]
b, a = noise["iono only"], noise["+hydro+wet"]
gc = json.load(open(f"{P}/gcov_farmland.json"))
td = json.load(open(f"{P}/nisar_two_directions.json"))
wx, eloy = json.load(open(f"{P}/stack_willcox_128D.json")), json.load(open(f"{P}/stack_eloy_77A.json"))


def area(slug, name):
    r = conf["per_area"][slug]
    return dict(name=name, s1_rate_cm_yr=round(r["rate_cm_yr_s1"], 2), years=r["years_for_90pct_chance_of_3sigma"], date=r["confirm_by_if_no_gaps"], chance_at_one_year=r["power_at_1yr"])


out = dict(
    pattern=dict(r=cmp_["test_B_rate_pattern"]["r"], n_blocks=cmp_["test_B_rate_pattern"]["n_blocks"], r_without_bad_date=cmp_["test_B_without_sep15"]["r"]),
    weather_fix=dict(residual_before_mm=b["resid_mm"], residual_after_mm=a["resid_mm"], jump_before_mm=b["jump_sd_mm"], jump_after_mm=a["jump_sd_mm"],
                     percent=round((b["resid_mm"] - a["resid_mm"]) / b["resid_mm"] * 100)),
    sinking=dict(nisar_cm_yr=cmp_["sinking_blocks"]["nisar_minus_rest"], s1_cm_yr=cmp_["sinking_blocks"]["s1_minus_rest"], n_blocks=cmp_["sinking_blocks"]["n_blocks"]),
    playa=dict(net_cm=cmp_["playa_nisar_net_change_cm"], years=cmp_["playa_nisar_years"], s1_trend_cm_yr=cmp_["playa_s1_trend_cm_yr"], s1_last3y_cm_yr=cmp_["playa_s1_last3y_cm_yr"]),
    overlap=dict(r=cmp_["test_A_overlap_change"]["r"]),
    confirm=dict(willcox=area("willcox", "Willcox basin"), eloy=area("eloy", "Eloy"), k_sigma=conf["k_sigma"], power=conf["power"]),
    record=dict(willcox=dict(start=wx["dates"][0], end=wx["dates"][-1], dates=len(wx["dates"]), track=wx["track"]),
                eloy=dict(start=eloy["dates"][0], end=eloy["dates"][-1], dates=len(eloy["dates"]), track=eloy["track"])),
    figure="nisar_vs_sentinel1_willcox.png",
    directions=dict(span_days=td["span_days"], asc_mm=td["sinking_blocks"]["asc_mm"], asc_lo=td["sinking_blocks"]["asc_ci95"][0], asc_hi=td["sinking_blocks"]["asc_ci95"][1],
                    desc_mm=td["sinking_blocks"]["desc_mm"], desc_lo=td["sinking_blocks"]["desc_ci95"][0], desc_hi=td["sinking_blocks"]["desc_ci95"][1],
                    expected_mm=td["sinking_blocks"]["expected_from_s1_mm"], ew_mm=td["east_west_check"]["asc_minus_desc_mm"], ew_lo=td["east_west_check"]["ci95"][0], ew_hi=td["east_west_check"]["ci95"][1]),
    farmland=dict(
        crop_share_box_pct=round(gc["composition"]["cropland"]["share_box"] * 100, 1), crop_share_sinking_pct=round(gc["composition"]["cropland"]["share_sinking"] * 100, 1),
        enrichment=gc["cropland_enrichment"], crop_acres_sinking=gc["composition"]["cropland"]["acres_sinking"],
        rate_diff_cm_yr=gc["rate_by_class"]["diff_cm_yr"], rate_diff_lo=gc["rate_by_class"]["diff_ci95"][0], rate_diff_hi=gc["rate_by_class"]["diff_ci95"][1],
        share_sinking_cropland_pct=round(gc["rate_by_class"]["share_sinking_cropland"] * 100), share_sinking_desert_pct=round(gc["rate_by_class"]["share_sinking_shrubland"] * 100),
        auc_hh_spread=gc["separability_auc_dry_dates_only"]["yearly spread HH (dB std)"], auc_hv_spread=gc["separability_auc_dry_dates_only"]["yearly spread HV (dB std)"],
        auc_mean_hh=gc["separability_auc_dry_dates_only"]["mean HH (dB)"],
        rain_rho_hh=gc["rain"]["spearman_3d_hh"], rain_rho_hv=gc["rain"]["spearman_3d_hv"], n_dates=gc["n_dates"], dry_dates=gc["rain"]["dry_dates"],
        nisar_diff_cm_yr=gc["rate_by_class_nisar"]["cropland_minus_shrubland_cm_yr"], nisar_cells=gc["rate_by_class_nisar"]["n_cropland"],
        figure="gcov_farmland_willcox.png"),
    release="NASA NISAR L2 GUNW. Willcox: Provisional (CRID P05023) except the first pair, Oct 26 to Nov 7 2025, which is Beta; re-fitting without it moves the rate from -2.82 to -3.00 cm/yr. Eloy: Provisional.",
)
json.dump(out, open(f"{P}/nisar_summary.json", "w"), indent=1)
shutil.copyfile(f"{ROOT}/docs/nisar_vs_sentinel1_willcox.png", f"{P}/nisar_vs_sentinel1_willcox.png")
shutil.copyfile(f"{ROOT}/docs/gcov_farmland_willcox.png", f"{P}/gcov_farmland_willcox.png")
print(json.dumps(out, indent=1))
