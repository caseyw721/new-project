#!/usr/bin/env bash
# Flash the receiver firmware onto the nRF52840 Dongle over its USB bootloader.
#
#   ./flash-receiver.sh                 # flashes prebuilt/receiver-dfu.zip
#   ./flash-receiver.sh path/to.zip     # flashes another DFU package
#
# Needs: nrfutil with the "device" command (brew install nrfutil; nrfutil install device).
# Put the dongle in bootloader mode first: press the small RESET button that sticks out
# sideways (next to the round white button). The red light pulses slowly when it's ready.
# The script waits up to 60 s for that.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PKG="${1:-$HERE/prebuilt/receiver-dfu.zip}"

echo "Waiting for the dongle in bootloader mode (press its side RESET button)..."
for i in $(seq 1 60); do
  SN="$(nrfutil device list --json 2>/dev/null \
        | python3 -c 'import json,sys
for line in sys.stdin:
    try: m=json.loads(line)
    except ValueError: continue
    if m.get("type")!="task_end": continue
    for dev in (m.get("data") or {}).get("data",{}).get("devices",[]):
        p=(dev.get("usb") or {}).get("product","") or ""
        if "Bootloader" in p or dev.get("currentMcuState")=="Bootloader":
            print(dev["serialNumber"]); raise SystemExit' 2>/dev/null || true)"
  [ -n "$SN" ] && break
  sleep 1
done
if [ -z "${SN:-}" ]; then
  echo "No dongle in bootloader mode found. Press its side RESET button and run this again." >&2
  exit 1
fi
echo "Found bootloader on $SN, writing $(basename "$PKG")"
nrfutil device program --firmware "$PKG" --serial-number "$SN" --traits nordicDfu 2>&1 | grep -v JLinkARM
sleep 3
echo "--- devices now:"
nrfutil device list 2>&1 | grep -v JLinkARM
