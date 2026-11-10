import JSZip from "jszip";

/** Ambil teks dari file upload: PDF, DOCX, XLSX, PPTX, CSV/TXT/MD/JSON. Tanpa API luar. */

const decode = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, "&");

async function docx(buf: Buffer): Promise<string> {
  const z = await JSZip.loadAsync(buf);
  const xml = (await z.file("word/document.xml")?.async("string")) || "";
  return decode(
    xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br[^>]*\/>/g, "\n")
      .replace(/<\/w:p>\s*<\/w:tc>/g, "\t")
      .replace(/<\/w:tc>/g, "\t")
      .replace(/\t?<\/w:tr>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
  );
}

async function xlsx(buf: Buffer): Promise<string> {
  const z = await JSZip.loadAsync(buf);
  const shared = [...((await z.file("xl/sharedStrings.xml")?.async("string")) || "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    decode(m[1].replace(/<rPh[\s\S]*?<\/rPh>/g, "").replace(/<[^>]+>/g, ""))
  );
  const sheets = Object.keys(z.files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort((a, b) => parseInt(a.match(/\d+/)![0]) - parseInt(b.match(/\d+/)![0]));
  const out: string[] = [];
  for (const f of sheets.slice(0, 5)) {
    const xml = await z.file(f)!.async("string");
    const rows = [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((r) =>
      [...r[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)]
        .map((c) => {
          const attrs = c[1] || "", inner = c[2] || "";
          if (/t="s"/.test(attrs)) return shared[+(inner.match(/<v>(\d+)<\/v>/)?.[1] ?? -1)] ?? "";
          if (/t="inlineStr"/.test(attrs)) return decode(inner.replace(/<[^>]+>/g, ""));
          return decode(inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "");
        })
        .join("\t")
    );
    out.push(`[${f.replace(/^.*\//, "").replace(".xml", "")}]\n${rows.join("\n")}`);
  }
  return out.join("\n\n");
}

async function pptx(buf: Buffer): Promise<string> {
  const z = await JSZip.loadAsync(buf);
  const slides = Object.keys(z.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a, b) => parseInt(a.match(/\d+/)![0]) - parseInt(b.match(/\d+/)![0]));
  const out: string[] = [];
  for (const [i, f] of slides.entries()) {
    const xml = await z.file(f)!.async("string");
    const text = [...xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map((p) => decode([...p[1].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => t[1]).join(""))).filter(Boolean);
    out.push(`[Slide ${i + 1}]\n${text.join("\n")}`);
  }
  return out.join("\n\n");
}

async function pdf(buf: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(doc, { mergePages: false });
  return (Array.isArray(text) ? text : [text]).map((t, i) => `[Halaman ${i + 1}]\n${t}`).join("\n\n");
}

export const READABLE = /\.(pdf|docx|xlsx|xlsm|pptx|csv|tsv|txt|md|json)$/i;

export async function fileToText(name: string, buf: Buffer): Promise<string> {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "";
  let t = "";
  if (ext === "pdf") t = await pdf(buf);
  else if (ext === "docx") t = await docx(buf);
  else if (ext === "xlsx" || ext === "xlsm") t = await xlsx(buf);
  else if (ext === "pptx") t = await pptx(buf);
  else if (["csv", "tsv", "txt", "md", "json"].includes(ext)) t = buf.toString("utf8");
  else throw new Error("format belum didukung (pakai PDF, DOCX, XLSX, PPTX, CSV, TXT, MD, JSON)");
  return t.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
