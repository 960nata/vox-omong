---
name: omniroute
description: Perutean cerdas multi-provider LLM (smart model routing), strategi fallback, dan efisiensi kuota token ala OmniRoute.
license: MIT (cheaper-inference/OmniRoute)
---

# OmniRoute — Perutean Model Cerdas & Manajemen Kuota

Metodologi perutean inferensi cerdas lintas penyedia LLM (Gemini, Claude, GPT, DeepSeek, Local) untuk efisiensi biaya dan ketersediaan tinggi.

## 1. Klasifikasi Kompleksitas Tugas (Tiering)
- **Tier 1 (Fast & Economical)**: Tugas ekstraksi, klasifikasi intent, rangkuman pendek, dan formatting JSON ringan → Rute ke model cepat (misal: Gemini Flash, DeepSeek-V3).
- **Tier 2 (Balanced Reasoning)**: Pembuatan kode umum, penulisan esai, audit logika, dan evaluasi review → Rute ke model menengah (misal: Sonnet / Pro).
- **Tier 3 (Deep Frontier)**: Arsitektur sistem berskala besar, refactoring rumit, dan pembuktian matematis → Rute ke model reasoning tinggi.

## 2. Mekanisme Fallback & Circuit Breaker
- Jika provider utama mengembalikan error status 429 (Rate Limit) atau 503 (Overloaded):
  1. Catat pendingin (*cooldown*) selama 30–60 detik.
  2. Alihkan otomatis ke provider cadangan yang setara tanpa memutus sesi pengguna.
- Hindari loop pemanggilan berulang jika model gagal menjawab dalam 3 kali percobaan.

## 3. Kompresi Konteks & Caching
- Singkirkan pesan pengisi dan formatting berlebih sebelum prompt dikirim.
- Gunakan context caching untuk data statis seperti skema database atau dokumentasi sistem.
