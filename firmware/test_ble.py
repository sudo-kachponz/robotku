#!/usr/bin/env python3
"""Tes protokol robotku-v1 lewat Bluetooth LE / Nordic UART Service.
Scan 'Robotku' -> connect -> HELLO, lalu verifikasi pemetaan servo aux P5:
  - HELLO_ACK.ports memuat 5 (aux terpetakan)
  - caps memuat ATTACH/DETACH/SET_HEAD_POSITION
  - SET_PORT/ATTACH/SET_HEAD_POSITION ke P5  -> TIDAK UNSUPPORTED
  - SET_PORT ke port 3 (kosong)              -> UNSUPPORTED (kontrol)"""
import sys, json, asyncio
from bleak import BleakScanner, BleakClient

NUS_SERVICE   = "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
NUS_RX_WRITE  = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
NUS_TX_NOTIFY = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"
BLE_NAME = "Robotku"

def parse_frames(blob):
    out = []
    for piece in blob.replace("\n", ";").split(";"):
        p = piece.strip()
        if p:
            try: out.append(json.loads(p))
            except Exception: pass
    return out

async def main():
    print(f"[i] Scan BLE mencari '{BLE_NAME}' ...")
    dev = await BleakScanner.find_device_by_filter(
        lambda d, ad: d.name == BLE_NAME or NUS_SERVICE in (ad.service_uuids or []),
        timeout=12.0)
    if not dev:
        print("[x] 'Robotku' TIDAK ketemu — board mati / tak advertising / sudah "
              "tersambung ke perangkat lain. (Coba jalur USB serial: test_serial.py)")
        sys.exit(1)
    print(f"[OK] Ketemu {dev.name} [{dev.address}]")

    rx = {"buf": ""}
    got = asyncio.Event()
    def on_notify(_, data): rx["buf"] += data.decode("utf-8", "replace"); got.set()

    async with BleakClient(dev) as c:
        print(f"[OK] GATT connected = {c.is_connected}")
        await c.start_notify(NUS_TX_NOTIFY, on_notify)

        async def send(line, wait=1.2):
            rx["buf"] = ""; got.clear()
            await c.write_gatt_char(NUS_RX_WRITE, line.encode(), response=False)
            try: await asyncio.wait_for(got.wait(), wait)
            except asyncio.TimeoutError: pass
            await asyncio.sleep(0.3)
            return parse_frames(rx["buf"])

        ok = run_checks(await gather(send))
    print("\n=== HASIL BLUETOOTH:", "SEMUA LULUS ✅" if ok else "ADA YANG GAGAL ❌", "===")
    sys.exit(0 if ok else 1)

async def gather(send):
    r = {}
    r["hello"] = await send('{"command":"HELLO","protocol":"robotku-v1"};', 1.5)
    r["attach5"]  = await send('{"command":"ATTACH","port":5};')
    r["setport5"] = await send('{"command":"SET_PORT","port":5,"value":60};')
    r["head"]     = await send('{"command":"SET_HEAD_POSITION","angle":120};')
    r["port3"]    = await send('{"command":"SET_PORT","port":3,"value":50};')  # kosong -> UNSUPPORTED
    await send('{"command":"SET_PORT","port":5,"value":0};')   # kembalikan aux ke tengah
    return r

def unsupported_ops(frames):
    return [f.get("op") for f in frames if f.get("command") == "UNSUPPORTED"]

def run_checks(r):
    ack = next((f for f in r["hello"] if f.get("command") == "HELLO_ACK"), None)
    if not ack:
        print("[x] Tidak ada HELLO_ACK."); return False
    caps, ports = ack.get("capabilities", []), ack.get("ports", [])
    print(f"[OK] HELLO_ACK fw={ack.get('fw')} ports={ports}")
    print(f"     caps={', '.join(caps)}")
    ok = True
    def check(name, cond):
        nonlocal ok
        print(f"  {'✅' if cond else '❌'} {name}")
        ok = ok and cond
    check("ports memuat 5 (P5/aux terpetakan)", 5 in ports)
    check("caps ATTACH/DETACH/SET_HEAD_POSITION",
          all(x in caps for x in ("ATTACH", "DETACH", "SET_HEAD_POSITION")))
    check("ATTACH P5 bukan UNSUPPORTED", "ATTACH" not in unsupported_ops(r["attach5"]))
    check("SET_PORT P5 bukan UNSUPPORTED", "SET_PORT" not in unsupported_ops(r["setport5"]))
    check("SET_HEAD_POSITION bukan UNSUPPORTED",
          "SET_HEAD_POSITION" not in unsupported_ops(r["head"]))
    check("SET_PORT port 3 (kosong) TETAP UNSUPPORTED", "SET_PORT" in unsupported_ops(r["port3"]))
    return ok

asyncio.run(main())
