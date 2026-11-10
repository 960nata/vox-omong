import type { InvoiceData, LetterData } from "../types";
import { getTheme } from "./themes";
import { ensureContrast } from "./colorUtils";

export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(s: string) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/** Hanya foto Unsplash yang dirender; URL lain dibuang supaya isi dokumen tidak bisa menyisipkan gambar sembarangan. */
export const PHOTO_LINE = /^\s*!\[([^\]]*)\]\((https:\/\/images\.unsplash\.com\/[^\s)]+)\)\s*$/;
const CAPTION_LINE = /^\s*\*(Foto: [^*]{1,120})\*\s*$/;

/** Markdown sederhana → HTML (heading, list, tabel, kutipan, paragraf). Input di-escape. */
export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const img = line.match(PHOTO_LINE);
    if (img) {
      const cap = i + 1 < lines.length ? lines[i + 1].match(CAPTION_LINE) : null;
      out.push(`<figure><img src="${escapeHtml(img[2])}" alt="${escapeHtml(img[1])}" loading="lazy">${cap ? `<figcaption>${escapeHtml(cap[1])}</figcaption>` : ""}</figure>`);
      i += cap ? 2 : 1;
      continue;
    }
    if (/^\s*!\[/.test(line)) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = Math.min(4, h[1].length + 1); // # → h2 (h1 = judul dokumen)
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`
      );
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ""))}</li>`);
        i++;
      }
      out.push(ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${inline(q.join(" "))}</blockquote>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*([-*•]|\d+[.)])\s|>|\s*\|)/.test(lines[i])) para.push(lines[i++]);
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    else i++;
  }
  return out.join("\n");
}

const FONT_LINK =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">';

function page(title: string, css: string, body: string, autoPrint: boolean) {
  return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(
    title
  )}</title>${FONT_LINK}<style>*{box-sizing:border-box}html,body{margin:0}@page{size:A4;margin:16mm}${css}</style></head><body>${body}${
    autoPrint ? "<script>window.onload=()=>setTimeout(()=>window.print(),400)</script>" : ""
  }</body></html>`;
}

// ------------------------------------------------------------------ document

export function documentHtml(
  { title, subtitle, markdown, theme }: { title: string; subtitle?: string; markdown: string; theme?: string },
  autoPrint = false
): string {
  const t = getTheme(theme);
  const dark = parseInt(t.bg.slice(0, 2), 16) + parseInt(t.bg.slice(2, 4), 16) + parseInt(t.bg.slice(4, 6), 16) < 300;
  // Untuk cetak, tema gelap dipakai di sampul saja; isi tetap terang agar hemat tinta & mudah dibaca
  const css = `
    body{font-family:Inter,${t.cssBody};color:#1d1d1f;background:#fff;line-height:1.7;font-size:14.5px}
    .cover{background:#${t.bg};color:#${dark ? t.text : t.text};padding:56px 56px 44px;position:relative;overflow:hidden}
    .cover:after{content:"";position:absolute;right:-60px;top:-60px;width:240px;height:240px;border-radius:50%;background:#${t.accent};opacity:.9}
    .kicker{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#${t.accent};position:relative;z-index:1}
    .cover h1{font-family:Fraunces,${t.cssDisplay};font-size:40px;line-height:1.08;margin:14px 0 10px;max-width:80%;position:relative;z-index:1}
    .cover p{margin:0;max-width:70%;opacity:.8;position:relative;z-index:1}
    .cover.has-photo{background-size:cover;background-position:center;padding-top:96px}
    .cover.has-photo:after{display:none}
    .credit{position:relative;z-index:1;margin-top:26px;font-size:10px;opacity:.7}
    figure{margin:22px 0;break-inside:avoid}
    figure img{width:100%;max-height:340px;object-fit:cover;border-radius:10px;display:block}
    figcaption{font-size:11px;color:#888;margin-top:6px}
    main{padding:36px 56px 56px;max-width:860px}
    h2{font-family:Fraunces,${t.cssDisplay};font-size:22px;margin:34px 0 8px;padding-top:14px;border-top:3px solid #${t.accent};display:inline-block}
    h3{font-family:'Space Grotesk',${t.cssBody};font-size:16px;margin:22px 0 6px;color:#${ensureContrast(dark ? t.bg : t.accent2, ["FFFFFF"], 4.5)}}
    h4{font-size:14px;margin:18px 0 4px}
    p{margin:10px 0}
    ul,ol{padding-left:22px}li{margin:4px 0}
    li::marker{color:#${t.accent}}
    blockquote{margin:18px 0;padding:12px 18px;border-left:4px solid #${t.accent};background:#${t.accent}1f;font-style:italic}
    table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
    th{background:#${t.bg};color:#${t.text};text-align:left;padding:9px 10px}
    td{padding:8px 10px;border-bottom:1px solid #e5e5e5}
    code{font-family:'JetBrains Mono',monospace;background:#f2f2f2;padding:1px 5px;border-radius:4px;font-size:12px}
    footer{margin:0 56px;padding:14px 0 30px;border-top:1px solid #ddd;font-size:11px;color:#888;display:flex;justify-content:space-between}
    @media print{.cover,figure img{-webkit-print-color-adjust:exact;print-color-adjust:exact}th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  `;
  const date = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  // Foto sampul = gambar pertama ber-alt "cover": jadi latar sampul, bukan isi
  let md = markdown;
  let cover: { url: string; credit?: string } | null = null;
  const mlines = md.split("\n");
  const ci = mlines.findIndex((l) => PHOTO_LINE.test(l) && /^\s*!\[cover\]/i.test(l));
  if (ci >= 0) {
    const m = mlines[ci].match(PHOTO_LINE)!;
    const cap = mlines[ci + 1]?.match(CAPTION_LINE);
    cover = { url: m[2], credit: cap?.[1] };
    mlines.splice(ci, cap ? 2 : 1);
    md = mlines.join("\n");
  }
  const body = `<section class="cover${cover ? " has-photo" : ""}"${cover ? ` style="background-image:linear-gradient(180deg,#${t.bg}d9 0%,#${t.bg}b3 55%,#${t.bg}f2 100%),url('${escapeHtml(cover.url)}')"` : ""}><div class="kicker">Dokumen · ${escapeHtml(date)}</div><h1>${escapeHtml(title)}</h1>${
    subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""
  }${cover?.credit ? `<div class="credit">${escapeHtml(cover.credit)}</div>` : ""}</section><main>${markdownToHtml(md)}</main><footer><span>${escapeHtml(title)}</span><span>Dibuat dengan VOX·AI Studio</span></footer>`;
  return page(title, css, body, autoPrint);
}

// ------------------------------------------------------------------ invoice

export function invoiceHtml(inv: InvoiceData, autoPrint = false): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: inv.currency || "IDR", maximumFractionDigits: 0 }).format(n);
  const accent = inv.accent || "#23786e";
  const style = inv.style || "modern";
  const date = (d: string) => {
    const x = new Date(d);
    return isNaN(x.getTime()) ? escapeHtml(d) : x.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  };
  const rows = inv.items
    .map(
      (it, i) =>
        `<tr><td class="n">${String(i + 1).padStart(2, "0")}</td><td>${escapeHtml(it.description)}</td><td class="r">${it.quantity}</td><td class="r">${fmt(
          it.unitPrice
        )}</td><td class="r b">${fmt(it.total)}</td></tr>`
    )
    .join("");

  const base = `
    body{font-family:Inter,system-ui,sans-serif;color:#1c1c1e;background:#fff;font-size:13.5px}
    .wrap{max-width:820px;margin:0 auto;padding:44px}
    table{width:100%;border-collapse:collapse;margin-top:26px}
    th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;text-align:left;padding:10px 8px}
    td{padding:12px 8px;border-bottom:1px solid #ececec;vertical-align:top}
    .r{text-align:right}.b{font-weight:600}.n{color:#999;font-family:'JetBrains Mono',monospace;width:34px}
    .parties{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:30px}
    .label{font-size:10.5px;text-transform:uppercase;letter-spacing:.14em;color:#8a8a8a;margin-bottom:6px}
    .totals{margin-left:auto;width:min(320px,100%);margin-top:18px}
    .totals div{display:flex;justify-content:space-between;padding:7px 0}
    .grand{font-size:20px;font-weight:700;border-top:2px solid ${accent};margin-top:6px;padding-top:12px!important;color:${accent}}
    .notes{margin-top:34px;padding:16px 18px;border-radius:10px;background:#f6f6f4;font-size:12.5px;color:#555}
    @media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}.wrap{padding:0}}
    @media (max-width:560px){.parties{grid-template-columns:1fr}.wrap{padding:22px}}
  `;

  const variants: Record<string, { css: string; head: string }> = {
    modern: {
      css: `.top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
        .brand{font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700}
        .title{font-family:'Space Grotesk',sans-serif;font-size:44px;font-weight:700;letter-spacing:-.02em;color:${accent};line-height:1}
        th{background:${accent};color:#fff}th:first-child{border-radius:8px 0 0 8px}th:last-child{border-radius:0 8px 8px 0}`,
      head: `<div class="top"><div><div class="brand">${escapeHtml(inv.companyName)}</div><div style="color:#777;margin-top:4px;max-width:280px">${escapeHtml(
        inv.companyAddress
      )}</div></div><div style="text-align:right"><div class="title">Invoice</div><div style="font-family:'JetBrains Mono',monospace;margin-top:8px">${escapeHtml(
        inv.invoiceNumber
      )}</div></div></div>`,
    },
    klasik: {
      css: `body{font-family:Fraunces,Georgia,serif}.wrap{border:1px solid #ddd;margin-top:24px}
        .title{font-size:34px;text-align:center;letter-spacing:.3em;text-transform:uppercase;margin:6px 0 2px}
        .sub{text-align:center;color:#777;font-style:italic}.rule{height:3px;background:${accent};margin:18px auto;width:80px}
        th{border-bottom:2px solid #1c1c1e;font-family:Inter,sans-serif}`,
      head: `<div class="title">Invoice</div><div class="sub">${escapeHtml(inv.companyName)} · ${escapeHtml(
        inv.invoiceNumber
      )}</div><div class="rule"></div><div style="text-align:center;color:#777;font-size:12px">${escapeHtml(inv.companyAddress)}</div>`,
    },
    bold: {
      css: `.band{background:${accent};color:#fff;margin:-44px -44px 0;padding:40px 44px 34px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px}
        .title{font-family:'Space Grotesk',sans-serif;font-size:64px;font-weight:700;line-height:.9;letter-spacing:-.03em}
        th{border-bottom:3px solid #1c1c1e;color:#1c1c1e}
        @media print{.band{margin:0}}`,
      head: `<div class="band"><div class="title">INVOICE</div><div style="text-align:right"><div style="font-weight:700;font-size:16px">${escapeHtml(
        inv.companyName
      )}</div><div style="opacity:.85;font-size:12px;max-width:260px">${escapeHtml(inv.companyAddress)}</div><div style="font-family:'JetBrains Mono',monospace;margin-top:8px">${escapeHtml(
        inv.invoiceNumber
      )}</div></div></div>`,
    },
  };
  const v = variants[style] || variants.modern;

  const body = `<div class="wrap">${v.head}
    <div class="parties">
      <div><div class="label">Ditagihkan kepada</div><div class="b" style="font-size:15px">${escapeHtml(inv.clientName)}</div><div style="color:#666">${escapeHtml(
        inv.clientAddress
      )}</div></div>
      <div style="text-align:right"><div class="label">Tanggal</div><div>${date(inv.date)}</div><div class="label" style="margin-top:12px">Jatuh tempo</div><div class="b">${date(
        inv.dueDate
      )}</div></div>
    </div>
    <table><thead><tr><th>#</th><th>Deskripsi</th><th class="r">Qty</th><th class="r">Harga</th><th class="r">Jumlah</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="totals">
      <div><span>Subtotal</span><span>${fmt(inv.subtotal)}</span></div>
      <div><span>Pajak (${inv.taxRate}%)</span><span>${fmt(inv.taxAmount)}</span></div>
      <div class="grand"><span>Total</span><span>${fmt(inv.totalAmount)}</span></div>
    </div>
    ${inv.notes ? `<div class="notes"><div class="label">Catatan</div>${escapeHtml(inv.notes)}</div>` : ""}
  </div>`;
  return page(`Invoice ${inv.invoiceNumber}`, base + v.css, body, autoPrint);
}

export function openPrintWindow(html: string) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\n");
}

// ------------------------------------------------------------------ surat berkop


export function letterHtml(l: LetterData, autoPrint = false): string {
  const e = escapeHtml;
  const css = `
    body{font-family:'Times New Roman',Tinos,Times,serif;color:#000;background:#fff;font-size:12pt;line-height:1.5}
    .sheet{max-width:794px;margin:0 auto;padding:48px 64px 56px}
    .kop{text-align:center;padding-bottom:8px;border-bottom:4px double #000;margin-bottom:22px}
    .kop .org{font-size:15pt;font-weight:700;text-transform:uppercase;letter-spacing:.02em;line-height:1.25}
    .kop .unit{font-size:13pt;font-weight:700;text-transform:uppercase;line-height:1.25}
    .kop .addr{font-size:10pt;line-height:1.35;margin-top:3px}
    .top{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}
    .meta td{padding:0 6px 0 0;vertical-align:top}
    .meta td:first-child{min-width:84px}
    .meta td:nth-child(2){width:10px}
    .date{text-align:right;white-space:nowrap}
    .to{margin:18px 0 12px}
    p{margin:0 0 10px;text-align:justify}
    p.body{text-indent:36px}
    table.rinci{margin:6px 0 12px 36px}
    table.rinci td{padding:1px 8px 1px 0;vertical-align:top}
    .ttd{margin:22px 0 0 auto;width:46%;text-align:left}
    .ttd .space{height:74px}
    .ttd .nm{font-weight:700;text-decoration:underline}
    .tembusan{margin-top:22px;font-size:11pt}
    .tembusan ol{margin:2px 0 0;padding-left:22px}
    @page{size:A4;margin:16mm 18mm}
    @media print{.sheet{padding:0;max-width:none}.kop{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  `;
  const kop = l.kop?.name
    ? `<div class="kop"><div class="org">${e(l.kop.name)}</div>${l.kop.unit ? `<div class="unit">${e(l.kop.unit)}</div>` : ""}${l.kop.address ? `<div class="addr">${e(l.kop.address)}</div>` : ""}${l.kop.contact ? `<div class="addr">${e(l.kop.contact)}</div>` : ""}</div>`
    : "";
  const metaRows = [
    l.nomor ? ["Nomor", l.nomor] : null,
    l.lampiran ? ["Lampiran", l.lampiran] : null,
    ["Perihal", l.perihal],
  ].filter((r): r is string[] => !!r);
  const meta = `<table class="meta">${metaRows.map(([k, v]) => `<tr><td>${k}</td><td>:</td><td>${k === "Perihal" ? `<b>${e(v)}</b>` : e(v)}</td></tr>`).join("")}</table>`;
  const rinci = l.rincian?.length ? `<table class="rinci">${l.rincian.map((r) => `<tr><td>${e(r.label)}</td><td>:</td><td>${e(r.value)}</td></tr>`).join("")}</table>` : "";
  const body = `<div class="sheet">${kop}<div class="top">${meta}<div class="date">${e(l.tempat)}, ${e(l.tanggal)}</div></div>
<div class="to">${l.kepada.map((k) => `${e(k)}`).join("<br>")}</div>
${l.pembuka ? `<p>${e(l.pembuka)}</p>` : ""}
${l.isi.map((p, i) => `<p class="body">${e(p)}</p>${i === 0 ? rinci : ""}`).join("")}
${!l.isi.length ? rinci : ""}
${l.penutup ? `<p class="body">${e(l.penutup)}</p>` : ""}
<div class="ttd"><div>${e(l.salamPenutup || "Hormat kami,")}</div>${l.jabatan ? `<div>${e(l.jabatan)},</div>` : ""}<div class="space"></div><div class="nm">${e(l.nama)}</div>${l.nip ? `<div>${e(l.nip)}</div>` : ""}</div>
${l.tembusan?.length ? `<div class="tembusan">Tembusan:<ol>${l.tembusan.map((t) => `<li>${e(t)}</li>`).join("")}</ol></div>` : ""}</div>`;
  return page(l.perihal, css, body, autoPrint);
}
