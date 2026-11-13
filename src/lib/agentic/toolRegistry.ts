import path from "path";
import { readProjectFile, writeProjectFile, listProjectFiles, getSafeProjectPath } from "../projects";
import { searchProjectCode } from "../localCodeSearch";
import { executeTerminal } from "../terminalRuntime";
import { openPage } from "../browser";
import { runSkill, type SkillKind } from "../skillAgent";
import { makeVideo } from "../videoMaker";
import { rememberSemantic, recallSemantic } from "./semanticMemory";
import type { AgentToolDefinition, ToolExecutionContext, ToolExecutionResult } from "./types";

export interface UnifiedTool {
  definition: AgentToolDefinition;
  execute: (args: Record<string, any>, context: ToolExecutionContext) => Promise<ToolExecutionResult>;
}

export const AGENT_TOOLS: Record<string, UnifiedTool> = {
  file_list: {
    definition: {
      name: "file_list",
      description: "Melihat daftar file dalam project workspace aktif.",
      parameters: {
        type: "object",
        properties: {
          subpath: { type: "string", description: "Subdirektori opsional untuk difilter" },
        },
      },
    },
    execute: async (args, context) => {
      try {
        const files = await listProjectFiles(context.projectId);
        const sub = (args.subpath || "").toLowerCase();
        const filtered = sub
          ? files.filter((f) => f.path.toLowerCase().includes(sub))
          : files.slice(0, 50);

        const listStr = filtered
          .map((f) => `${f.isDir ? "[DIR] " : "[FILE]"} ${f.path} (${f.size} B)`)
          .join("\n");

        return {
          success: true,
          output: listStr || "Tidak ada file ditemukan dalam project ini.",
        };
      } catch (err) {
        return { success: false, output: "", error: (err as Error).message };
      }
    },
  },

  file_read: {
    definition: {
      name: "file_read",
      description: "Membaca isi file teks dari workspace project aktif.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path relatif file (contoh: 'index.html', 'src/App.tsx')" },
          startLine: { type: "number", description: "Nomor baris awal (opsional, default 1)" },
          maxLines: { type: "number", description: "Maksimal baris yang dibaca (opsional, default 150)" },
        },
        required: ["path"],
      },
    },
    execute: async (args, context) => {
      try {
        const filePath = String(args.path || "").trim();
        const res = await readProjectFile(context.projectId, filePath);
        if (!res) return { success: false, output: "", error: `File '${filePath}' tidak ditemukan.` };

        const lines = res.content.split("\n");
        const start = Math.max(1, Number(args.startLine) || 1) - 1;
        const count = Math.min(300, Number(args.maxLines) || 150);
        const sliced = lines.slice(start, start + count);

        const formatted = sliced.map((l, i) => `${start + i + 1}: ${l}`).join("\n");
        return {
          success: true,
          output: `[File: ${filePath} (${res.lines} total baris)]\n${formatted}`,
        };
      } catch (err) {
        return { success: false, output: "", error: (err as Error).message };
      }
    },
  },

  file_write: {
    definition: {
      name: "file_write",
      description: "Membuat atau menulis ulang isi file di project aktif.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path file relatif (contoh: 'index.html', 'style.css')" },
          content: { type: "string", description: "Konten lengkap yang akan ditulis ke file" },
        },
        required: ["path", "content"],
      },
    },
    execute: async (args, context) => {
      try {
        const filePath = String(args.path || "").trim();
        const content = String(args.content || "");
        const ok = await writeProjectFile(context.projectId, filePath, content);
        if (!ok) return { success: false, output: "", error: `Gagal menulis file '${filePath}'.` };
        return {
          success: true,
          output: `Berhasil menulis file '${filePath}' (${content.length} karakter).`,
        };
      } catch (err) {
        return { success: false, output: "", error: (err as Error).message };
      }
    },
  },

  file_search: {
    definition: {
      name: "file_search",
      description: "Mencari potongan teks atau simbol kode di seluruh file project aktif.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Kata kunci / simbol kode yang dicari" },
        },
        required: ["query"],
      },
    },
    execute: async (args, context) => {
      try {
        const query = String(args.query || "").trim();
        const { projectDir } = getSafeProjectPath(context.projectId);
        const searchRes = await searchProjectCode(query, projectDir);
        const hits = searchRes.hits;
        if (!hits || hits.length === 0) {
          return { success: true, output: `Tidak ada kecocokan untuk '${query}'.` };
        }
        const text = hits
          .slice(0, 10)
          .map((h: { file: string; startLine: number; snippet: string }) => `[${h.file}:${h.startLine}] ${h.snippet}`)
          .join("\n");
        return { success: true, output: text };
      } catch (err) {
        return { success: false, output: "", error: (err as Error).message };
      }
    },
  },

  terminal_exec: {
    definition: {
      name: "terminal_exec",
      description: "Menjalankan perintah terminal/shell di direktori workspace project aktif (misal: npm, git status, node script).",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Perintah shell untuk dieksekusi (contoh: 'npm run lint', 'node check.js')" },
        },
        required: ["command"],
      },
    },
    execute: async (args, context) => {
      try {
        const cmd = String(args.command || "").trim();
        const res = await executeTerminal({ command: cmd, projectId: context.projectId });
        const out = [
          res.stdout ? `STDOUT:\n${res.stdout}` : "",
          res.stderr ? `STDERR:\n${res.stderr}` : "",
          `Exit code: ${res.exitCode ?? (res.running ? "running" : 0)}`,
        ].filter(Boolean).join("\n\n");
        return { success: res.success, output: out || "(tidak ada output)" };
      } catch (err) {
        return { success: false, output: "", error: (err as Error).message };
      }
    },
  },

  web_search: {
    definition: {
      name: "web_search",
      description: "Mencari informasi terkini atau dokumentasi di internet menggunakan DuckDuckGo.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Kata kunci pencarian yang spesifik" },
        },
        required: ["query"],
      },
    },
    execute: async (args) => {
      try {
        const q = String(args.query || "").trim();
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
        const page = await openPage(url);
        const links = (page.text.match(/https?:\/\/[^\s)]+/g) || []).filter((u) => !/duckduckgo\./.test(u));
        let body = page.text.slice(0, 2000);
        let targetUrl = url;

        // If a direct search link exists, fetch the first page for richer context
        if (links[0]) {
          try {
            const targetPage = await openPage(links[0]);
            if (targetPage.text.length > 300) {
              body = targetPage.text.slice(0, 2500);
              targetUrl = targetPage.url;
            }
          } catch {}
        }

        return {
          success: true,
          output: `Hasil pencarian untuk "${q}" (Sumber: ${targetUrl}):\n${body.replace(/\s+/g, " ").trim()}`,
        };
      } catch (err) {
        return { success: false, output: "", error: (err as Error).message };
      }
    },
  },

  browser_fetch: {
    definition: {
      name: "browser_fetch",
      description: "Membuka sebuah URL spesifik via browser headless Playwright dan mengambil teks lengkap halamannya.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL website yang ingin dibuka (contoh: 'https://example.com')" },
        },
        required: ["url"],
      },
    },
    execute: async (args) => {
      try {
        const targetUrl = String(args.url || "").trim();
        const res = await openPage(targetUrl);
        return {
          success: true,
          output: `Judul: ${res.title}\nURL: ${res.url}\n\nKonten:\n${res.text.slice(0, 3500)}`,
        };
      } catch (err) {
        return { success: false, output: "", error: (err as Error).message };
      }
    },
  },

  create_artifact: {
    definition: {
      name: "create_artifact",
      description: "Membuat artefak nyata seperti slide presentasi (.pptx), dokumen (.docx), spreadsheet (.xlsx), atau video.",
      parameters: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            description: "Jenis artefak: 'slides' | 'document' | 'spreadsheet' | 'invoice' | 'video'",
            enum: ["slides", "document", "spreadsheet", "invoice", "video"],
          },
          prompt: { type: "string", description: "Instruksi detail isi artefak" },
        },
        required: ["kind", "prompt"],
      },
    },
    execute: async (args, context) => {
      try {
        const kind = String(args.kind || "") as SkillKind | "video";
        const prompt = String(args.prompt || "");

        if (kind === "video") {
          const res = await makeVideo(prompt, context.apiKey);
          return {
            success: true,
            output: `Video berhasil dibuat: ${res.title}. ${res.reply}`,
            artifact: (res.video as unknown) as any,
          };
        }

        const res = await runSkill(kind as SkillKind, prompt, context.apiKey);

        return {
          success: true,
          output: `Artefak ${kind} selesai dibuat. ${res.reply}`,
          artifact: res.artifact,
        };
      } catch (err) {
        return { success: false, output: "", error: (err as Error).message };
      }
    },
  },

  memory_recall: {
    definition: {
      name: "memory_recall",
      description: "Mencari catatan atau pengetahuan relevan dari sesi sebelumnya di memori semantik.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Topik atau masalah yang ingin diingat" },
        },
        required: ["query"],
      },
    },
    execute: async (args, context) => {
      try {
        const query = String(args.query || "");
        const hits = await recallSemantic(query, { apiKey: context.apiKey, topK: 3 });
        if (hits.length === 0) return { success: true, output: "Tidak ada catatan relevan di memori." };
        const text = hits
          .map((h, i) => `${i + 1}. [${h.item.topic}] (${Math.round(h.score * 100)}% relevan): ${h.item.content}`)
          .join("\n\n");
        return { success: true, output: text };
      } catch (err) {
        return { success: false, output: "", error: (err as Error).message };
      }
    },
  },

  memory_store: {
    definition: {
      name: "memory_store",
      description: "Menyimpan pengetahuan penting, solusi bug, atau preferensi ke memori jangka panjang.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "Topik / judul memori" },
          content: { type: "string", description: "Pelajaran, ringkasan, atau fakta penting untuk diingat" },
        },
        required: ["topic", "content"],
      },
    },
    execute: async (args, context) => {
      try {
        const topic = String(args.topic || "");
        const content = String(args.content || "");
        await rememberSemantic(topic, content, "solution", context.apiKey);
        return { success: true, output: `Berhasil menyimpan catatan '${topic}' ke memori jangka panjang.` };
      } catch (err) {
        return { success: false, output: "", error: (err as Error).message };
      }
    },
  },
};

export function getToolDefinitions(): AgentToolDefinition[] {
  return Object.values(AGENT_TOOLS).map((t) => t.definition);
}

export async function executeAgentTool(
  toolName: string,
  args: Record<string, any>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const tool = AGENT_TOOLS[toolName];
  if (!tool) {
    return {
      success: false,
      output: "",
      error: `Alat '${toolName}' tidak terdaftar. Alat yang tersedia: ${Object.keys(AGENT_TOOLS).join(", ")}`,
    };
  }
  return tool.execute(args, context);
}
