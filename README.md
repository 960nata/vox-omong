# Vox Omong — Jarvis, asisten AI yang tinggal disuruh

> Ngomong atau ketik, hasilnya jadi file: website, slide, dokumen, video.

Asisten AI yang bisa diajak ngomong, lalu beneran ngerjain: bikin website, slide, dokumen, video, sampai riset di web. Proyek ini saya bangun karena capek pindah-pindah tool. Maunya satu tempat: ngomong atau ketik, hasilnya langsung jadi file yang bisa dipakai.

Masih terus dikembangkan. Beberapa bagian sudah enak dipakai, beberapa masih kasar. Bagian "Yang belum" di bawah saya tulis apa adanya.

## Yang bisa dikerjakan

- **Website** — landing page atau toko sederhana dari satu kalimat, dengan preview langsung dan kode yang bisa dicek. Gaya, warna, dan isi bisa direvisi lewat chat.
- **Slide** — minimal 7 slide dengan foto, bisa diunduh sebagai `.pptx`.
- **Dokumen** — laporan, proposal, dan surat resmi berkop. Unduh sebagai `.docx` atau PDF.
- **Invoice dan tabel** — tabel bisa diunduh sebagai `.xlsx` (angka tetap angka) atau CSV.
- **Video motion graphic** — teks kinetik, grafik yang menggambar dirinya, dan transisi antar adegan, direkam jadi `.webm`. Bisa dari kalimat, JSON adegan, atau HTML.
- **Riset** — beberapa pencarian jalan paralel, hasilnya dirangkum dan dipakai sebagai bahan slide, dokumen, atau video.
- **Perintah berantai** — misalnya: *"riset tren kopi 2026, bikin slide, terus bikin videonya"*. Dikerjakan berurutan dalam satu balasan.
- **Baca file** — lampirkan PDF, Word, Excel, PowerPoint, atau CSV, lalu minta diringkas atau dijadikan bahan.
- **Email** — menulis draf dan mengirim lewat Gmail, hanya setelah kamu membalas "kirim".
- **Browser** — membuka halaman, mencari, dan membaca isinya. Tidak login, tidak membayar, tidak mengisi password.
- **Lowongan dari web** — ekstrak posisi, perusahaan, lokasi, gaji yang tercantum, dan tautan dari halaman lowongan publik (LinkedIn, Jobstreet, situs karier yang memakai JobPosting). Hasil bisa diunduh sebagai CSV/Excel; tidak mengarang kolom yang tidak tersedia. Sesi browser per chat bertahan selama 15 menit tanpa aktivitas, maksimal 5 sesi sekaligus. Login, CAPTCHA, unggah CV dan kirim lamaran/publikasi loker belum otomatis dilakukan.
- **Grup dan kontak AI** — tim Developer, Marketing dan Kreatif terpisah. Pilih grup untuk rapat/tugas, atau anggota untuk chat pribadi. Nama dan avatar anggota bisa diubah. Di profil anggota, pilih keahlian Agency Agents; delapan panduan spesialis pilihan tersedia dan dipakai dalam chat, laporan tim, serta pembuatan website oleh anggota frontend. Tim lama mendapat pilihan bawaan dan dapat menggantinya atau menonaktifkannya. Tim baru tidak memanggil model sampai diberi tugas. Chat pribadi memakai satu panggilan; rapat biasa dibatasi dua spesialis dan ketua; `@nama` memanggil anggota yang dituju. Maksimal dua pekerjaan model bersamaan. Dengar progres memakai laporan tersimpan.
- **Referensi website** — pindai website atau hero/navbar/pricing/footer: ambil HTML frontend yang dibersihkan, sampel computed CSS dan screenshot, lalu simpan di folder `references/` proyek aktif. Perintah membuat ulang mengirim referensi ke pembuat website. Source backend/framework asli dan stylesheet lengkap tidak ikut diambil.
- **Terminal dari chat** — `jalankan di terminal: npm ...` menjalankan perintah di proyek aktif dengan output dan exit code nyata. Server `npm run dev` tetap hidup, punya status/stop dan preview setelah pemeriksaan HTTP. Proyek HTML statis dapat memakai server Node tanpa dependency tambahan; tidak ada script build sukses palsu.
- **Suara** — bisa diajak ngobrol lewat mikrofon, dan ada layanan terpisah (`jarvis-call/`) supaya bisa ditelpon lewat WhatsApp.

## Cara menjalankan

Butuh Node.js 20 ke atas dan Google Chrome terpasang (dipakai untuk browser, PDF, dan perekam video).

```bash
npm install
cp .env.example .env.local   # lalu isi kuncinya
npm run dev
```

Buka `http://localhost:3000`.

Untuk fitur video, perekamnya butuh ffmpeg milik Playwright. Biasanya terunduh sendiri saat pertama dipakai. Kalau gagal:

```bash
npx playwright-core install ffmpeg
```

## Konfigurasi

Semua kunci disimpan di `.env.local` (tidak ikut ke repo). Yang wajib cuma satu kunci model AI; sisanya opsional sesuai fitur.

| Variabel | Untuk apa |
|---|---|
| `GEMINI_API_KEY` | Model utama (Gemini). Paket gratis sudah cukup untuk mencoba. |
| `AI_GATEWAY_KEY`, `AI_GATEWAY_URL` | Gateway model cadangan, kalau punya. |
| `UNSPLASH_ACCESS_KEY` | Foto untuk slide, dokumen, website, dan video. |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM_NAME` | Kirim email. Pakai App Password, bukan password akun. |
| `YOUTUBE_API_KEY` | Menyisipkan video di website. |
| `GITHUB_ACCESS_TOKEN` | Push project buatan Jarvis ke GitHub. |
| `JARVIS_API_SECRET` | Pengaman antara app ini dan `jarvis-call`. |
| `SKILL_ENGINE_MODE` | `fast` (default): satu panggilan AI untuk tugas skill komunitas, memakai panduan asli dan pemeriksaan mandiri. `quality`: tambah distilasi panduan, pemeriksaan AI terpisah, dan revisi bila perlu; lebih lambat. |

## Contoh perintah

```
bikinin landing page buat kedai kopi lokal
buat slide 10 halaman tentang energi surya
bikin surat undangan rapat berkop dinas
bikin video tentang manfaat kopi
riset: harga laptop 14 inci 2026
riset kompetitor kedai kopi di Jogja, bikin slide, terus bikin videonya
cari lowongan frontend remote di LinkedIn
buka https://id.jobstreet.com lalu cari frontend developer
ambil data lowongan dari halaman ini
klik lowongan frontend developer
tutup browser
buat tim kreatif
rapat tim kreatif tentang konsep kampanye kopi lokal
panggil ketua kreatif
tim developer kerjakan landing page kedai kopi
scan website https://example.com bagian hero
tiru section hero dari https://example.com untuk proyek ini
jalankan di terminal: node --version
jalankan di terminal: npm run dev
status terminal
stop server
```

## Cara kerjanya, singkat

Model AI gratisan gampang ngawur kalau disuruh mikir terlalu banyak sekaligus. Jadi di sini model cuma mengerjakan potongan kecil, dan sisanya dipegang kode:

- Jalur (website, slide, video, email, dan lain-lain) dipilih oleh aturan di kode, bukan ditebak model.
- Keluaran model diminta dalam JSON, divalidasi, dan diperbaiki oleh kode kalau rusak.
- Angka dan fakta diambil dari hasil riset atau file lampiran. Model merangkum, tidak mengarang.
- Hal yang bisa dihitung, seperti kontras warna atau jumlah slide, dihitung kode.

Penjelasan lengkapnya ada di [`docs/ARSITEKTUR.md`](docs/ARSITEKTUR.md).

## Struktur folder

```
src/app/          halaman dan endpoint API
src/components/   tampilan chat, kartu hasil, panel preview
src/lib/          mesin tiap fitur (website, slide, video, riset, email, ...)
skills/           panduan desain pihak ketiga yang disisipkan ke prompt
jarvis-call/      layanan Python untuk telepon WhatsApp
docs/             catatan arsitektur
```

## Keamanan

Aplikasi ini punya akses terminal, file, dan browser di komputer tempat ia berjalan. Jalankan di `localhost` saja dan jangan dibuka ke internet. Detailnya di [`SECURITY.md`](SECURITY.md).

## Yang belum

- Video hanya `.webm`, belum `.mp4`, dan belum ada suara narasi.
- PDF hasil scan belum terbaca (belum ada OCR).
- Riset membaca halaman web biasa, jadi data seperti harga saham bisa telat. Bukan data real-time.
- Email belum bisa membawa lampiran.
- Perintah berantai belum menampilkan progres per langkah; chat menunggu sampai semuanya selesai.
- Belum ada tes otomatis yang menyeluruh.

## Catatan pihak ketiga

Folder `skills/` berisi panduan desain dari proyek open source lain, lengkap dengan lisensinya. Rinciannya ada di `skills/NOTICE.md`.

## Ikut bantu

Proyek ini terbuka. Kalau nemu bug atau punya ide, buka issue atau kirim pull request. Perubahan kecil pun diterima dengan senang hati. Panduannya ada di [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Lisensi

MIT. Lihat file `LICENSE`. Panduan di folder `skills/` mengikuti lisensinya masing-masing.

## Penulis

Dicky Hadinata — [hadinata.dev](https://hadinata.dev)
## Analisis project lokal dan biaya token

Setelah memilih **Hubungkan Folder Lokal**, browser meminta izin baca/tulis lalu menyalin file yang diizinkan ke `.data/user_projects/local-<nama-folder>`. AI membaca dan mengedit salinan itu. Setelah agen coding selesai, browser menulis balik hanya file yang diubah ke folder Mac yang dipilih jika izin tulis tersedia. Koneksi lama yang hanya punya izin baca menampilkan tombol **Simpan ke folder Mac** untuk meminta izin. Jika file asli berubah sejak sinkronisasi, VOX tidak menimpanya dan menampilkan konflik. Pilih ulang folder jika izin browser hilang.

Pencarian kode kini bawaan VOX. Ia membaca file yang diizinkan, mengurutkan cuplikan relevan dengan pencocokan kata, mengenali simbol TypeScript/JavaScript, dan menunjukkan hubungan impor antarfail. Indeks disimpan di memori server dan diperbarui ketika ukuran atau waktu perubahan file berubah. Hasil yang masuk ke model dibatasi pada beberapa cuplikan. **Ollama, Lumen, dan Codebase Memory MCP tidak diperlukan** untuk instalasi baru. Pencocokan kata ini tidak sama dengan embedding semantik penuh atau knowledge graph lengkap; pertanyaan yang memakai istilah sangat berbeda dari kode bisa kurang akurat.

Untuk analisis project di chat umum atau tim, VOX memakai harness baca-saja: pencarian awal berjalan tanpa model, lalu model murah dapat memilih `read_file`, `search_code`, `list_files`, atau selesai. Setiap hasil alat dikembalikan ke model untuk memutuskan langkah berikutnya. Maksimal tiga putaran, cuplikan dibatasi, path harus ada di project aktif, dan symlink ditolak.

Untuk mengerjakan kode dalam **satu putaran agen**, pilih project aktif lalu ketik `agen coding: perbaiki ...` di chat. Perintah `edit file ...` di chat umum maupun chat langsung anggota tim juga memakai alur ini. Agen dapat mengurutkan file, mencari simbol, membaca potongan kode, mengganti teks yang cocok persis satu kali, membuat file baru di folder yang sudah ada, dan memeriksa file berubah. Maksimal delapan langkah dengan model hemat. Pemeriksaan `.js`, `.mjs`, dan `.cjs` menjalankan `node --check` sebagai proses terminal tanpa shell; `run_check` pada `tsconfig.json` menjalankan TypeScript typecheck project. Agen juga dapat menjalankan file `.test.js`, `.test.mjs`, `.test.cjs` (atau `.spec.*`) satu per satu di proses Node dengan izin file terbatas ke salinan project. Tes framework yang membutuhkan instalasi paket atau proses anak belum didukung oleh alat ini; terminal manual VOX tetap terpisah untuk perintah lain. Hasil chat menampilkan file yang benar-benar berubah dan pemeriksaan yang berhasil. Pada folder browser yang terhubung, perubahan agen disalin balik sesuai izin dan aturan konflik di atas.

[Headroom](https://headroomlabs-ai.github.io/headroom/) tetap opsional untuk merangkum konteks panjang. Instalasi baru memakai konteks asli tanpa Headroom; jika kamu memasangnya sendiri, set `HEADROOM_ENABLED=true`. Pertanyaan terbaru, instruksi sistem, dan bukti file tetap dijaga. Gaya jawaban ringkas mengikuti prinsip [Caveman](https://github.com/JuliusBrussee/caveman), tanpa membuang rincian audit dan kode yang diperlukan.

`CODE_CONTEXT_FUSION=true` mengaktifkan pencarian kode bawaan (default aktif jika variabel tidak diisi). Biaya kredit tetap bergantung pada model gateway dan ukuran prompt sebenarnya; tidak ada persentase hemat yang dijamin. Ketua tim memakai model hemat secara default; model premium hanya saat brief menyebut `premium`, `sonnet`, atau `kualitas maksimal`.

Untuk membagikan repo, `.env.local`, `.data/`, dan `.tools/` sudah dikecualikan dari Git. Pencarian bawaan bekerja setelah `npm install` tanpa mengunduh model. Jika aplikasi di-host terbuka di internet, pasang autentikasi server sebelum mengunggah project pribadi karena endpoint file dan pencarian kode membaca data project di server.

## MCP opsional

Di **Pengaturan → Alat tambahan MCP**, pilih Perplexity, Firecrawl, PostHog, Playwright MCP, atau Composio. Tombol **Uji koneksi** benar-benar membuka sesi MCP dan menghitung alat baca yang tersedia. Firecrawl dapat dicoba tanpa API key dengan batas harian. Layanan lain memerlukan `STUDIO_PIN` dan kredensial di server melalui `.env.local` sesuai nama variabel di `.env.example`, tidak di pengaturan browser. Setelah PIN dimasukkan, server memberi cookie sesi untuk mengizinkan alat MCP berakun. Playwright MCP memerlukan server lokal di `PLAYWRIGHT_MCP_URL` (default `http://127.0.0.1:8931/mcp`); browser bawaan VOX tetap tersedia tanpa MCP tersebut.

Setelah layanan aktif, ketik contoh `MCP perplexity: cari informasi terbaru tentang ...` atau `MCP firecrawl: baca https://...`. VOX memilih satu alat baca yang disediakan server MCP lalu menampilkan hasilnya. Tidak ada pemanggilan MCP otomatis dari chat biasa. Mode ini hanya memakai alat baca; tindakan menulis ke PostHog, Composio, atau situs di browser belum dibuka lewat koneksi MCP ini. Perplexity dan Firecrawl mungkin memakai kuota/biaya akun masing-masing; status “dikonfigurasi” berarti kredensial ada, sedangkan “terhubung” hanya muncul setelah uji koneksi berhasil.
