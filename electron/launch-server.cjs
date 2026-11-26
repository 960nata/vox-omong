// @ts-check
"use strict";

/**
 * Pembungkus yang menjalankan server Next di dalam app desktop.
 *
 * Masalahnya: `.next/standalone/server.js` memanggil `process.chdir(__dirname)`, sedangkan 22
 * tempat di kode VOX menyimpan data lewat `path.join(process.cwd(), ".data", …)`. Akibatnya app
 * terpaket menulis datanya ke dalam bundle `.app` sendiri — folder yang read-only begitu app ada
 * di /Applications, dan isinya hilang tiap kali app diperbarui.
 *
 * Jadi di sini cwd dipaksa ke folder data pengguna (`~/Library/Application Support/…`) dan
 * `process.chdir` dimatikan supaya server tidak memindahkannya balik. Dua aset yang memang dibaca
 * relatif cwd (`skills`, `node_modules`) disambungkan ke dalam bundle lewat symlink.
 *
 * Next sendiri tidak terganggu: ia menemukan berkasnya lewat `__dirname`, bukan cwd.
 */

const fs = require("node:fs");
const path = require("node:path");

const dataRoot = process.env.VOX_DATA_ROOT;
const entry = process.env.VOX_SERVER_ENTRY;

if (!dataRoot || !entry) {
  console.error("[vox] VOX_DATA_ROOT dan VOX_SERVER_ENTRY wajib diisi.");
  process.exit(1);
}

fs.mkdirSync(path.join(dataRoot, ".data"), { recursive: true });

// Muat .env dari folder data pengguna (~/Library/Application Support/VOX·AI Studio/.env) bila ada.
const userEnvPath = path.join(dataRoot, ".env");
if (fs.existsSync(userEnvPath)) {
  try {
    const rawEnv = fs.readFileSync(userEnvPath, "utf8");
    for (const line of rawEnv.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && !(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch (err) {
    console.error(`[vox] gagal membaca .env pengguna: ${err instanceof Error ? err.message : err}`);
  }
}

// Aset read-only yang dibaca relatif cwd — disambungkan, bukan disalin.
const bundleDir = path.dirname(entry);
for (const asset of ["skills", "node_modules"]) {
  const link = path.join(dataRoot, asset);
  const source = path.join(bundleDir, asset);
  if (!fs.existsSync(source)) continue;
  try {
    const current = fs.lstatSync(link, { throwIfNoEntry: false });
    if (current?.isSymbolicLink() && fs.readlinkSync(link) === source) continue;
    if (current) fs.rmSync(link, { recursive: true, force: true });
    fs.symlinkSync(source, link, "dir");
  } catch (error) {
    console.error(`[vox] gagal menyambungkan ${asset}: ${error instanceof Error ? error.message : error}`);
  }
}

process.chdir(dataRoot);
// Kunci cwd: `server.js` akan mencoba pindah ke dalam bundle, dan itu yang mau dicegah.
process.chdir = () => {};

require(entry);
