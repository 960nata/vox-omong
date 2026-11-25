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

/**
 * Paket yang tidak boleh ada di server, walau sempat ikut tertarik tracing Next.
 * `electron` sendiri ~770 MB (ada binary Electron utuh di dalamnya) dan server Next
 * tidak pernah memuatnya — ini jaring pengaman kalau `outputFileTracingExcludes` terlewat.
 */
const PRUNE_PACKAGES = [
  "electron",
  "electron-builder",
  "electron-updater",
  "app-builder-lib",
  "dmg-builder",
  "@electron",
  "vitest",
  "eslint",
  "esbuild",
  "@esbuild",
];

let copied = 0;
const skipped = [];

async function dirSize(dir) {
  let total = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await dirSize(full);
    else {
      const stat = await fs.stat(full).catch(() => null);
      if (stat) total += stat.size;
    }
  }
  return total;
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;

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

  // Buang paket yang jelas tidak dipakai server, lalu laporkan hematnya.
  const pruned = [];
  for (const name of PRUNE_PACKAGES) {
    const dir = path.join(target, "node_modules", name);
    if (!(await exists(dir))) continue;
    const size = await dirSize(dir);
    await fs.rm(dir, { recursive: true, force: true });
    pruned.push(`${name} (${mb(size)})`);
  }
  if (pruned.length) console.log(`[desktop] dipangkas: ${pruned.join(", ")}`);

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

  const total = await dirSize(target);
  console.log(`[desktop] ${copied} berkas, ${mb(total)} disiapkan di .vox-desktop/server`);
  if (skipped.length) console.log(`[desktop] dilewati (rahasia/sampah): ${[...new Set(skipped)].join(", ")}`);

  // Paket terbesar, biar kalau membengkak lagi langsung kelihatan penyebabnya.
  const modules = path.join(target, "node_modules");
  if (await exists(modules)) {
    const sizes = [];
    for (const entry of await fs.readdir(modules, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      sizes.push([entry.name, await dirSize(path.join(modules, entry.name))]);
    }
    const top = sizes.sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log(`[desktop] terbesar: ${top.map(([n, v]) => `${n} ${mb(v)}`).join(", ")}`);
  }
}

main().catch((error) => {
  console.error(`[desktop] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
