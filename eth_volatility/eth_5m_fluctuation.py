#!/usr/bin/env python3
"""Mean 5-minute price fluctuation of ETH/USD over the last 24 hours and 7 days.

Pulls public 5-minute candles (no API key needed) and reports, per window:
  - mean absolute 5-min move (close-to-close), in USD and %
  - mean signed 5-min move (drift), in USD and %
  - standard deviation of 5-min % returns
  - mean intra-candle range (high - low), in USD and %

Usage:
  python3 eth_5m_fluctuation.py                    # fetch from Coinbase, fall back to Binance
  python3 eth_5m_fluctuation.py --source binance
  python3 eth_5m_fluctuation.py --csv candles.csv  # offline: columns time,open,high,low,close
  python3 eth_5m_fluctuation.py --save candles.csv # also write the fetched candles

Standard library only.
"""

import argparse
import csv
import json
import statistics
import sys
import time
import urllib.request

INTERVAL = 300  # seconds
WEEK = 7 * 24 * 3600
DAY = 24 * 3600


def _get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "eth-5m-fluctuation/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def fetch_coinbase(start, end):
    """Coinbase Exchange returns at most 300 candles per request: [time, low, high, open, close, volume]."""
    candles = {}
    step = 300 * INTERVAL
    t = start
    while t < end:
        chunk_end = min(t + step, end)
        url = (
            "https://api.exchange.coinbase.com/products/ETH-USD/candles"
            f"?granularity={INTERVAL}"
            f"&start={time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(t))}"
            f"&end={time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(chunk_end))}"
        )
        for ts, low, high, open_, close, _vol in _get_json(url):
            candles[int(ts)] = (float(open_), float(high), float(low), float(close))
        t = chunk_end
        time.sleep(0.35)  # stay under the public rate limit
    return candles


def fetch_binance(start, end):
    """Binance returns at most 1000 klines per request: [openTime(ms), open, high, low, close, ...]."""
    candles = {}
    t = start
    while t < end:
        url = (
            "https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=5m&limit=1000"
            f"&startTime={t * 1000}&endTime={end * 1000}"
        )
        rows = _get_json(url)
        if not rows:
            break
        for row in rows:
            candles[int(row[0]) // 1000] = tuple(float(x) for x in row[1:5])
        t = int(rows[-1][0]) // 1000 + INTERVAL
    return candles


def load_csv(path):
    candles = {}
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            candles[int(float(row["time"]))] = (
                float(row["open"]), float(row["high"]), float(row["low"]), float(row["close"]),
            )
    return candles


def save_csv(path, candles):
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["time", "open", "high", "low", "close"])
        for ts in sorted(candles):
            w.writerow([ts, *candles[ts]])


def stats(candles, since):
    rows = [(ts, candles[ts]) for ts in sorted(candles) if ts >= since]
    if len(rows) < 2:
        return None
    moves_usd, moves_pct, ranges_usd, ranges_pct = [], [], [], []
    gaps = 0
    for (ts_prev, prev), (ts, cur) in zip(rows, rows[1:]):
        if ts - ts_prev != INTERVAL:
            gaps += 1  # missing candle(s): skip rather than treat a longer move as one 5-min step
            continue
        moves_usd.append(cur[3] - prev[3])
        moves_pct.append((cur[3] - prev[3]) / prev[3] * 100)
    for _ts, (open_, high, low, _close) in rows:
        ranges_usd.append(high - low)
        ranges_pct.append((high - low) / open_ * 100)
    return {
        "candles": len(rows),
        "intervals": len(moves_usd),
        "gaps": gaps,
        "from": rows[0][0],
        "to": rows[-1][0],
        "first_close": rows[0][1][3],
        "last_close": rows[-1][1][3],
        "mean_abs_usd": statistics.fmean(abs(x) for x in moves_usd),
        "mean_abs_pct": statistics.fmean(abs(x) for x in moves_pct),
        "median_abs_pct": statistics.median(abs(x) for x in moves_pct),
        "mean_signed_usd": statistics.fmean(moves_usd),
        "mean_signed_pct": statistics.fmean(moves_pct),
        "stdev_pct": statistics.stdev(moves_pct),
        "max_up_pct": max(moves_pct),
        "max_down_pct": min(moves_pct),
        "mean_range_usd": statistics.fmean(ranges_usd),
        "mean_range_pct": statistics.fmean(ranges_pct),
    }


def report(label, s):
    fmt = lambda ts: time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(ts))
    print(f"\n=== {label} ===")
    if s is None:
        print("  not enough data")
        return
    print(f"  span:                 {fmt(s['from'])} -> {fmt(s['to'])}")
    print(f"  candles / intervals:  {s['candles']} / {s['intervals']} (gaps skipped: {s['gaps']})")
    print(f"  price:                ${s['first_close']:,.2f} -> ${s['last_close']:,.2f}")
    print(f"  mean |5-min move|:    ${s['mean_abs_usd']:,.2f}  ({s['mean_abs_pct']:.4f}%)")
    print(f"  median |5-min move|:  {s['median_abs_pct']:.4f}%")
    print(f"  mean signed move:     ${s['mean_signed_usd']:+,.4f}  ({s['mean_signed_pct']:+.5f}%)")
    print(f"  stdev of 5-min %:     {s['stdev_pct']:.4f}%")
    print(f"  largest up / down:    {s['max_up_pct']:+.3f}% / {s['max_down_pct']:+.3f}%")
    print(f"  mean high-low range:  ${s['mean_range_usd']:,.2f}  ({s['mean_range_pct']:.4f}%)")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", choices=["coinbase", "binance"], help="data source (default: try coinbase, then binance)")
    ap.add_argument("--csv", help="read candles from a CSV instead of fetching")
    ap.add_argument("--save", help="write the candles used to this CSV")
    args = ap.parse_args()

    end = int(time.time()) // INTERVAL * INTERVAL
    start = end - WEEK

    if args.csv:
        candles = load_csv(args.csv)
        end = max(candles) + INTERVAL
        source = args.csv
    else:
        sources = [args.source] if args.source else ["coinbase", "binance"]
        candles, source = None, None
        for name in sources:
            try:
                candles = {"coinbase": fetch_coinbase, "binance": fetch_binance}[name](start, end)
                source = name
                break
            except Exception as e:  # network/policy errors: try the next source
                print(f"{name}: fetch failed ({e})", file=sys.stderr)
        if not candles:
            sys.exit("could not fetch candles from any source")

    if args.save:
        save_csv(args.save, candles)

    print(f"ETH/USD 5-minute fluctuation (source: {source})")
    report("Last 24 hours", stats(candles, end - DAY))
    report("Last 7 days", stats(candles, end - WEEK))


if __name__ == "__main__":
    main()
