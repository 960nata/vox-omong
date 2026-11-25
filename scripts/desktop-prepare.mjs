#!/usr/bin/env node
/**
 * Menyiapkan folder server untuk shell desktop.
 *
 * `next build` dengan `output: "standalone"` menaruh hasilnya di `.next/standalone`, tapi folder
 * itu juga memuat salinan isi project — termasuk `.env` dan `.data`. Kalau folder itu langsung
 * dipaketkan, kredensial ikut masuk ke berkas `.app`/`.dmg` yang bisa dibagikan. Skrip ini
 * menyalin ulang ke `dist-desktop/server/` dengan daftar larangan yang tegas, lalu memastikan
 * `server.js` dan `node_modules/next` benar-benar ada sebelum packaging jalan.
 */

import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");
// Staging sengaja di luar `dist-desktop` (folder keluaran electron-builder) biar tidak
// ikut dipaketkan balik ke dalam dirinya sendiri.
const target = path.join(root, ".vox-desktop", "server");

/** Nama yang tidak boleh ikut, dicek per segmen path. */
const BLOCKED = [
  /^\.env($|\..*)/i, // .env, .env.local, .env.production …
  /^\.data$/i,
  /^\.git$/i,
  /^\.DS_Store$/i,
  /^\.next-docs$/i,
  /^dist-desktop$/i,
  /^\.vox-desktop$/i,
  /^node_modules\.cache$/i,
  /\.pem$/i,
  /\.key$/i,
  /^credentials.*\.json$/i,
];

function blocked(name) {
  return BLOCKED.some((rule) => rule.test(name));
}

let copied = 0;
const skipped = [];

async function copyDir(from, to) {
  const entries = await fs.readdir(from, { withFileTypes: true });
  await fs.mkdir(to, { recursive: true });
  for (const entry of entries) {
    if (blocked(entry.name)) {
      skipped.push(path.relative(root, path.join(from, entry.name)));
      continue;
    }
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyDir(src, dst);
    } else if (entry.isSymbolicLink()) {
      // Symlink diikuti isinya, biar hasil paket tidak menunjuk ke luar bundle.
      const real = await fs.realpath(src).catch(() => null);
      if (!real) continue;
      const stat = await fs.stat(real);
      if (stat.isDirectory()) await copyDir(real, dst);
      else {
        await fs.copyFile(real, dst);
        copied++;
      }
    } else {
      await fs.copyFile(src, dst);
      copied++;
    }
  }
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(path.join(standalone, "server.js")))) {
    throw new Error('Belum ada .next/standalone. Jalankan "npm run desktop:next" dulu.');
  }

  await fs.rm(target, { recursive: true, force: true });
  await copyDir(standalone, target);

  // `next build` tidak menyalin aset statis & public ke standalone; harus ditambah manual.
  if (await exists(path.join(root, ".next", "static"))) {
    await copyDir(path.join(root, ".next", "static"), path.join(target, ".next", "static"));
  }
  if (await exists(path.join(root, "public"))) {
    await copyDir(path.join(root, "public"), path.join(target, "public"));
  }

  // Pagar pengaman: kalau ada yang lolos, hentikan build daripada merilis rahasia.
  const leaks = [];
  const scan = async (dir) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (blocked(entry.name)) leaks.push(path.relative(target, path.join(dir, entry.name)));
      if (entry.isDirectory() && entry.name !== "node_modules") await scan(path.join(dir, entry.name));
    }
  };
  await scan(target);
  if (leaks.length) throw new Error(`Berkas rahasia lolos ke paket: ${leaks.join(", ")}`);

  for (const required of ["server.js", "node_modules/next/package.json", ".next/static"]) {
    if (!(await exists(path.join(target, required)))) {
      throw new Error(`Folder server belum lengkap: ${required} tidak ada.`);
    }
  }

  console.log(`[desktop] ${copied} berkas disiapkan di .vox-desktop/server`);
  if (skipped.length) console.log(`[desktop] dilewati (rahasia/sampah): ${[...new Set(skipped)].join(", ")}`);
}

main().catch((error) => {
  console.error(`[desktop] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
