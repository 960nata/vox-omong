# Konek VOX ke langganan Claude & ChatGPT Plus (tanpa API key)

Pertanyaannya: "gimana caranya biar VOX bisa pakai akun Claude dan ChatGPT Plus gw?"
Jawabannya sama dengan cara OpenBot (docs/openbot-breakdown.md §D): **jalankan CLI resmi vendor
yang sudah login dengan akun langganan**, lalu baca keluarannya.

## Kenapa lewat CLI, bukan sesi web

| Cara | Status |
| --- | --- |
| CLI resmi vendor (`codex`, `claude`, `gemini`) login OAuth | **Dipakai VOX.** Vendor sendiri yang menyediakan dan mengizinkan jalur ini untuk langganan Plus/Pro/Max. |
| Mengambil cookie / token dari sesi web chatgpt.com atau claude.ai | **Tidak dipakai.** Melanggar ketentuan layanan, gampang kena blokir, dan kredensialnya jadi tanggung jawab VOX. |

Kredensial tetap milik CLI masing-masing. VOX cuma membaca **statusnya** (`~/.codex/auth.json` →
`auth_mode`, ada/tidak `tokens`), tidak pernah nilai tokennya, dan tidak pernah mengirimnya ke mana pun.

## Siapkan sekali

```bash
# ChatGPT Plus / Pro / Business
npm i -g @openai/codex
codex login                 # pilih "Sign in with ChatGPT"
codex login status          # -> Logged in using ChatGPT

# Claude Pro / Max
npm i -g @anthropic-ai/claude-code
claude login

# Google AI Pro (opsional)
npm i -g @google/gemini-cli
gemini                      # login di jalan pertama
```

Dari app desktop, menu tray **Status provider langganan…** membuka panel yang sama, dan tombol
login-nya membuka perintah di Terminal (perintahnya di-whitelist di `electron/main.cjs` — VOX tidak
pernah menjalankan perintah bebas dari halaman).

## Cek dari VOX

```bash
curl -s localhost:3000/api/providers -H "x-studio-pin: $STUDIO_PIN" | jq
```

```json
{
  "providers": [
    { "id": "codex", "label": "ChatGPT (Codex)", "bin": "/Users/…/bin/codex",
      "version": "codex-cli 0.164.0", "auth": "subscription",
      "detail": "Login pakai akun ChatGPT.", "nextStep": null }
  ],
  "ready": ["codex"]
}
```

`auth` bisa bernilai:

- `subscription` — siap dipakai, pakai kuota langganan
- `api-key` — login pakai kunci API (kena tagihan per token, bukan langganan)
- `unknown` — kredensial mungkin di Keychain; coba perintah login-nya
- `none` — belum login, atau CLI-nya belum terpasang

## Jalankan prompt

```bash
curl -s -X POST localhost:3000/api/providers \
  -H 'content-type: application/json' -H "x-studio-pin: $STUDIO_PIN" \
  --data '{"provider":"codex","prompt":"Ringkas README repo ini dalam 3 poin"}' | jq .result
```

Dari kode:

```ts
import { runProvider } from "@/lib/providers";

const out = await runProvider({ provider: "codex", prompt: "…" });
out.text;       // jawaban final
out.usage;      // token input/cached/output
out.sessionId;  // id thread CLI, buat lanjut percakapan
```

Di workflow, pakai step `cli-agent`:

```json
{ "id": "riset", "kind": "cli-agent", "title": "Riset pakai ChatGPT",
  "input": { "provider": "codex", "prompt": "Riset tren {{trigger.topik}}" } }
```

## Pengamanan

- **Prompt lewat stdin, bukan argumen** — isi prompt tidak muncul di `ps` atau history shell.
- **Tanpa shell** (`spawn` tanpa `shell: true`) — isi prompt tidak mungkin jadi perintah.
- **Baca-saja secara default.** Tanpa `write: true`, codex jalan `-s read-only` dan Claude
  `--permission-mode plan`: agent boleh membaca dan menyusun rencana, tidak boleh mengubah berkas.
- Route `/api/providers` dijaga sesi studio, sama seperti `/api/chat`.

## Tes

```bash
npx vitest run tests/providers.test.ts          # parser & argumen (tidak memanggil CLI)
VOX_LIVE=1 npx vitest run tests/providersLive.test.ts   # benar-benar memanggil langganan
```

Tes live dilewati kecuali `VOX_LIVE=1`, karena ia memakai kuota langganan sungguhan.
