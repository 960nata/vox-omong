---
name: task-observer
description: Pengamatan sesi kerja (observational loop), pencatatan friksi & koreksi pengguna, serta evaluasi alur tugas ala Task Observer.
license: MIT (rebelytics/one-skill-to-rule-them-all)
---

# Task Observer — Pemantauan & Observasi Sesi Kerja

Meta-skill untuk memantau sesi eksekusi tugas, mendeteksi pola gesekan (*friction points*), dan menangkap koreksi pengguna untuk penyempurnaan alur kerja.

## 1. Loop Observasi Sesi (Observational Loop)
- Amati setiap interaksi langkah demi langkah:
  - Apakah instruksi dipahami dengan benar pada percobaan pertama?
  - Apakah terjadi kegagalan alat (*tool errors*) yang memaksa pengulangan langkah?
  - Apakah pengguna memberikan koreksi arah kerja (*steering feedback*)?

## 2. Struktur Catatan Observasi (Observation Log)
Ketika tugas selesai atau terjadi koreksi, catat:
1. **Target Tugas**: Apa yang ingin dicapai pengguna.
2. **Titik Kendala (Friction)**: Dimana model sempat bingung atau alat gagal.
3. **Koreksi Pengguna**: Solusi atau arahan yang diberikan pengguna.
4. **Rekomendasi Pembaruan**: Panduan apa yang perlu ditambahkan ke dokumen proyek atau skill agar kendala tidak berulang.

## 3. Human-in-the-Loop
- Jangan mengubah file konfigurasi atau aturan dasar tanpa persetujuan eksplisit pengguna.
- Sajikan temuan sebagai usulan perbaikan yang jelas dan dapat ditindaklanjuti.
