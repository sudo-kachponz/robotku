# Deploy robotku ke VPS 1GB (target ~300 user konkuren)

Robotku adalah **static export** (`output: 'export'`). Server tidak melakukan
komputasi per-user — hanya mengirim file. Jadi di VPS 1GB, RAM/CPU **bukan**
batasannya; yang jadi batasan adalah **bandwidth**. Semua yang berat (Blockly,
TensorFlow.js, Three.js, Web Serial/BLE) jalan di browser tiap user.

## Langkah

```bash
npm run build                                   # hasilkan out/
sudo cp deploy/nginx-robotku.conf /etc/nginx/sites-available/robotku
sudo ln -s /etc/nginx/sites-available/robotku /etc/nginx/sites-enabled/
sudo mkdir -p /var/www/robotku
sudo rsync -a --delete out/ /var/www/robotku/
sudo certbot --nginx -d hub.robotku.id          # HTTPS wajib (Web Serial/BLE/getUserMedia)
sudo nginx -t && sudo systemctl reload nginx
```

Deploy ulang berikutnya cukup: `npm run build && sudo rsync -a --delete out/ /var/www/robotku/`.

## Swap (penting di box 1GB)

nginx statis nyaris tak makan RAM, tapi `certbot`/`apt`/build tool bisa bikin
OOM di 1GB. Tambah 2GB swap sekali:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Catatan: **jangan build di VPS 1GB** — `next build` bisa >1GB RAM. Build di lokal/CI, kirim `out/` saja.

## Kapasitas & bandwidth (angka nyata dari build ini)

| Item | Ukuran | Catatan |
|------|--------|---------|
| First-load `/cek/` | 0.48MB → **0.15MB gzip** | 300 user = ~45MB. Sepele. |
| Aset 3D sim (`/sim3d/`) | ~20MB | **on-demand**, cuma saat user buka 3D sim; cache 30 hari |

- **RAM/CPU**: bukan masalah. nginx statis melayani puluhan ribu req/s per core.
- **Bandwidth**: batasan sebenarnya. Skenario terberat = banyak user buka 3D sim
  pertama kali bersamaan (300 × 20MB ≈ 6GB). Mitigasi: aset `/sim3d/` di-cache
  browser (config sudah set), jadi hanya first-hit yang berat. Kalau kuota egress
  VPS ketat, taruh CDN gratis (Cloudflare) di depan — itu menyerap 90%+ transfer.

## Uji beban

```bash
# dari mesin lain (bukan VPS-nya sendiri):
python3 scripts/loadtest.py https://hub.robotku.id/cek/ -c 300 -n 3000
python3 scripts/loadtest.py https://hub.robotku.id/_next/static/chunks/ -c 300 -d 15
```

`verdict PASS` = 0 request drop. Uji lokal 300 konkuren sudah lolos (0 drop);
nginx akan jauh lebih cepat daripada server uji python.
