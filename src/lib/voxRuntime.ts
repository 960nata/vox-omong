/**
 * Runtime kecil yang disuntikkan ke setiap website hasil AI (saat disajikan, bukan disimpan di file):
 *   await VOX.save("pesan", { nama, email })   → simpan ke server (fallback localStorage)
 *   await VOX.list("pesan")                    → baca data tersimpan
 *   await VOX.remove("pesan", id)              → hapus satu data
 * Modul ini murni (tanpa API Node) supaya bisa dipakai di server dan browser.
 */

export const VOX_ORIGIN_PLACEHOLDER = "%%VOX_ORIGIN%%";
export const VOX_PROJECT_PLACEHOLDER = "%%VOX_PROJECT%%";

const RUNTIME_SOURCE = `
(function () {
  // Halaman disajikan dalam sandbox (origin buram) → localStorage/sessionStorage melempar error.
  // Ganti dengan penyimpanan di memori supaya skrip halaman tidak rusak.
  function mem() {
    var d = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
      setItem: function (k, v) { d[k] = String(v); },
      removeItem: function (k) { delete d[k]; },
      clear: function () { d = {}; },
      key: function (i) { return Object.keys(d)[i] || null; },
      get length() { return Object.keys(d).length; }
    };
  }
  ["localStorage", "sessionStorage"].forEach(function (n) {
    try { window[n].getItem("__vox"); }
    catch (e) { try { Object.defineProperty(window, n, { value: mem(), configurable: true }); } catch (_) {} }
  });
})();
(function () {
  var ORIGIN = ${JSON.stringify(VOX_ORIGIN_PLACEHOLDER)};
  var PROJECT = ${JSON.stringify(VOX_PROJECT_PLACEHOLDER)};
  var remote = ORIGIN.indexOf("%%") !== 0 && PROJECT.indexOf("%%") !== 0;
  var base = remote ? ORIGIN + "/api/data/" + encodeURIComponent(PROJECT) + "/" : null;
  function key(c) { return "vox:" + PROJECT + ":" + c; }
  function readLocal(c) { try { return JSON.parse(localStorage.getItem(key(c)) || "[]"); } catch (e) { return []; } }
  function writeLocal(c, rows) { try { localStorage.setItem(key(c), JSON.stringify(rows.slice(-200))); } catch (e) {} }
  function rid() { return Math.random().toString(36).slice(2, 10); }
  function req(url, opt) {
    return fetch(url, opt).then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); });
  }
  window.VOX = {
    project: PROJECT,
    remote: remote,
    save: function (c, data) {
      var body = JSON.stringify(data || {});
      if (!remote) return Promise.resolve(saveLocal());
      return req(base + encodeURIComponent(c), { method: "POST", headers: { "Content-Type": "application/json" }, body: body })
        .catch(function () { return saveLocal(); });
      function saveLocal() {
        var rec = Object.assign({ id: rid(), createdAt: new Date().toISOString() }, data || {});
        var rows = readLocal(c); rows.push(rec); writeLocal(c, rows);
        return { ok: true, local: true, record: rec };
      }
    },
    list: function (c) {
      if (!remote) return Promise.resolve({ ok: true, local: true, records: readLocal(c).slice().reverse() });
      return req(base + encodeURIComponent(c))
        .catch(function () { return { ok: true, local: true, records: readLocal(c).slice().reverse() }; });
    },
    remove: function (c, id) {
      writeLocal(c, readLocal(c).filter(function (r) { return r.id !== id; }));
      if (!remote) return Promise.resolve({ ok: true, local: true });
      return req(base + encodeURIComponent(c) + "?id=" + encodeURIComponent(id), { method: "DELETE" })
        .catch(function () { return { ok: true, local: true }; });
    }
  };
})();
`;

/** Sisipkan runtime sebelum </body>. Idempotent. `origin` kosong → hanya localStorage (mis. file yang diunduh). */
export function injectVoxRuntime(html: string, projectId: string, origin?: string): string {
  if (html.includes('id="vox-runtime"')) return html;
  const src = RUNTIME_SOURCE.replace(VOX_PROJECT_PLACEHOLDER, projectId.replace(/[^a-z0-9_-]/gi, "")).replace(
    VOX_ORIGIN_PLACEHOLDER,
    origin ? origin.replace(/[^a-zA-Z0-9:/._-]/g, "") : VOX_ORIGIN_PLACEHOLDER
  );
  const tag = `<script id="vox-runtime">${src}</script>`;
  // Taruh di <head> agar tersedia sebelum script halaman berjalan
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>\n${tag}`);
  return tag + html;
}

/** Deskripsi untuk prompt model. */
export const VOX_PROMPT = `BACKEND MINI (sudah tersedia otomatis, JANGAN didefinisikan ulang): objek global window.VOX.
- await VOX.save("nama-koleksi", { ...data })  → menyimpan data (server, fallback localStorage). Balikannya { ok, record }.
- await VOX.list("nama-koleksi")               → { records: [...] } terbaru dulu.
- await VOX.remove("nama-koleksi", id)
Pakai untuk form kontak/reservasi/RSVP/pendaftaran/pesanan/ulasan/komentar. Setelah submit tampilkan keadaan sukses yang jelas, kosongkan form, dan boleh menampilkan data yang tersimpan (mis. daftar ulasan, jumlah pendaftar). Validasi input di sisi klien dan tangani error.`;
