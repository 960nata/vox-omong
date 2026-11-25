// @ts-check
"use strict";

/**
 * Satu-satunya jembatan antara halaman VOX dan sistem.
 *
 * Yang dibuka cuma yang memang dibutuhkan app: info versi, notifikasi native, keep-awake,
 * login provider (perintahnya sudah di-whitelist di main), dan buka tautan di browser.
 * Tidak ada akses berkas, tidak ada `require`, tidak ada eksekusi perintah bebas.
 */

const { contextBridge, ipcRenderer } = require("electron");

/**
 * Penanda untuk CSS: `html[data-vox-desktop="mac"]`. Dipakai globals.css untuk memberi ruang
 * bagi tombol jendela macOS dan menjadikan header bisa diseret. Di tab browser atribut ini
 * tidak pernah ada, jadi tampilan web sama sekali tidak berubah.
 */
function markDesktop() {
  try {
    document.documentElement.dataset.voxDesktop = process.platform === "darwin" ? "mac" : "lain";
  } catch {
    // dokumen belum siap: coba lagi saat DOM selesai dimuat
  }
}
markDesktop();
window.addEventListener("DOMContentLoaded", markDesktop);

contextBridge.exposeInMainWorld("vox", {
  /** Penanda bahwa app jalan di shell desktop, bukan tab browser. */
  desktop: true,
  info: () => ipcRenderer.invoke("vox:info"),
  notify: (title, body) => ipcRenderer.invoke("vox:notify", { title, body }),
  setKeepAwake: (on) => ipcRenderer.invoke("vox:keep-awake", on === true),
  /** `command` harus salah satu dari daftar putih di main: "codex login" | "claude login" | "gemini". */
  providerLogin: (command) => ipcRenderer.invoke("vox:provider-login", command),
  openExternal: (url) => ipcRenderer.invoke("vox:open-external", url),
  /**
   * Aksi dari menu bar native (Berkas > Chat baru, Tampilan > Workflow, dst.).
   * Halaman boleh mengabaikan aksi yang belum ditanganinya.
   */
  onMenu: (handler) => {
    if (typeof handler !== "function") return () => {};
    const listener = (_event, action) => handler(String(action));
    ipcRenderer.on("vox:menu", listener);
    return () => ipcRenderer.removeListener("vox:menu", listener);
  },
  onDeepLink: (handler) => {
    if (typeof handler !== "function") return () => {};
    const listener = (_event, url) => handler(String(url));
    ipcRenderer.on("vox:deep-link", listener);
    return () => ipcRenderer.removeListener("vox:deep-link", listener);
  },
});
