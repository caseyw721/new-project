"""Turn a trade list (in R) into prop-challenge outcomes.

Rules modelled (Kraken Funded as its US pages describe it, see README): $10,000 start, pass at
$11,200, fail if equity ever touches $9,700 (static floor from the starting balance, measured on
open equity, no daily limit).

The bot's own risk rules sit on top:
- risk `risk_pct` of the *starting* balance per trade,
- but never more than `cushion_cap` of the distance to the floor, so a losing streak shrinks size,
- and stop trading once the cushion is under `min_cushion` (counted as a fail: the account is
  alive but can't reach the target at a size worth trading).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class Rules:
    start: float = 10_000.0
    target: float = 11_200.0
    floor: float = 9_700.0
    risk_pct: float = 0.0035
    cushion_cap: float = 0.25
    min_cushion: float = 75.0


@dataclass
class Outcome:
    result: str             # "pass", "fail" or "open" (data ran out first)
    days: float
    trades: int
    end_equity: float


def replay(net_r: np.ndarray, mae_r: np.ndarray, cost_r: np.ndarray, rules: Rules,
           t_entry: Optional[np.ndarray] = None, t_exit: Optional[np.ndarray] = None) -> Outcome:
    eq = rules.start
    t0 = t_entry[0] if t_entry is not None and len(t_entry) else None
    for k in range(len(net_r)):
        cushion = eq - rules.floor
        days = (t_exit[k] - t0) / np.timedelta64(1, "D") if t0 is not None else float("nan")
        if cushion < rules.min_cushion:
            return Outcome("fail", days, k, eq)
        risk = min(rules.risk_pct * rules.start, rules.cushion_cap * cushion)
        # entry fee is paid up front, so the worst open equity includes it
        if eq + risk * (mae_r[k] - cost_r[k] / 2) <= rules.floor:
            return Outcome("fail", days, k + 1, rules.floor)
        eq += risk * net_r[k]
        if eq >= rules.target:
            return Outcome("pass", days, k + 1, eq)
    days = (t_exit[-1] - t0) / np.timedelta64(1, "D") if t0 is not None and len(net_r) else float("nan")
    return Outcome("open", days, len(net_r), eq)


def rolling(trades: pd.DataFrame, rules: Rules, every: str = "7D",
            first: Optional[str] = None, last: Optional[str] = None) -> pd.DataFrame:
    """Start a fresh challenge every `every` and trade the real trade sequence from that date on."""
    te = trades.entry_time.dt.tz_convert(None).to_numpy()   # naive UTC datetime64 for searchsorted
    tx = trades.exit_time.dt.tz_convert(None).to_numpy()
    lo = pd.Timestamp(first, tz="UTC") if first else trades.entry_time.iloc[0]
    hi = pd.Timestamp(last, tz="UTC") if last else trades.entry_time.iloc[-1]
    rows = []
    for s in pd.date_range(lo, hi, freq=every):
        k = np.searchsorted(te, s.tz_convert(None).to_datetime64())
        o = replay(trades.net_r.to_numpy()[k:], trades.mae_r.to_numpy()[k:], trades.cost_r.to_numpy()[k:],
                   rules, te[k:], tx[k:])
        days = o.days if o.result != "open" else float("nan")
        rows.append({"start": s, "result": o.result, "days": days, "trades": o.trades, "end_equity": o.end_equity})
    return pd.DataFrame(rows)


def bootstrap(trades: pd.DataFrame, rules: Rules, n: int = 5000, max_trades: int = 500,
              seed: int = 0) -> dict:
    """Shuffle the trade list (with replacement) into `n` fresh challenges."""
    rng = np.random.default_rng(seed)
    cols = trades[["net_r", "mae_r", "cost_r"]].to_numpy()
    res = {"pass": 0, "fail": 0, "open": 0}
    used = []
    for _ in range(n):
        s = cols[rng.integers(0, len(cols), max_trades)]
        o = replay(s[:, 0], s[:, 1], s[:, 2], rules)
        res[o.result] += 1
        if o.result == "pass":
            used.append(o.trades)
    return {"pass": res["pass"] / n, "fail": res["fail"] / n, "open": res["open"] / n,
            "median_trades_to_pass": float(np.median(used)) if used else float("nan")}


def tally(r: pd.DataFrame) -> dict:
    done = r[r.result != "open"]
    p = done[done.result == "pass"]
    return {
        "starts": len(r),
        "pass": (r.result == "pass").mean(),
        "fail": (r.result == "fail").mean(),
        "open": (r.result == "open").mean(),
        "median_days_to_pass": p.days.median() if len(p) else float("nan"),
        "pass_within_30d": ((r.result == "pass") & (r.days <= 30)).mean(),
        "pass_within_90d": ((r.result == "pass") & (r.days <= 90)).mean(),
        "pass_within_180d": ((r.result == "pass") & (r.days <= 180)).mean(),
        "pass_within_365d": ((r.result == "pass") & (r.days <= 365)).mean(),
    }

