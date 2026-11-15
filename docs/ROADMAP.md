# Analisis Kematangan Vox Omong & Rencana Menuju Matang

*15 Nov 2026 · @Diki Hadinata*

---

## Ringkasan

**Vox Omong masih alpha, kira-kira 4 dari 10 menuju matang.** Fiturnya lebar dan banyak mesin nyata sudah ada, tapi belum ada yang membuktikan semuanya jalan: tes otomatis 0, CI belum ada, dan build produksi belum pernah lolos.

Butuh sekitar **7–9 minggu kerja santai** untuk matang. Tahap 1–3 (bekukan fitur, jaring pengaman, keamanan) paling menentukan.

---

## Kondisi Sekarang

Dicek langsung di repo: kode sekitar 40 ribu baris, `tsc` bersih, branch `main` 1 commit di depan `origin/main`.

### Yang Sudah Bagus
- Struktur folder jelas, dokumen repo lengkap (`README`, `LICENSE`, `CONTRIBUTING`, `SECURITY`).
- Ada pengaman CSRF di `src/proxy.ts` yang menolak website lain menembak API lokal.
- Banyak mesin nyata: slide, dokumen, xlsx, PDF, video, website, email, riset, dan tim agent.

### Yang Bikin Belum Matang

| No | Masalah | Dampak |
|:---:|---|---|
| **1** | **Tes otomatis: 0 file** | Perubahan kecil bisa merusak fitur lain tanpa ketahuan. |
| **2** | **Belum ada CI (`.github/workflows` kosong)** | Typecheck, lint, dan build tidak jalan otomatis tiap push. |
| **3** | **Build produksi belum terbukti lolos** | Terakhir dicoba nyangkut lebih dari 10 menit. |
| **4** | **Enam file raksasa:**<br>• `agentTeams.ts` (2.028 baris)<br>• `RightWorkspacePanel.tsx` (1.848 baris)<br>• `page.tsx` (1.759 baris)<br>• `codeAgent.ts` (1.590 baris)<br>• `SettingsModal.tsx` (1.568 baris)<br>• `chat/route.ts` (1.466 baris) | Susah dirawat, rawan bug. |
| **5** | **Tanpa login:** route terminal, fs, browser, agent tidak mengecek siapa yang minta | Aman di laptop sendiri; kalau dibuka ke jaringan, siapa pun bisa mengendalikan laptop. |
| **6** | **Data disimpan di file JSON di `.data/`** (percakapan, sesi WA, kredensial MCP) | Rawan korup saat ditulis bersamaan, susah di-backup. |
| **7** | **Scope melebar terus** (virtual org, divisi, sprint dispatch, FreeLLMAPI) | Fitur bertambah lebih cepat daripada fitur lama distabilkan. |
| **8** | **Commit terbaru belum ke GitHub** | Repo publik tertinggal dari kode lokal. |

---

## Tujuh Tahap Menuju Matang

> *Kerjakan berurutan dan jangan dilompat. Tiap tahap jadi pondasi tahap berikutnya.*

### Tahap 1: Bekukan fitur dan tentukan inti (1 minggu)
- [x] Stop nambah fitur baru dulu (feature freeze aktif).
- [x] Tulis di `README` 5–7 alur inti yang wajib selalu jalan: chat biasa, slide, dokumen, website, video, email, perintah berantai.
- [x] Cap fitur lain "eksperimental" dan sembunyikan/tandai di Settings.
- [x] Integrasikan arah arsitektur Paperclip control plane ([docs/PRD_FUSI_PAPERCLIP.md](docs/PRD_FUSI_PAPERCLIP.md)).

### Tahap 2: Jaring pengaman (1–2 minggu)
- [ ] Tes untuk tiap alur inti, pakai respons AI palsu (mock) supaya gratis token dan hasilnya konsisten.
- [x] Tes fungsi murni: parseLoose, studioAuth / PIN route guard (`tests/`).
- [x] GitHub Actions: typecheck, lint, tes, dan build tiap push (`.github/workflows/ci.yml`).
- [x] Pastikan `npm run build` lolos (terbukti lolos dalam ~1 menit setelah ruang disk tersedia).

### Tahap 3: Keamanan (1 minggu)
- [x] Kunci akses (token atau PIN) wajib untuk semua API, terutama terminal, fs, browser, agent (`src/proxy.ts` & `src/lib/studioAuth.ts`).
- [x] Server default hanya izinkan akses route sensitif via localhost jika PIN kosong; akses jaringan/mobile wajib pakai kunci PIN.
- [ ] Kredensial MCP dan sesi WA dienkripsi atau dipindah ke keychain sistem.
- [ ] `npm audit` dan `gitleaks` di CI supaya `.env` tidak ikut ke-commit.

### Tahap 4: Rapikan kode (2 minggu, bertahap)
- [ ] Pecah enam file raksasa jadi modul kecil; `chat/route.ts` jadi router tipis yang memanggil handler per kemampuan.
- [ ] Kerjakan setelah tes ada, supaya kerusakan saat dipecah langsung kelihatan.
- [ ] Hapus kode mati dan fitur setengah jadi di luar alur inti.

### Tahap 5: Data dan keandalan (1 minggu)
- [ ] Pindahkan penyimpanan JSON ke SQLite (satu file, tanpa server, aman dari tulis bersamaan).
- [ ] Log terstruktur dan halaman status: kunci API aktif, ffmpeg terpasang, Chrome ketemu.
- [ ] Semua kegagalan AI (429, timeout, JSON rusak) berakhir dengan pesan jelas ke user, bukan diam atau error 500.

### Tahap 6: Pengalaman pengguna baru (1 minggu)
- [ ] Satu perintah setup yang memeriksa Node, Chrome, ffmpeg, `.env`, lalu bilang apa yang kurang.
- [ ] `README`: panduan 5 menit, GIF demo, tabel "fitur → butuh kunci apa".
- [ ] Minta 2–3 teman install dari nol dan catat di mana mereka nyangkut.

### Tahap 7: Rilis
- [ ] Push ke GitHub, tag `v0.1.0`, tulis `CHANGELOG`.
- [ ] Baru buka lagi pintu fitur baru; tiap fitur baru wajib datang bersama tesnya.

---

## Ukuran Matang (Definition of Done)

Project dianggap matang kalau semua ini terpenuhi:
- [ ] CI hijau di setiap commit.
- [ ] Minimal satu tes untuk tiap alur inti.
- [ ] Orang baru bisa install dan menjalankan alur inti dalam kurang dari 15 menit tanpa bertanya.
- [ ] API tidak bisa dipakai tanpa kunci.
- [ ] Tidak ada file di atas sekitar 600 baris.
- [ ] Dipakai harian 2 minggu tanpa crash.
