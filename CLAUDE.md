# VOX·AI Studio — Claude Code & Oh My Claude Code (OMC) Guide

## Ringkasan Proyek
VOX·AI Studio adalah asisten AI berbasis web & suara (Next.js 16, React 19, TypeScript, Tailwind CSS v4) yang menghasilkan website, dokumen, slide, dan video interaktif melalui perintah bahasa alami (Bahasa Indonesia & Inggris).

## Perintah Pengembangan (Scripts)
- `npm run dev`: Menjalankan server development dengan Next.js Turbopack.
- `npm run build`: Kompilasi build produksi.
- `npm run typecheck`: Validasi tipe TypeScript (`tsc --noEmit -p .`).
- `npm run lint`: Pemeriksaan linting ESLint.

## Konfigurasi Oh My Claude Code (OMC)
Proyek ini mengadopsi prinsip orkestrasi multi-agen dari **Oh My Claude Code** (`Yeachan-Heo/oh-my-claudecode`):
1. **Mode Ultrawork (Fokus & Milestone)**:
   - Pecah tugas kompleks ke dalam milestone kecil yang terukur.
   - Jangan melompat ke tahap berikutnya sebelum implementasi saat ini terverifikasi.
2. **Koordinasi Spesialis**:
   - **Architect**: Merancang skema data, arsitektur route, dan kontrak API.
   - **Implementer (Frontend/Fullstack)**: Menulis kode semantik, responsif, dan hemat dependensi.
   - **Reality Checker (QA/Audit)**: Memeriksa hasil terhadap brief awal, memisahkan fakta dari asumsi, dan memastikan tidak ada klaim palsu.
3. **Integritas & Keamanan**:
   - Lindungi kredensial (`.env.local`, API keys, token OAuth).
   - Jangan pernah mengaku sudah melakukan verifikasi browser/runtime tanpa bukti log alat.

## Integrasi Model Context Protocol (MCP)
Konfigurasi MCP tersimpan di `.mcp.json` dan terintegrasi di VOX (`src/lib/mcpConnections.ts`):
- **Supabase** (`https://mcp.supabase.com/mcp`): Inspeksi skema basis data, tabel, dan migrasi.
- **Vercel** (`https://mcp.vercel.com`): Pelacakan status deployment, log error build, dan konfigurasi proyek.
- **Chrome DevTools** (`chrome-devtools-mcp`): Diagnostik langsung DOM, evaluasi JavaScript, penangkapan screenshot, dan audit performa/konsol.
- **Playwright** (`http://127.0.0.1:8931/mcp`): Otomasi pengujian navigasi browser lokal.
