// @ts-check
"use strict";

/**
 * Shell desktop VOX·AI Studio.
 *
 * Bentuknya seperti OpenBot (docs/openbot-breakdown.md): jendela Electron yang memuat app Next
 * dari server lokal, plus tray, keep-awake, notifikasi native, deep link, dan auto-update.
 *
 * Catatan keamanan: renderer jalan dengan `contextIsolation` + `sandbox` dan tanpa Node. Navigasi
 * keluar origin lokal diblokir, jendela baru dibuka di browser sistem. Satu-satunya jembatan ke
 * sistem adalah `preload.cjs` yang isinya dibatasi.
 */

const { app, BrowserWindow, Menu, Notification, Tray, dialog, ipcMain, nativeImage, powerSaveBlocker, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { startServer, HOST } = require("./server.cjs");
const { applyMenu } = require("./menu.cjs");

const isDev = !app.isPackaged;
const projectRoot = path.join(__dirname, "..");
const DEV_PORT = Number(process.env.VOX_DEV_PORT) || 3000;

/** @type {{ url: string, stop: () => void, log: string[] } | null} */
let server = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;
let keepAwakeId = -1;
/** Deep link yang datang sebelum jendela siap. */
let pendingDeepLink = null;

app.setName("VOX·AI Studio");
if (process.platform === "darwin") app.setAboutPanelOptions({ applicationName: "VOX·AI Studio" });

// ───────────────────────────── jendela ─────────────────────────────

function iconPath() {
  for (const file of ["build/icon.png", "public/icon.png", "src/app/favicon.ico"]) {
    const full = path.join(projectRoot, file);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function createWindow() {
  const icon = iconPath();
  mainWindow = new BrowserWindow({
    title: "VOX·AI Studio",
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    frame: true,
    show: false,
    backgroundColor: "#0b0b0f",
    // Bingkai jendela standar OS (title bar native + tombol tutup/perkecil/perbesar di atas konten)
    titleBarStyle: "default",
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
    if (pendingDeepLink) {
      mainWindow?.webContents.send("vox:deep-link", pendingDeepLink);
      pendingDeepLink = null;
    }
  });

  // Jendela baru (target=_blank) dibuka di browser sistem, bukan jadi jendela Electron.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  // Blokir navigasi keluar dari server lokal VOX.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!server || url.startsWith(server.url)) return;
    event.preventDefault();
    if (/^https?:/.test(url)) void shell.openExternal(url);
  });

  // Aplikasi suara: izinkan mikrofon, tolak sisanya.
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "media" || permission === "audioCapture");
  });

  mainWindow.on("close", (event) => {
    // Tutup jendela = sembunyikan ke tray, biar routine & thread tetap jalan.
    if (!(/** @type {any} */ (app).isQuittingVox)) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

function showWindow() {
  if (!mainWindow) {
    createWindow();
    if (server) void mainWindow?.loadURL(server.url);
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// ───────────────────────────── tray & keep awake ─────────────────────────────

function keepAwake(on) {
  if (on && keepAwakeId < 0) {
    // `prevent-app-suspension`: layar boleh mati, tapi proses tidak di-suspend —
    // itu yang dibutuhkan routine supaya tetap jalan tepat waktu.
    keepAwakeId = powerSaveBlocker.start("prevent-app-suspension");
  } else if (!on && keepAwakeId >= 0) {
    powerSaveBlocker.stop(keepAwakeId);
    keepAwakeId = -1;
  }
  refreshTray();
  refreshMenu();
  return keepAwakeId >= 0;
}

/** Menu bar dibangun ulang supaya centang (keep-awake) ikut berubah. */
function refreshMenu() {
  applyMenu({
    getWindow: () => mainWindow,
    keepAwake,
    isKeepAwake: () => keepAwakeId >= 0,
    showWindow,
    showServerLog,
  });
}

function refreshTray() {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Buka VOX", click: showWindow },
      { type: "separator" },
      {
        label: "Jaga komputer tetap bangun",
        type: "checkbox",
        checked: keepAwakeId >= 0,
        click: (item) => keepAwake(item.checked),
      },
      {
        label: "Status provider langganan…",
        click: () => {
          showWindow();
          if (server) void mainWindow?.loadURL(`${server.url}/?panel=providers`);
        },
      },
      { type: "separator" },
      { label: "Log server…", click: showServerLog },
      {
        label: "Keluar",
        click: () => {
          /** @type {any} */ (app).isQuittingVox = true;
          app.quit();
        },
      },
    ])
  );
}

function createTray() {
  const icon = iconPath();
  const image = icon ? nativeImage.createFromPath(icon).resize({ width: 18, height: 18 }) : nativeImage.createEmpty();
  if (process.platform === "darwin") image.setTemplateImage(true);
  tray = new Tray(image);
  tray.setToolTip("VOX·AI Studio");
  tray.on("click", showWindow);
  refreshTray();
}

function showServerLog() {
  void dialog.showMessageBox({
    type: "info",
    title: "Log server VOX",
    message: server ? `Server: ${server.url}` : "Server belum hidup.",
    detail: (server?.log ?? []).slice(-25).join("\n") || "(belum ada log)",
  });
}

// ───────────────────────────── jembatan ke renderer ─────────────────────────────

function registerIpc() {
  ipcMain.handle("vox:info", () => ({
    platform: process.platform,
    appVersion: app.getVersion(),
    electron: process.versions.electron,
    isDev,
    serverUrl: server?.url ?? null,
    keepAwake: keepAwakeId >= 0,
  }));

  ipcMain.handle("vox:keep-awake", (_event, on) => keepAwake(on === true));

  ipcMain.handle("vox:notify", (_event, payload) => {
    const title = String(payload?.title ?? "VOX·AI Studio").slice(0, 120);
    const body = String(payload?.body ?? "").slice(0, 500);
    if (!Notification.isSupported()) return false;
    const notification = new Notification({ title, body });
    notification.on("click", showWindow);
    notification.show();
    return true;
  });

  /**
   * Login provider langganan (ChatGPT/Claude) harus interaktif, jadi perintahnya dibuka di
   * Terminal milik pengguna. VOX tidak pernah memegang kredensialnya.
   */
  ipcMain.handle("vox:provider-login", (_event, command) => {
    const allowed = ["codex login", "claude login", "gemini"];
    const wanted = String(command ?? "");
    if (!allowed.includes(wanted)) throw new Error(`Perintah login "${wanted}" tidak diizinkan.`);
    if (process.platform === "darwin") {
      const { spawn } = require("node:child_process");
      // `open -a Terminal` dengan argumen skrip: perintahnya dari daftar putih di atas.
      spawn("osascript", ["-e", `tell application "Terminal" to do script "${wanted}"`, "-e", 'tell application "Terminal" to activate'], {
        stdio: "ignore",
        detached: true,
      }).unref();
      return true;
    }
    void dialog.showMessageBox({
      type: "info",
      title: "Login provider",
      message: "Jalankan perintah ini di terminal:",
      detail: wanted,
    });
    return false;
  });

  ipcMain.handle("vox:open-external", (_event, url) => {
    const target = String(url ?? "");
    if (!/^https?:\/\//.test(target)) throw new Error("URL harus http(s).");
    void shell.openExternal(target);
    return true;
  });
}

// ───────────────────────────── auto-update ─────────────────────────────

function setupUpdater() {
  if (isDev) return;
  const feed = path.join(process.resourcesPath || "", "app-update.yml");
  if (!fs.existsSync(feed)) return; // belum dikonfigurasi publish target
  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.autoDownload = true;
    autoUpdater.on("update-downloaded", async () => {
      const { response } = await dialog.showMessageBox({
        type: "info",
        buttons: ["Restart sekarang", "Nanti"],
        defaultId: 0,
        title: "Pembaruan siap",
        message: "Versi baru VOX sudah diunduh.",
        detail: "Restart dilakukan saat kamu siap — tugas yang sedang jalan tidak dipotong.",
      });
      if (response === 0) {
        /** @type {any} */ (app).isQuittingVox = true;
        autoUpdater.quitAndInstall();
      }
    });
    void autoUpdater.checkForUpdates();
    setInterval(() => void autoUpdater.checkForUpdates(), 6 * 3_600_000);
  } catch {
    // electron-updater belum terpasang: lewati saja, app tetap jalan
  }
}

// ───────────────────────────── deep link & single instance ─────────────────────────────

app.setAsDefaultProtocolClient("vox");

function handleDeepLink(url) {
  if (!url || !url.startsWith("vox://")) return;
  if (mainWindow) {
    mainWindow.webContents.send("vox:deep-link", url);
    showWindow();
  } else {
    pendingDeepLink = url;
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    showWindow();
    const link = argv.find((arg) => arg.startsWith("vox://"));
    if (link) handleDeepLink(link);
  });
  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  app.whenReady().then(async () => {
    registerIpc();
    refreshMenu();
    createTray();
    const window = createWindow();

    try {
      server = await startServer({
        isDev,
        resourcesPath: process.resourcesPath,
        projectRoot,
        devPort: DEV_PORT,
        // Data app (chat, project, memory, engine) disimpan di folder pengguna supaya tetap ada
        // setelah update dan tidak mencoba menulis ke dalam bundle yang read-only.
        dataRoot: app.getPath("userData"),
      });
      await window.loadURL(server.url);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      // Di mode uji jangan munculkan dialog: tidak ada yang mengkliknya, prosesnya akan menggantung.
      if (process.env.VOX_SMOKE === "1") {
        console.error(`VOX_SMOKE_FAIL ${detail}`);
      } else {
        await dialog.showMessageBox({
          type: "error",
          title: "VOX tidak bisa start",
          message: "Server lokal VOX gagal dinyalakan.",
          detail,
        });
      }
      /** @type {any} */ (app).isQuittingVox = true;
      app.exit(process.env.VOX_SMOKE === "1" ? 1 : 0);
      return;
    }

    setupUpdater();

    // Mode uji: pastikan jendela benar-benar memuat app, lalu keluar. Dipakai `desktop:smoke`.
    if (process.env.VOX_SMOKE === "1") {
      const title = window.webContents.getTitle();
      const menu = Menu.getApplicationMenu();
      const labels = (menu?.items ?? []).map((item) => item.label).join(" / ");
      console.log(`VOX_SMOKE_OK ${server.url} | judul: ${title}`);
      console.log(`VOX_SMOKE_MENU ${labels}`);
      // Beri waktu React hydrate dulu; sebelum itu header belum ada di DOM.
      await new Promise((resolve) => setTimeout(resolve, 3000));
      // Yang dicek efek akhirnya di layar, bukan atribut di markup.
      const ui = await window.webContents
        .executeJavaScript(
          `(() => {
            const el = document.querySelector("header");
            const style = el ? getComputedStyle(el) : null;
            const btn = el ? el.querySelector("button") : null;
            return JSON.stringify({
              header: !!el,
              padLeft: style ? style.paddingLeft : null,
              drag: style ? style.webkitAppRegion : null,
              tombolBisaDiklik: btn ? getComputedStyle(btn).webkitAppRegion : null,
            });
          })()`
        )
        .catch((error) => `{"error":${JSON.stringify(String(error))}}`);
      console.log(`VOX_SMOKE_UI ${ui}`);
      /** @type {any} */ (app).isQuittingVox = true;
      server.stop();
      // `app.exit` bukan `app.quit`: dengan tray hidup, quit tidak selalu mengakhiri proses.
      app.exit(0);
      return;
    }

    app.on("activate", showWindow);
  });

  app.on("before-quit", () => {
    /** @type {any} */ (app).isQuittingVox = true;
    if (keepAwakeId >= 0) powerSaveBlocker.stop(keepAwakeId);
    server?.stop();
  });

  // Di macOS app tetap hidup di tray walau semua jendela ditutup.
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      /** @type {any} */ (app).isQuittingVox = true;
      app.quit();
    }
  });
}

module.exports = { HOST };
