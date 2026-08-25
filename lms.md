# Robotku Academy (LMS) — Prompt Halaman Daftar Lesson (Folder + Grid)

Membangun halaman **Robotku Academy** meniru struktur Stick'em Academy (dari 5 screenshot): **gate akses → loading → All Lessons** dengan dua tampilan **Folder** (dikelompokkan per tema) dan **Grid** (kartu kotak). Di-skin ke **Design System Robotku** (indigo #4F46E5 + pink #EC2D8F, Plus Jakarta Sans). Ini modul "Robotku Academy" dari Home (kartu kedua), terpisah dari Web Control.

> Catatan tema: LMS ini **padat konten & thumbnail**, jadi **kartu lesson tetap putih** (surface konten yang butuh keterbacaan — sah seperti canvas Blockly). Tapi **chrome-nya Robotku**: background bertint indigo lembut (bukan putih polos), header/folder-tab/chip/tombol pakai indigo–pink. Jadi tetap "berasa Robotku", bukan putih kosong.
>
> **Wajib baca dulu:** terapkan `PROMPT_Robotku_DesignSystem_Reference.md` (font Plus Jakarta Sans + token & komponen `.rb-*` dari `src/theme/tokens.css`, vibe robotku.id). **Tombol "Robotku Academy" SUDAH ADA** di `src/pages/index.tsx` (kartu Home) — sambungkan ke `/academy` (ganti stub `https://robotku.id`). **Isi Academy = kumpulan PPT/slide**: `Lesson.content.slides` berupa .pptx/.pdf, halaman detail = penampil slide (konversi .pptx→.pdf lalu render PDF.js, atau embed Google Slides), dengan navigasi prev/next + progress; video/quiz opsional.

---

## Struktur & data (acuan)

**Route**
```
/academy                     Gate: Access Code | Continue as Guest (+ preview 6 basics)
/academy/lessons             All Lessons (Folder & Grid view)
/academy/lessons/:lessonId   Lesson detail (slides PDF.js + video embed + practice + quiz) — ringkas
```

**Model data**
```ts
type LessonStatus = 'live' | 'coming_soon' | 'subscribe';   // hijau | abu | pink
interface Lesson {
  id: string;
  number?: number;                 // "1.", "2." (untuk Basics berurutan)
  title: string;
  thumbnail: string;               // gambar sampul
  levelType: string;               // chip "Robotku Basics" / "Level 1..4"
  concepts: string[];              // chips: Teamwork, Geometry, Motion Control, dll
  status: LessonStatus;            // LIVE / Coming Soon / Subscribe
  group: string;                   // id grup/folder
  content?: { slides?: string; videoEmbed?: string; practiceProjectId?: string; quizId?: string };
  requiresSubscription?: boolean;
}
interface Group {
  id: string; title: string; emoji?: string;   // "Stick'Em Basics 1 2 3", "Reference Mechanisms ⚙️"
  order: number;
}
```

**Taksonomi grup (folder)** — sama seperti referensi, isi silakan diedit:
`Robotku Basics` · `Reference Mechanisms` ⚙️ · `Design Thinking` 💡🧠 · `Sciences` 🧲⚡ · `Makerspace & Robotics` 🛠️🤖 · `AI & Machine Learning` 🌐💻 · `Sustainability` ♻️🌱 · `Maths` 🧮📐 · `Languages` 🔤✏️ · `Arts, Craft & Music` 🎨🎺 · `Global Adventures` 🌍✈️

---

## PROMPT (salin ke Claude Code)

```
ROLE
Build the Robotku Academy (LMS) listing pages: an access gate, a loading state, and an "All Lessons" page with TWO switchable views — FOLDER (grouped by theme) and GRID (flat cards). Mirror the Stick'em Academy layout/UX, but skin to the Robotku Design System (indigo/pink, Plus Jakarta Sans). React + TypeScript + Vite + Tailwind/shadcn. Lessons come from a JSON seed (src/data/lessons.ts) via a repository; make it easy to replace with a CMS/API later. Persist "continue as guest" + access code + progress in IndexedDB.

THEME (Robotku, readable-immersive)
- Page background: soft indigo-tinted gradient (top #EEF0FF → #E0E3FF), NOT stark white; optional faint mascot/pattern watermark.
- Chrome (top bar, folder tabs, chips, primary buttons, view toggle) uses Robotku indigo (#4F46E5 / #352DA0) + pink accent (#EC2D8F).
- Lesson CARDS are white surfaces (--r-lg radius, soft shadow) — the legitimate light area for thumbnail readability.
- Status chip colors: LIVE = green (#16A34A) on light-green; Coming Soon = amber (#E08600) on light-amber; Subscribe = pink (#EC2D8F) on light-pink. Level/Type chip = indigo tint; Concept chips = indigo-50 with indigo text.
- Font 'Plus Jakarta Sans', large & bold headers (page title ~26–30px/800, group titles ~20–22px/700), consistent with the rest of Robotku.

ROUTE /academy — ACCESS GATE (two columns)
- Header: Robotku Academy logo + "SELAMAT DATANG DI ROBOTKU ACADEMY!".
- Left column "PUNYA KODE AKSES?": Access Code input (with show/hide eye toggle) + big indigo pill "Akses Robotku Academy!". Below it, a small preview grid of the free Basics lessons (mini cards: thumbnail, title, Level chip, Concepts, "Public Link").
- Right column "Baru di sini?": copy "Coba 6 pelajaran Robotku Basics tanpa langganan! Untuk seluruh materi, hubungi team@robotku.id." + outline pill "Lanjut sebagai Tamu" (→ /academy/lessons as guest, basics only) + dark pill "Hubungi Kami".
- Validating a code unlocks the full catalog; guest sees only status:'live' Basics.

ROUTE /academy/lessons — LOADING STATE
- While lessons load: centered Robotku mascot (meditating/among falling blocks) + "Lessons loading…". Use the mascot asset; keep it calm.

ROUTE /academy/lessons — ALL LESSONS
Top bar:
- Left: back arrow → Home.
- Center: Robotku Academy logo + "ROBOTKU ACADEMY (Semua Pelajaran)".
- Right: org name + "Sesi aktif: x / y" (from license/session context; stub ok) + user avatar.
Controls row:
- "Pilih Level" dropdown (All / Level 1..4 / Basics) + "Cari nama pelajaran" search input (filters live).
- View toggle (top-right): two icon buttons — FOLDER view and GRID view (active = filled indigo pill).
- A friendly mascot helper bubble on first visit: "Selamat datang! Butuh bantuan? Klik aku untuk tutorial singkat." (dismissible; opens a short tour).

FOLDER VIEW (default)
- Render each Group as a "folder" container: a rounded panel with a folder-TAB on the top-left showing the group title + emoji/icon (indigo tab, white text). Inside: a responsive grid of MINI lesson tiles (thumbnail on top, title, small Level chip, Concept chips, and a "Public Link"/status line). Groups stack vertically; large groups wrap tiles to multiple rows.
- Folder tab styling like the reference (a tab bump), but Robotku indigo. Groups can be collapsible (chevron) — remember open/closed in IndexedDB.
- Basics group shows the ordered Part 1..N tiles (Shapes & Structures, Intro to Connectors, Intro to Electronics, Build a Basic Robot, Robot Mechanisms, Block Coding, …).

GRID VIEW
- Flat responsive grid (auto-fill, min card ~260px) of full LessonCards, honoring the Level filter + search.
- LessonCard (white surface, radius --r-lg, shadow):
  * Thumbnail (16:10, rounded top).
  * Title (numbered when applicable): "1. Shapes & Structures".
  * "Lesson Level/ Type" label + chip (e.g., "Robotku Basics").
  * "Concepts" label + concept chips (Teamwork, Geometry, Structures…).
  * "Status" label + status chip (LIVE / Coming Soon / Subscribe).
  * Whole card clickable → /academy/lessons/:id (if locked/subscribe → show a subscribe modal instead).

COMPONENTS
- <FolderGroup group tiles/>, <LessonCard/> (grid), <LessonTile/> (mini, folder), <StatusChip/>, <ConceptChip/>, <LevelChip/>, <ViewToggle/>, <LevelSelect/>, <SearchBox/>, <AcademyTopBar org sessions avatar/>, <MascotHelper/>.
- Repository: getGroups(), getLessons(filter), searchLessons(q); reads src/data/lessons.ts now, swappable for API.

ROUTE /academy/lessons/:id — LESSON DETAIL (ringkas, cukup rangka)
- Header with lesson title + status; body renders content: slides (PDF.js viewer for pptx→pdf or embedded Google Slides), video embed (YouTube no-cookie), a "Praktikkan di Coding Studio" button (deep-links to /control/modes/code with practiceProjectId), and an optional quiz. Track progress (viewed slides / video ≥90% / quiz passed) in IndexedDB; show a progress bar. (Full lesson authoring is out of scope here — just the shell + progress.)

SEED (src/data/lessons.ts) — provide ~8–10 example lessons across groups so both views render, e.g.:
[
 {id:'basics-1', number:1, title:'Shapes & Structures', thumbnail:'/academy/thumbs/shapes.png', levelType:'Robotku Basics', concepts:['Teamwork','Geometry','Structures'], status:'live', group:'basics'},
 {id:'basics-3', number:3, title:'Electronics & Control App', thumbnail:'/academy/thumbs/electronics.png', levelType:'Robotku Basics', concepts:['Motion Control'], status:'live', group:'basics'},
 {id:'basics-6', number:6, title:'Block Coding', thumbnail:'/academy/thumbs/blockcoding.png', levelType:'Robotku Basics', concepts:['Coding','Logic'], status:'live', group:'basics', content:{practiceProjectId:'starter-move'}},
 {id:'mech-pulley', title:'Building a Belt & Pulley', thumbnail:'/academy/thumbs/pulley.png', levelType:'Level 1', concepts:['Mechanisms'], status:'live', group:'reference-mechanisms'},
 {id:'ai-cv', title:'Building a Computer Vision Model', thumbnail:'/academy/thumbs/cv.png', levelType:'Level 4', concepts:['AI','Critical Thinking'], status:'coming_soon', group:'ai-ml'},
 {id:'sus-farm', title:'Learning about Sustainable Farming', thumbnail:'/academy/thumbs/farm.png', levelType:'Level 4', concepts:['Sustainability','Problem Solving'], status:'subscribe', group:'sustainability'},
 ...
]
Groups seed with the taxonomy above (id,title,emoji,order). Include placeholder thumbnails under public/academy/thumbs/ (or graceful <img> fallback if missing — no 404 spam).

ACCEPTANCE
- /academy gate works: guest path shows only live Basics; valid code unlocks all.
- /academy/lessons shows loading mascot, then All Lessons.
- Folder view groups lessons into Robotku-indigo folder panels with tabs + emoji; Grid view shows white lesson cards with Level/Type, Concepts, and Status chips; toggle switches between them; Level filter + Search work in both.
- Everything follows Robotku DS (indigo/pink chrome, Plus Jakarta Sans, white cards); background is soft indigo, not stark white. No "Stick'em" text/assets. Graceful image fallbacks; no console 404 spam.
- Lesson detail shell opens with slides/video placeholders + progress + "Praktikkan di Coding Studio" deep-link.

Start by printing the data model + component tree + routes, then implement the gate, loading, All Lessons (Folder + Grid), and the detail shell. Show diffs per file.
```

---

## Catatan
- Ini modul **Robotku Academy** (kartu kedua di Home). Modul Web Control (Block Coding + mode kendali) tetap pakai prompt terpisah.
- Konten pelajaran = milik Robotku; seed di `lessons.ts` cuma contoh biar dua view langsung tampil — tinggal ganti dengan materi kamu (atau sambungkan ke API/CMS).
- "Sesi aktif x/y" itu konsep lisensi per-seat sekolah (seperti "Sessions active: 1/5" di referensi) — saya jadikan stub, bisa disambung ke backend nanti.
- Kalau mau, saya bisa langsung buatkan **`lessons.ts` + `groups.ts` versi Robotku** (taksonomi lengkap + 20–30 lesson contoh berlabel Robotku) supaya agen tinggal render, plus komponen `LessonCard`/`FolderGroup` starter ber-tema indigo.
