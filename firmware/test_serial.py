#!/usr/bin/env python3
"""Tes protokol robotku-v1 lewat USB Serial. Verifikasi pemetaan servo aux P5:
  - HELLO_ACK.ports memuat 5
  - SET_PORT/ATTACH/SET_HEAD_POSITION ke P5 -> TIDAK UNSUPPORTED
  - SET_PORT port 3 (kosong)                -> UNSUPPORTED (kontrol)"""
import sys, time, json, serial

PORT = sys.argv[1] if len(sys.argv) > 1 else "/dev/ttyUSB0"

def parse_frames(blob):
    out = []
    for piece in blob.replace("\n", ";").split(";"):
        p = piece.strip()
        if p:
            try: out.append(json.loads(p))
            except Exception: pass
    return out

try:
    ser = serial.Serial(PORT, 115200, timeout=0.2)
except Exception as e:
    print(f"[x] Gagal buka {PORT}: {e}  (BLE juga bisa dicoba: test_ble.py)")
    sys.exit(2)
print(f"[i] USB Serial {PORT} @ 115200")
time.sleep(2.0); ser.reset_input_buffer()

def send(line, wait=1.2):
    ser.write(line.encode()); ser.flush()
    end = time.time() + wait; buf = ""
    while time.time() < end:
        buf += ser.read(256).decode("utf-8", "replace")
    return parse_frames(buf)

def unsupported_ops(frames):
    return [f.get("op") for f in frames if f.get("command") == "UNSUPPORTED"]

hello   = send('{"command":"HELLO","protocol":"robotku-v1"};', 1.5)
attach5  = send('{"command":"ATTACH","port":5};')
setport5 = send('{"command":"SET_PORT","port":5,"value":60};')
head     = send('{"command":"SET_HEAD_POSITION","angle":120};')
port3    = send('{"command":"SET_PORT","port":3,"value":50};')
send('{"command":"SET_PORT","port":5,"value":0};')
ser.close()

ack = next((f for f in hello if f.get("command") == "HELLO_ACK"), None)
if not ack:
    print("[x] Tidak ada HELLO_ACK — firmware diam / belum di-flash."); sys.exit(1)
caps, ports = ack.get("capabilities", []), ack.get("ports", [])
print(f"[OK] HELLO_ACK fw={ack.get('fw')} ports={ports}")
print(f"     caps={', '.join(caps)}")

ok = True
def check(name, cond):
    global ok
    print(f"  {'✅' if cond else '❌'} {name}"); ok = ok and cond

check("ports memuat 5 (P5/aux terpetakan)", 5 in ports)
check("caps ATTACH/DETACH/SET_HEAD_POSITION",
      all(x in caps for x in ("ATTACH", "DETACH", "SET_HEAD_POSITION")))
check("ATTACH P5 bukan UNSUPPORTED", "ATTACH" not in unsupported_ops(attach5))
check("SET_PORT P5 bukan UNSUPPORTED", "SET_PORT" not in unsupported_ops(setport5))
check("SET_HEAD_POSITION bukan UNSUPPORTED", "SET_HEAD_POSITION" not in unsupported_ops(head))
check("SET_PORT port 3 (kosong) TETAP UNSUPPORTED", "SET_PORT" in unsupported_ops(port3))

print("\n=== HASIL USB SERIAL:", "SEMUA LULUS ✅" if ok else "ADA YANG GAGAL ❌", "===")
sys.exit(0 if ok else 1)
