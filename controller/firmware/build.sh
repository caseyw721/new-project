#!/usr/bin/env bash
# Build the ring and receiver firmware from source (Linux or macOS).
#
# You don't need this to use the controller: ready-to-flash files are in
# firmware/prebuilt/. Use it after changing the code.
#
#   ./build.sh            # set up the toolchain on first run, then build
#   WORKSPACE=/path ./build.sh
#
# First run downloads ~2 GB (Nordic nRF Connect SDK + ARM compiler).
set -euo pipefail

NCS_VERSION=v3.4.1
ZEPHYR_SDK_VERSION=1.0.1

HERE="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE="${WORKSPACE:-$HOME/.cache/pointer-fw}"
NCS="$WORKSPACE/ncs"
SDK="$WORKSPACE/zephyr-sdk-$ZEPHYR_SDK_VERSION"
VENV="$WORKSPACE/venv"
OUT="$HERE/prebuilt"

mkdir -p "$WORKSPACE"

# --- Python environment (the SDK needs Python 3.12 or newer) ---
if [ ! -x "$VENV/bin/west" ]; then
  PY="$(command -v python3.13 || command -v python3.12 || command -v python3)"
  "$PY" -c 'import sys; assert sys.version_info >= (3, 12), "Python 3.12+ required"'
  "$PY" -m venv "$VENV"
  "$VENV/bin/pip" install -q --upgrade pip wheel
  "$VENV/bin/pip" install -q west
fi
export PATH="$VENV/bin:$PATH"

# --- nRF Connect SDK (only the parts this project needs) ---
if [ ! -d "$NCS/.west" ]; then
  west init -m https://github.com/nrfconnect/sdk-nrf --mr "$NCS_VERSION" "$NCS"
  (cd "$NCS" &&
    west config manifest.project-filter -- '-.*,+nrf,+zephyr,+hal_nordic,+cmsis,+cmsis_6,+nrfxlib,+segger,+picolibc' &&
    west update --narrow -o=--depth=1 &&
    pip install -q -r zephyr/scripts/requirements-base.txt -r nrf/scripts/requirements-build.txt)
fi

# --- Zephyr SDK: ARM compiler only ---
if [ ! -x "$SDK/gnu/arm-zephyr-eabi/bin/arm-zephyr-eabi-gcc" ]; then
  case "$(uname -s)-$(uname -m)" in
    Linux-x86_64) HOST=linux-x86_64 ;;
    Linux-aarch64) HOST=linux-aarch64 ;;
    Darwin-arm64) HOST=macos-aarch64 ;;
    Darwin-x86_64) HOST=macos-x86_64 ;;
    *) echo "Unsupported host $(uname -s)-$(uname -m)"; exit 1 ;;
  esac
  BASE="https://github.com/zephyrproject-rtos/sdk-ng/releases/download/v$ZEPHYR_SDK_VERSION"
  MIN="zephyr-sdk-${ZEPHYR_SDK_VERSION}_${HOST}_minimal.tar.xz"
  ARM="toolchain_gnu_${HOST}_arm-zephyr-eabi.tar.xz"
  (cd "$WORKSPACE" &&
    curl -fLO "$BASE/$MIN" && curl -fLO "$BASE/$ARM" &&
    curl -fL "$BASE/sha256.sum" | grep -E " ($MIN|$ARM)\$" > sums.txt &&
    (sha256sum -c sums.txt 2>/dev/null || shasum -a 256 -c sums.txt) &&
    tar xf "$MIN" && mkdir -p "$SDK/gnu" && tar xf "$ARM" -C "$SDK/gnu" &&
    rm -f "$MIN" "$ARM" sums.txt)
  (cd "$SDK" && ./setup.sh -c)
fi
export ZEPHYR_SDK_INSTALL_DIR="$SDK"

# --- build ---
cd "$NCS"
west build -p -b xiao_ble/nrf52840/sense -d "$WORKSPACE/build_ring" "$HERE/ring"
west build -p -b nrf52840dongle/nrf52840 -d "$WORKSPACE/build_receiver" "$HERE/receiver"

mkdir -p "$OUT"
cp "$WORKSPACE/build_ring/ring/zephyr/zephyr.uf2" "$OUT/ring.uf2"
cp "$WORKSPACE/build_receiver/receiver/zephyr/zephyr.hex" "$OUT/receiver.hex"

# Optional: package for the dongle's USB bootloader (command-line flashing).
if command -v nrfutil >/dev/null 2>&1 && nrfutil pkg generate --help >/dev/null 2>&1; then
  nrfutil pkg generate --hw-version 52 --sd-req=0x00 \
    --application "$OUT/receiver.hex" --application-version 1 "$OUT/receiver-dfu.zip"
fi

(cd "$OUT" && (sha256sum ring.uf2 receiver.hex receiver-dfu.zip 2>/dev/null ||
               shasum -a 256 ring.uf2 receiver.hex receiver-dfu.zip) > SHA256SUMS || true)
echo "Built: $OUT"
