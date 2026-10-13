"""python3 -m propbot [options]  —  backtest the breakout and score it against the challenge.

Prints the strategy's trade stats (all data, the 2018-2022 tuning period, and 2023 onward, which
the settings were not tuned on), then pass / fail rates for several per-trade risk levels using
both the real trade order (a new challenge started every week) and shuffled trades.
"""
from __future__ import annotations

import argparse

import pandas as pd

from . import challenge as c
from . import data
from . import strategy as s

OOS_START = "2023-01-01"   # everything before this was used to pick the default settings


def main() -> None:
    d = s.Params()
    ap = argparse.ArgumentParser(prog="propbot", description=__doc__.splitlines()[0])
    ap.add_argument("--tf", default=d.tf, help="bar size: 1h, 2h, 4h, 8h ...")
    ap.add_argument("--entry-n", type=int, default=d.entry_n)
    ap.add_argument("--trend-n", type=int, default=d.trend_n)
    ap.add_argument("--stop", type=float, default=d.stop_atr, help="initial stop in ATRs")
    ap.add_argument("--trail", type=float, default=d.trail_atr, help="chandelier trail in ATRs")
    ap.add_argument("--shorts", action="store_true", help="also trade short breakouts")
    ap.add_argument("--cost-bps", type=float, default=10.0, help="fee + slippage per side, basis points")
    ap.add_argument("--risk", type=float, nargs="*", default=[0.0025, 0.0035, 0.005, 0.01],
                    help="per-trade risk as a fraction of the starting balance")
    ap.add_argument("--csv", help="hourly OHLC CSV to use instead of the Bitstamp minute data")
    ap.add_argument("--trades-out", help="write the trade list here")
    a = ap.parse_args()

    p = s.Params(tf=a.tf, entry_n=a.entry_n, trend_n=a.trend_n, stop_atr=a.stop, trail_atr=a.trail, shorts=a.shorts)
    bars = data.load_csv(a.csv) if a.csv else data.hourly()
    trades = s.to_frame(s.run(bars, p), a.cost_bps)
    if trades.empty:
        raise SystemExit("no trades")
    if a.trades_out:
        trades.to_csv(a.trades_out, index=False)

    pd.set_option("display.width", 200)
    print(f"{p.label()}   costs {a.cost_bps:g} bps/side   data {bars.index[0]:%Y-%m-%d} .. {bars.index[-1]:%Y-%m-%d}\n")
    oos = trades[trades.entry_time >= OOS_START]
    stats = pd.DataFrame({"all": s.summary(trades), "2018-22 (tuned)": s.summary(trades[trades.entry_time < OOS_START]),
                          "2023+ (unseen)": s.summary(oos)})
    print(stats.astype(float).round(3).to_string(), "\n")

    # leave a year at the end so most challenges can finish before the data does
    last = (bars.index[-1] - pd.Timedelta(days=365)).strftime("%Y-%m-%d")
    rows = []
    for risk in a.risk:
        rules = c.Rules(risk_pct=risk)
        for span, first in [("all", None), ("2023+", OOS_START)]:
            t = c.tally(c.rolling(trades, rules, first=first, last=last))
            b = c.bootstrap(trades if first is None else oos, rules, n=3000)
            rows.append({"risk": f"{risk:.2%}", "starts": span, "pass": t["pass"], "fail": t["fail"], "open": t["open"],
                         "median_days": t["median_days_to_pass"], "pass_in_90d": t["pass_within_90d"],
                         "pass_in_180d": t["pass_within_180d"], "pass_in_365d": t["pass_within_365d"],
                         "shuffled_pass": b["pass"]})
    print("challenge: $10k start, pass at $11,200, fail at $9,700 (open equity); weekly starts on the real trade order")
    print(pd.DataFrame(rows).round(3).to_string(index=False))


if __name__ == "__main__":
    main()
