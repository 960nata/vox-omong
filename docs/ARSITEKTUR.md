# Arsitektur singkat

Satu pesan dari pengguna melewati tiga tahap: **pilih jalur → jalankan mesin → tampilkan kartu hasil**.

## 1. Memilih jalur

`src/app/api/chat/route.ts` menerima pesan dan menentukan jalurnya dengan aturan di kode, bukan dengan bertanya ke model. Urutannya kurang lebih:

1. Perintah project (buat/buka project), daftar skill.
2. Perintah berantai (`orchestrator.ts`): dua keluaran atau lebih dalam satu kalimat.
3. Email, riset (`agentCore.ts`), browser.
4. Slide, dokumen, invoice, tabel (`skillAgent.ts`), video (`videoMaker.ts`).
5. Website (`siteAgent.ts`, `codeAgent.ts`).
6. Kalau tidak ada yang cocok: obrolan biasa (`gemini.ts`).

Hasil riset dan isi lampiran baru ditempel ke pesan **setelah** jalur dipilih, supaya kata-kata di dalamnya tidak membelokkan jalur.

## 2. Mesin tiap fitur (`src/lib/`)

| File | Tugas |
|---|---|
| `codeAgent.ts` | Pemanggil model (`callLLM`): mode JSON, suhu per tugas, coba ulang saat kena limit, cache singkat. |
| `jsonLoose.ts` | Memperbaiki JSON rusak dari model tanpa memanggil model lagi. |
| `agentCore.ts` | Tim riset: perencana, peneliti paralel, pemeriksa, memori file. |
| `orchestrator.ts` | Menjalankan beberapa mesin berurutan dari satu perintah. |
| `skillAgent.ts` | Slide, dokumen, surat, invoice, tabel. |
| `videoScenes.ts`, `videoMaker.ts` | Adegan motion graphic jadi HTML, lalu direkam jadi `.webm`. |
| `siteAgent.ts`, `siteComposer.ts`, `siteTemplates.ts`, `siteDesign.ts` | Website: spesifikasi, perakitan, gaya, dan tema. |
| `claudeSkills/` | Perender dan pengekspor: tema, palet, `.pptx`, `.docx`, `.xlsx`, HTML dokumen. |
| `browser.ts`, `browserAgent.ts` | Chrome headless dengan pembatas, dan agen yang mengendalikannya. |
| `email.ts` | Draf, konfirmasi, lalu kirim lewat SMTP Gmail. |
| `fileText.ts` | Mengambil teks dari PDF, DOCX, XLSX, PPTX. |
| `skillHub.ts`, `skillLoader.ts` | Katalog panduan (skill) yang disisipkan ke prompt saat relevan. |

## 3. Prinsip yang dipegang

- **Model mengisi, kode memutuskan.** Model kecil patuh kalau tugasnya sempit.
- **Keluaran model tidak dipercaya mentah-mentah.** Selalu divalidasi; yang bisa dihitung (kontras warna, jumlah slide) dihitung kode.
- **Data tidak dikarang.** Angka datang dari riset atau lampiran. Kalau tidak ada angka, tidak ada grafik.
- **Aksi berisiko minta konfirmasi.** Email tidak terkirim dan browser tidak membayar tanpa persetujuan pengguna.

## Penyimpanan

Semua data lokal ada di `.data/` (percakapan, project buatan pengguna, video, memori agen). Folder ini tidak ikut ke repo.

## Layanan terpisah

`jarvis-call/` adalah layanan Python untuk menerima telepon WhatsApp dan meneruskan perintah ke aplikasi ini. Petunjuknya ada di `jarvis-call/README.md`.
