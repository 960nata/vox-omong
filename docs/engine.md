# Mesin orkestrasi VOX (`src/lib/engine/`)

Lapisan ini hasil bedah OpenBot 0.78.0 — lihat [openbot-breakdown.md](./openbot-breakdown.md) untuk
inventaris fitur dan alasan pemilihannya. Semua diimplementasi ulang dari nol (OpenBot berlisensi
PolyForm Noncommercial, jadi tidak ada kodenya yang dipakai).

| Berkas | Isi |
| --- | --- |
| `types.ts` | tipe bersama (workflow, routine, thread, memory, UI block, akun provider) |
| `store.ts` | koleksi JSON atomic di `.data/engine/` (mutex + `.tmp`→`rename` + `.bak`) |
| `template.ts` | placeholder `{{step.field}}`, indeks array, nilai default `\| fallback` |
| `cron.ts` | cron 5 field dengan timezone IANA (aman DST) + daftar jadwal terlewat |
| `workflow.ts` | runner multi-step: gelombang paralel, batch, run-from-step, pause, export/import |
| `routines.ts` | tugas terjadwal + kebijakan missed-run |
| `scheduler.ts` | `tickRoutines()` — dipicu dari luar, bukan timer internal |
| `threads.ts` | thread paralel per agent dengan batas konkurensi dan tanya-jawab di tengah jalan |
| `failover.ts` | rantai model cadangan + pemilihan akun provider yang tidak kena limit |
| `memory.ts` | memory per agent: selalu-di-prompt vs dicari saat perlu |
| `uiBlocks.ts` | tombol/chip/daftar/form/approval + validasi jawaban |
| `automation.ts` | control plane lokal untuk `scripts/vox-cli.mjs` |
| `bootstrap.ts` | menyambung mesin ke runtime VOX yang sudah ada |

## Endpoint

Semua di bawah `/api/engine/`, dijaga sesi studio (`STUDIO_PIN`) seperti `/api/chat`.

| Route | Aksi |
| --- | --- |
| `GET /workflows` | daftar; `?id=` satu workflow + rencana gelombangnya; `?runs` riwayat run |
| `POST /workflows` | `save`, `delete`, `pause`, `resume`, `export`, `import`, `run` |
| `GET /routines` | daftar + `nextRunAt` |
| `POST /routines` | `save`, `delete`, `enable`, `disable`, `tick` |
| `GET /threads` | daftar (filter `agent`/`status`), jumlah yang menunggu |
| `POST /threads` | `start`, `answer`, `stop`, `at-once` |
| `GET /memory` | daftar; `?agent=&q=` pencarian + blok prompt |
| `POST /memory` | `save`, `delete` |
| `GET /automation` | nyalakan handshake CLI (`?off` untuk mematikan) |
| `POST /automation` | perintah CLI, pakai token automation |

## Contoh workflow

```json
{
  "name": "Riset lalu tulis",
  "trigger": { "kind": "schedule", "value": "0 7 * * *" },
  "steps": [
    { "id": "riset", "kind": "agent", "title": "Riset pasar",
      "input": { "prompt": "Riset tren {{trigger.topik}}", "projectId": "toko-baju" } },
    { "id": "tulis", "kind": "agent", "title": "Tulis draft",
      "input": { "prompt": "Tulis artikel dari: {{riset.reply}}", "projectId": "toko-baju" } },
    { "id": "kirim", "kind": "notification", "title": "Beri tahu",
      "input": { "text": "Draft siap: {{tulis.reply}}" } }
  ]
}
```

- `riset` dan `tulis` otomatis berurutan karena `tulis` merujuk `{{riset.reply}}` — `needs` tidak wajib.
- Step yang tidak saling merujuk jalan paralel dalam satu gelombang.
- `batch: 2..4` membuat beberapa hasil sekaligus; semuanya tersimpan di `batchOutputs`.
- Step `approval` menahan run di status `waiting` sampai dijawab, lalu lanjut lewat
  `action: "run"` dengan `previousRunId`.
- `fromStep` + `previousRunId` = "Run from this step": hasil step di atasnya dipakai ulang.

## Menjalankan routine

Tidak ada timer di dalam proses (biar aman di serverless). Picu dari luar:

```bash
# cron OS tiap menit
* * * * * curl -s -X POST localhost:3000/api/engine/routines \
  -H 'content-type: application/json' -H "x-studio-pin: $STUDIO_PIN" \
  --data '{"action":"tick"}'
```

Waktu tick terakhir disimpan di `.data/engine/scheduler-state.json`; itulah dasar kebijakan
missed-run (`skip` atau `run-once-on-start`) saat aplikasi mati melewati jadwalnya.

## CLI

```bash
# 1. nyalakan automation (butuh sesi studio) — menulis url+token ke .data/engine/automation/
curl -s "localhost:3000/api/engine/automation" -H "x-studio-pin: $STUDIO_PIN"

# 2. pakai dari shell
npm run vox -- list
npm run vox -- run toko-baju "Perbaiki hero section" --wait --timeout 10m
echo "ringkas penjualan minggu ini" | npm run vox -- run toko-baju - --wait --json
npm run vox -- status th-xxxx
npm run vox -- stop th-xxxx
```

Kode keluar: `0` selesai, `1` gagal, `2` salah pakai, `3` menunggu jawaban orang,
`4` kehabisan waktu tunggu (kerjaannya lanjut), `5` server/agent tidak terjangkau.
Token hanya dibaca dari berkas (mode `0600`), tidak pernah lewat argumen perintah.

## Menambah jenis step sendiri

```ts
import { registerStepRunner } from "@/lib/engine";

registerStepRunner("kirim-wa", async ({ input }) => {
  await kirimWhatsApp(String(input.nomor), String(input.teks));
  return { terkirim: true };
});
```

Handler bawaan: `agent`, `http`, `transform`, `notification`, `approval`.

## Tes

`tests/engine*.test.ts` (80 tes): template, cron termasuk DST, rencana & eksekusi workflow,
kebijakan missed-run, batas konkurensi thread, failover model, memory, dan UI block.

```bash
npm test -- tests/engineWorkflow.test.ts
```
