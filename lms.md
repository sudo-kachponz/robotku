Lanjut. ESP32-ku masih di rumah, jadi apa pun yang butuh hardware nyata kita tunda —
tapi jangan pakai itu sebagai alasan berhenti: sebagian besar R4 dan R5 tidak butuh robot.

PRIORITAS SEKARANG (urut):
1. R2 slice terisolasi — OPCODES typed constant di src/domain/protocol.ts, hapus semua `any`
   di src/runtime + src/blockcoding. Jangan sentuh komponen yang lagi dipegang agent lain.
2. R4 penuh — responsiveness tidak butuh ESP32 sama sekali. Kerjakan 8 file CSS yang nol
   media query, drawer AppShell, fluid type scale, touch target 44px, bottom sheet <768px,
   safe-area global, dan Playwright smoke test 3 viewport. Satu-satunya yang ditunda:
   verifikasi fisik di iPhone.
3. R5 bagian software-only — semua ini bisa dites tanpa robot:
   - docs/CONNECTIVITY.md (matrix + penjelasan mixed-content ws:// vs https)
   - capability matrix unit test dengan navigator/UA di-mock: Chrome desktop, Chrome Android,
     Safari iOS, Firefox, insecure context
   - FakeTransport di src/test + test lifecycle connect→run→telemetry→timeout→estop
   - ConnectPanel yang me-rank transport per device + copy alasan (Bahasa Indonesia)
   - layar diagnostik "Cek perangkat saya"
   - rate limiting / command coalescing, backoff, BroadcastChannel multi-tab
   Yang DITUNDA sampai robot ada: acceptance 1–4 R5 (connect BLE/serial/WiFi beneran).
   Tandai jelas di docs sebagai "belum diverifikasi dengan hardware".

ATURAN KOORDINASI (agent lain lagi jalan):
- Kamu TIDAK menyentuh: useBlocklyWorkspace.ts, BlockCoding.tsx, dan file hasil pecahannya.
- Kalau butuh perubahan di sana, tulis catatan di docs/HANDOFF.md, jangan edit.
- Jalankan `npm test && npm run typecheck` setelah tiap slice, bukan cuma di akhir.

R3 heap numbers: ambil dulu di laptopku (Ubuntu + Chrome, RTX 4070) sebagai baseline
sementara, tulis apa adanya di PERF-BASELINE.md dengan label "diukur di dev machine,
BUKAN Chromebook — target kelas masih perlu diverifikasi". Lebih baik angka jujur dengan
disclaimer daripada kosong.

R6: JANGAN jalankan deploy workflow. Kredensial FTP belum kurotasi. Tambahkan guard di
workflow yang gagal kalau secret belum ada, supaya tidak ada yang tidak sengaja push
pakai kredensial lama.

Mulai dari nomor 1, lapor per slice.