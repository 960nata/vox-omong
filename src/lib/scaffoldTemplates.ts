/**
 * Template proyek backend + frontend yang rapi (dipakai scaffold.ts).
 * Backend Express berlapis: config → middleware (keamanan, CORS terbatas, error) → validasi → store → routes.
 * Frontend React/Next: api client → hook data → komponen kecil. Semua teks antarmuka berbahasa Indonesia.
 * Placeholder: __RES__, __LABEL__, __API_PORT__, __WEB_PORT__, __STACKNAME__.
 */

// ---------------------------------------------------------------- Express

export const EXPRESS_FILES: Record<string, string> = {
  "server/index.js": `const { createApp } = require("./src/app");

const PORT = Number(process.env.PORT) || __API_PORT__;
const HOST = "127.0.0.1"; // hanya bisa diakses dari laptop ini

createApp().listen(PORT, HOST, function () {
  console.log("API __RES__ siap di http://" + HOST + ":" + PORT);
});
`,
  "server/src/config.js": `const path = require("path");

const WEB_PORT = Number(process.env.WEB_PORT) || __WEB_PORT__;

module.exports = {
  // Hanya frontend sendiri yang boleh memanggil API dari browser
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "http://localhost:" + WEB_PORT + ",http://127.0.0.1:" + WEB_PORT)
    .split(",")
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean),
  dataFile: process.env.DATA_FILE || path.join(__dirname, "..", "data.json"),
  bodyLimit: "50kb",
};
`,
  "server/src/app.js": `const express = require("express");
const config = require("./config");
const { securityHeaders, cors } = require("./middleware/security");
const { notFound, errorHandler } = require("./middleware/errors");
const itemsRouter = require("./routes/__RES__");

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(cors(config.allowedOrigins));
  app.use(express.json({ limit: config.bodyLimit }));

  app.get("/health", function (req, res) {
    res.json({ ok: true, service: "__RES__-api" });
  });
  app.use("/api/__RES__", itemsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
`,
  "server/src/middleware/security.js": `function securityHeaders(req, res, next) {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    // API hanya mengembalikan JSON: tidak boleh memuat apa pun atau dibingkai
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  });
  next();
}

/** CORS dengan daftar origin yang diizinkan (bukan "*"). */
function cors(allowed) {
  return function (req, res, next) {
    const origin = req.headers.origin;
    if (origin && allowed.indexOf(origin) !== -1) {
      res.set({
        "Access-Control-Allow-Origin": origin,
        Vary: "Origin",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  };
}

module.exports = { securityHeaders, cors };
`,
  "server/src/middleware/errors.js": `class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function notFound(req, res) {
  res.status(404).json({ error: "Endpoint tidak ditemukan" });
}

// Express mengenali error handler dari 4 argumennya
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "JSON tidak valid" });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Data terlalu besar" });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? "Terjadi kesalahan di server" : err.message });
}

module.exports = { HttpError, notFound, errorHandler };
`,
  "server/src/lib/validate.js": `const { HttpError } = require("../middleware/errors");

function cleanTitle(value, required) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string") throw new HttpError(400, "title harus berupa teks");
  const t = value.trim();
  if (!t) throw new HttpError(400, "title wajib diisi");
  if (t.length > 200) throw new HttpError(400, "title maksimal 200 karakter");
  return t;
}

function cleanDone(value) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new HttpError(400, "done harus true atau false");
  return value;
}

module.exports = { cleanTitle, cleanDone };
`,
  "server/src/lib/store.js": `const fs = require("fs/promises");
const crypto = require("crypto");
const config = require("../config");

let queue = Promise.resolve();

async function readAll() {
  try {
    const rows = JSON.parse(await fs.readFile(config.dataFile, "utf8"));
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

async function writeAll(rows) {
  // tulis ke file sementara lalu rename: file data tidak pernah setengah tertulis
  const tmp = config.dataFile + "." + process.pid + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(rows, null, 2));
  await fs.rename(tmp, config.dataFile);
}

/** Semua perubahan diantrekan supaya dua request bersamaan tidak saling menimpa. */
function mutate(fn) {
  const run = queue.then(async function () {
    const rows = await readAll();
    const out = await fn(rows);
    await writeAll(rows);
    return out;
  });
  queue = run.catch(function () {});
  return run;
}

function newId() {
  return crypto.randomUUID();
}

module.exports = { readAll, mutate, newId };
`,
  "server/src/routes/__RES__.js": `const express = require("express");
const store = require("../lib/store");
const { cleanTitle, cleanDone } = require("../lib/validate");
const { HttpError } = require("../middleware/errors");

const router = express.Router();
const wrap = function (fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
const body = function (req) {
  return req.body && typeof req.body === "object" ? req.body : {};
};

router.get(
  "/",
  wrap(async function (req, res) {
    res.json(await store.readAll());
  })
);

router.post(
  "/",
  wrap(async function (req, res) {
    const title = cleanTitle(body(req).title, true);
    const row = await store.mutate(function (rows) {
      const r = { id: store.newId(), title: title, done: false, createdAt: new Date().toISOString() };
      rows.unshift(r);
      return r;
    });
    res.status(201).json(row);
  })
);

router.patch(
  "/:id",
  wrap(async function (req, res) {
    const title = cleanTitle(body(req).title, false);
    const done = cleanDone(body(req).done);
    if (title === undefined && done === undefined) throw new HttpError(400, "Tidak ada yang diubah");
    const row = await store.mutate(function (rows) {
      const r = rows.find(function (x) {
        return x.id === req.params.id;
      });
      if (!r) throw new HttpError(404, "Data tidak ditemukan");
      if (title !== undefined) r.title = title;
      if (done !== undefined) r.done = done;
      r.updatedAt = new Date().toISOString();
      return r;
    });
    res.json(row);
  })
);

router.delete(
  "/:id",
  wrap(async function (req, res) {
    await store.mutate(function (rows) {
      const i = rows.findIndex(function (x) {
        return x.id === req.params.id;
      });
      if (i === -1) throw new HttpError(404, "Data tidak ditemukan");
      rows.splice(i, 1);
    });
    res.status(204).end();
  })
);

module.exports = router;
`,
  "server/.env.example": "PORT=__API_PORT__\nWEB_PORT=__WEB_PORT__\n# ALLOWED_ORIGINS=http://localhost:__WEB_PORT__\n",
  "server/.gitignore": "node_modules\ndata.json\n*.tmp\n.env\n",
};

export const EXPRESS_PACKAGE = (res: string) =>
  JSON.stringify(
    {
      name: `${res}-api`,
      private: true,
      version: "1.0.0",
      main: "index.js",
      engines: { node: ">=18" },
      scripts: { start: "node index.js", dev: "node --watch index.js" },
      dependencies: { express: "^4.21.2" },
    },
    null,
    2
  );

// ---------------------------------------------------------------- Frontend (React + Vite / Next.js)

const API_JS = (envExpr: string) => `const BASE = (${envExpr} || "http://localhost:__API_PORT__") + "/api/__RES__";

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(BASE + path, { headers: { "Content-Type": "application/json" }, ...options });
  } catch {
    throw new Error("Backend belum bisa dihubungi. Pastikan server jalan.");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Permintaan gagal (" + res.status + ")");
  return data;
}

export const api = {
  list: () => request(""),
  create: (title) => request("", { method: "POST", body: JSON.stringify({ title }) }),
  update: (id, patch) => request("/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(patch) }),
  remove: (id) => request("/" + encodeURIComponent(id), { method: "DELETE" }),
};
`;

const USE_ITEMS = (apiImport: string) => `import { useCallback, useEffect, useState } from "react";
import { api } from "${apiImport}";

/** Data + aksi untuk daftar. Setiap aksi mengembalikan true bila berhasil. */
export function useItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const run = useCallback(async (fn) => {
    try {
      setError("");
      await fn();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }, []);

  useEffect(() => {
    run(async () => setItems(await api.list())).finally(() => setLoading(false));
  }, [run]);

  return {
    items,
    loading,
    error,
    add: (title) =>
      run(async () => {
        const row = await api.create(title);
        setItems((xs) => [row, ...xs]);
      }),
    toggle: (it) =>
      run(async () => {
        const row = await api.update(it.id, { done: !it.done });
        setItems((xs) => xs.map((x) => (x.id === row.id ? row : x)));
      }),
    remove: (it) =>
      run(async () => {
        await api.remove(it.id);
        setItems((xs) => xs.filter((x) => x.id !== it.id));
      }),
  };
}
`;

const ADD_FORM = `import { useState } from "react";

export default function AddForm({ onAdd, label }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    const ok = await onAdd(t);
    setBusy(false);
    if (ok) setTitle(""); // kalau gagal, isian tidak hilang
  }

  return (
    <form onSubmit={submit} className="add">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={"Tambah " + label + " baru…"}
        aria-label={"Judul " + label + " baru"}
        maxLength={200}
      />
      <button type="submit" disabled={busy || !title.trim()}>
        {busy ? "Menyimpan…" : "Tambah"}
      </button>
    </form>
  );
}
`;

const ITEM_LIST = `export default function ItemList({ items, loading, onToggle, onRemove }) {
  if (loading) return <p className="sub">Memuat…</p>;
  if (!items.length) return <p className="empty">Belum ada data. Tambahkan yang pertama di atas.</p>;
  return (
    <ul className="list">
      {items.map((it) => (
        <li key={it.id} className={it.done ? "done" : ""}>
          <label>
            <input type="checkbox" checked={it.done} onChange={() => onToggle(it)} />
            <span>{it.title}</span>
          </label>
          <button className="del" onClick={() => onRemove(it)} aria-label={"Hapus " + it.title}>
            Hapus
          </button>
        </li>
      ))}
    </ul>
  );
}
`;

const PAGE = (client: boolean, imp: { css: string; form: string; list: string; hook: string }) => `${client ? '"use client";\n\n' : ""}${imp.css ? `import "${imp.css}";\n` : ""}import AddForm from "${imp.form}";
import ItemList from "${imp.list}";
import { useItems } from "${imp.hook}";

export default function ${client ? "Page" : "App"}() {
  const { items, loading, error, add, toggle, remove } = useItems();
  const done = items.filter((i) => i.done).length;

  return (
    <main className="wrap">
      <header>
        <h1>__LABEL__</h1>
        <p className="sub">{loading ? "Memuat…" : items.length + " item, " + done + " selesai"}</p>
      </header>

      <AddForm onAdd={add} label="__LABEL__" />

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <ItemList items={items} loading={loading} onToggle={toggle} onRemove={remove} />
    </main>
  );
}
`;

export const CSS = `:root{--bg:#eef3f2;--ink:#102a27;--muted:#4f6662;--line:#d3dfdc;--card:#ffffff;--accent:#0f766e;--danger:#b3261e}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:16px;line-height:1.55}
.wrap{max-width:640px;margin:0 auto;padding:clamp(28px,6vw,72px) 20px}
h1{font-size:clamp(34px,6vw,52px);margin:8px 0 4px;letter-spacing:-.02em;line-height:1.05;text-wrap:balance}
.sub{color:var(--muted);margin:0 0 28px}
.add{display:flex;gap:10px;margin-bottom:18px}
.add input{flex:1;min-width:0}
input{font:inherit;padding:13px 15px;border:1.5px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);min-height:44px}
input:focus-visible{outline:0;border-color:var(--accent);box-shadow:0 0 0 4px #0f766e26}
button{font:inherit;font-weight:600;cursor:pointer;border:0;border-radius:12px;padding:13px 20px;min-height:44px;background:var(--accent);color:#fff;transition:transform .15s,opacity .15s}
button:hover:not(:disabled){transform:translateY(-1px)}
button:disabled{opacity:.5;cursor:not-allowed}
button:focus-visible{outline:3px solid var(--ink);outline-offset:2px}
.list{list-style:none;padding:0;margin:0;display:grid;gap:10px}
.list li{display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.list label{display:flex;align-items:center;gap:12px;cursor:pointer;flex:1;min-width:0}
.list label span{overflow-wrap:anywhere}
.list input[type=checkbox]{width:20px;height:20px;min-height:0;accent-color:var(--accent);padding:0}
.done span{text-decoration:line-through;color:var(--muted)}
.del{background:transparent;color:var(--muted);border:1px solid var(--line);padding:8px 14px;font-size:14px}
.del:hover{color:var(--danger);border-color:var(--danger)}
.empty{text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:14px;padding:18px}
.error{background:#fdecea;color:#8a1c14;padding:12px 16px;border-radius:12px}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
`;

const WEB_GITIGNORE = "node_modules\ndist\n.next\n.env*\n!.env.example\n";

export function reactFiles(): Record<string, string> {
  return {
    "web/src/api.js": API_JS("import.meta.env.VITE_API_URL"),
    "web/src/hooks/useItems.js": USE_ITEMS("../api.js"),
    "web/src/components/AddForm.jsx": ADD_FORM,
    "web/src/components/ItemList.jsx": ITEM_LIST,
    "web/src/App.jsx": PAGE(false, { css: "./styles.css", form: "./components/AddForm.jsx", list: "./components/ItemList.jsx", hook: "./hooks/useItems.js" }),
    "web/src/styles.css": CSS,
    "web/.gitignore": WEB_GITIGNORE,
  };
}

export function nextFiles(): Record<string, string> {
  return {
    "web/lib/api.js": API_JS("process.env.NEXT_PUBLIC_API_URL"),
    "web/hooks/useItems.js": USE_ITEMS("../lib/api"),
    "web/components/AddForm.jsx": ADD_FORM,
    "web/components/ItemList.jsx": ITEM_LIST,
    "web/app/page.jsx": PAGE(true, { css: "", form: "../components/AddForm", list: "../components/ItemList", hook: "../hooks/useItems" }),
    "web/app/globals.css": CSS,
    "web/.gitignore": WEB_GITIGNORE,
  };
}
