---
name: graphify
description: Transformasi codebase, skema basis data, dan dokumentasi menjadi knowledge graph ringkas untuk reduksi konteks token ala Graphify.
license: MIT (Graphify-Labs/graphify)
---

# Graphify — Pemetaan Knowledge Graph Kode & Dokumen

Metodologi pemetaan struktur kode dan dokumen menjadi graf relasional berbobot ringan untuk navigasi presisi tanpa membakar kuota token konteks.

## 1. Pemetaan Relasi Simbol (Nodes & Edges)
- **Node**: File, Modul, Kelas, Fungsi, Endpoint API, Tabel Database.
- **Edge**:
  - `imports`: Ketergantungan modul antar-file.
  - `calls`: Fungsi memanggil fungsi lain.
  - `extends / implements`: Pewarisan atau implementasi interface.
  - `references`: Pemakaian schema database pada query kode.

## 2. Navigasi Berbasis Graf
- Saat mencari implementasi fitur, telusuri alur dari entry point (misal: route handler) melalui edge `calls` dan `imports` alih-alih melakukan grep seluruh isi direktori.
- Kelompokkan komponen ke dalam subsistem logis (*communities/clusters*): Presentation, Business Logic, Persistence, dan External Integrations.

## 3. Efisiensi Konteks (Token Optimization)
- Sajikan ringkasan struktur graf terlebih dahulu (diagram alur relasi) sebelum menampilkan isi kode penuh.
- Tampilkan cuplikan kode hanya untuk file atau fungsi yang menjadi titik fokus perubahan.
