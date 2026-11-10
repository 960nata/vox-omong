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

## Contoh perintah

```
bikinin landing page buat kedai kopi lokal
buat slide 10 halaman tentang energi surya
bikin surat undangan rapat berkop dinas
bikin video tentang manfaat kopi
riset: harga laptop 14 inci 2026
riset kompetitor kedai kopi di Jogja, bikin slide, terus bikin videonya
```

## Cara kerjanya, singkat

Model AI gratisan gampang ngawur kalau disuruh mikir terlalu banyak sekaligus. Jadi di sini model cuma mengerjakan potongan kecil, dan sisanya dipegang kode:

- Jalur (website, slide, video, email, dan lain-lain) dipilih oleh aturan di kode, bukan ditebak model.
- Keluaran model diminta dalam JSON, divalidasi, dan diperbaiki oleh kode kalau rusak.
- Angka dan fakta diambil dari hasil riset atau file lampiran. Model merangkum, tidak mengarang.
- Hal yang bisa dihitung, seperti kontras warna atau jumlah slide, dihitung kode.

Kode utamanya ada di `src/lib/` (mesin tiap fitur) dan `src/app/api/` (endpoint). Tampilan chat di `src/components/`.

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

Proyek ini terbuka. Kalau nemu bug atau punya ide, buka issue atau kirim pull request. Perubahan kecil pun diterima dengan senang hati.

## Lisensi

MIT. Lihat file `LICENSE`. Panduan di folder `skills/` mengikuti lisensinya masing-masing.

## Penulis

Dicky Hadinata — [hadinata.dev](https://hadinata.dev)
