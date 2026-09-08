#!/usr/bin/env bash
# Flash firmware Robotku ke ESP32 (offset standar ESP32 4MB).
set -e
PORT="${1:-/dev/ttyUSB0}"
PY=/home/firania/anaconda3/bin/python3
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
B="${DIR}/build"
CORE=/home/firania/.arduino15/packages/esp32/hardware/esp32/2.0.17/tools/partitions/boot_app0.bin

echo "[i] Flashing ke $PORT ..."
"$PY" -m esptool --chip esp32 --port "$PORT" --baud 460800 \
  --before default_reset --after hard_reset write_flash -z \
  --flash_mode dio --flash_freq 40m --flash_size 4MB \
  0x1000  "$B/robotku-esp32.ino.bootloader.bin" \
  0x8000  "$B/robotku-esp32.ino.partitions.bin" \
  0xe000  "$CORE" \
  0x10000 "$B/robotku-esp32.ino.bin"
echo "[OK] Flash selesai. Board akan reboot menjalankan firmware Robotku."
