"""When can NISAR confirm a sinking rate? Estimated from the noise NISAR actually showed us, not assumed.
Model: every acquisition date carries an independent error with standard deviation s_d (mm). In a chain of consecutive pairs this makes
neighbouring increments anti-correlated (lag-1 = -0.5); we measured -0.47 at Willcox, so the model fits. Averaging more pixels does NOT help,
because a date error is common to the whole scene. The slope uncertainty of a straight-line fit through n dates spread evenly over T years is
    SE = s_d * sqrt(12) / (T * sqrt(n)),   n = 1 + T * 365.25 / 12   (12-day repeat).
A rate r is "confirmed" when |r| / SE >= 3. Reaching 3 sigma on average only gives about a 50% chance, so we ask for a 90% chance: |r| / SE >= 3 + 1.28.
We solve for T and check it with a Monte Carlo simulation. Willcox noise is CALIBRATED so the model reproduces the standard error we measured (0.93 cm/yr).
s_d is estimated from the chain increments: std(increment) = s_d * sqrt(2); a robust (MAD) version is also given because one bad date inflates the plain std.
Limits of the estimate: it covers the random per-date error only. Reference-area drift, unmodelled seasonal motion and line-of-sight vs vertical are NOT included.
Output: data/processed/nisar_confirm.json. Usage: python nisar_when.py"""
import json, os, numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = f"{ROOT}/data/processed"
K = 3.0
K90 = K + 1.2816          # 90% chance of reaching K sigma


def sd_from_chain(path):
    j = json.load(open(path))
    inc = np.diff(np.array(j["displacement_mm"], float))
    plain = float(inc.std(ddof=1) / np.sqrt(2))
    robust = float(1.4826 * np.median(np.abs(inc - np.median(inc))) / np.sqrt(2))
    lag1 = float(np.corrcoef(inc[:-1], inc[1:])[0, 1])
    return dict(n_dates=len(j["displacement_mm"]), s_d_plain_mm=round(plain, 1), s_d_robust_mm=round(robust, 1), lag1=round(lag1, 2))


def se_cm_yr(sd_mm, T):
    n = 1 + T * 365.25 / 12
    return sd_mm * np.sqrt(12) / (T * np.sqrt(n)) / 10


def years_needed(rate_cm_yr, sd_mm, k=K90):
    lo, hi = 0.05, 60.0
    for _ in range(80):
        mid = (lo + hi) / 2
        if abs(rate_cm_yr) / se_cm_yr(sd_mm, mid) >= k:
            hi = mid
        else:
            lo = mid
    return hi


def mc_power(rate_cm_yr, sd_mm, T, k=K, trials=4000, seed=1):
    rng = np.random.default_rng(seed)
    n = int(round(1 + T * 365.25 / 12))
    t = np.arange(n) * 12 / 365.25
    hits = 0
    for _ in range(trials):
        y = rate_cm_yr * 10 * t + rng.normal(0, sd_mm, n)           # mm
        A = np.c_[t, np.ones(n)]
        c, *_ = np.linalg.lstsq(A, y, rcond=None)
        r = y - A @ c
        se = np.sqrt((r ** 2).sum() / max(n - 2, 1) / ((t - t.mean()) ** 2).sum())
        hits += (abs(c[0]) / se >= k) and (np.sign(c[0]) == np.sign(rate_cm_yr))
    return hits / trials


noise = {"willcox_128D": sd_from_chain(f"{P}/stack_willcox_128D.json"), "eloy_077A": sd_from_chain(f"{P}/stack_eloy_77A.json")}
print("per-date error estimated from the real chains:", json.dumps(noise, indent=1))
# Willcox: scale the plain per-date error so the model reproduces the measured OLS standard error (0.93 cm/yr over 0.99 yr)
model_plain = se_cm_yr(noise["willcox_128D"]["s_d_plain_mm"], 0.99)
sd = {"willcox_128D": round(noise["willcox_128D"]["s_d_plain_mm"] * 0.93 / model_plain, 1),
      "eloy_077A": max(noise["eloy_077A"]["s_d_plain_mm"], noise["eloy_077A"]["s_d_robust_mm"])}
print("per-date error used (mm):", sd)
# closed-form check against what we actually measured at Willcox (corrected): OLS SE 0.93 cm/yr over 0.99 yr, 26 dates
chk = se_cm_yr(sd["willcox_128D"], 0.99)
print(f"check: model SE at Willcox with the calibrated s_d = {chk:.2f} cm/yr vs measured OLS SE 0.93 cm/yr")

# rates to test: Sentinel-1 10-year LOS rates per study area (cm/yr, magnitude)
ts = {}
for slug in ("willcox", "north_willcox", "south", "east", "eloy"):
    j = json.load(open(f"{P}/timeseries_{slug}.json"))
    ts[slug] = abs(float(j["rate_cm_yr"]))
print("Sentinel-1 rates used:", ts)
rows = {}
for slug, r in ts.items():
    # Willcox-area frame is NISAR 128 D; Eloy is 077 A. North/south/east are outside the 128 D coverage we processed, so they borrow the Willcox noise as a proxy.
    key = "eloy_077A" if slug == "eloy" else "willcox_128D"
    s = sd[key]
    T = years_needed(r, s)
    rows[slug] = dict(rate_cm_yr_s1=round(r, 2), noise_source=key, s_d_mm=s, years_for_90pct_chance_of_3sigma=round(T, 2), power_at_that_time=round(mc_power(-r, s, T), 2),
                      power_at_1yr=round(mc_power(-r, s, 1.0), 2), power_at_2yr=round(mc_power(-r, s, 2.0), 2), proxy=(slug in ("north_willcox", "south", "east")))
    print(f"{slug:14s} rate {r:4.2f} cm/yr | s_d {s:4.1f} mm ({key}) | 90%-sure 3-sigma after {T:4.2f} yr | simulated chance at that time {rows[slug]['power_at_that_time']:.2f}, at 1 yr {rows[slug]['power_at_1yr']:.2f}, at 2 yr {rows[slug]['power_at_2yr']:.2f}")

# generic table: years needed for a few rates with the Willcox (pessimistic) and Eloy-like (optimistic) noise
gen = {}
for r in (0.5, 1, 2, 3, 5):
    gen[str(r)] = {k: round(years_needed(r, sd[k]), 2) for k in sd}
print("years for a 90% chance of 3 sigma, by rate:", gen)

# calendar dates, assuming the 12-day record continues without gaps from the first date of each chain
import datetime as dt
START = {"willcox_128D": dt.date(2025, 10, 26), "eloy_077A": dt.date(2026, 6, 19)}
for slug, r in rows.items():
    st = START[r["noise_source"]] if not r["proxy"] else START["willcox_128D"]
    r["confirm_by_if_no_gaps"] = (st + dt.timedelta(days=round(r["years_for_90pct_chance_of_3sigma"] * 365.25))).isoformat()
    print(slug, "record start", st, "->", r["confirm_by_if_no_gaps"])
# launch/record context: NISAR started science data Oct 2025 (record start Oct 26 2025 at Willcox)
out = dict(note="Years of continuous 12-day NISAR data needed for a 90% chance of confirming a rate at 3 sigma, from the random per-date error measured in our chains. Excludes reference drift, seasonal motion and LOS-vs-vertical.",
           k_sigma=K, power=0.9, noise=noise, sd_used_mm={k: float(v) for k, v in sd.items()}, model_check=dict(model_se_cm_yr=round(float(chk), 2), measured_ols_se_cm_yr=0.93), per_area=rows, generic_years=gen)
json.dump(out, open(f"{P}/nisar_confirm.json", "w"), indent=1)
print("saved data/processed/nisar_confirm.json")
