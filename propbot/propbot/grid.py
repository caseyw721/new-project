"""python3 -m propbot.grid  —  the parameter sweep the defaults came from.

Scores 288 settings on 2018-2022, then shows how the same settings did on 2023 onward, plus the
median 2023+ result grouped by each parameter. Pick from the region that holds up, not the top row.
"""
from __future__ import annotations

import itertools

import pandas as pd

from . import data
from . import strategy as s

OOS_START = "2023-01-01"


def score(bars: pd.DataFrame, p: s.Params, since=None, cost_bps: float = 10) -> dict:
    df = s.to_frame(s.run(bars, p), cost_bps)
    if since is not None and not df.empty:
        df = df[df.entry_time >= since]
    m = s.summary(df)
    if not m["trades"]:
        return {"trades": 0, "per_year": 0.0, "exp_r": 0.0, "r_per_year": 0.0, "streak": 0}
    return {"trades": m["trades"], "per_year": m["per_year"], "exp_r": m["exp_r"],
            "r_per_year": m["exp_r"] * m["per_year"], "streak": m["max_losing_streak"]}


def main() -> None:
    h = data.hourly()
    tuned = h[h.index < OOS_START]
    unseen = h[h.index >= "2022-11-01"]          # two months of indicator warm-up before 2023
    rows = []
    for tf, n, st, tr, sh in itertools.product(["1h", "2h", "4h", "8h"], [10, 20, 40], [1.5, 2, 3], [2, 3, 4, 6], [True, False]):
        p = s.Params(tf=tf, entry_n=n, stop_atr=st, trail_atr=tr, shorts=sh)
        a = score(tuned, p)
        b = score(unseen, p, since=pd.Timestamp(OOS_START, tz="UTC"))
        rows.append({"tf": tf, "entry_n": n, "stop": st, "trail": tr, "dir": "L/S" if sh else "long",
                     **{f"is_{k}": v for k, v in a.items()}, **{f"oos_{k}": v for k, v in b.items()}})
    g = pd.DataFrame(rows).sort_values("is_r_per_year", ascending=False)
    pd.set_option("display.width", 200)
    print("top 20 on 2018-22, with their 2023+ results")
    print(g.head(20).round(3).to_string(index=False))
    print(f"\nsettings with a positive 2023+ edge: {(g.oos_exp_r > 0).mean():.0%};  "
          f"rank correlation 2018-22 vs 2023+ R/yr: {g.is_r_per_year.rank().corr(g.oos_r_per_year.rank()):.2f}")
    for col in ("tf", "entry_n", "stop", "trail", "dir"):
        print(f"\nmedian 2023+ by {col}")
        print(g.groupby(col)[["oos_exp_r", "oos_r_per_year"]].median().round(3).to_string())


if __name__ == "__main__":
    main()
