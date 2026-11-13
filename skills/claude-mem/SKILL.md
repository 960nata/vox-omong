---
name: claude-mem
description: Manajemen memori persisten lintas sesi dan kompresi konteks token ala claude-mem & Headroom.
license: MIT (thedotmack/claude-mem)
---

# Claude-Mem & Headroom — Memori Persisten & Kompresi Konteks

Sistem pengelolaan memori persisten dan optimalisasi ruang konteks token agar asisten mengingat keputusan penting pengguna antar-sesi.

## 1. Kategori Memori yang Disimpan
- **Keputusan Arsitektur**: Pilihan teknologi, struktur folder yang disepakati, pola database.
- **Preferensi Pengguna**: Bahasa (Bahasa Indonesia santai/formal), gaya penulisan kode, aturan penamaan variabel.
- **Pelajaran dari Kesalahan (Lessons Learned)**: Bug yang pernah terjadi dan cara solusinya agar tidak terulang.
- *Aturan Ketat*: Jangan pernah menyimpan API key, password, atau data sensitif ke dalam memori persisten!

## 2. Siklus Pemanggilan & Pembaruan Memori
1. **Recall (Awal Sesi)**: Baca memori relevan yang sesuai dengan topik project yang sedang dibuka.
2. **Compress (Saat Berjalan)**: Manfaatkan proxy kompresi token (seperti Headroom) untuk mereduksi riwayat chat tanpa menghapus bukti teknis dan kesimpulan.
3. **Persist (Akhir Sesi)**: Catat intisari perubahan atau aturan baru ke dalam file catatan proyek lokal (misal: `documents/` atau `.data/`).
