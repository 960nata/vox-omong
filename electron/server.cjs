// @ts-check
"use strict";

/**
 * Menyalakan server Next di localhost untuk dipakai jendela Electron.
 *
 * Mode dev: tidak menyalakan apa pun, cukup pakai `npm run dev` yang sudah jalan.
 * Mode terpaket: menjalankan hasil build `output: "standalone"` sebagai proses anak Node
 * (ELECTRON_RUN_AS_NODE memakai Node yang sudah ada di dalam Electron, jadi tidak perlu
 * Node terpasang di komputer pengguna).
 */

const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const fs = require("node:fs");

const HOST = "127.0.0.1";

/** Port kosong yang dipilih OS, biar tidak bentrok dengan server lain. */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, HOST, () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

function portOpen(port, timeoutMs = 700) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, HOST);
  });
}

async function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portOpen(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

/** Berkas server hasil build standalone, kalau ada. */
function standaloneEntry(resourcesPath, projectRoot) {
  const candidates = [
    // Paket rilis: ikut app.asar tapi di-unpack, supaya node_modules-nya nyata di disk.
    path.join(resourcesPath || "", "app.asar.unpacked", ".vox-desktop", "server", "server.js"),
    path.join(resourcesPath || "", "standalone", "server.js"),
    // Jalan dari repo (electron . tanpa packaging).
    path.join(projectRoot, ".vox-desktop", "server", "server.js"),
    path.join(projectRoot, ".next", "standalone", "server.js"),
  ];
  return candidates.find((file) => fs.existsSync(file)) || null;
}

/**
 * @returns {Promise<{ url: string, stop: () => void, log: string[] }>}
 */
async function startServer({ isDev, resourcesPath, projectRoot, devPort = 3000, env = {}, dataRoot }) {
  const log = [];

  if (isDev) {
    const ready = await waitForPort(devPort, 60_000);
    if (!ready) {
      throw new Error(
        `Server dev belum hidup di ${HOST}:${devPort}. Jalankan "npm run dev" dulu, lalu buka lagi.`
      );
    }
    return { url: `http://${HOST}:${devPort}`, stop: () => {}, log };
  }

  const entry = standaloneEntry(resourcesPath, projectRoot);
  if (!entry) {
    throw new Error(
      'Build desktop belum ada. Jalankan "npm run desktop:build" dulu (butuh output standalone).'
    );
  }

  const port = await freePort();
  // Dijalankan lewat pembungkus supaya datanya mendarat di folder pengguna, bukan di dalam bundle.
  const launcher = path.join(__dirname, "launch-server.cjs");
  const home = dataRoot || path.dirname(entry);
  fs.mkdirSync(home, { recursive: true });
  const child = spawn(process.execPath, [launcher], {
    cwd: home,
    env: {
      ...process.env,
      ...env,
      VOX_SERVER_ENTRY: entry,
      VOX_DATA_ROOT: home,
      // Pakai Node yang menyatu di dalam Electron, bukan Node sistem.
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      HOSTNAME: HOST,
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const keep = (chunk) => {
    log.push(String(chunk).trimEnd());
    if (log.length > 200) log.shift();
  };
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);

  const ready = await waitForPort(port, 60_000);
  if (!ready) {
    child.kill();
    throw new Error(`Server VOX tidak hidup di port ${port}.\n${log.slice(-10).join("\n")}`);
  }

  return {
    url: `http://${HOST}:${port}`,
    stop: () => {
      if (!child.killed) child.kill();
    },
    log,
  };
}

module.exports = { startServer, freePort, portOpen, waitForPort, standaloneEntry, HOST };
