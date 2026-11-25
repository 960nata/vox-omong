// @ts-check
"use strict";

/**
 * Menu bar native VOX·AI Studio.
 *
 * Tanpa ini Electron memasang menu bawaannya yang generik ("Electron", "Help > Learn More").
 * Di sini menunya dibuat sendiri: label Bahasa Indonesia, pintasan yang masuk akal, dan item
 * yang benar-benar menggerakkan app.
 *
 * Pembagian tugasnya:
 * - Hal yang urusan jendela/sistem (reload, zoom, devtools, keep-awake) dikerjakan di main.
 * - Hal yang urusan isi app (chat baru, thread baru, workflow, panel) dikirim ke renderer lewat
 *   channel `vox:menu`, jadi halaman yang memutuskan apa yang terjadi. Halaman yang belum
 *   menangani sebuah aksi cukup mengabaikannya — menunya tetap aman diklik.
 */

const { Menu, app, shell } = require("electron");

/** Aksi yang diteruskan ke halaman. Dipakai juga oleh src/types/desktop.d.ts. */
const MENU_ACTIONS = [
  "chat-baru",
  "thread-baru",
  "tanya-samping",
  "workflow-baru",
  "workflow-impor",
  "routine-baru",
  "jalankan-routine",
  "panel-provider",
  "panel-workflow",
  "panel-routine",
  "panel-thread",
  "panel-memory",
  "pengaturan",
  "cari",
];

const DOCS = {
  panduan: "https://github.com/NataKun7/voice-ai/blob/main/docs/engine.md",
  provider: "https://github.com/NataKun7/voice-ai/blob/main/docs/providers.md",
  desktop: "https://github.com/NataKun7/voice-ai/blob/main/docs/desktop.md",
  masalah: "https://github.com/NataKun7/voice-ai/issues",
};

/**
 * @param {object} deps
 * @param {() => import("electron").BrowserWindow | null} deps.getWindow
 * @param {(on: boolean) => boolean} deps.keepAwake
 * @param {() => boolean} deps.isKeepAwake
 * @param {() => void} deps.showWindow
 * @param {() => void} deps.showServerLog
 */
function buildMenu(deps) {
  const isMac = process.platform === "darwin";

  /** Kirim aksi ke halaman; kalau jendelanya tertutup, buka dulu. */
  const toPage = (action) => () => {
    deps.showWindow();
    deps.getWindow()?.webContents.send("vox:menu", action);
  };

  const openDoc = (url) => () => void shell.openExternal(url);

  /** @type {import("electron").MenuItemConstructorOptions[]} */
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about", label: `Tentang ${app.name}` },
              { type: "separator" },
              { label: "Pengaturan…", accelerator: "CmdOrCtrl+,", click: toPage("pengaturan") },
              { type: "separator" },
              { role: "services", label: "Layanan" },
              { type: "separator" },
              { role: "hide", label: `Sembunyikan ${app.name}` },
              { role: "hideOthers", label: "Sembunyikan Lainnya" },
              { role: "unhide", label: "Tampilkan Semua" },
              { type: "separator" },
              { role: "quit", label: `Keluar dari ${app.name}` },
            ],
          },
        ]
      : []),
    {
      label: "Berkas",
      submenu: [
        { label: "Chat baru", accelerator: "CmdOrCtrl+N", click: toPage("chat-baru") },
        { label: "Thread baru", accelerator: "CmdOrCtrl+Shift+N", click: toPage("thread-baru") },
        { label: "Tanya samping", accelerator: "CmdOrCtrl+Shift+K", click: toPage("tanya-samping") },
        { type: "separator" },
        { label: "Workflow baru", accelerator: "CmdOrCtrl+Shift+W", click: toPage("workflow-baru") },
        { label: "Impor workflow…", click: toPage("workflow-impor") },
        { label: "Routine baru", click: toPage("routine-baru") },
        { type: "separator" },
        ...(isMac
          ? [{ role: "close", label: "Tutup Jendela" }]
          : [
              { label: "Pengaturan…", accelerator: "CmdOrCtrl+,", click: toPage("pengaturan") },
              { type: "separator" },
              { role: "quit", label: "Keluar" },
            ]),
      ],
    },
    {
      label: "Ubah",
      submenu: [
        { role: "undo", label: "Urungkan" },
        { role: "redo", label: "Ulangi" },
        { type: "separator" },
        { role: "cut", label: "Potong" },
        { role: "copy", label: "Salin" },
        { role: "paste", label: "Tempel" },
        { role: "pasteAndMatchStyle", label: "Tempel Tanpa Format" },
        { role: "delete", label: "Hapus" },
        { role: "selectAll", label: "Pilih Semua" },
        { type: "separator" },
        { label: "Cari…", accelerator: "CmdOrCtrl+F", click: toPage("cari") },
      ],
    },
    {
      label: "Tampilan",
      submenu: [
        { label: "Workflow", click: toPage("panel-workflow") },
        { label: "Routine", click: toPage("panel-routine") },
        { label: "Thread", click: toPage("panel-thread") },
        { label: "Memory agent", click: toPage("panel-memory") },
        { type: "separator" },
        { role: "reload", label: "Muat Ulang" },
        { role: "forceReload", label: "Muat Ulang Paksa" },
        { type: "separator" },
        { role: "resetZoom", label: "Ukuran Asli" },
        { role: "zoomIn", label: "Perbesar" },
        { role: "zoomOut", label: "Perkecil" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Layar Penuh" },
        { role: "toggleDevTools", label: "Alat Pengembang" },
      ],
    },
    {
      label: "Jalankan",
      submenu: [
        { label: "Jalankan routine yang jatuh tempo", click: toPage("jalankan-routine") },
        { type: "separator" },
        { label: "Status provider langganan…", click: toPage("panel-provider") },
        {
          label: "Jaga komputer tetap bangun",
          type: "checkbox",
          checked: deps.isKeepAwake(),
          click: (item) => deps.keepAwake(item.checked),
        },
        { type: "separator" },
        { label: "Log server…", click: deps.showServerLog },
      ],
    },
    {
      label: "Jendela",
      submenu: [
        { role: "minimize", label: "Perkecil" },
        { role: "zoom", label: "Zoom" },
        ...(isMac
          ? [{ type: "separator" }, { role: "front", label: "Bawa Semua ke Depan" }]
          : [{ role: "close", label: "Tutup" }]),
      ],
    },
    {
      role: "help",
      label: "Bantuan",
      submenu: [
        { label: "Panduan mesin VOX", click: openDoc(DOCS.panduan) },
        { label: "Konek langganan Claude & ChatGPT", click: openDoc(DOCS.provider) },
        { label: "Soal app desktop", click: openDoc(DOCS.desktop) },
        { type: "separator" },
        { label: "Lapor masalah", click: openDoc(DOCS.masalah) },
      ],
    },
  ];

  return Menu.buildFromTemplate(/** @type {any} */ (template));
}

/** Pasang menu bar. Dipanggil ulang kalau status centang (mis. keep-awake) berubah. */
function applyMenu(deps) {
  Menu.setApplicationMenu(buildMenu(deps));
}

module.exports = { buildMenu, applyMenu, MENU_ACTIONS, DOCS };
