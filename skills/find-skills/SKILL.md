---
name: find-skills
description: Penemuan keahlian (skill discovery), pencocokan kebutuhan pengguna ke katalog agen, dan panduan penggunaan skill.
license: MIT
---

# Find Skills — Penemuan & Panduan Keahlian Agen

Membantu pengguna menemukan, memilih, dan menggabungkan skill yang tepat di dalam sistem VOX·AI.

## 1. Identifikasi Intent & Kebutuhan
- Ekstrak tujuan utama pengguna: apakah terkait penulisan kode, perancangan desain, analisis bisnis, riset akademik, atau otomasi media.
- Cocokkan kata kunci brief dengan katalog skill internal (`skills/`) dan katalog komunitas (`src/lib/skillCatalog.ts`).

## 2. Rekomendasi Terarah
- Berikan rekomendasi 1–2 skill yang paling relevan beserta alasan spesifik.
- Berikan contoh format pemanggilan (prompt) yang langsung bisa dicoba pengguna.
- Jelaskan keterbatasan skill jika membutuhkan kredensial layanan eksternal (API key).

## 3. Komposisi Antar-Skill (Skill Chaining)
- Jika tugas berskala besar, susun alur bertahap:
  1. *Fase Riset/Analisis*: (misal: `academic-research` atau `find-skills`)
  2. *Fase Perancangan*: (misal: `frontend-design` atau `founder-skills`)
  3. *Fase Eksekusi/Audit*: (misal: `agency-agents` atau `task-observer`)
