"""Plain-language insights for each study area, written for a reader who is not a radar or groundwater expert.
Every sentence is built from the study's own exported numbers; nothing is invented. Rules:
 - short sentences, no jargon (no 'InSAR', 'line of sight', 'correlation' without explanation);
 - say what we do NOT know (cause, vertical drop, NASA's new satellite);
 - confidence is computed by fixed rules (below), not by judgement per study.
"""
import datetime as dt

SQMI = 0.3861      # square miles per square kilometre
INCH = 2.54        # cm per inch

def _nisar_summary():
    """data/processed/nisar_summary.json (src/export_nisar.py), or None. Run export_nisar.py before export_contract.py."""
    import json, os
    p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "processed", "nisar_summary.json")
    try:
        return json.load(open(p, encoding="utf-8"))
    except (OSError, ValueError):
        return None

def _years(dates):
    a, b = (dt.date.fromisoformat(dates[0]), dt.date.fromisoformat(dates[-1])); return (b - a).days / 365.25

def confidence(ts, in_feature):
    """Two ratings from fixed rules.
    where: 'high' needs ALL of: both satellite directions see it, it lies inside an official ADWR feature, and our pattern matches ADWR's own
           Sentinel-1 pattern (agreement 0.9 or better); 'medium' if two of those three hold; else 'low'.
    how fast: 'high' needs both directions AND an independent-satellite (RADARSAT-2) agreement of 0.9 or better AND uncertainty under a quarter of the rate;
              'medium' if the independent agreement is 0.9+, or both directions agree and the uncertainty is under a quarter of the rate; else 'low'."""
    both = ts["confirmation"] == "both look directions"
    comp = ts.get("adwr_comparison") or {}
    s1ok = comp.get("corr_s1") is not None and comp["corr_s1"] >= 0.9
    n_ok = sum([both, bool(in_feature), s1ok])
    where = "high" if n_ok == 3 else "medium" if n_ok == 2 else "low"
    c = comp.get("corr_rs2")
    indep = c is not None and c >= 0.9
    tight = abs(ts["rate_cm_yr"]) > 0 and ts["rate_sigma"] / abs(ts["rate_cm_yr"]) <= 0.25
    rate = "high" if (both and indep and tight) else "medium" if (indep or (both and tight)) else "low"
    return where, rate

def build(ts, farm, features):
    """ts: the timeseries dict being exported; farm: 'yes' | 'little' | 'unchecked'; features: list of official ADWR feature names holding this area."""
    rate = abs(ts["rate_cm_yr"]); sig = ts["rate_sigma"]; years = _years(ts["dates"]); total = abs(ts["displacement"][-1])
    area = ts["area_km2"]; fastest = abs(ts["p5_rate_cm_yr"]); c = (ts.get("adwr_comparison") or {}).get("corr_rs2")
    where, speed = confidence(ts, bool(features))
    both = ts["confirmation"] == "both look directions"
    feat = " and ".join(features) if features else None

    summary = (f"Over about {years:.0f} years, the ground in the sinking part of this area has dropped by roughly {total:.0f} cm "
               f"({total / INCH:.0f} inches) on average, and the fastest spots have dropped more.")

    found = (f"About {area:.0f} square kilometres ({area * SQMI:.0f} square miles) of ground here is sinking at roughly "
             f"{rate:.1f} cm a year ({rate / INCH:.1f} inches a year), give or take {sig:.1f} cm a year. "
             f"In the fastest-sinking 5% of this patch, the ground drops by more than {fastest:.1f} cm a year.")

    sure = []
    sure.append("Satellite views from two opposite directions both see the ground sinking here." if both else
                "Only one of our two satellite viewing directions covers this area, so treat the result as unconfirmed.")
    if feat:
        sure.append(f"Arizona's water agency (ADWR) also lists this area as an official sinking-ground zone, which it calls {feat}.")
    if c is not None and c >= 0.9 and ts.get("adwr_rs2_rate_cm_yr") is not None:
        sure.append(f"ADWR's own measurements from a separate satellite (RADARSAT-2) show the same pattern and a similar speed, about "
                    f"{abs(ts['adwr_rs2_rate_cm_yr']):.1f} cm a year over the same spots.")
    elif c is not None:
        sure.append("But the match with ADWR's separate satellite is weak here. The sinking is small compared with the measurement error, "
                    "so treat the exact speed as a rough estimate.")
    sure.append(f"Confidence that the ground is sinking here: {where}. Confidence in the exact speed: {speed}.")

    why = ["In farming valleys, the usual cause of sinking is groundwater being pumped out faster than rain and rivers refill it. "
           "When the water level drops, layers of clay and sand underground squeeze together and the land above settles."]
    why.append({"yes": "Irrigated farmland surrounds this area.",
                "little": "There is little farmland right around this spot, so the cause here is less clear.",
                "unchecked": "We have not checked what land surrounds this spot."}[farm])
    why.append("Our data show where the ground is moving, not who is pumping or why. That needs other evidence.")

    matters = ("Sinking ground can crack roads, canals and wells, and can open long cracks in the ground called earth fissures. "
               "Much of the squeeze underground is permanent, so the space that once held water is lost for good.")

    nisar = ts.get("nisar")
    if nisar:
        span = "about a year" if len(nisar["dates"]) > 15 else "under four months"
        summ = _nisar_summary()
        conf = (summ.get("confirm") or {}).get(ts.get("hotspot")) if summ else None
        match = ""
        if summ and ts.get("hotspot") == "willcox":
            match = (f"Its map of where the ground sinks lines up with the ten-year Sentinel-1 pattern (match {summ['pattern']['r']:.2f} on a scale where 1 is perfect), "
                     "so the two satellites broadly agree on where. ")
        when = ""
        if conf:
            month = dt.date.fromisoformat(conf["date"]).strftime("%B %Y")
            when = f" If NISAR keeps observing, we estimate it can confirm a speed here around {month}."
        nis = (f"NASA's new NISAR satellite has watched this area for {span}. {match}That is still too short, and too uncertain, to give a trustworthy speed, "
               f"so the ten-year trend above comes from the older Sentinel-1 satellite.{when}")
    else:
        nis = ("NASA's new NISAR satellite does not yet have a usable record for this spot, so the ten-year trend above comes from the "
               "Sentinel-1 satellite.")

    know = ("These numbers are measured along the satellite's slanted view, not straight down, and relative to the surrounding ground. "
            "If the ground is moving straight down, the true drop is likely somewhat larger. All numbers are preliminary.")

    return {
        "summary": summary,
        "confidence": {"where": where, "how_fast": speed,
                       "where_label": "Where it is sinking", "how_fast_label": "How fast"},
        "points": [
            {"heading": "What we found", "text": found},
            {"heading": "How sure are we?", "text": " ".join(sure)},
            {"heading": "Why is the ground sinking?", "text": " ".join(why)},
            {"heading": "Why it matters", "text": matters},
            {"heading": "What about NASA's new satellite?", "text": nis},
            {"heading": "Good to know", "text": know},
        ],
    }
