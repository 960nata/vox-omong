import JSZip from "jszip";
import type { SpreadsheetData } from "../types";

/** File .xlsx asli (OOXML) dari SpreadsheetData: header tebal & beku, filter, lebar kolom, angka tetap angka. */

const x = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const col = (n: number) => { let s = ""; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

/** "Rp 1.250.000" / "12,5%" -> angka bila jelas angka; selain itu tetap teks. */
function asNumber(v: string | number): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = v.trim().replace(/^rp\.?\s*/i, "");
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, "").replace(",", "."));
  if (/^-?\d+(,\d+)?$/.test(t)) return Number(t.replace(",", "."));
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return null;
}

export async function buildXlsx(sheet: SpreadsheetData): Promise<Blob> {
  const rows = [sheet.headers, ...sheet.rows];
  const ncol = Math.max(1, ...rows.map((r) => r.length));
  const width = Array.from({ length: ncol }, (_, c) => Math.min(60, Math.max(8, ...rows.map((r) => String(r[c] ?? "").length + 2))));
  const sheetRows = rows
    .map((r, ri) => {
      const cells = Array.from({ length: ncol }, (_, c) => {
        const ref = `${col(c)}${ri + 1}`;
        const v = r[c];
        if (v === undefined || v === null || v === "") return "";
        if (ri === 0) return `<c r="${ref}" t="inlineStr" s="1"><is><t>${x(String(v))}</t></is></c>`;
        const n = asNumber(v);
        if (n !== null) return `<c r="${ref}" s="${Number.isInteger(n) ? 2 : 3}"><v>${n}</v></c>`;
        return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${x(String(v))}</t></is></c>`;
      }).join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join("");
  const last = `${col(ncol - 1)}${rows.length}`;
  const ws = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${width.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E3D"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf numFmtId="3" applyNumberFormat="1"/><xf numFmtId="164" applyNumberFormat="1"/></cellXfs></styleSheet>`;
  const name = x((sheet.title || "Sheet1").replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet1");
  const z = new JSZip();
  z.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  z.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  z.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${name.replace(/'/g, "''")}'!$A$1:$${col(ncol - 1)}$${rows.length}</definedName></definedNames></workbook>`);
  z.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  z.file("xl/worksheets/sheet1.xml", ws);
  z.file("xl/styles.xml", styles);
  return z.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function downloadXlsx(sheet: SpreadsheetData): Promise<void> {
  const blob = await buildXlsx(sheet);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(sheet.filename || sheet.title || "tabel").replace(/\.(csv|xlsx)$/i, "").replace(/[^\w\- ]+/g, "").trim() || "tabel"}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
