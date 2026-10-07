# Controller tools (host side, Python 3 + numpy)

Scripts used on 2026-10-07 to get two rings (index = pointer, thumb = clicks) working on one receiver. They talk
to the receiver's serial port (`RECEIVER_PORT`, default `/dev/cu.usbmodem2101`) and speak their cues through
`~/bin/claude-say` (ElevenLabs voice), so they can be run while the user's hands are busy.

| Script | What it does |
|---|---|
| `ringcmd.py PORT cmd...` | Send serial commands (PROTOCOL.md) and print the replies, without telemetry lines. |
| `ring_update_watch.py` | Update each ring that gets plugged in (`bootloader` → XIAO-SENSE → `prebuilt/ring.uf2`), then set and save its `txdiv` (index 2, thumb 6). |
| `axis_cal.py` | Voice-guided axis calibration of the pointer ring (still → right → up), applied to the receiver only when the two moves are ≥ 55° apart. |
| `posture_test.py OUT.csv "position" ...` | Voice-guided: in each position, still / left-right / up-down / wrist twist, recording every packet from both rings (`raw,1`). |
| `posture_eval.py OUT.csv` | Scores pointing mappings on that recording (gravity tilt, fixed, learned axes perpendicular to the finger axis, thumb-relative, twist gate). |
| `pinch_rec.py PORT OUT SECONDS`, `pinch_analyze.py OUT` | Record both rings while pinching and look for simultaneous jolts. |
| `fus_analyze.py ring.csv frames.jsonl` | Camera lag behind the ring (cross-correlation of angular speeds) and ring-axis → image-motion fit. |

Results that set the current receiver configuration (posture test, three positions): gravity tilt mode leaked wrist
twist into the cursor (up to 0.69 of real moves) and mixed axes; learned hand-frame axes perpendicular to the finger
axis plus the twist gate kept 94-100 % of real motion with twist leak 0.04-0.17; the blend mode (`tilt,2`) adds
gravity's axes while the finger is level, which fixed a rolled wrist turning up-down into left-right.
