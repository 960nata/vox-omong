import path from "path";
import fs from "fs/promises";
import { getBrowser } from "../browser";
import { readProjectFile, writeProjectFile } from "../projects";
import { callLLM } from "../codeAgent";
import { parseLoose } from "../jsonLoose";
import type { VisualCriticIssue, VisualCriticResult } from "./types";

const MAX_CRITIC_ITERATIONS = 2;

interface PageInspection {
  consoleErrors: string[];
  failedRequests: string[];
  hasHorizontalOverflow: boolean;
  domSummary: string;
  screenshotBase64: string;
}

async function inspectHtmlPage(htmlContent: string): Promise<PageInspection> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text().slice(0, 300));
    }
  });

  page.on("pageerror", (err) => {
    consoleErrors.push(err.message.slice(0, 300));
  });

  page.on("requestfailed", (req) => {
    failedRequests.push(`${req.url()} (${req.failure()?.errorText || "failed"})`);
  });

  await page.setContent(htmlContent, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(1000); // Allow fonts & CDN Tailwind to settle

  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth + 5;
  });

  const domSummary = await page.evaluate(() => {
    const titles = Array.from(document.querySelectorAll("h1, h2")).map((el) => el.textContent?.trim()).filter(Boolean);
    const buttons = Array.from(document.querySelectorAll("button, a")).map((el) => el.textContent?.trim()).filter(Boolean);
    const images = Array.from(document.querySelectorAll("img")).map((img) => ({
      src: img.src,
      hasAlt: !!img.alt,
      complete: img.complete && img.naturalHeight > 0,
    }));
    return `Judul: ${titles.slice(0, 5).join(" | ")}, Tombol/Tautan: ${buttons.slice(0, 8).join(", ")}, Total Gambar: ${images.length} (${images.filter((i) => !i.complete).length} broken)`;
  });

  const screenshotBuffer = await page.screenshot({ type: "png", fullPage: false });
  const screenshotBase64 = screenshotBuffer.toString("base64");

  await context.close();

  return {
    consoleErrors,
    failedRequests,
    hasHorizontalOverflow,
    domSummary,
    screenshotBase64,
  };
}

const SYSTEM_CRITIC = `Kamu adalah Senior UI/UX & Quality Assurance Auditor.
Tugasmu adalah menganalisis halaman web (HTML/Tailwind) dan hasil inspeksi browser untuk menemukan cacat visual atau fungsional.

Periksa:
1. Console errors atau runtime JS error.
2. Layout overflow horizontal yang merusak responsivitas.
3. Keterbacaan dan kontras warna (misal: teks abu-abu muda di atas putih).
4. Tombol atau elemen penting yang terlihat janggal.

Jika ada masalah yang bisa diperbaiki, berikan perbaikan terarah:
- Beri string target eksak yang mau diganti (oldSnippet) dan penggantinya (newSnippet).

Balas HANYA JSON:
{
  "passed": true/false,
  "critiqueSummary": "Ringkasan kualitas visual dalam 1-2 kalimat.",
  "issues": [
    {
      "type": "console_error" | "layout_overflow" | "contrast_warning" | "broken_asset" | "aesthetic",
      "severity": "high" | "medium" | "low",
      "description": "Deskripsi masalah",
      "suggestedFix": "Solusi perbaikan"
    }
  ],
  "patch": {
    "oldSnippet": "kode lama yang mau diganti (harus persis ada di html)",
    "newSnippet": "kode baru perbaikan"
  }
}`;

export async function runVisualCritic(
  projectId: string,
  opts: {
    apiKey?: string;
    maxIterations?: number;
    onLog?: (msg: string) => void;
  } = {}
): Promise<VisualCriticResult> {
  const maxIters = opts.maxIterations || MAX_CRITIC_ITERATIONS;
  const fixedIssues: string[] = [];
  let allIssues: VisualCriticIssue[] = [];
  let lastScreenshot = "";
  let lastSummary = "Pemeriksaan visual selesai.";
  let iteration = 0;

  for (iteration = 0; iteration < maxIters; iteration++) {
    opts.onLog?.(`Menjalankan inspeksi visual iterasi ke-${iteration + 1}...`);

    const file = await readProjectFile(projectId, "index.html");
    if (!file || !file.content) {
      return {
        passed: false,
        issues: [{ type: "broken_asset", severity: "high", description: "index.html tidak ditemukan dalam project." }],
        fixedIssues: [],
        critiqueSummary: "File index.html tidak ada untuk diinspeksi.",
        iterationsRun: iteration,
      };
    }

    let inspection: PageInspection;
    try {
      inspection = await inspectHtmlPage(file.content);
      lastScreenshot = inspection.screenshotBase64;
    } catch (err) {
      opts.onLog?.(`Browser inspection error: ${(err as Error).message}`);
      break;
    }

    // Call LLM for critique with multimodal vision if supported
    const prompt = [
      `DOM Summary: ${inspection.domSummary}`,
      `Horizontal Overflow: ${inspection.hasHorizontalOverflow ? "YA (Ada elemen keluar layar!)" : "TIDAK (Normal)"}`,
      `Console Errors (${inspection.consoleErrors.length}): ${inspection.consoleErrors.slice(0, 3).join("\n") || "Tidak ada"}`,
      `Failed Requests (${inspection.failedRequests.length}): ${inspection.failedRequests.slice(0, 3).join("\n") || "Tidak ada"}`,
      `Potongan HTML (Awal & Akhir):\n${file.content.slice(0, 3000)}\n...\n${file.content.slice(-1500)}`,
    ].join("\n\n");

    try {
      const res = await callLLM({
        system: SYSTEM_CRITIC,
        prompt,
        imageDataUri: `data:image/png;base64,${inspection.screenshotBase64}`,
        json: true,
        maxTokens: 1000,
        temperature: 0.1,
        apiKey: opts.apiKey,
        prefer: ["gemini", "sonnet"],
      });

      const parsed = parseLoose<{
        passed: boolean;
        critiqueSummary: string;
        issues: VisualCriticIssue[];
        patch?: { oldSnippet?: string; newSnippet?: string };
      }>(res.text);

      if (parsed) {
        lastSummary = parsed.critiqueSummary || lastSummary;
        allIssues = parsed.issues || [];

        // If automatic fix patch is provided, apply it (Self-Correction)
        if (parsed.patch && parsed.patch.oldSnippet && parsed.patch.newSnippet) {
          const { oldSnippet, newSnippet } = parsed.patch;
          if (file.content.includes(oldSnippet)) {
            const patched = file.content.replace(oldSnippet, newSnippet);
            await writeProjectFile(projectId, "index.html", patched);
            fixedIssues.push(`Memperbaiki: ${allIssues[0]?.description || "Penyesuaian UI & styling"}`);
            opts.onLog?.(`[Self-Correction] Perbaikan otomatis diterapkan ke index.html`);
            continue; // Re-inspect in next iteration
          }
        }

        if (parsed.passed || allIssues.length === 0) {
          return {
            passed: true,
            issues: allIssues,
            fixedIssues,
            screenshotBase64: lastScreenshot,
            critiqueSummary: lastSummary,
            iterationsRun: iteration + 1,
          };
        }
      }
    } catch (err) {
      opts.onLog?.(`LLM critic call failed: ${(err as Error).message}`);
      break;
    }
  }

  return {
    passed: allIssues.length === 0,
    issues: allIssues,
    fixedIssues,
    screenshotBase64: lastScreenshot,
    critiqueSummary: lastSummary,
    iterationsRun: iteration,
  };
}
