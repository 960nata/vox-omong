---
name: hyperframes
description: Pembuatan video dan animasi programatik berbasis kode web (HTML/CSS/JS/GSAP) dengan deterministik frame-seeking ala HyperFrames.
license: Apache-2.0 (heygen-com/hyperframes)
---

# HyperFrames — Video & Animasi Berbasis Kode Web

Metode perancangan video dan motion graphics presisi berbasis kode web (HTML5, CSS Animations, GSAP) untuk AI agents.

## 1. Konsep Deterministik Frame-Seeking
- Setiap adegan video dikontrol oleh variabel waktu `t` (detik atau frame) yang dapat dipause, diseek, dan dirender frame demi frame tanpa fluktuasi waktu runtime.
- Hindari fungsi non-deterministik seperti `setInterval` atau `Math.random()` tanpa seed tetap.

## 2. Struktur Adegan (Scene Composition)
- **Viewport Standar**: 1920x1080 (Landscape) atau 1080x1920 (Vertical/Reels/TikTok).
- **Komponen Visual**:
  - Background layer (warna solid, grid, atau gradient dinamis).
  - Subject layer (tipografi hero, badge metrik, mockup UI, grafik).
  - Overlay layer (subtitel, watermark, audio waveform).

## 3. Sinkronisasi Audio & Transisi
- Setiap perubahan adegan harus memiliki timestamp mulai (`startTime`) dan durasi (`duration`).
- Pastikan teks narasi atau voiceover cocok dengan cue visual di timeline.
- Gunakan kurva easing yang natural (`power2.out`, `expo.out`) untuk gerakan tipografi dan transisi elemen.
