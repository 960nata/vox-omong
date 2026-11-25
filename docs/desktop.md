# VOX·AI Studio sebagai app desktop

Shell Electron membungkus app Next yang sudah ada: satu jendela, tray, keep-awake, notifikasi
native, deep link `vox://`, dan auto-update — bentuknya sama dengan OpenBot
(docs/openbot-breakdown.md §F/§I), tanpa bagian billing/kredit.

| Berkas | Isi |
| --- | --- |
| `electron/main.cjs` | proses utama: jendela, tray, keep-awake, IPC, deep link, auto-update |
| `electron/menu.cjs` | menu bar native (Berkas / Ubah / Tampilan / Jalankan / Jendela / Bantuan) |
| `electron/launch-server.cjs` | memaksa data app ke folder pengguna, bukan ke dalam bundle |
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

## Menu bar

Menu native dibuat di `electron/menu.cjs`, bukan memakai bawaan Electron.

- Urusan jendela/sistem (muat ulang, zoom, layar penuh, devtools, keep-awake) dikerjakan di main.
- Urusan isi app (Chat baru ⌘N, Thread baru ⇧⌘N, Tanya samping ⇧⌘K, Workflow baru ⇧⌘W,
  panel Workflow/Routine/Thread/Memory, Pengaturan ⌘,) dikirim ke halaman lewat channel
  `vox:menu`. Halaman mendengarkannya dengan `window.vox?.onMenu(...)`; aksi yang belum ditangani
  cukup diabaikan, menunya tetap aman diklik.

Daftar aksinya ada di `VoxMenuAction` (src/types/desktop.d.ts).

## Header & tombol jendela

Di macOS jendelanya `titleBarStyle: "hiddenInset"` dengan `trafficLightPosition` disetel agar
tombol merah-kuning-hijau sejajar tengah header app (tinggi 56px). Supaya tombol itu tidak menutupi
isi header, main menyuntikkan CSS lewat `webContents.insertCSS`: header dapat `padding-left: 84px`
dan jadi area seret jendela, sementara tombol/input di dalamnya tetap `no-drag` agar bisa diklik.

CSS-nya sengaja **tidak** ditaruh di `globals.css` dan tidak ada atribut tambahan di komponen:
tampilan web di browser sama sekali tidak berubah, dan React tidak bisa membuangnya saat hydration
(atribut `data-*` yang ditambahkan di JSX terbukti hilang setelah hydrate).

## Di mana data disimpan

Server Next memanggil `process.chdir(__dirname)`, sedangkan 22 tempat di kode VOX menyimpan data
lewat `path.join(process.cwd(), ".data", …)`. Kalau dibiarkan, app terpaket menulis ke dalam bundle
`.app` sendiri — read-only begitu ada di /Applications, dan hilang tiap update.

`electron/launch-server.cjs` memaksa cwd ke folder data pengguna dan mengunci `process.chdir`,
lalu menyambungkan aset read-only (`skills`, `node_modules`) ke dalam bundle lewat symlink.

| OS | Lokasi data |
| --- | --- |
| macOS | `~/Library/Application Support/VOX·AI Studio/.data` |
| Windows | `%APPDATA%/VOX·AI Studio/.data` |
| Linux | `~/.config/VOX·AI Studio/.data` |

## Ukuran paket

| | Sebelum | Sesudah |
| --- | --- | --- |
| bundle server | 856 MB | 75 MB |
| `.app` | 1.1 GB | 320 MB |
| `.dmg` | 448 MB | 128 MB |

Biang keroknya `electron-updater` ada di `dependencies`, sehingga file-tracing Next ikut menarik
`node_modules/electron` (772 MB — ada binary Electron utuh di dalamnya) ke `.next/standalone`,
padahal server Next tidak pernah memuat Electron. Perbaikannya: `electron-updater` pindah ke
`devDependencies`, plus `outputFileTracingExcludes` di `next.config.ts` dan daftar pangkas di
`scripts/desktop-prepare.mjs` sebagai jaring pengaman. `electronLanguages` juga memangkas ~50
folder bahasa dari Electron.

Setiap `desktop:prepare` mencetak ukuran total dan 5 paket terbesar, jadi kalau membengkak lagi
penyebabnya langsung kelihatan.

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
- **Sisa ukuran** sebagian besar Electron itu sendiri (213 MB framework). Yang masih bisa dipangkas
  dari sisi VOX: `@img`/sharp 18 MB dan `typescript` 9 MB, keduanya dipakai saat runtime.
- Auto-update baru aktif kalau target publish sudah diisi di `electron-builder.yml`.
