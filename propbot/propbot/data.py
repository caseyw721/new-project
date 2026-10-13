"""Price history: Bitstamp BTC/USD 1-minute candles resampled to hourly.

The sandbox this was written in can't reach api.kraken.com, so the source is the public
ff137/bitstamp-btcusd-minute-data repo (2012 to yesterday, updated daily). Bitstamp and Kraken
BTC/USD trade within a few dollars of each other, so for hourly candles the difference is noise.
Swap in Kraken's own OHLC with `load_csv` once the network allows it.
"""
from __future__ import annotations

import os

import pandas as pd

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
# a clone of ff137/bitstamp-btcusd-minute-data next to this repo, or wherever PROPBOT_MINUTE_DATA points
DEFAULT_SRC = os.environ.get("PROPBOT_MINUTE_DATA",
                             os.path.join(REPO_ROOT, "..", "ff137", "bitstamp-btcusd-minute-data", "data"))
CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def load_minutes(src: str = DEFAULT_SRC, start: str = "2018-01-01") -> pd.DataFrame:
    hist = os.path.join(src, "historical", "btcusd_bitstamp_1min_2012-2025.csv.gz")
    upd = os.path.join(src, "updates", "btcusd_bitstamp_1min_latest.csv")
    frames = [pd.read_csv(p) for p in (hist, upd) if os.path.exists(p)]
    if not frames:
        raise FileNotFoundError(f"no minute data under {src}; clone ff137/bitstamp-btcusd-minute-data")
    df = pd.concat(frames).drop_duplicates("timestamp").sort_values("timestamp")
    df.index = pd.to_datetime(df.pop("timestamp"), unit="s", utc=True)
    return df[df.index >= pd.Timestamp(start, tz="UTC")]


def resample(minutes: pd.DataFrame, rule: str) -> pd.DataFrame:
    bars = minutes.resample(rule, label="left", closed="left").agg(
        {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"})
    return bars.dropna(subset=["open"])   # exchange outages leave empty bars


def hourly(src: str = DEFAULT_SRC, start: str = "2018-01-01", refresh: bool = False) -> pd.DataFrame:
    """Hourly bars, cached as CSV under propbot/data/ (gitignored)."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, f"btcusd_1h_from_{start}.csv")
    if os.path.exists(path) and not refresh:
        return load_csv(path)
    bars = resample(load_minutes(src, start), "1h")
    bars.to_csv(path, index_label="time")
    return bars


def load_csv(path: str) -> pd.DataFrame:
    """Any OHLC CSV with a time column (ISO or unix seconds) and open/high/low/close."""
    df = pd.read_csv(path)
    t = df.pop(df.columns[0])
    df.index = pd.to_datetime(t, unit="s", utc=True) if pd.api.types.is_numeric_dtype(t) else pd.to_datetime(t, utc=True)
    return df
