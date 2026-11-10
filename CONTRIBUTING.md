# Ikut berkontribusi

Makasih sudah mau bantu. Proyek ini dikerjakan di sela waktu, jadi bantuan sekecil apa pun kepakai: laporan bug, perbaikan typo, sampai fitur baru.

## Sebelum mulai

- Untuk perubahan besar, buka issue dulu supaya kita sepakat arahnya sebelum kamu keluar tenaga.
- Untuk perbaikan kecil, langsung kirim pull request saja.

## Menyiapkan di komputer sendiri

```bash
npm install
cp .env.example .env.local   # isi minimal GEMINI_API_KEY
npm run dev
```

## Sebelum kirim pull request

```bash
npm run typecheck
npm run lint
```

`typecheck` harus bersih. `lint` masih punya beberapa peringatan lama; yang penting perubahanmu tidak menambah yang baru.

## Gaya kode

- TypeScript, tanpa `any` di kode baru.
- Satu fitur, satu file di `src/lib/`. Logika yang bisa dites tanpa server ditaruh sebagai fungsi murni.
- Komentar dan teks antarmuka pakai Bahasa Indonesia, sama seperti kode yang sudah ada.
- Jangan biarkan model AI yang memutuskan hal yang bisa diputuskan kode. Penjelasannya ada di `docs/ARSITEKTUR.md`.

## Pesan commit

Pakai awalan pendek: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`. Contoh: `fix: tombol unduh PDF tidak muncul di layar sempit`.

## Soal keamanan

Kalau nemu celah keamanan, jangan buka issue publik. Ikuti langkah di `SECURITY.md`.
