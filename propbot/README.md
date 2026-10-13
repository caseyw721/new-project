# propbot

A backtest of a trend-breakout bot, scored against a crypto prop-firm challenge:
**$10,000 account, pass at +12% ($11,200), fail if equity ever touches −3% ($9,700)**. Those
are the Kraken Funded rules as Kraken's US pages describe them: a static floor measured from the
starting balance, on open equity, with no daily limit.

> **Check before going live.** Kraken describes Kraken Funded as a *mobile-only* challenge and
> doesn't say whether API or bot trading is allowed. Some regions get a 5% floor instead of 3%.
> Confirm the bot policy, the floor, any time limit and the trading fee on your challenge page.

## Run it

```
git clone https://github.com/ff137/bitstamp-btcusd-minute-data ../ff137/bitstamp-btcusd-minute-data
pip install -r requirements.txt
python3 -m propbot                    # strategy stats + challenge pass rates
python3 -m propbot --cost-bps 40      # at Kraken Pro's 0.40% starter taker fee
python3 -m propbot --shorts --tf 8h   # any setting is a flag; see --help
python3 -m propbot.grid               # the 288-setting sweep the defaults came from
python3 -m unittest discover -s tests
```

The minute data can live elsewhere if `PROPBOT_MINUTE_DATA` points at its `data/` directory.
`--csv` takes any hourly OHLC file instead, for example Kraken's own history.

**Why Bitstamp:** the sandbox this was built in can't reach api.kraken.com or any other exchange
API. The public ff137 repo has Bitstamp BTC/USD 1-minute candles from 2012 to yesterday.
Bitstamp and Kraken BTC/USD trade within dollars of each other, so for 4-hour bars the venue
doesn't matter. ETH isn't in that dataset, so everything here is BTC only.

## The strategy

`propbot/strategy.py`, run on 4-hour bars built from the hourly data:

- **Entry:** the 4h bar closes above the previous 20 bars' high while above its 100-bar EMA.
  Buy at the next bar's open. Long only.
- **Initial stop:** 1.5 ATR(14) below entry. This distance is 1R.
- **Exit:** a chandelier trail 6 ATR below the highest high since entry. It only tightens, and
  there is no profit target, so winners run.
- **Fills:** a bar that opens through the stop fills at its open (a gap), otherwise at the stop.
  Costs are 10 bps per side by default, covering fee and slippage.

Risk rules, in `propbot/challenge.py`:

- Risk 0.35% of the starting balance ($35) per trade,
- but never more than 25% of the remaining cushion above $9,700,
- and stop once the cushion is under $75.
- One position at a time.

## What the backtest found (2018-01 to 2026-10, BTC/USD)

**Trade stats.** The settings were chosen on 2018–2022 only. 2023 onward is data they never saw.

| | 2018–22 (tuned) | 2023+ (unseen) |
|---|---|---|
| trades per year | 23 | 28 |
| win rate | 24% | 26% |
| average win / loss | +7.0R / −1.0R | +7.1R / −1.1R |
| expectancy, net of costs | +0.93R | +1.08R |
| longest losing streak | 9 | 7 |

The edge held up out of sample. It is a classic trend-follower: it loses three trades in four
and lives on a few big runs.

**Challenge outcomes.** A new challenge starts every week and trades the real sequence of trades
from that date on. "Shuffled" draws the same trades in random order.

| risk/trade | starts | pass | fail | not done | median days to pass | pass within 180 days | shuffled pass |
|---|---|---|---|---|---|---|---|
| 0.25% | 2023+ | 29% | 58% | 13% | 288 | 6% | 62% |
| **0.35%** | **2023+** | **29%** | **62%** | **10%** | **217** | **10%** | **51%** |
| 0.50% | 2023+ | 28% | 72% | 0% | 217 | 13% | 42% |
| 1.00% | 2023+ | 21% | 79% | 0% | 142 | 14% | 34% |
| 0.35% | all | 51% | 46% | 4% | 266 | 14% | 56% |

What that means:

1. **The edge is real but slow.** Reaching +12% at $35 per trade takes about 34R, and the
   strategy makes roughly 25–30R a year. Expect 7–9 months to pass, not weeks. **If the
   challenge has a time limit of 30–90 days, this strategy can't meet it.**
2. **The real trade order is much harsher than the shuffled one** (29% vs 51% since 2023).
   Trend-followers lose in clusters during choppy months, and a 3% floor doesn't survive a
   bad cluster. The shuffled number is the optimistic one.
3. **Bigger size doesn't help.** 1% risk passes faster when it passes, but less often.
4. **Costs matter a lot.** At 0.35% risk with 2023+ starts, the pass rate is 36% with no costs,
   29% at 10 bps per side, 25% at 25 bps and 16% at 40 bps (Kraken Pro's starter taker fee).
   The challenge is only worth trying if the funded account really is commission-free.
5. As a yardstick, with no edge the best possible pass rate for 12%-up-before-3%-down is about
   20%, and costs push it lower. This strategy roughly doubles the shuffled odds, but on the
   real 2023+ sequence it beats luck only modestly.

## Things tried and rejected

- **1-hour bars, tight trails (2–3 ATR), shorts:** these looked fine on 2018–2022 and lost or
  halved their edge after 2023 (`python3 -m propbot.grid`).
- **Sizing from the cushion** (risk 10–20% of the distance to the floor, so size grows with
  profit): no better than fixed 0.35%, and much worse on 2023+ starts.
- **Equity-curve gate** (only trade while the last 3–20 paper trades netted positive): worse
  everywhere. It skips the trades right after a losing patch, which is exactly where new
  trends start.

## Caveats

- BTC only, one venue proxy, about 8 years of data. 2018–2022 was unusually trendy.
- Weekly starts overlap heavily, so "144 starts since 2023" amounts to only a handful of
  independent market regimes. Read the pass rates as ±10 points.
- Funding rates (if the challenge uses perpetual futures), weekend liquidity and the challenge
  platform's own fills aren't modelled.

## Next steps

1. Confirm the rules: bot or API permission, floor, time limit, fees.
2. Add ETH and SOL with Kraken's own candles once the network allows api.kraken.com. More
   uncorrelated signals is the only real way to make this faster.
3. Paper trade it live (the `kalshi-bot` repo already has Kraken venue code) before paying a fee.
