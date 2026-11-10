import fs from "fs/promises";
import net from "net";
import path from "path";

/**
 * Pembuat proyek backend + frontend terpisah dari template yang kita tulis sendiri.
 * Model hanya menentukan stack dan nama resource; nama paket dan perintah dipatok di sini
 * (bukan dipilih model), sehingga tidak ada instal paket atau perintah sembarang.
 */

export type Frontend = "react" | "nextjs" | null;
export type Backend = "express" | "go" | null;

export interface StackConfig {
  frontend: Frontend;
  backend: Backend;
  resource: string; // slug, mis. "catatan"
  label: string; // mis. "Catatan"
  apiPort: number;
  webPort: number;
  createdAt: string;
}

export interface StackRequest {
  frontend: Frontend;
  backend: Backend;
  resource: string;
  label: string;
  install: boolean;
}

// ---------------------------------------------------------------- deteksi permintaan

const MAKE = /\b(buat(?:in|kan)?|bikin(?:in|kan)?|bangun|siapkan|siapin|generate|create|setup|scaffold|install|instal)\b/i;
const BACK_EXPRESS = /\b(express(?:[\s.]?js)?|node[\s.]?js\s+(?:api|backend)|backend\s+node)\b/i;
const BACK_GO = /\b(golang|go\s?lang|go\s+(?:api|backend)|backend\s+go|api\s+go)\b/i;
const BACK_GENERIC = /\b(backend|back\s?end|rest\s?api|api\s+server|server\s+api)\b/i;
const FRONT_NEXT = /\bnext[\s.]?js\b/i;
const FRONT_REACT = /\b(react(?:[\s.]?js)?|vite)\b/i;
const FULLSTACK = /\b(full\s?-?stack|fullstack|(?:backend|frontend)\s*(?:dan|\+|sama|&)\s*(?:frontend|backend)|front\s?end\s*(?:dan|\+)\s*back\s?end|terpisah|pisah)\b/i;
const INSTALL_NOW = /\b(install|instal|jalankan|jalanin|run|start|langsung|sekalian)\b/i;

export const SUPPORTED_STACK_RE = /\b(express(?:[\s.]?js)?|golang|go\s?lang|next[\s.]?js|react(?:[\s.]?js)?|vite|node[\s.]?js)\b/i;
export const UNSUPPORTED_STACK_RE = /\b(laravel|flutter|dart|php|django|flask|vue(?:[\s.]?js)?|angular|svelte|ruby|rails|spring|kotlin|swift)\b/i;

const RES_STOP = new Set(["website", "web", "backend", "frontend", "fullstack", "api", "server", "react", "express", "nextjs", "golang", "dengan", "pakai", "pake", "untuk", "yang", "baru", "aplikasi", "app", "proyek", "project", "sederhana", "simple", "node", "vite"]);

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
}

/** Pertanyaan ("gimana cara bikin … di express?") bukan perintah membuat proyek. */
const QUESTION = /\?\s*$|\b(gimana|bagaimana|cara(?:nya)?|kenapa|mengapa|apa\s+itu|contoh(?:nya)?|jelasin|jelaskan|beda(?:nya)?|error)\b/i;

export function detectStackRequest(msg: string): StackRequest | null {
  if (!MAKE.test(msg) || QUESTION.test(msg)) return null;
  const goBack = BACK_GO.test(msg);
  const expBack = BACK_EXPRESS.test(msg);
  const generic = BACK_GENERIC.test(msg) || FULLSTACK.test(msg);
  const next = FRONT_NEXT.test(msg);
  const react = FRONT_REACT.test(msg);

  let backend: Backend = goBack ? "go" : expBack ? "express" : generic ? "express" : null;
  const frontend: Frontend = next ? "nextjs" : react ? "react" : FULLSTACK.test(msg) ? "react" : null;
  if (!backend && !frontend) return null;
  // frontend tanpa backend: CRUD butuh API, jadi pasangkan Express
  if (frontend && !backend) backend = "express";
  // "bikin website ... pakai react" untuk halaman statis tetap boleh, tapi tanpa kata kunci stack kita tidak sampai sini

  const m = msg.match(/\b(?:untuk|aplikasi|app|manajemen|kelola|crud|daftar|tentang)\s+([a-zA-Z]{3,20})/i);
  let res = m ? slug(m[1]) : "";
  if (!res || RES_STOP.has(res)) res = "tugas";
  const label = res.charAt(0).toUpperCase() + res.slice(1);
  return { frontend, backend, resource: res, label, install: INSTALL_NOW.test(msg) };
}

// ---------------------------------------------------------------- port

export async function freePort(start: number, taken: number[] = []): Promise<number> {
  for (let p = start; p < start + 200; p++) {
    if (taken.includes(p)) continue;
    const ok = await new Promise<boolean>((resolve) => {
      const s = net.createServer();
      s.once("error", () => resolve(false));
      s.once("listening", () => s.close(() => resolve(true)));
      s.listen(p, "127.0.0.1");
    });
    if (ok) return p;
  }
  throw new Error("Tidak ada port kosong");
}

// ---------------------------------------------------------------- template

import { EXPRESS_FILES, EXPRESS_PACKAGE, nextFiles, reactFiles } from "./scaffoldTemplates";

const fill = (tpl: string, v: Record<string, string>) => Object.entries(v).reduce((s, [k, val]) => s.split(`__${k}__`).join(val), tpl);

const GO_MAIN = `package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

type Item struct {
	ID        string \`json:"id"\`
	Title     string \`json:"title"\`
	Done      bool   \`json:"done"\`
	CreatedAt string \`json:"createdAt"\`
}

var (
	mu   sync.Mutex
	file = "data.json"
)

func load() []Item {
	b, err := os.ReadFile(file)
	if err != nil {
		return []Item{}
	}
	var items []Item
	if json.Unmarshal(b, &items) != nil {
		return []Item{}
	}
	return items
}

func save(items []Item) {
	b, _ := json.MarshalIndent(items, "", "  ")
	tmp := file + ".tmp"
	if os.WriteFile(tmp, b, 0o644) == nil {
		_ = os.Rename(tmp, file) // atomik: file data tidak pernah setengah tertulis
	}
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// Hanya frontend sendiri yang boleh memanggil API dari browser (bukan "*").
var allowedOrigins = map[string]bool{
	"http://localhost:__WEB_PORT__": true,
	"http://127.0.0.1:__WEB_PORT__": true,
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		if o := r.Header.Get("Origin"); allowedOrigins[o] {
			h.Set("Access-Control-Allow-Origin", o)
			h.Set("Vary", "Origin")
			h.Set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
			h.Set("Access-Control-Allow-Headers", "Content-Type")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "__API_PORT__"
	}
	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]interface{}{"ok": true, "service": "__RES__-api"})
	})

	mux.HandleFunc("/api/__RES__", func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		switch r.Method {
		case http.MethodGet:
			writeJSON(w, 200, load())
		case http.MethodPost:
			var in struct {
				Title string \`json:"title"\`
			}
			r.Body = http.MaxBytesReader(w, r.Body, 50*1024)
			if json.NewDecoder(r.Body).Decode(&in) != nil || strings.TrimSpace(in.Title) == "" {
				writeJSON(w, 400, map[string]string{"error": "title wajib diisi"})
				return
			}
			t := strings.TrimSpace(in.Title)
			if len(t) > 200 {
				t = t[:200]
			}
			item := Item{ID: fmt.Sprintf("%x", time.Now().UnixNano()), Title: t, CreatedAt: time.Now().Format(time.RFC3339)}
			items := append([]Item{item}, load()...)
			save(items)
			writeJSON(w, 201, item)
		default:
			writeJSON(w, 405, map[string]string{"error": "method tidak didukung"})
		}
	})

	mux.HandleFunc("/api/__RES__/", func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimPrefix(r.URL.Path, "/api/__RES__/")
		mu.Lock()
		defer mu.Unlock()
		items := load()
		idx := -1
		for i, it := range items {
			if it.ID == id {
				idx = i
			}
		}
		if idx == -1 {
			writeJSON(w, 404, map[string]string{"error": "tidak ditemukan"})
			return
		}
		switch r.Method {
		case http.MethodPatch:
			var in struct {
				Done  *bool   \`json:"done"\`
				Title *string \`json:"title"\`
			}
			r.Body = http.MaxBytesReader(w, r.Body, 50*1024)
			_ = json.NewDecoder(r.Body).Decode(&in)
			if in.Done != nil {
				items[idx].Done = *in.Done
			}
			if in.Title != nil && strings.TrimSpace(*in.Title) != "" {
				t := strings.TrimSpace(*in.Title)
				if len(t) > 200 {
					t = t[:200]
				}
				items[idx].Title = t
			}
			save(items)
			writeJSON(w, 200, items[idx])
		case http.MethodDelete:
			items = append(items[:idx], items[idx+1:]...)
			save(items)
			writeJSON(w, 200, map[string]bool{"ok": true})
		default:
			writeJSON(w, 405, map[string]string{"error": "method tidak didukung"})
		}
	})

	addr := "127.0.0.1:" + port
	log.Println("API __RES__ siap di http://" + addr)
	log.Fatal(http.ListenAndServe(addr, cors(mux)))
}
`;

function files(cfg: StackConfig): Record<string, string> {
  const v = { RES: cfg.resource, LABEL: cfg.label, API_PORT: String(cfg.apiPort), WEB_PORT: String(cfg.webPort), STACKNAME: `${cfg.frontend === "nextjs" ? "Next.js" : "React"} + ${cfg.backend === "go" ? "Go" : "Express"}` };
  const out: Record<string, string> = {};

  if (cfg.backend === "express") {
    out["server/package.json"] = EXPRESS_PACKAGE(cfg.resource);
    for (const [rel, tpl] of Object.entries(EXPRESS_FILES)) out[fill(rel, v)] = fill(tpl, v);
  }
  if (cfg.backend === "go") {
    out["server/go.mod"] = "module api\n\ngo 1.21\n";
    out["server/main.go"] = fill(GO_MAIN, v);
  }

  if (cfg.frontend === "react") {
    out["web/package.json"] = JSON.stringify(
      {
        name: `${cfg.resource}-web`,
        private: true,
        version: "1.0.0",
        type: "module",
        scripts: { dev: `vite --port ${cfg.webPort} --host 127.0.0.1 --strictPort`, build: "vite build", preview: `vite preview --port ${cfg.webPort}` },
        dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" },
        devDependencies: { "@vitejs/plugin-react": "^4.4.0", vite: "^6.3.0" },
      },
      null,
      2
    );
    out["web/vite.config.js"] = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Header keamanan untuk server dev & preview
const headers = {
  "Content-Security-Policy": "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export default defineConfig({ plugins: [react()], server: { headers }, preview: { headers } });
`;
    out["web/index.html"] = fill('<!doctype html>\n<html lang="id">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>__LABEL__</title>\n    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 rx=%228%22 fill=%22%230f766e%22/%3E%3C/svg%3E" />\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n', v);
    out["web/src/main.jsx"] = 'import React from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App.jsx";\n\ncreateRoot(document.getElementById("root")).render(<App />);\n';
    for (const [rel, tpl] of Object.entries(reactFiles())) out[rel] = fill(tpl, v);
    out["web/.env"] = `VITE_API_URL=http://localhost:${cfg.apiPort}\n`;
  }
  if (cfg.frontend === "nextjs") {
    out["web/package.json"] = JSON.stringify(
      {
        name: `${cfg.resource}-web`,
        private: true,
        version: "1.0.0",
        scripts: { dev: `next dev -p ${cfg.webPort} -H 127.0.0.1`, build: "next build", start: `next start -p ${cfg.webPort} -H 127.0.0.1` },
        dependencies: { next: "16.4.5", react: "19.3.0", "react-dom": "19.3.0" },
      },
      null,
      2
    );
    out["web/next.config.mjs"] = `const headers = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

/** @type {import('next').NextConfig} */
export default {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers }];
  },
};
`;
    out["web/app/layout.jsx"] = fill('import "./globals.css";\n\nexport const metadata = { title: "__LABEL__" };\n\nexport default function RootLayout({ children }) {\n  return (\n    <html lang="id">\n      <body>{children}</body>\n    </html>\n  );\n}\n', v);
    for (const [rel, tpl] of Object.entries(nextFiles())) out[rel] = fill(tpl, v);
    out["web/.env.local"] = `NEXT_PUBLIC_API_URL=http://localhost:${cfg.apiPort}\n`;
  }

  const runLines = [
    cfg.backend === "go" ? "cd server && go run ." : "cd server && npm install && npm run dev",
    cfg.frontend ? "cd web && npm install && npm run dev" : "",
  ].filter(Boolean);
  out["README.md"] = `# ${cfg.label} (${v.STACKNAME})

Backend dan frontend terpisah, dibuat oleh VOX·AI Studio.

| Bagian | Folder | Alamat |
|---|---|---|
| API (${cfg.backend === "go" ? "Go" : "Express"}) | \`server/\` | http://127.0.0.1:${cfg.apiPort} |
${cfg.frontend ? `| Web (${cfg.frontend === "nextjs" ? "Next.js" : "React + Vite"}) | \`web/\` | http://127.0.0.1:${cfg.webPort} |\n` : ""}
## Menjalankan manual
\`\`\`
${runLines.join("\n")}
\`\`\`

Endpoint: \`GET/POST /api/${cfg.resource}\`, \`PATCH/DELETE /api/${cfg.resource}/:id\`, \`GET /health\`.
Data disimpan di \`server/data.json\`. Hanya mendengarkan di 127.0.0.1.
`;
  out["stack.json"] = JSON.stringify(cfg, null, 2);
  return out;
}

export async function scaffoldStack(projectDir: string, req: StackRequest): Promise<{ cfg: StackConfig; written: string[] }> {
  const apiPort = await freePort(4100);
  const webPort = await freePort(5200, [apiPort]);
  const cfg: StackConfig = { frontend: req.frontend, backend: req.backend, resource: req.resource, label: req.label, apiPort, webPort, createdAt: new Date().toISOString() };
  const all = files(cfg);
  const written: string[] = [];
  for (const [rel, content] of Object.entries(all)) {
    const abs = path.join(projectDir, rel);
    if (!abs.startsWith(projectDir + path.sep)) continue; // jaga-jaga path traversal
    await fs.mkdir(path.dirname(abs), { recursive: true });
    // Jangan pernah menimpa file milik user (mis. README.md project). Yang sudah ada dibiarkan.
    try {
      await fs.writeFile(abs, content, { encoding: "utf-8", flag: "wx" });
      written.push(rel);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
  }
  return { cfg, written };
}

export async function readStackConfig(projectDir: string): Promise<StackConfig | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(projectDir, "stack.json"), "utf-8")) as StackConfig;
  } catch {
    return null;
  }
}

export const stackName = (c: { frontend: Frontend; backend: Backend }) =>
  [c.backend ? (c.backend === "go" ? "API Go" : "API Express") : "", c.frontend ? (c.frontend === "nextjs" ? "web Next.js" : "web React + Vite") : ""].filter(Boolean).join(" + ");

/** Perkiraan unduhan paket untuk memberi tahu user sebelum install. */
export const installSize = (c: { frontend: Frontend; backend: Backend }) => (c.frontend === "nextjs" ? "±350–450 MB" : c.frontend === "react" ? "±80–120 MB" : c.backend === "express" ? "±5 MB" : "tanpa unduhan paket");
