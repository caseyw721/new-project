import unittest

import numpy as np
import pandas as pd

from propbot import challenge as c
from propbot import strategy as s


def bars(rows):
    """rows of (open, high, low, close) on a 1h grid."""
    idx = pd.date_range("2024-01-01", periods=len(rows), freq="1h", tz="UTC")
    df = pd.DataFrame(rows, columns=["open", "high", "low", "close"], index=idx)
    df["volume"] = 1.0
    return df


FLAT = [(100, 101, 99, 100)] * 30          # ATR settles at 2, prior 3-bar high is 101
P = s.Params(tf="1h", entry_n=3, trend_n=3, atr_n=3, stop_atr=1.0, trail_atr=100.0)


class StrategyTest(unittest.TestCase):
    def test_breakout_fills_next_open_and_stops_at_stop(self):
        # breakout close at 103, enter at 103 next open; stop = 103 - ATR (~2.67 after the TR-4 bar)
        rows = FLAT + [(100, 104, 100, 103), (103, 104, 102, 103.5), (103.5, 103.5, 90, 95)]
        t = s.run(bars(rows), P)
        self.assertEqual(len(t), 1)
        tr = t[0]
        self.assertEqual(tr.side, 1)
        self.assertEqual(tr.entry, 103)
        self.assertAlmostEqual(tr.exit, tr.entry - tr.stop_dist)
        self.assertAlmostEqual(tr.r, -1.0)
        self.assertFalse(tr.gap)

    def test_gap_through_stop_fills_at_open(self):
        rows = FLAT + [(100, 104, 100, 103), (103, 104, 102, 103.5), (90, 91, 88, 89)]
        tr = s.run(bars(rows), P)[0]
        self.assertTrue(tr.gap)
        self.assertEqual(tr.exit, 90)
        self.assertLess(tr.r, -1.0)
        self.assertAlmostEqual(tr.mae_r, tr.r)

    def test_trail_only_tightens(self):
        p = s.Params(tf="1h", entry_n=3, trend_n=3, atr_n=3, stop_atr=1.0, trail_atr=1.0)
        rows = FLAT + [(100, 104, 100, 103), (103, 110, 103, 109), (109, 109.5, 108.5, 109), (109, 109, 100, 101)]
        tr = s.run(bars(rows), p)[0]
        self.assertGreater(tr.exit, tr.entry)      # the trail locked in profit before the drop

    def test_costs_in_r(self):
        df = s.to_frame([s.Trade(pd.Timestamp("2024-01-01", tz="UTC"), pd.Timestamp("2024-01-02", tz="UTC"),
                                 1, 100.0, 110.0, 5.0, 2.0, -0.5, False)], cost_bps=10)
        self.assertAlmostEqual(df.cost_r[0], 0.001 * 210 / 5)
        self.assertAlmostEqual(df.net_r[0], 2.0 - 0.042)


class ChallengeTest(unittest.TestCase):
    def replay(self, net, mae=None, rules=c.Rules()):
        net = np.array(net, float)
        mae = np.minimum(net, 0) if mae is None else np.array(mae, float)
        return c.replay(net, mae, np.zeros_like(net), rules)

    def test_pass(self):
        # 0.35% of 10k = $35 per R; $1,200 needs 34.3R
        o = self.replay([10, 10, 10, 5])
        self.assertEqual(o.result, "pass")
        self.assertEqual(o.trades, 4)

    def test_cushion_cap_shrinks_size_and_stops_near_floor(self):
        o = self.replay([-1] * 40)
        self.assertEqual(o.result, "fail")
        self.assertGreater(o.end_equity, 9_700)       # never touched the floor, stopped at min_cushion
        self.assertLess(o.end_equity - 9_700, 75)

    def test_open_equity_touching_floor_fails(self):
        o = self.replay([1], mae=[-9], rules=c.Rules(risk_pct=0.01, cushion_cap=1.0))   # $100 risk, -$900 open
        self.assertEqual(o.result, "fail")

    def test_open_when_trades_run_out(self):
        self.assertEqual(self.replay([1, -1, 1]).result, "open")


if __name__ == "__main__":
    unittest.main()
