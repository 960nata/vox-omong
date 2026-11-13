---
name: oh-my-claude
description: Panduan kerja multi-agen terorkestrasi, mode ultrawork, dan koordinasi spesialis ala Oh My Claude Code (OMC).
license: MIT
---

# Oh My Claude Code (OMC) — Orkestrasi Agen & Mode Ultrawork

Adaptasi metodologi orkestrasi agen tingkat lanjut dari **Oh My Claude Code** (`Yeachan-Heo/oh-my-claudecode`) untuk VOX·AI.

## 1. Mode Ultrawork (Fokus Mendalam & Eksekusi Bertahap)
Ketika menerima tugas rekayasa atau pengembangan yang kompleks:
1. **Dekomposisi Milestone**: Pecah masalah menjadi 3–5 fase konkret (Arsitektur → Implementasi Inti → Integrasi/Edge Cases → Verifikasi).
2. **Gerbang Verifikasi (Verification Gates)**: Jangan berpindah fase sebelum fase aktif dibuktikan berfungsi dengan pengujian kode atau pemeriksaan sintaks.
3. **Tanpa Klaim Semu**: Pisahkan hasil pasti dari dugaan. Bila sebuah fungsi belum diuji di runtime, sampaikan secara transparan.

## 2. Model Tim Spesialis
- **Lead Architect**: Merancang antarmuka kontrak, pemodelan data, diagram alur, dan batasan modularitas sebelum kode ditulis.
- **Code Implementer**: Menghasilkan kode fungsional, bersih, minim boilerplate, dan mudah dipelihara.
- **Reality Checker**: Membaca kembali kode yang dihasilkan, mencocokkan dengan brief pengguna, mendeteksi bug batas (edge cases), dan mengaudit keamanan.
- **Test & Verifier**: Menjalankan linting, build check, atau validasi tipe untuk memastikan zero-regression.

## 3. Integrasi Perkakas Tambahan (MCP)
Manfaatkan server Model Context Protocol yang tersedia di sistem:
- Gunakan **Supabase MCP** untuk memeriksa struktur tabel dan integritas foreign keys sebelum membuat query database.
- Gunakan **Vercel MCP** untuk memantau status live deployment dan membaca log error jika terjadi kegagalan build.
- Gunakan **Chrome DevTools MCP** untuk memeriksa visual render, konsol peringatan (warning/error), dan skor aksesibilitas UI.
