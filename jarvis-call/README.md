# Jarvis WA Call

Telpon nomor bot di WhatsApp → Gemini Live yang ngangkat → kamu nyuruh pakai suara →
tim AI bikin website sungguhan (arsitek → developer → reviewer) di laptop → hasilnya dikabarin lewat suara (kalau masih nelpon)
dan selalu dikirim juga lewat chat WA (daftar file + ringkasan).

```
WA call ──webhook──▶ server.py (Python, Pipecat) ──▶ Gemini Live (suara ⇄ suara)
                         │  tool: kerjakan_tugas / cek_progress / tutup_telpon
                         ▼
                Next.js  /api/jarvis/tasks  ──▶ codeAgent.buildWebsite (website asli)
```

## Isi folder

| File | Fungsi |
|---|---|
| `server.py` | Webhook WA: verifikasi, cek tanda tangan, **tolak nomor selain owner**, terusin event chat ke bot Next.js |
| `bot.py` | Pipeline suara + system prompt bahasa Indonesia + 3 tool |
| `tasks.py` | Pantau tugas, kabarin hasil lewat suara / chat |
| `jarvis_api.py` | Client ke API Next.js + kirim chat WA. Ada **mode simulasi** (`JARVIS_MOCK=1`) |
| `start.sh` | Jalanin server + cloudflared sekaligus |

## 1. Setup Meta (sekali aja)

1. developers.facebook.com → **Create App** → tipe Business → tambah produk **WhatsApp**.
2. **WhatsApp → API Setup**: catat *Phone number ID*, bikin access token.
   Token sementara cuma 24 jam, jadi buat pemakaian terus bikin **System User token**
   (Business Settings → Users → System users) dengan izin `whatsapp_business_messaging`
   dan `whatsapp_business_management`.
3. Tambah nomor khusus bot (jangan nomor WA pribadi). Nomor test dari Meta juga bisa buat nyoba.
4. **Aktifin telpon**: WhatsApp Manager → Phone numbers → pilih nomor → tab **Calls** →
   nyalain *Allow voice calls*. Kalau opsinya gak ada atau gak bisa dinyalain, berarti
   Calling API belum tersedia buat nomor/negara itu (lihat bagian "Kalau Calling API belum bisa").
5. **App settings → Basic**: catat *App secret* buat `WHATSAPP_APP_SECRET`.
6. Webhook diisi setelah langkah 3 di bawah (butuh URL publik).

## 2. Jalanin service Python di laptop

```bash
cd jarvis-call
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # isi semua nilainya
```

Butuh Python 3.11+. Isi `OWNER_NUMBERS` pakai nomor WA kamu, format `62812...`.

Install cloudflared: `brew install cloudflared` (Mac), `winget install Cloudflare.cloudflared`
(Windows), atau lihat dokumentasi Cloudflare buat Linux.

```bash
./start.sh
```

Cari URL `https://xxxx.trycloudflare.com` di log. Di Windows jalanin dua terminal:
`python server.py` dan `cloudflared tunnel --url http://localhost:7860`.

> Quick tunnel ganti URL tiap restart, jadi webhook di Meta harus diupdate terus.
> Biar tetap, bikin *named tunnel* ke domain kamu (misal `jarvis.hadinata.dev`), lalu jalanin
> `CLOUDFLARE_TUNNEL_NAME=jarvis ./start.sh`.

## 3. Pasang webhook di Meta

WhatsApp → Configuration → Webhook:
- Callback URL: `https://<domain-tunnel>/whatsapp`
- Verify token: sama dengan `WHATSAPP_WEBHOOK_VERIFICATION_TOKEN`
- Subscribe field: **calls** (+ **messages** kalau bot chat kamu juga lewat app ini)

**Kalau bot chat WA kamu udah pakai webhook di app Meta yang sama:** satu app cuma bisa punya
satu callback URL. Arahin callback ke service Python ini, terus isi `FORWARD_WEBHOOK_URL` dengan
URL webhook chat Next.js kamu. Event selain telpon diterusin ke sana apa adanya, header
tanda tangannya ikut dikirim.

## 4. Tes dulu pakai mode simulasi

Pastiin `.env` berisi `JARVIS_MOCK=1`, terus telpon nomor bot dari WA kamu. Coba bilang:
*"bikinin landing page buat kedai kopi"*. Tugas simulasinya selesai dalam 30 detik.
Kalau masih nelpon, AI-nya bakal ngabarin. Kalau udah ditutup, kamu dapet chat ✅.

## 5. Sambungin ke Next.js (udah dipasang)

Route-nya udah ada di project `voice ai`:
- `src/lib/jarvisTasks.ts` — antrian tugas, manggil `buildWebsite` (website, edit) atau `runSkill` (dokumen)
- `src/app/api/jarvis/tasks/route.ts` — `POST` mulai tugas, `GET` daftar tugas
- `src/app/api/jarvis/tasks/[id]/route.ts` — status satu tugas
- `JARVIS_API_SECRET` udah ditambahin ke `.env.local` dan disamain dengan `jarvis-call/.env`

Langkahnya:
1. Jalanin Next.js di laptop (`npm run dev`). **Jangan di Vercel.**
2. Ganti `JARVIS_MOCK=0` di `jarvis-call/.env`, terus restart service Python.
3. Di telpon, sebut nama project kalau mau, misal "bikinin landing page di project toko online baju".
   Kalau gak disebut, hasilnya masuk ke `default-workspace`.
   ⚠️ Permintaan berbunyi "ubah/ganti/tambah" mengedit website yang sudah ada di project itu; permintaan baru menimpa `index.html` (versi sebelumnya tersimpan di `index.prev.html`).

Tes cepat API-nya:
```bash
S=$(grep JARVIS_API_SECRET .env.local | cut -d= -f2)
curl -X POST localhost:3000/api/jarvis/tasks -H "Authorization: Bearer $S" \
  -H "Content-Type: application/json" -d '{"instruction":"tes","projectId":"tes-telpon"}'
curl localhost:3000/api/jarvis/tasks/<id> -H "Authorization: Bearer $S"
```

## Keamanan

- Telpon dari nomor selain `OWNER_NUMBERS` langsung **ditolak**, jadi gak bakal sampai ke AI.
- Isi `WHATSAPP_APP_SECRET` supaya request palsu ke webhook ditolak (401).
- API Next.js cuma dipanggil dari localhost dan pakai `JARVIS_API_SECRET`. Jangan di-expose lewat tunnel.

## Catatan

- **Chat notifikasi** pakai pesan teks biasa. Meta cuma ngizinin itu dalam jendela 24 jam sejak
  kamu terakhir chat ke nomor bot. Kalau chat-nya gak masuk (cek log `Gagal kirim chat WA`),
  kirim chat apa aja ke bot sekali sehari, atau bikin message template.
- Data tugas disimpan di memori Next.js, plus log ke `.jarvis-tasks.json`. Kalau Next.js restart,
  tugas yang lagi jalan ikut berhenti.
- Laptop harus nyala dan online selama kamu mau bisa nelpon.
- Pakai earphone / hands-free kalau sambil nyetir.

## Kalau Calling API belum bisa

`bot.py` gak terikat ke WhatsApp. Pipecat juga punya transport Twilio (nomor telpon biasa),
jadi pipeline + tool yang sama bisa dipakai lagi. Tinggal ganti bagian transport-nya.
