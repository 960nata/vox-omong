# Bedah OpenBot 0.78.0 → Mesin VOX·AI Studio

Sumber: `OpenBot-0.78.0-arm64.dmg` (Electron, `app.openbot.desktop`, repo `nightly-labs/openbot`,
lisensi **PolyForm-Noncommercial-1.0.0**).

> **Catatan lisensi:** PolyForm Noncommercial melarang pemakaian komersial dan kode di `app.asar`
> sudah ter-minify/bundled. Jadi di proyek ini **tidak ada satu baris kode OpenBot yang dicopy**.
> Yang diadopsi adalah *arsitektur & konsep fitur* (hasil bedah di bawah), diimplementasi ulang
> dari nol di `src/lib/engine/` dengan gaya & tipe proyek sendiri.

---

## 1. Anatomi aplikasi

| Bagian | Isi |
| --- | --- |
| `Contents/Resources/app.asar` | 155 MB, Electron: `out/main` (20 MB bundle), `out/preload`, `out/renderer` (Solid.js) |
| `app.asar.unpacked/out/main` | `agent-database-host.js`, `voice-speech-host.js`, `voice-transcription-host.js` → host proses terpisah |
| `Resources/cli/openbot-cli.mjs` | CLI otomasi: `list`, `run`, `status`, `agent set-account/set-model/new-chat` |
| `Resources/agent-runtime/cpu-limit.cjs` | pembatas CPU untuk proses agent |
| `Resources/cua-driver/darwin/arm64/cua-driver` | driver *computer use* (kontrol layar/mouse native) |
| `Resources/agent-import/{grok-bot,hermes-agent}/SKILL.md` | skill migrasi agent dari produk lain → `.zip` manifest |
| `Resources/icons/logo-colors/*` | 10 varian warna ikon aplikasi (branding per-user) |

**Stack:** Solid.js 2 + Tailwind 4 + Vite 8, Effect 4 untuk efek/konkurensi, `@anthropic-ai/claude-agent-sdk`,
`@agentclientprotocol/sdk` (ACP), `@modelcontextprotocol/{sdk,client}`, `quickjs-emscripten` (sandbox JS),
`koffi` (FFI native), `rrweb` (rekam sesi browser), `protobufjs` + `ws` (sinkronisasi server), `jose` (JWT),
`@1password/sdk` (vault), `electron-updater`, `pino`, `hono`/`express` (server lokal), `mermaid`+`katex` (render).

**Modul renderer yang kelihatan dari nama chunk** — peta fitur UI-nya:
`WorkflowsCanvas`, `MarketplaceModal`, `ServerLibrary`, `VaultPanel`, `CrmScreen`, `BrowserFullView`,
`BrowserDock`/`BrowserLiveView`/`BrowserProxies`, `OpenBotDynamicIsland`, `RemoteDesktopWorkspace`,
`AgentUsagePanel`, `ProviderModelPicker`/`ProviderAccountList`, `UiBlockPrompt`, `GlobalSearch`,
`ThreadTabGhost`, `ComputerUseSetup`, `AgentTemplateInstall`, `SkillPreview`, `FirstRunFlow`.

---

## 2. Inventaris fitur (62 rilis, 0.34.0 → 0.78.0 — 289 item "added")

### A. Workflow engine (nilai tertinggi)
- Canvas node-based; workflow buka di **tab**.
- Step mengembalikan **typed answer**; referensi antar-step dengan `{{nama}}`, autocomplete lewat `{{`.
- **Run from this step** — step sebelumnya pakai jawaban lama, tidak dijalankan ulang.
- **Pause**, **export/import** workflow ke file (pindah komputer/server).
- Snapshot *settings + inputs* per hasil step → "Use these settings" (reproducible run).
- **Group node** (⌘G) + collapse jadi satu kartu.
- **Batch** sampai 4 hasil paralel untuk step image/video.
- **Trigger**: Schedule, GitHub, Discord, Telegram, Slack — trigger ikut menyuplai field.
- Output **Notification** & step **tunggu approval** → kirim notifikasi HP.

### B. Routines / scheduler
- Canvas routine: next runs, past runs, hasil.
- Cron + **sekali jalan pada tanggal/jam tertentu**; timezone per server.
- **Missed-run policy**: skip jadwal yang terlewat saat app tutup, atau jalankan sekali saat app dibuka.
- Stop run (status `Cancelled`); routine tidak lagi mati sendiri saat run tanpa hasil.
- Kirim tiap jawaban ke tujuan Slack/Discord/Telegram.
- Rantai agent: jawaban agent A jadi input agent B.
- "Keep this computer awake" biar routine tepat waktu.

### C. Threads & tugas paralel
- Agent memecah kerja tak-berkaitan jadi **task paralel**, hasil digabung di chat utama.
- Tiap task punya conversation, progress, stop, result sendiri; "Earlier tasks".
- **Tasks at once** per agent (batas konkurensi).
- Tab **Threads** di side panel + badge jumlah thread yang menunggu.
- **Side question** — tanya di luar chat, jawaban masuk side panel, tidak mengotori konteks.
- Pesan yang dikirim saat agent kerja langsung masuk ke turn yang sedang jalan.

### D. Model & provider
- **Backup models**: kena rate-limit → lempar ke model lain, manual order atau otomatis.
- Multi-akun per provider (sampai 20), pilih akun per agent; `Usage` menampilkan limit tiap akun.
- Auto-update CLI provider tiap jam, tunggu agent idle.
- **Auto-compaction**: chat idle ≥200K token dikompaksi sebelum prompt cache 1 jam kedaluwarsa.
- Watchdog turn: 15 menit tanpa output (60 menit kalau tool jalan) → turn ditutup, antrean lanjut.
- Agent menyelesaikan request tanpa "continue" (maksimal 3 lanjutan otomatis).

### E. Memory & skill
- Memory per agent; pilih mana yang **selalu** di prompt, sisanya **dicari** saat perlu.
- Skill berbasis `SKILL.md`; baca SKILL.md skill di server lain.
- Import/export agent sebagai `.zip` dengan manifest `openbot-import.json`
  (instructions, avatar, skills, routines, memories, group chat) + aturan sanitasi rahasia.

### F. Interaksi & suara
- **UI block interaktif**: button, reply chip, list pilihan, form pendek — bisa di-skip.
- Dictation (Whisper large-v3 turbo lokal, ElevenLabs Scribe v2, Underdog Bark 3.0), bahasa dikunci, 10 menit.
- **Push to talk** (tahan tombol/keyboard), interupsi saat agent bicara.
- Read-aloud balasan (10 voice), per-pesan maupun otomatis; suara di channel.
- Dynamic Island macOS + agent dock: balas/approve/stop tanpa buka window.

### G. Browser & computer use
- Browser agent dengan tab; **take over** tab lalu "I'm done"; tab idle berhenti pakai CPU setelah 2 menit.
- Sesi browser terpisah per agent; sign-in di komputer sendiri untuk browser server; proxy per profil.
- **Screen capture**: display/window/area, dengan approval (atau Turbo auto-approve).
- Remote desktop workspace.

### H. Kolaborasi & integrasi
- Channel multi-agent (ada lead agent), notifikasi mute per agent.
- Server (hosted/self-hosted/Docker), member + **role**, transfer ownership, transfer isi server.
- Marketplace: Apps + MCP server custom; MCP server bisa ditambah **oleh agent** dengan approval.
- Connector: GitHub, Slack, Discord, Telegram, 1Password (Vault), Vercel, Stripe (CRM), Cobrain.
- Mobile Connect (link permanen, bisa dicabut), notifikasi iPhone.
- **Local scripts** → folder `automation/{url,token}` + CLI untuk kontrol dari shell.

### I. Lain-lain
- CRM eksperimental (leads/customers/payments, import Stripe, perubahan via approval).
- Library dengan folder/Favorites/Recent/Undo, agent bisa merapikan folder.
- Global search, filter sidebar, keyboard shortcut editable, i18n 15 bahasa.
- Appearance: backdrop video/animasi, interface size, matikan blur & animasi untuk device lemah.
- Billing: lisensi, kredit, invite/referral.

---

## 3. Yang dipakai jadi mesin VOX (dan kenapa)

Proyek ini **sudah punya**: agent/teams (`agentTeams.ts`, `teamFlow*.ts`), skill engine
(`skillEngine/Hub/Installer`), browser agent, terminal runtime, MCP (`mcpConnections.ts`),
token tracking, TTS/voice, video & deck. Jadi yang diambil adalah **lapisan orkestrasi yang belum ada**:

| # | Dari OpenBot | Modul baru | Alasan |
| --- | --- | --- | --- |
| 1 | Workflow engine (§A) | `engine/workflow.ts` + `engine/template.ts` | belum ada runner multi-step yang bisa pause / run-from-step / export |
| 2 | Routines (§B) | `engine/routines.ts` | belum ada scheduler + missed-run policy |
| 3 | Threads paralel (§C) | `engine/threads.ts` | `jarvisTasks.ts` sekuensial & tanpa batas konkurensi per agent |
| 4 | Backup model + akun (§D) | `engine/failover.ts` | `routerModels.ts` belum punya failover saat rate-limit |
| 5 | Memory selalu/dicari (§E) | `engine/memory.ts` | belum ada memory per agent |
| 6 | UI block interaktif (§F) | `engine/uiBlocks.ts` | approval/form terstruktur, bukan tebak teks |
| 7 | Local scripts + CLI (§H) | `engine/automation.ts` + `scripts/vox-cli.mjs` | kontrol dari shell/cron luar |

**Tidak diambil** (sengaja): server multi-tenant & billing/kredit, CRM, i18n 15 bahasa, Electron/Dynamic
Island, computer-use driver native, remote desktop, marketplace berbayar — semuanya di luar bentuk
VOX sebagai web app Next.js, atau butuh infra yang belum ada.
