import JSZip from "jszip";
import { getTheme } from "./themes";
import { PHOTO_LINE } from "./documentRender";
import { ensureContrast } from "./colorUtils";
import type { LetterData } from "../types";

/**
 * Ekspor dokumen (Markdown) ke file Word .docx sungguhan, dirakit langsung dari XML OOXML lewat JSZip
 * (tanpa paket tambahan). Mendukung: judul + subjudul, heading, paragraf dengan **tebal** / *miring* / `kode`,
 * daftar bullet & bernomor, kutipan, tabel, dan nomor halaman di footer. Warna mengikuti tema dokumen.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface RunOpts {
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  color?: string;
  size?: number; // half-points
  underline?: boolean;
}

function run(text: string, o: RunOpts = {}) {
  if (!text) return "";
  const rpr =
    (o.code ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : "") +
    (o.bold ? "<w:b/>" : "") +
    (o.italic ? "<w:i/>" : "") +
    (o.color ? `<w:color w:val="${o.color}"/>` : "") +
    (o.size ? `<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>` : "") +
    (o.underline ? '<w:u w:val="single"/>' : "");
  return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

/** **tebal**, *miring*, `kode` di dalam satu baris → deretan run */
function inlineRuns(text: string, base: RunOpts = {}): string {
  const out: string[] = [];
  const re = /(\*\*(.+?)\*\*|`([^`]+)`|(?<![*\w])\*(?!\s)(.+?)\*(?!\w))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(run(text.slice(last, m.index), base));
    if (m[2] !== undefined) out.push(run(m[2], { ...base, bold: true }));
    else if (m[3] !== undefined) out.push(run(m[3], { ...base, code: true }));
    else out.push(run(m[4], { ...base, italic: true }));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(run(text.slice(last), base));
  return out.join("");
}

const para = (inner: string, style?: string, extra = "") =>
  `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${extra}</w:pPr>${inner}</w:p>`;

export interface DocImage {
  rId: string;
  name: string;
  ext: "jpeg" | "png";
  bytes: Uint8Array;
  cx: number; // EMU
  cy: number;
}

/** Ukuran piksel dari header JPEG / PNG (tanpa dekoder gambar, jalan di browser & Node). */
export function imageInfo(b: Uint8Array): { ext: "jpeg" | "png"; w: number; h: number } | null {
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { ext: "png", w: dv.getUint32(16), h: dv.getUint32(20) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { ext: "jpeg", h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
      }
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
  }
  return null;
}

const MAX_W = 5_700_000; // lebar teks halaman A4 (EMU)
function fitImage(w: number, h: number, maxH: number) {
  let cx = MAX_W;
  let cy = Math.round((MAX_W * h) / w);
  if (cy > maxH) {
    cy = maxH;
    cx = Math.round((maxH * w) / h);
  }
  return { cx, cy };
}

/** Ambil foto Unsplash yang ada di Markdown (maks 5, timeout 10 dtk). Yang gagal dilewati: dokumen tetap jadi tanpa foto itu. */
async function loadImages(markdown: string): Promise<Map<string, DocImage>> {
  const urls = [...new Set(markdown.split("\n").map((l) => l.match(PHOTO_LINE)?.[2]).filter((u): u is string => !!u))].slice(0, 5);
  const map = new Map<string, DocImage>();
  await Promise.all(
    urls.map(async (url, k) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) return;
        const bytes = new Uint8Array(await res.arrayBuffer());
        const info = imageInfo(bytes);
        if (!info || !info.w || !info.h) return;
        const isCover = markdown.includes(`![cover](${url})`);
        const { cx, cy } = fitImage(info.w, info.h, isCover ? 3_300_000 : 3_400_000);
        map.set(url, { rId: `rId${20 + k}`, name: `image${k + 1}.${info.ext === "jpeg" ? "jpg" : "png"}`, ext: info.ext, bytes, cx, cy });
      } catch {
        // dilewati
      }
    })
  );
  return map;
}

const drawing = (img: DocImage, id: number, alt: string) =>
  `<w:p><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="60"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${img.cx}" cy="${img.cy}"/><wp:docPr id="${id}" name="Foto ${id}" descr="${esc(alt)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${esc(img.name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${img.rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${img.cx}" cy="${img.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

interface Built {
  body: string;
  numInstances: { numId: number; abstractId: number }[];
}

function markdownToBody(md: string, accent: string, headBg: string, headFg: string, images: Map<string, DocImage> = new Map()): Built {
  const lines = md.replace(/\r/g, "").split("\n");
  const body: string[] = [];
  const numInstances: Built["numInstances"] = [];
  let nextNum = 10;
  let imgCount = 0;
  let i = 0;
  const isItem = (l: string) => /^\s*([-*•]|\d+[.)])\s+/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const pic = line.match(PHOTO_LINE);
    if (pic) {
      const img = images.get(pic[2]);
      const cap = i + 1 < lines.length ? lines[i + 1].match(/^\s*\*(Foto: [^*]{1,120})\*\s*$/) : null;
      i += cap ? 2 : 1;
      if (!img || /^cover$/i.test(pic[1])) continue; // sampul ditangani terpisah; foto gagal dimuat dilewati
      imgCount++;
      body.push(drawing(img, 100 + imgCount, pic[1]));
      if (cap) body.push(para(run(cap[1], { italic: true, color: "888888", size: 16 }), undefined, '<w:jc w:val="center"/><w:spacing w:after="200"/>'));
      continue;
    }
    if (/^\s*!\[/.test(line)) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      body.push(para(inlineRuns(h[2]), `Heading${Math.min(3, h[1].length)}`));
      i++;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      const cols = head.length;
      const w = Math.floor(9000 / cols);
      const cell = (txt: string, header: boolean) =>
        `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${header ? `<w:shd w:val="clear" w:color="auto" w:fill="${headBg}"/>` : ""}</w:tcPr>${para(
          inlineRuns(txt, header ? { bold: true, color: headFg } : {}),
          undefined,
          '<w:spacing w:before="60" w:after="60"/>'
        )}</w:tc>`;
      const tr = (r: string[], header: boolean) =>
        `<w:tr>${header ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}${Array.from({ length: cols }, (_, k) => cell(r[k] ?? "", header)).join("")}</w:tr>`;
      body.push(
        `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9D9D9"/><w:bottom w:val="single" w:sz="4" w:color="D9D9D9"/><w:insideH w:val="single" w:sz="4" w:color="D9D9D9"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${Array.from({ length: cols }, () => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${tr(head, true)}${rows.map((r) => tr(r, false)).join("")}</w:tbl>`,
        para("", undefined, '<w:spacing w:after="60"/>')
      );
      continue;
    }
    if (isItem(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const numId = nextNum++;
      numInstances.push({ numId, abstractId: ordered ? 2 : 1 });
      while (i < lines.length && isItem(lines[i])) {
        const txt = lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, "");
        body.push(para(inlineRuns(txt), "ListParagraph", `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr>`));
        i++;
      }
      continue;
    }
    if (/^>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
      body.push(para(inlineRuns(q.join(" "), { italic: true }), "Quote"));
      continue;
    }
    const p: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*([-*•]|\d+[.)])\s|>|\s*\|)/.test(lines[i])) p.push(lines[i++]);
    if (p.length) body.push(para(inlineRuns(p.join(" "))));
    else i++;
  }
  void accent;
  return { body: body.join(""), numInstances };
}

function stylesXml(accent: string, ink: string, bodyFont: string, headFont: string) {
  const f = (name: string) => `<w:rFonts w:ascii="${name}" w:hAnsi="${name}" w:cs="${name}"/>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>${f(bodyFont)}<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="id-ID"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="320" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:rPr><w:color w:val="${ink}"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="120" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr>${f(headFont)}<w:b/><w:color w:val="${ink}"/><w:sz w:val="68"/><w:szCs w:val="68"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="360"/></w:pPr><w:rPr><w:color w:val="666666"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Kicker"><w:name w:val="Kicker"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="1800" w:after="120"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:b/><w:color w:val="${accent}"/><w:spacing w:val="40"/><w:sz w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pBdr><w:top w:val="single" w:sz="18" w:space="6" w:color="${accent}"/></w:pBdr><w:spacing w:before="420" w:after="120" w:line="240" w:lineRule="auto"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr>${f(headFont)}<w:b/><w:color w:val="${ink}"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="100" w:line="240" w:lineRule="auto"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr>${f(headFont)}<w:b/><w:color w:val="${accent}"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80" w:line="240" w:lineRule="auto"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr>${f(headFont)}<w:b/><w:color w:val="${ink}"/><w:sz w:val="25"/><w:szCs w:val="25"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/><w:contextualSpacing/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:pBdr><w:left w:val="single" w:sz="24" w:space="10" w:color="${accent}"/></w:pBdr><w:spacing w:before="200" w:after="200"/><w:ind w:left="360"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="888888"/><w:sz w:val="18"/></w:rPr></w:style>
</w:styles>`;
}

function numberingXml(instances: Built["numInstances"], accent: string) {
  const bullet = `<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="540" w:hanging="270"/></w:pPr><w:rPr><w:color w:val="${accent}"/><w:b/></w:rPr></w:lvl></w:abstractNum>`;
  const dec = `<w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="540" w:hanging="360"/></w:pPr><w:rPr><w:color w:val="${accent}"/><w:b/></w:rPr></w:lvl></w:abstractNum>`;
  const nums = instances
    .map((n) => `<w:num w:numId="${n.numId}"><w:abstractNumId w:val="${n.abstractId}"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${bullet}${dec}${nums}</w:numbering>`;
}

export interface DocxInput {
  title: string;
  subtitle?: string;
  markdown: string;
  theme?: string;
}

/** Rakit file .docx dan kembalikan sebagai Blob (siap diunduh di browser, atau dipakai di Node untuk tes). */
export async function buildDocx({ title, subtitle, markdown, theme }: DocxInput): Promise<Blob> {
  const t = getTheme(theme);
  // aksen harus terbaca di kertas putih: pakai accent2 kalau accent terlalu terang
  const lum = (hex: string) => parseInt(hex.slice(0, 2), 16) * 0.299 + parseInt(hex.slice(2, 4), 16) * 0.587 + parseInt(hex.slice(4, 6), 16) * 0.114;
  // Kertas putih: aksen & teks digeser (warna dijaga) sampai kontrasnya cukup; tema gelap tetap dapat teks gelap
  const accent = ensureContrast(t.accent, ["FFFFFF"], 4.5);
  const ink = ensureContrast(lum(t.text) > 120 ? "1D1D1F" : t.text, ["FFFFFF"], 12);
  const images = await loadImages(markdown);
  const { body, numInstances } = markdownToBody(markdown, accent, t.bg, lum(t.bg) < 140 ? "FFFFFF" : t.text, images);
  const coverUrl = markdown.split("\n").map((l) => l.match(PHOTO_LINE)).find((m) => m && /^cover$/i.test(m[1]))?.[2];
  const coverImg = coverUrl ? images.get(coverUrl) : undefined;
  const mdLines = markdown.split("\n");
  const coverCap = coverUrl ? mdLines[mdLines.findIndex((l) => l.includes(`![cover](${coverUrl})`)) + 1]?.match(/^\s*\*(Foto: [^*]{1,120})\*\s*$/)?.[1] : undefined;
  const date = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const cover =
    (coverImg ? drawing(coverImg, 100, "Sampul") + (coverCap ? para(run(coverCap, { italic: true, color: "888888", size: 16 }), undefined, '<w:jc w:val="center"/><w:spacing w:after="0"/>') : "") : "") +
    para(run(`DOKUMEN · ${date}`.toUpperCase()), "Kicker", coverImg ? '<w:spacing w:before="600" w:after="120"/>' : "") +
    para(run(title), "Title") +
    (subtitle ? para(run(subtitle), "Subtitle") : "") +
    `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;

  const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pStyle w:val="Footer"/><w:tabs><w:tab w:val="right" w:pos="9000"/></w:tabs></w:pPr>${run(title.slice(0, 60))}<w:r><w:tab/></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;

  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${cover}${body}<w:sectPr><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${[...images.values()].map((im) => `<Relationship Id="${im.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${im.name}"/>`).join("")}</Relationships>`
  );
  zip.file("word/document.xml", doc);
  for (const im of images.values()) zip.file(`word/media/${im.name}`, im.bytes);
  zip.file("word/styles.xml", stylesXml(accent, ink, t.bodyFont, t.displayFont));
  zip.file("word/numbering.xml", numberingXml(numInstances, accent));
  zip.file("word/footer1.xml", footer);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

export async function downloadDocx(input: DocxInput) {
  if (typeof window === "undefined") return;
  const blob = await buildDocx(input);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${input.title.replace(/[^a-zA-Z0-9_-]+/g, "_") || "dokumen"}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ------------------------------------------------------------------ surat berkop (.docx)

interface PP {
  keepNext?: boolean;
  bdr?: "double";
  tabs?: number[];
  after?: number;
  line?: number;
  left?: number;
  hanging?: number;
  first?: number;
  jc?: "left" | "right" | "center" | "both";
}
/** pPr dengan urutan elemen sesuai skema OOXML (Word ketat soal urutan). */
const pp = (o: PP) =>
  `<w:pPr>${o.keepNext ? "<w:keepNext/>" : ""}${o.bdr ? '<w:pBdr><w:bottom w:val="double" w:sz="12" w:space="4" w:color="000000"/></w:pBdr>' : ""}${
    o.tabs ? `<w:tabs>${o.tabs.map((t) => `<w:tab w:val="left" w:pos="${t}"/>`).join("")}</w:tabs>` : ""
  }<w:spacing w:after="${o.after ?? 120}" w:line="${o.line ?? 300}" w:lineRule="auto"/>${
    o.left !== undefined || o.first !== undefined || o.hanging !== undefined
      ? `<w:ind${o.left !== undefined ? ` w:left="${o.left}"` : ""}${o.hanging !== undefined ? ` w:hanging="${o.hanging}"` : ""}${o.first !== undefined ? ` w:firstLine="${o.first}"` : ""}/>`
      : ""
  }${o.jc ? `<w:jc w:val="${o.jc}"/>` : ""}</w:pPr>`;
const P = (inner: string, o: PP = {}) => `<w:p>${pp(o)}${inner}</w:p>`;

/** Surat resmi berkop ke .docx: Times New Roman 12 pt, kop dengan garis ganda, blok tanda tangan, tembusan. */
export async function buildLetterDocx(l: LetterData): Promise<Blob> {
  const R = run;
  const out: string[] = [];
  if (l.kop?.name) {
    const tight = { after: 0, line: 260, jc: "center" as const };
    out.push(P(R(l.kop.name.toUpperCase(), { bold: true, size: 30 }), tight));
    if (l.kop.unit) out.push(P(R(l.kop.unit.toUpperCase(), { bold: true, size: 26 }), tight));
    const subs = [l.kop.address, l.kop.contact].filter(Boolean) as string[];
    if (subs.length) subs.forEach((t, i) => out.push(P(R(t, { size: 20 }), { ...tight, bdr: i === subs.length - 1 ? "double" : undefined })));
    else out.push(P("", { ...tight, bdr: "double" }));
    out.push(P(""));
  }
  const meta: [string, string][] = [];
  if (l.nomor) meta.push(["Nomor", l.nomor]);
  if (l.lampiran) meta.push(["Lampiran", l.lampiran]);
  meta.push(["Perihal", l.perihal]);
  out.push(P(R(`${l.tempat}, ${l.tanggal}`), { jc: "right" }));
  meta.forEach(([k, v]) => out.push(P(`${R(k)}<w:r><w:tab/></w:r>${R(":")}<w:r><w:tab/></w:r>${R(v, { bold: k === "Perihal" })}`, { tabs: [1500, 1750], after: 0, left: 1750, hanging: 1750 })));
  out.push(P(""));
  l.kepada.forEach((k) => out.push(P(R(k), { after: 0 })));
  out.push(P(""));
  if (l.pembuka) out.push(P(R(l.pembuka)));
  const rinci = () => (l.rincian || []).map((r) => P(`${R(r.label)}<w:r><w:tab/></w:r>${R(":")}<w:r><w:tab/></w:r>${R(r.value)}`, { tabs: [2300, 2550], after: 40, left: 2550, hanging: 2550 }));
  l.isi.forEach((p, i) => {
    out.push(P(R(p), { jc: "both", first: 720 }));
    if (i === 0) out.push(...rinci());
  });
  if (!l.isi.length) out.push(...rinci());
  if (l.penutup) out.push(P(R(l.penutup), { jc: "both", first: 720 }));
  const sig: PP = { left: 5200, after: 0, keepNext: true };
  out.push(P(""));
  out.push(P(R(l.salamPenutup || "Hormat kami,"), sig));
  if (l.jabatan) out.push(P(R(`${l.jabatan},`), sig));
  out.push(P("", sig), P("", sig), P("", sig));
  out.push(P(R(l.nama, { bold: true, underline: true }), sig));
  if (l.nip) out.push(P(R(l.nip), { left: 5200, after: 0 }));
  if (l.tembusan?.length) {
    out.push(P(""), P(R("Tembusan:", { size: 22 }), { after: 0 }));
    l.tembusan.forEach((t, i) => out.push(P(R(`${i + 1}. ${t}`, { size: 22 }), { after: 0, left: 360, hanging: 360 })));
  }
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${out.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1247" w:bottom="1134" w:left="1417" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="id-ID"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file("word/document.xml", doc);
  zip.file("word/styles.xml", styles);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

export async function downloadLetterDocx(l: LetterData) {
  if (typeof window === "undefined") return;
  const blob = await buildLetterDocx(l);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(l.perihal || "surat").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60) || "surat"}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
