# VOX·AI Studio sebagai app desktop

Shell Electron membungkus app Next yang sudah ada: satu jendela, tray, keep-awake, notifikasi
native, deep link `vox://`, dan auto-update — bentuknya sama dengan OpenBot
(docs/openbot-breakdown.md §F/§I), tanpa bagian billing/kredit.

| Berkas | Isi |
| --- | --- |
| `electron/main.cjs` | proses utama: jendela, tray, keep-awake, IPC, deep link, auto-update |
| `electron/preload.cjs` | satu-satunya jembatan ke sistem (`window.vox`) |
| `electron/server.cjs` | menyalakan server Next lokal di port kosong |
| `scripts/desktop-prepare.mjs` | menyiapkan folder server **tanpa `.env`/`.data`** |
| `electron-builder.yml` | konfigurasi paket `.dmg` / `.zip` / NSIS / AppImage |
| `src/types/desktop.d.ts` | tipe `window.vox` buat dipakai komponen |

## Perintah

```bash
npm run dev            # terminal 1: server Next
npm run desktop        # terminal 2: buka jendela desktop (pakai server dev di :3000)

npm run desktop:pack   # build + bikin VOX·AI Studio.app (tanpa installer)
npm run desktop:build   # build + bikin .dmg dan .zip di dist-desktop/
npm run desktop:smoke  # uji: jendela benar-benar memuat app, lalu keluar
```

`desktop:smoke` mencetak `VOX_SMOKE_OK <url> | judul: …` kalau berhasil, atau
`VOX_SMOKE_FAIL <alasan>` lalu keluar dengan kode 1 — jadi bisa dipakai di CI.

## Cara kerjanya

- **Dev**: jendela langsung memuat `http://127.0.0.1:3000`; `npm run dev` harus sudah jalan.
- **Terpaket**: `next build` dengan `output: "standalone"` (aktif saat `VOX_DESKTOP=1`) menghasilkan
  server mandiri. Server itu ikut di `app.asar.unpacked` lalu dijalankan sebagai proses anak dengan
  `ELECTRON_RUN_AS_NODE=1`, jadi **pengguna tidak perlu punya Node**. Portnya dipilih kosong oleh OS.

## Keamanan

- Renderer: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- Navigasi keluar origin lokal diblokir; `target=_blank` dibuka di browser sistem.
- Izin perangkat: cuma mikrofon yang diizinkan (app suara), sisanya ditolak.
- `window.vox` isinya terbatas; `providerLogin` hanya menerima perintah dari daftar putih.
- `scripts/desktop-prepare.mjs` membuang `.env*`, `.data`, `*.pem`, `*.key`, dan
  `credentials*.json` dari folder yang dipaketkan, lalu **menggagalkan build** kalau ada yang lolos.
  Tanpa ini, `.next/standalone` ikut menyalin `.env` ke dalam `.app` yang bisa dibagikan.

## Batasan sekarang

- **Belum ditandatangani Apple.** `identity: null`, jadi `.dmg` hasil build lokal akan kena
  Gatekeeper di komputer orang lain ("tidak bisa diverifikasi"). Untuk rilis publik, isi
  `CSC_LINK` + `CSC_KEY_PASSWORD` dan hidupkan notarisasi.
- **Electron 38**, bukan versi terbaru, karena Electron 42+ butuh Node ≥ 22.12 sedangkan mesin ini
  Node 20.12. Setelah Node di-upgrade, `npm i -D electron@latest` bisa langsung dipakai.
- **Belum ada ikon app** — electron-builder memakai ikon Electron bawaan. Taruh `build/icon.png`
  (1024×1024) untuk ikon sendiri.
- Auto-update baru aktif kalau target publish sudah diisi di `electron-builder.yml`.
