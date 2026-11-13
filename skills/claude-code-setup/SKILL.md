---
name: claude-code-setup
description: Panduan penyiapan lingkungan Claude Code CLI, konfigurasi .claude/ dan .mcp.json, serta integrasi alur kerja agen lokal.
license: MIT
---

# Claude Code Setup — Panduan Penyiapan CLI & MCP

Instruksi lengkap penyiapan Claude Code CLI dan integrasi server MCP di lingkungan kerja lokal.

## 1. Instalasi & Verifikasi CLI
- Pastikan Node.js (>=20) terpasang.
- Jalankan perintah instalasi global:
  ```bash
  npm install -g @anthropic-ai/claude-code
  ```
- Jalankan `claude` di terminal direktori proyek untuk memulai sesi interaktif.

## 2. Struktur Konfigurasi Repository
- **`CLAUDE.md`**: Tempatkan di root proyek. Berisi instruksi proyek, perintah build/test, arsitektur, dan konvensi penamaan kode.
- **`.mcp.json`**: Menghubungkan server MCP resmi (Supabase, Vercel, Chrome DevTools, Playwright) secara otomatis saat Claude Code berjalan di repo ini.

## 3. Disiplin Interaksi CLI
- Selalu jalankan validasi sintaks (`npm run typecheck` atau `npm run build`) setelah melakukan pengeditan berkas.
- Gunakan perintah git yang aman; selalu periksa status branch sebelum melakukan commit atau perubahan struktur file besar.
