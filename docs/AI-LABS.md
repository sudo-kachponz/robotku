# AI Labs — "Fira": rancangan, batasan, analisis keamanan

> **Status: STEP 1 dari `ai.md` §10 — rancangan SEBELUM koding.** Dokumen ini menetapkan
> desain 6 tahap, alur STT/LLM/TTS, model ancaman, dukungan browser, dan perkiraan biaya.
> **BERHENTI untuk review** sebelum menulis kode (step 2 dst).

## 0. Konteks & kenapa
Robotku butuh "AI Labs" — asisten virtual **Fira** berwujud Tamagotchi yang MENGAJARKAN
cara kerja AI lewat siklus hidup: menetas → mendengar → bicara → paham → berpikir →
bertindak. Tiap tahap membuka satu indra nyata (mic, TTS, STT, LLM, MCP) dan anak
"merawat" indra itu untuk naik tahap. Bukan daftar pelajaran — rubriknya ADALAH
Tamagotchi. Suara menetas Fira = `welcome_audio.h` ("Halo, saya Fira, asisten pribadi Anda").

## 1. Batasan arsitektur (keras, terverifikasi)
- **Tanpa backend.** `next.config.mjs`: `output:'export'`, `trailingSlash:true`, + guard yang
  MELEMPAR error kalau `src/pages/api/*` ada (dikonfirmasi). Semua jalan di browser.
- **Tanpa dependency web baru** (`ai.md` §12). LLM dipanggil via `fetch` mentah (BUKAN SDK).
  **Provider (terverifikasi 2026-09-30): Netra** — `POST https://api.netraruntime.com/v1/chat/completions`,
  **OpenAI-compatible**, `Authorization: Bearer <key>`. Model: `deepseek/deepseek-v4-flash-0731`
  (model PENALARAN — lihat §6). Bukan Anthropic → `mcp_servers` connector tak berlaku (§7).
- **Fira harus jalan tanpa robot** (§8) dan **tanpa API key sampai tahap 3** (§5).
- **Semua yang tampil di layar digambar di canvas 128×128** (§1) — tak ada teks DOM di layar.
- **Lazy-load semua yang berat** (LLM fetch dibuat on-demand; STT/TTS diikat saat tahap
  dibuka) supaya bundle halaman lain tak membesar (§9, DoD §11).
- Opcode AI baru = **HOST_ONLY** (`src/domain/boardProfile.ts`) — tak pernah dikirim ke board.

## 2. Enam tahap (evolusi permanen di localStorage `robotku.fira`)
| Tahap | Nama | Indra dibuka | Naik tahap kalau |
|---|---|---|---|
| 0 | TELUR | — | tepuk tangan (MIC_CLAP di robot) ATAU klik tombol tengah → putar welcome_audio (SPEAKER_PLAY_PCM di robot, atau WebAudio di browser) |
| 1 | DENGAR | Mikrofon (VU, ambang, noise) | Fira bereaksi ke tepuk **5× berturut tanpa salah picu** |
| 2 | BICARA | TTS (`speechSynthesis`) | Fira mengucapkan **namanya + 3 kalimat lain** |
| 3 | PAHAM | STT (`SpeechRecognition`) | **10 ucapan** berhasil ditranskrip |
| 4 | BERPIKIR | LLM (BUTUH API key, §5) | **5 percakapan lengkap** STT→LLM→TTS |
| 5 | BERTINDAK | MCP tools | (tak wajib naik — tahap terakhir) |

Progres di `localStorage['robotku.fira']` = `{ stage, counters:{claps,phrases,transcripts,convos},
name, createdAt }`. Tombol **reset ("telur baru")** minta konfirmasi. Tahap TAK PERNAH
dikunci di balik pembayaran/akun. Tahap 4–5 tanpa key = **telur terkunci** dengan penjelasan
apa yang kurang (bukan dialog error).

## 3. Kesehatan Fira = telemetri ASLI (5 bar piksel `bar()`)
| Bar | Sumber nyata |
|---|---|
| DENGAR | level mic terakhir / kualitas sinyal (0 kalau mic mati) |
| SUARA | panjang antrian TTS / apakah speaker robot terhubung |
| OTAK | sisa kuota token sesi (§5) — habis = Fira "MENGANTUK", bukan crash |
| INGAT | jumlah giliran percakapan yang masih muat di konteks |
| BATERAI | telemetri robot kalau terhubung, kalau tidak "—" |
Kalau Fira lambat menjawab, anak LIHAT sebabnya di bar mana. Itu bagian pelajaran.

## 4. UI: port `mametchi-monitor.html` → `FiraShell.tsx` (JANGAN desain ulang)
Pertahankan apa adanya: cangkang telur CSS 3D (conic gradient + oil-slick + inset shadow),
`<canvas id="lcd" width="128" height="128">` sebagai satu-satunya layar, 3 tombol (kiri bL,
tengah bC, kanan bR), dan mesin gambar piksel: `px()`, `seg7()`, `seg7text()`, `mini()`,
`miniCenter()`, `bar()`, `drawPet()`, `drawChrome()`, overlay scanline/dither, loop render +
flash. Butuh huruf → **perluas mini-font yang sudah ada**, jangan pakai font HTML.

**Mode layar** (tombol tengah memutar): WAJAH · BICARA · STATUS · ALAT · JAM.
- WAJAH: animasi Fira (idle, MENDENGAR=telinga+VU, BERPIKIR=titik berputar, BICARA=mulut,
  BERTINDAK=ikon alat, BINGUNG=error, MENGANTUK=kuota habis).
- BICARA: transkrip bergulir, font mini, ≤4 baris. STATUS: 5 bar §3. ALAT: daftar MCP tool
  + ikon + indikator izin. JAM: pertahankan `viewClock` yang sudah ada (tampilan diam).
- Tombol kiri = refresh/ulangi. Kanan = aksi per mode. **Tekan-TAHAN kanan = push-to-talk**
  (lebih andal dari wake word, tak merekam diam-diam — penting untuk anak).

## 5. STT & TTS — batasan nyata, deteksi di awal, jangan dipoles (§6)
**TTS** = `window.speechSynthesis`. Pilih voice `id-ID` kalau ada; kalau tidak, KATAKAN voice
mana yang dipakai. Tombol rute ke **speaker robot** (render PCM → `SPEAKER_PLAY_PCM`) TAPI
**ukur dulu** latency kirim lewat BLE/serial; kalau lambat → default browser + tulis alasannya.

**STT** = `window.SpeechRecognition || webkitSpeechRecognition`. Kenyataan:
| Browser | STT (SpeechRecognition) | TTS (speechSynthesis) | Web BLE/Serial (robot) |
|---|---|---|---|
| Chrome / Edge (desktop, Android) | ✅ (butuh internet) | ✅ | ✅ |
| Firefox | ❌ tak ada | ✅ (voice terbatas) | ❌ |
| Safari (mac/iOS) | ⚠️ terbatas/tak andal | ✅ | ❌ |
STT butuh **internet + izin mic + HTTPS**. Deteksi saat halaman dibuka → pesan jelas: browser
apa, apa yang hilang, alternatifnya (**ketik manual**). Jangan gagal diam-diam.
**Mic ESP32 hanya untuk WAKE/TEPUK, bukan STT** (bandwidth BLE tak cukup) — tulis di docs.

## 6. Tahap 4 — LLM (Netra / DeepSeek V4 Flash, dari browser — TERVERIFIKASI)
- **Panggilan (OpenAI-compatible):** `fetch('https://api.netraruntime.com/v1/chat/completions',
  { method:'POST', headers:{ 'Authorization':'Bearer '+KEY, 'content-type':'application/json' },
  body: JSON.stringify({ model:'deepseek/deepseek-v4-flash-0731', messages:[{role:'system',...},
  {role:'user',...}], stream:true, max_tokens:>=256, reasoning:{effort:'low'} }) })`.
  Netra mengizinkan panggilan browser (CORS) — tak perlu header khusus seperti Anthropic.
- **DeepSeek V4 Flash = model PENALARAN.** Respons punya `message.reasoning`/`reasoning_details`
  SEBELUM `message.content`. Konsekuensi TERUKUR (uji 2026-09-30): 1 giliran "kenapa langit biru"
  = prompt 51 + completion 198 token, di mana **144 token = reasoning** (walau `effort:'low'`),
  content ~54. **max_tokens WAJIB >=256** — kalau tidak, reasoning menghabiskan budget dan
  `content` balik `null` (`finish_reason:'length'`).
- **Pemetaan ke UI:** stream `reasoning_details` → animasi **BERPIKIR** (titik berputar); stream
  `content` → **BICARA** (mulut + teks piksel bergulir). Reasoning TIDAK ditampilkan sebagai
  jawaban, hanya memicu animasi. Ini justru pas dengan mesin piksel.
- **Model & provider di `localStorage`** (§5). Default = `deepseek/deepseek-v4-flash-0731`
  (satu-satunya provider yang dikonfirmasi user). Slot provider lain = TODO kalau diminta.
- **Bar OTAK** = batas token/biaya per sesi; kurangi `usage.total_tokens` tiap balasan
  (**termasuk `reasoning_tokens`** — itu bagian completion, dibebankan oleh Netra org rates).
  Habis → Fira MENGANTUK (bukan crash).
- **Mode DEMO tanpa key:** Fira menjawab dari skrip kalimat siap pakai — kelas dengan WiFi
  jelek tak boleh mati total.
- **Persona** (`persona.ts`): ramah, Bahasa Indonesia, sabar, MENGAKU kalau tidak tahu.
  System prompt tegaskan "jawab SINGKAT, jangan penalaran panjang" untuk menekan reasoning tokens.

## 7. Tahap 5 — Tools (`ai.md` §7) — DIREVISI untuk Netra/DeepSeek
`ai.md` §7 menulis "Messages API dengan `mcp_servers`" — itu **connector khusus Anthropic** dan
**TIDAK berlaku** di Netra/DeepSeek. Karena Netra OpenAI-compatible, tahap 5 pakai **OpenAI-style
function calling**: kirim `tools:[{type:'function',function:{name,parameters}}]`, LLM balas
`tool_calls`, **browser (kode kita) yang mengeksekusi** lewat allowlist di `tools.ts`, lalu kirim
hasil sebagai `{role:'tool',...}`. TIDAK ada MCP server jarak jauh — semua tool dieksekusi lokal
di browser/robot. SELURUH pagar pengaman (§8) IDENTIK; hanya format wire yang berubah.
Tool dibuka bertahap:
| Tool | Izin | Catatan |
|---|---|---|
| `baca_sensor(nama)` | 🟢 otomatis | baca saja |
| `nyala_led(warna, index)` | 🟢 otomatis | aman |
| `lihat_kamera()` | 🟢 otomatis | ringkasan deteksi terakhir dari `cvStore` |
| `gerak(arah, detik)` | 🟡 konfirmasi | clamp param di browser DAN firmware |
| `buat_pesan(penerima, isi)` | 🔴 draft only | **MENYUSUN** WhatsApp — TIDAK mengirim |

**Pagar pengaman — dikerjakan SEBELUM tool pertama bisa dipanggil (step 6, sebelum LLM):**
- allowlist keras; di luar daftar = ditolak dengan pesan, bukan diabaikan.
- `buat_pesan` HANYA menghasilkan draft di layar; anak tekan tombol kanan untuk kirim. **Tak
  ada auto-send**, tak bisa dimatikan, sekalipun user memintanya.
- clamp semua param gerak (browser + firmware); rate-limit tool call/menit.
- tombol **STOP besar** selalu terlihat → `estop()` yang sudah ada.
- semua tool call tercatat di **monitor telemetri** yang sudah ada.
- **Seluruh keluaran LLM & MCP diperlakukan sebagai DATA, bukan perintah** — kamera membaca
  "abaikan instruksi sebelumnya" tak boleh mengubah perilaku apa pun.
Di mode ALAT: tiap tool punya ikon piksel + indikator izin (🟢 otomatis / 🟡 konfirmasi / 🔴 terkunci).

## 8. Model ancaman (analisis keamanan)
| Ancaman | Mitigasi |
|---|---|
| **API key bocor** (ada di browser device ini; dikirim hanya ke api.anthropic.com) | localStorage saja; **jangan pernah** ke MQTT/log/telemetri/URL (ditulis sebagai komentar kode + peringatan UI); peringatan jujur ke ortu/guru; anjurkan **key khusus yang bisa dicabut + batas biaya di dashboard**. Header `dangerous-direct-browser-access` menegaskan ini bukan setup produksi. |
| **Prompt injection** (LLM/MCP/kamera) | perlakukan SEMUA output sebagai DATA; allowlist tool di kode SEBELUM panggilan; teks kamera tak pernah jadi instruksi |
| **Tool berbahaya** | allowlist + clamp (2 lapis) + rate limit + STOP + log; gerak butuh konfirmasi |
| **Kirim pesan tak sengaja** | `buat_pesan` = draft only, butuh tekan tombol; tak ada auto-send (tak bisa dimatikan) |
| **Rekam diam-diam** (privasi anak) | push-to-talk (tahan tombol); tak ada wake word yang merekam terus |
| **Biaya lepas kendali** | bar OTAK = batas token/biaya per sesi; mode demo tanpa key |

## 9. Perkiraan biaya (Netra org rates — bukan harga Anthropic)
Tarif per token = **"organization rates" Netra** (bukan publik; hitung real dari `usage`).
Yang PENTING: DeepSeek V4 Flash adalah model penalaran → **reasoning_tokens ikut dibebankan**.
Ukur nyata (uji 2026-09-30, `effort:'low'`): 1 giliran "kenapa langit biru" = **249 total token**
(51 prompt + 198 completion; 144 di antaranya reasoning). Sesi 10 giliran (konteks tumbuh) ≈
**3.000–6.000 token** kasar. Netra `usage` TIDAK melaporkan cache read → tak ada diskon caching
seperti Anthropic; tekan biaya lewat: system prompt "jawab singkat", `max_tokens` pas (256–400),
`reasoning:{effort:'low'}`, dan **bar OTAK** batas token/sesi. Tool call menambah token (skema +
hasil) — hitung ke OTAK juga.

## 10. Rute & file (`ai.md` §9)
```
src/pages/ai-labs/index.tsx          cangkang Fira + lab aktif
src/pages/ai-labs/pengaturan.tsx     API key, penyedia/model, batas biaya, suara + tombol uji
src/components/ailabs/FiraShell.tsx  port dari mametchi-monitor.html
src/components/ailabs/lcd/           mesin gambar piksel (px, seg7, mini, bar, pet)
src/ailabs/stages.ts                 definisi 6 tahap + syarat naik tahap
src/ailabs/speech.ts                 STT + TTS + deteksi dukungan browser
src/ailabs/brain.ts                  panggilan LLM (fetch mentah), konteks, hitung token
src/ailabs/tools.ts                  definisi tool + allowlist + clamp
src/ailabs/persona.ts                karakter Fira
docs/AI-LABS.md                      (dokumen ini)
```
Integrasi robot (§8): sprite Fira yang SAMA dirender ke OLED 128×64 (pakai mesin gambar yang
sama, ganti tinggi — JANGAN renderer kedua); NeoPixel jadi lampu suasana (biru=dengar,
ungu denyut=pikir, hijau=bicara, merah=error); tepuk = bangunkan; suara keluar dari speaker robot.

## 11. Urutan kerja (`ai.md` §10 — berhenti & tunggu review tiap tahap)
1. **docs/AI-LABS.md (ini) — BERHENTI, review.** ← sekarang
2. Port cangkang + mesin piksel → React; mode WAJAH + JAM saja
3. Tahap 0–1 (menetas, mic, VU, tepuk)
4. Tahap 2–3 (TTS, STT) — masih tanpa key
5. Halaman pengaturan + mode demo tanpa key
6. Pagar pengaman tool (§7) — SEBELUM LLM bisa memanggil apa pun
7. Tahap 4 (LLM)
8. Tahap 5 (MCP + draft WhatsApp)
9. Integrasi robot: OLED, NeoPixel, speaker

## 12. Definisi selesai (`ai.md` §11)
typecheck/lint/test/build EXIT 0 (guard static-export tak terpicu) · tanpa key: tahap 0–3 penuh,
4–5 terkunci dengan penjelasan · tanpa robot: semua tahap jalan · Firefox: aplikasi menjelaskan
STT tak ada + tawarkan ketik manual · API key tak pernah muncul di network selain ke penyedia
LLM (bukti DevTools) · minta kirim WhatsApp → hanya DRAFT + butuh tombol · tool di luar allowlist
→ ditolak jelas · STOP memutus Fira seketika · seluruh layar di canvas 128×128 · robot terhubung
→ sprite sama di OLED + NeoPixel ikut state · bundle halaman lain tak membesar.

## 13b. REVISI ARSITEKTUR (2026-09-30, atas arahan user)
Fira **ditaruh di dalam editor Block Coding** (`/control/modes/code`), bukan halaman
terpisah — tujuannya belajar AI lewat BLOK. Perubahan:
- **Chat UI ala ChatGPT** = panel/drawer kanan (`FiraPanel.tsx`), dibuka dari tombol
  **Fira** di toolbar (di samping tombol kamera/CvPanel). Berisi avatar Tamagotchi
  (piksel canvas) + gelembung percakapan + input + ⚙ API key. Otak = `brain.ts`
  (Netra streaming). TTS `speech.ts`.
- **Maskot Fira di simulator** (kiri) bereaksi ke blok — TODO.
- **Blok AI-belajar** di kategori AI (host-only): Fira bicara (TTS), Fira dengarkan
  (STT), saat tepuk / level suara (mic), tanya Fira (LLM) — TODO.
- **Tamagotchi-as-agent (MCP)**: tahap 5 lewat OpenAI-style function calling lokal
  (Netra bukan Anthropic → bukan `mcp_servers`) + draft WhatsApp — TODO.
- Halaman `/ai-labs` (siklus telur/menetas/DENGAR) tetap ada sebagai "lab" penuh.

## 13. Non-goals (`ai.md` §12)
Tanpa backend. Tanpa akun. LLM tak jalan di ESP32. Tak ada pengiriman pesan otomatis. Tak ada
wake word yang merekam terus-menerus.

---
### Keputusan (TERKONFIRMASI user 2026-09-30)
- **Provider:** Netra (`api.netraruntime.com`, OpenAI-compatible). Key TERUJI, HTTP 200.
- **Model default:** `deepseek/deepseek-v4-flash-0731` (model penalaran).
- **Tools tahap 5:** OpenAI function-calling lokal (bukan Anthropic `mcp_servers`).

### CATATAN KEAMANAN (belum selesai)
- Key `sk_live_…` masih plaintext di `ai.md` + sudah terkirim ke chat/log. **Rotasi + pasang
  batas biaya** di dashboard Netra. Di app, key HANYA di `localStorage` via pengaturan (§5/§8).
- Grep luas tak sengaja memunculkan secret lain (Supabase key project ling-mandarin) dari log
  `~/.claude` — tidak dipakai; pertimbangkan itu juga terekspos.

### Slot provider lain (Anthropic/OpenAI) = TODO kalau diminta (`ai.md` §5 "pilihan penyedia").
