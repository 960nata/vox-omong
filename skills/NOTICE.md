# Skill pihak ketiga

Skill di folder ini disalin apa adanya (teks SKILL.md + lisensi) dan dibaca oleh `src/lib/skillLoader.ts`
sebagai bagian prompt untuk model AI di VOX·AI Studio. Tidak ada kode dari skill ini yang dijalankan.

| Folder | Sumber | Commit | Lisensi |
|---|---|---|---|
| frontend-design | github.com/anthropics/skills | 2c5958e (2026-11-06) | Apache-2.0 (LICENSE.txt) |
| theme-factory | github.com/anthropics/skills | 2c5958e (2026-11-06) | Apache-2.0 (LICENSE.txt) |
| web-design-guidelines | github.com/vercel-labs/agent-skills + vercel-labs/web-interface-guidelines (guidelines.md) | 1a2c79d (2026-10-27) | MIT |
| react-best-practices | github.com/vercel-labs/agent-skills | 1a2c79d (2026-10-27) | MIT |
| grilling | github.com/mattpocock/skills (dipanggil oleh skill grill-me) | 4ae2317 (2026-10-31) | MIT (LICENSE) |
| frontend-ui-engineering | github.com/addyosmani/agent-skills | 301b02b (2026-11-01) | MIT (LICENSE) |
| agency-agents | github.com/msitarzewski/agency-agents | HEAD (2026-11) | MIT |
| oh-my-claude | github.com/Yeachan-Heo/oh-my-claudecode | HEAD (2026-11) | MIT |
| career-ops | github.com/santifer/career-ops | HEAD (2026-11) | MIT |
| founder-skills | github.com/ognjengt/founder-skills | HEAD (2026-11) | MIT |
| hyperframes | github.com/heygen-com/hyperframes | HEAD (2026-11) | Apache-2.0 |
| trading-skills | github.com/marian2js/trading-skills | HEAD (2026-11) | MIT |
| find-skills | github.com/javimosch/supercli | HEAD (2026-11) | MIT |
| graphify | github.com/Graphify-Labs/graphify | HEAD (2026-11) | MIT |
| youtube-agent | github.com/JimmySadek/video-fetcher-to-markdown | HEAD (2026-11) | MIT |
| omniroute | github.com/cheaper-inference/OmniRoute | HEAD (2026-11) | MIT |
| claude-mem | github.com/thedotmack/claude-mem | HEAD (2026-11) | MIT |
| claude-code-setup | github.com/anthropic-ai/claude-code | HEAD (2026-11) | MIT |
| task-observer | github.com/rebelytics/one-skill-to-rule-them-all | HEAD (2026-11) | MIT |
| instagram-agent | VOX Creative Media | In-house (2026-11) | MIT |
| academic-research | github.com/KalarisLabs/research-agent-skills | HEAD (2026-11) | MIT |

Juga dipakai (data, bukan skill): UI UX Pro Max di `src/lib/uiux/` (MIT).

## Agency Agents

`src/lib/agencyAgents.ts` berisi adaptasi lokal singkat dari profil pilihan
[`msitarzewski/agency-agents`](https://github.com/msitarzewski/agency-agents) (MIT).
Setiap profil menyimpan path sumbernya. Teks panduan ditulis ulang untuk kemampuan
tim VOX dan tersedia tanpa koneksi GitHub; file asli maupun skrip repo itu tidak dijalankan.

## Skill on-demand (tidak disalin)

98 repo skill komunitas terdaftar di `src/lib/skillCatalog.ts`. Isinya **tidak** disalin ke repo ini:
`src/lib/skillHub.ts` memilih sub-skill lewat `skills/hub-index.json` (daftar path SKILL.md tiap repo),
lalu mengambil satu file itu dari raw.githubusercontent.com saat dibutuhkan dan menyimpannya di
`.data/skill-cache/` (7 hari). Lisensi mengikuti masing-masing repo sumber; link sumber ikut di prompt.
