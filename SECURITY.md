# Keamanan

## Aplikasi ini untuk dijalankan di komputer sendiri

Vox Omong punya fitur yang menyentuh komputer tempat ia berjalan: terminal, akses file project, Git, dan browser otomatis. Karena itu:

- Jalankan di `localhost`. **Jangan** membuka port-nya ke internet atau men-deploy apa adanya ke server publik.
- Simpan semua kunci di `.env.local`. File itu tidak ikut ke repo.
- Untuk email, pakai App Password Gmail, bukan password akun.

Pengaman yang sudah ada: permintaan lintas-origin ke API ditolak, website buatan AI ditampilkan dalam sandbox, browser otomatis tidak mengisi password atau data kartu, dan email baru terkirim setelah kamu mengonfirmasi.

## Melaporkan celah

Kalau kamu menemukan celah keamanan, tolong jangan buka issue publik. Kirim detailnya lewat kontak di [hadinata.dev](https://hadinata.dev), sertakan langkah untuk mengulanginya. Saya usahakan membalas dalam beberapa hari.
