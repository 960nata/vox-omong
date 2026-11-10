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

Juga dipakai (data, bukan skill): UI UX Pro Max di `src/lib/uiux/` (MIT).

## Skill on-demand (tidak disalin)

98 repo skill komunitas terdaftar di `src/lib/skillCatalog.ts`. Isinya **tidak** disalin ke repo ini:
`src/lib/skillHub.ts` memilih sub-skill lewat `skills/hub-index.json` (daftar path SKILL.md tiap repo),
lalu mengambil satu file itu dari raw.githubusercontent.com saat dibutuhkan dan menyimpannya di
`.data/skill-cache/` (7 hari). Lisensi mengikuti masing-masing repo sumber; link sumber ikut di prompt.
