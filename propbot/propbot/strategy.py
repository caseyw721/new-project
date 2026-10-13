"""Donchian breakout with a trend filter, an ATR stop and an ATR chandelier trail.

Signals are taken on a bar's close and filled at the next bar's open. While a trade is open the
stop is checked against each bar: a bar that opens through the stop fills at its open (a gap,
which is how losses bigger than 1R happen), otherwise a touch fills at the stop. After the bar
closes the trailing stop can only tighten.

Every trade is reported in R, where 1R is the distance from entry to the initial stop. That makes
the trade list independent of account size; `challenge.py` turns it into dollars.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import List

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class Params:
    tf: str = "4h"          # bar size the strategy runs on (resampled from hourly)
    entry_n: int = 20       # breakout of the prior N bars' high / low
    trend_n: int = 100      # EMA trend filter: longs only above, shorts only below
    atr_n: int = 14
    stop_atr: float = 1.5   # initial stop distance in ATRs
    trail_atr: float = 6.0  # chandelier trail: extreme since entry minus this many ATRs
    shorts: bool = False   # shorts halved the 2023+ edge

    def label(self) -> str:
        return (f"{self.tf} N{self.entry_n} ema{self.trend_n} stop{self.stop_atr:g} "
                f"trail{self.trail_atr:g} {'L/S' if self.shorts else 'long'}")


@dataclass
class Trade:
    entry_time: pd.Timestamp
    exit_time: pd.Timestamp
    side: int               # +1 long, -1 short
    entry: float
    exit: float
    stop_dist: float        # 1R in price
    r: float                # gross result in R
    mae_r: float            # worst open loss in R (<= 0), for intratrade floor checks
    gap: bool               # stopped out by a bar that opened through the stop


def bars_for(hourly: pd.DataFrame, tf: str) -> pd.DataFrame:
    if tf == "1h":
        return hourly
    return hourly.resample(tf, label="left", closed="left").agg(
        {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}
    ).dropna(subset=["open"])


def atr(bars: pd.DataFrame, n: int) -> pd.Series:
    prev = bars["close"].shift()
    tr = pd.concat([bars["high"] - bars["low"], (bars["high"] - prev).abs(), (bars["low"] - prev).abs()], axis=1).max(axis=1)
    return tr.ewm(alpha=1 / n, adjust=False).mean()


def run(hourly: pd.DataFrame, p: Params) -> List[Trade]:
    b = bars_for(hourly, p.tf)
    t = b.index
    o, h, l, c = (b[k].to_numpy() for k in ("open", "high", "low", "close"))
    a = atr(b, p.atr_n).to_numpy()
    ema = b["close"].ewm(span=p.trend_n, adjust=False).mean().to_numpy()
    hi_n = b["high"].rolling(p.entry_n).max().shift().to_numpy()   # prior N bars, excluding this one
    lo_n = b["low"].rolling(p.entry_n).min().shift().to_numpy()
    warm = max(p.entry_n, p.trend_n, p.atr_n) + 1

    trades: List[Trade] = []
    side = 0
    i = warm
    while i < len(b) - 1:
        if side == 0:
            if c[i] > hi_n[i] and c[i] > ema[i]:
                side = 1
            elif p.shorts and c[i] < lo_n[i] and c[i] < ema[i]:
                side = -1
            if side:
                e_i = i + 1
                entry = o[e_i]
                dist = p.stop_atr * a[i]
                stop = entry - side * dist
                extreme = entry
                worst = 0.0
                j = e_i
                while True:
                    # stop first: we can't know the intrabar path, so assume the adverse move came first
                    if side * (o[j] - stop) <= 0:
                        px, gap = o[j], True
                    elif side * ((l[j] if side == 1 else h[j]) - stop) <= 0:
                        px, gap = stop, False
                    else:
                        px = None
                    adverse = l[j] if side == 1 else h[j]
                    worst = min(worst, side * ((px if px is not None else adverse) - entry) / dist)
                    if px is not None or j == len(b) - 1:
                        if px is None:
                            px, gap = c[j], False            # data ends: mark to the last close
                        trades.append(Trade(t[e_i], t[j], side, entry, px, dist,
                                            side * (px - entry) / dist, worst, gap))
                        break
                    extreme = max(extreme, h[j]) if side == 1 else min(extreme, l[j])
                    trail = extreme - side * p.trail_atr * a[j]
                    stop = max(stop, trail) if side == 1 else min(stop, trail)
                    j += 1
                side = 0
                i = j      # flat again; the exit bar's close can signal the next entry
                continue
        i += 1
    return trades


def to_frame(trades: List[Trade], cost_bps: float) -> pd.DataFrame:
    """Trades as a frame with costs in R: `cost_bps` is charged per side (fee + slippage)."""
    df = pd.DataFrame([asdict(x) for x in trades])
    if df.empty:
        return df
    df["cost_r"] = (cost_bps / 1e4) * (df["entry"] + df["exit"]) / df["stop_dist"]
    df["net_r"] = df["r"] - df["cost_r"]
    return df


def summary(df: pd.DataFrame) -> dict:
    if df.empty:
        return {"trades": 0}
    wins = df[df.net_r > 0]
    years = max((df.exit_time.iloc[-1] - df.entry_time.iloc[0]).days / 365.25, 1e-9)
    return {
        "trades": len(df),
        "per_year": len(df) / years,
        "win_rate": len(wins) / len(df),
        "avg_win_r": wins.net_r.mean() if len(wins) else 0.0,
        "avg_loss_r": df[df.net_r <= 0].net_r.mean() if len(wins) < len(df) else 0.0,
        "exp_r": df.net_r.mean(),
        "worst_r": df.net_r.min(),
        "gaps": int(df.gap.sum()),
        "max_losing_streak": _streak(df.net_r.to_numpy() <= 0),
    }


def _streak(flags: np.ndarray) -> int:
    best = cur = 0
    for f in flags:
        cur = cur + 1 if f else 0
        best = max(best, cur)
    return best
