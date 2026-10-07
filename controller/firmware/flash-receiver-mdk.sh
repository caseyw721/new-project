#!/bin/bash
# Update the Makerdiary MDK dongle receiver over USB without touching its button: ask the running firmware to
# restart into its UF2 drive, copy the image, wait for the serial port to come back and print its version.
#   ./flash-receiver-mdk.sh [IMAGE.uf2]          (default: prebuilt/receiver-mdk.uf2; RECEIVER_PORT to override the port)
# Settings saved with `save` and the pinned ring live in their own flash area and survive the update.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
UF2="${1:-$HERE/prebuilt/receiver-mdk.uf2}"
PORT="${RECEIVER_PORT:-/dev/cu.usbmodem2101}"
[ -f "$UF2" ] || { echo "no such image: $UF2"; exit 1; }
if [ ! -d /Volumes/UF2BOOT ]; then
  [ -e "$PORT" ] && python3 "$HERE/../tools/ringcmd.py" "$PORT" bootloader >/dev/null 2>&1
  for _ in $(seq 1 40); do [ -d /Volumes/UF2BOOT ] && break; sleep 0.25; done
  [ -d /Volumes/UF2BOOT ] || { echo "no UF2BOOT drive appeared: double-click the dongle's button and run this again"; exit 1; }
  sleep 1   # let the drive finish mounting before writing to it
fi
cp -X "$UF2" /Volumes/UF2BOOT/ || echo "copy reported an error (normal if the drive vanished as the copy ended)"
# The bootloader exposes a serial port under the same name, so wait for the drive to go away first.
for _ in $(seq 1 80); do [ -d /Volumes/UF2BOOT ] || break; sleep 0.25; done
[ -d /Volumes/UF2BOOT ] && { echo "the UF2BOOT drive is still there: the image was not taken"; exit 1; }
for _ in $(seq 1 80); do [ -e "$PORT" ] && break; sleep 0.25; done
[ -e "$PORT" ] || { echo "the receiver did not come back on $PORT"; exit 1; }
sleep 2
python3 "$HERE/../tools/ringcmd.py" "$PORT" ver rings
