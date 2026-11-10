import { NextResponse } from "next/server";
import { addMessage, getConversation } from "@/lib/storage";
import { generateAIResponse } from "@/lib/gemini";
import { detectSkill, runSkill } from "@/lib/skillAgent";
import { isDeckMessage, isDocFollowUp, isWebExplicit, type ChatTurn } from "@/lib/deckFlow";
import { detectSkillList, listSkills, skillContextFor } from "@/lib/skillHub";
import { buildWebsite, detectCodeIntent, hasGeneratedSite, readProjectHtml, restorePreviousWebsite } from "@/lib/codeAgent";
import { buildSite, editSite, hasSite, isSiteKind, readSiteFile, swapPrevSpec, understandSiteMessage, type EditOps } from "@/lib/siteAgent";
import { detectKind } from "@/lib/designKnowledge";
import { handleStackMessage, STACK_HONEST } from "@/lib/stackFlow";
import { detectBrowse, openPage } from "@/lib/browser";
import { designAdvice, detectDesignAdvice, topUxRules } from "@/lib/uiuxKnowledge";
import { answerWithDocs, detectDocsQuestion } from "@/lib/context7";
import { detectUiReview, reviewProjectUi } from "@/lib/uiReview";
import { auditProject, detectAudit, formatAudit } from "@/lib/securityAudit";
import { detectCouncil, formatCouncil, runCouncil } from "@/lib/council";
import { detectAgentTask, runAgentLoop, runAgentTeam } from "@/lib/agentCore";
import { isVideoRequest, makeVideo } from "@/lib/videoMaker";
import { planChain, runChain } from "@/lib/orchestrator";
import type { ArtifactItem } from "@/lib/types";
import { UNSUPPORTED_STACK_RE } from "@/lib/scaffold";
import { detectBrowserTask, runBrowserTask } from "@/lib/browserAgent";
import { handleEmailMessage } from "@/lib/email";
import { ACCEPT_ALL, AUTO_WORDS, briefMessage, grillQuestions, looksLikeNewRequest, needsBrief, saveBrief, takeBrief } from "@/lib/brief";
import fs from "fs/promises";
import path from "path";
import { createProject, findProject, listProjects, parseProjectCommand, slugify } from "@/lib/projects";

const USER_PROJECTS_BASE = path.join(process.cwd(), ".data", "user_projects");

function sanitizeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export const maxDuration = 300;

// "mana hasilnya", "kok gak ada preview", "tampilin dong": tampilkan ulang kartu website terbaru (jangan dijawab chatbot)
const SHOW_RESULT = /\b(mana\s+(?:hasil|preview|website|webnya)|(?:hasil|preview)(?:nya)?\s+mana|gak|ga|nggak|tidak|belum)\s+(?:ada|muncul|keluar|kelihatan)\s*(?:preview|hasil|tombol)?|\b(?:tampil(?:in|kan)|lihat|buka(?:in|kan)?)\s+(?:hasil|preview|website|webnya)\b|\bmana\s+hasil/i;

export async function POST(req: Request) {
  try {
    const {
      conversationId,
      message,
      language,
      apiKey,
      systemPrompt,
      imageUri,
      imageDataUri,
      activeProjectId: activeProjectIdRaw = "default-workspace",
    } = await req.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 });
    }

    const convId = conversationId || "conv-default";
    // Lampiran dokumen (PDF/DOCX/XLSX/...) dikirim sebagai blok <<lampiran:nama>>...<</lampiran>>.
    // Deteksi niat memakai teks user saja; isi lampiran baru ditempel setelah rute dipilih.
    const rawMessage = message.trim();
    const attachMatch = rawMessage.match(/<<lampiran:([^>\n]{1,200})>>\n?([\s\S]*?)<<\/lampiran>>/);
    const trimmedMessage = (attachMatch ? rawMessage.replace(attachMatch[0], "") : rawMessage).trim() || "Ringkas isi dokumen ini";

    // 1. Project lewat suara/teks: "buat project X", "buka project X", "daftar project" (bisa digabung dengan perintah lain)
    let createdFolderInfo: string | null = null;
    let activeProjectId = slugify(String(activeProjectIdRaw)) || "default-workspace";
    let work = trimmedMessage; // pesan yang diproses pipeline (bisa tinggal sisa kalimat setelah perintah project)
    let projectDirectReply: string | null = null;
    let projectPrefix = "";
    let projectAction: "created" | "opened" | "listed" | "missing" | null = null;

    const pcmd = parseProjectCommand(trimmedMessage);
    if (pcmd) {
      const all = await listProjects();
      const nameOf = (id: string) => all.find((p) => p.id === id)?.name || id;
      if (pcmd.type === "list") {
        projectAction = "listed";
        projectDirectReply = all.length
          ? `Ada ${all.length} project: ${all.map((p) => p.name + (p.hasSite ? " (ada website)" : "")).join(", ")}. Yang aktif sekarang: ${nameOf(activeProjectId)}.`
          : "Belum ada project. Bilang aja \"buat project\" diikuti namanya.";
      } else if (pcmd.type === "create") {
        const made = await createProject(pcmd.name);
        activeProjectId = made.id;
        projectAction = "created";
        projectPrefix = made.existed
          ? `Project ${made.name} udah ada, aku pindahin ke situ. `
          : `Project ${made.name} udah aku buat dan jadi project aktif. `;
        projectDirectReply = `${projectPrefix}Semua hasil kerja sekarang masuk ke sini. Mau bikin apa di dalamnya?`;
        createdFolderInfo = null;
      } else {
        const found = findProject(all, pcmd.name);
        if (found) {
          activeProjectId = found.id;
          projectAction = "opened";
          const info = all.find((p) => p.id === found.id);
          projectPrefix = `Oke, pindah ke project ${nameOf(found.id)}. `;
          projectDirectReply = `${projectPrefix}${info?.hasSite ? "Websitenya udah ada di sini, minta ubah apa aja." : "Belum ada website di sini. Mau bikin apa?"}`;
        } else {
          projectAction = "missing";
          projectDirectReply = `Aku gak nemu project "${pcmd.name}". ${all.length ? `Yang ada: ${all.map((p) => p.name).join(", ")}. ` : ""}Mau aku bikinin project baru dengan nama itu? Bilang "buat project ${pcmd.name}".`;
        }
      }
      // Perintah gabungan ("buat project X terus bikinin landing page"): sisa kalimatnya tetap dikerjakan di project itu
      if ("rest" in pcmd && pcmd.rest && pcmd.rest.length >= 6 && projectAction !== "missing") {
        work = pcmd.rest;
        projectDirectReply = null;
      }
    }

    // B. Check for "buat folder [nama]" inside user's active project
    const folderMatch = trimmedMessage.match(/(?:buat|bikin|create)\s+folder\s+([a-zA-Z0-9_\-\/\.]+)/i);
    if (!createdFolderInfo && folderMatch && folderMatch[1]) {
      const rawFolderName = folderMatch[1].trim();
      try {
        const safeProj = sanitizeSlug(activeProjectId) || "default-workspace";
        const projRoot = path.normalize(path.join(USER_PROJECTS_BASE, safeProj));
        const safeTarget = path.normalize(path.join(projRoot, rawFolderName));

        if (safeTarget.startsWith(projRoot)) {
          await fs.mkdir(safeTarget, { recursive: true });
          createdFolderInfo = `${rawFolderName} (di project ${safeProj})`;
        }
      } catch (err) {
        console.error("Folder creation error in user project:", err);
      }
    }

    // 2. Save user message with attached imageUri if any
    const userMsg = await addMessage(convId, {
      role: "user",
      content: rawMessage,
      imageUri: imageUri || undefined,
    });

    // 3. Retrieve conversation history for context
    const conv = await getConversation(convId);
    const history =
      conv?.messages.map((m) => ({
        role: m.role,
        content: m.content.replace(/<<lampiran:([^>\n]{1,200})>>\n?([\s\S]*?)<<\/lampiran>>/g, (_, n: string, t: string) => `[Lampiran ${n}, cuplikan: ${t.slice(0, 1500)}]`),
      })) || [];
    // Deck terakhir di chat ini: dipakai untuk mengenali pesan lanjutan ("kurang slide", "kasih gambar") dan merevisi deck yang sama
    const recentTurns: ChatTurn[] = (conv?.messages || []).slice(-8).map((m) => ({ role: m.role, content: m.content, hasSlides: !!m.artifact?.slides, hasDoc: m.artifact?.type === "pdf_document" }));
    const prevDeck = [...(conv?.messages || [])].reverse().find((m) => m.role === "assistant" && m.artifact?.slides)?.artifact?.slides;
    const prevDocArt = [...(conv?.messages || [])].reverse().find((m) => m.role === "assistant" && m.artifact?.type === "pdf_document")?.artifact;
    const prevDoc = prevDocArt?.pdfContent ? { title: prevDocArt.title || "Dokumen", subtitle: prevDocArt.summary, markdown: prevDocArt.pdfContent, theme: prevDocArt.docTheme, letter: prevDocArt.letter } : undefined;

    // 4. Coding website sungguhan (buat baru / edit / undo) atau jawaban AI biasa
    let reply: string;
    let artifact: any = undefined;
    let updatedPreviewUrl: string | null = null;

    // "daftar skill" / "skill tentang pajak": jawab langsung dari katalog
    if (projectDirectReply === null) {
      const sl = detectSkillList(work);
      if (sl) projectDirectReply = listSkills(sl.query);
    }

    // Email: draf -> konfirmasi user -> kirim (hanya setelah user bilang "kirim")
    let emailOut: { spoken?: string; suggestions?: string[] } | null = null;

    // Orkestrator: satu perintah berisi beberapa keluaran (riset + slide + video + email ...)
    let chainArtifacts: ArtifactItem[] | undefined;
    const chain = projectDirectReply === null && !imageUri ? planChain(work) : null;
    if (chain) {
      const ch = await runChain(work, chain, { apiKey, convId, history });
      projectDirectReply = ch.reply;
      chainArtifacts = ch.artifacts;
      emailOut = { spoken: ch.spoken, suggestions: ch.suggestions };
    }
    if (projectDirectReply === null) {
      try {
        const em = await handleEmailMessage({ message: work, convId, history, apiKey });
        if (em) {
          projectDirectReply = em.reply;
          emailOut = { spoken: em.spoken, suggestions: em.suggestions };
        }
      } catch (e) {
        projectDirectReply = `Fitur email error: ${(e as Error).message}`;
      }
    }

    // Brief: kalau sebelumnya AI bertanya, pesan ini dianggap jawabannya (atau permintaan baru yang jelas)
    let answers = "";
    let fromBrief = false;
    if (projectDirectReply === null) {
      const pending = await takeBrief(convId);
      if (pending) {
        if (looksLikeNewRequest(work)) {
          // permintaan baru yang lengkap: pakai apa adanya
        } else {
          fromBrief = true;
          const short = work.trim().split(/\s+/).length <= 8;
          if (pending.recommended && (ACCEPT_ALL.test(work) || (AUTO_WORDS.test(work) && short))) {
            answers = `${pending.recommended} (pelanggan menerima semua rekomendasi)`;
          } else if (AUTO_WORDS.test(work) && short) {
            answers = "(pelanggan menyerahkan semua pilihan ke AI: tentukan nama, gaya, dan bagian yang paling cocok)";
          } else {
            answers = pending.recommended ? `${work}\n(untuk hal yang tidak dijawab, pakai rekomendasi ini: ${pending.recommended})` : work;
          }
          work = pending.request;
        }
      }
    }
    let spoken: string | undefined;
    let suggestions: string[] | undefined;

    const siteExists = await hasGeneratedSite(activeProjectId);
    const composerHasSite = siteExists && (await hasSite(activeProjectId));

    // Pemahaman maksud: kalau sudah ada website, model membaca pesan + riwayat chat dan menerjemahkannya jadi aksi
    // (menangani kalimat berantakan, "gas kerjakan", "mana hasilnya", dan "rombak total")
    // Perintah alat (rapat, buka situs, cek keamanan, saran desain) dicek dari pesan ASLI dan menang atas alur website,
    // supaya tidak ditafsirkan sebagai "rombak website" lalu menimpa project.
    // Tim agent ringan: riset paralel; kalau diminta "lalu bikin slide/dokumen", hasilnya jadi bahan pipeline di bawah
    let researchNotes = ""; // ditempel ke `work` SETELAH rute dipilih, supaya kata di hasil riset tidak mengubah rute
    const agentTask = projectDirectReply === null && !fromBrief ? detectAgentTask(work) : null;
    if (agentTask) {
      const team = !agentTask.then && /^agent\s*[:,-]/i.test(work) ? await runAgentLoop(agentTask.topic, apiKey).then((r) => ({ ...r, notes: "" })) : await runAgentTeam(agentTask, apiKey);
      if (agentTask.then && team.notes) researchNotes = team.notes;
      else if (!agentTask.then) {
        projectDirectReply = team.reply;
        emailOut = { spoken: team.spoken };
      }
    }

    const toolHit = projectDirectReply === null && !fromBrief && !!(detectCouncil(work) || detectBrowse(work) || detectAudit(work) || detectDesignAdvice(work) || detectDocsQuestion(work) || detectUiReview(work));
    // Lagi di alur presentasi: pesan ini lanjutan/permintaan deck, bukan edit website (walau project punya website)
    const deckMode = projectDirectReply === null && !fromBrief && !toolHit && isDeckMessage(work, recentTurns.slice(0, -1));
    // Sama untuk dokumen: "tambahin bagian risiko" setelah dokumen jadi = revisi dokumen itu
    const docMode = !deckMode && projectDirectReply === null && !fromBrief && !toolHit && !!prevDoc && isDocFollowUp(work, recentTurns.slice(0, -1));
    // Permintaan jelas untuk invoice / tabel / dokumen / surat / slide ("buatkan invoice ..."): jangan dibajak jadi edit website
    const explicitSkill = !deckMode && !docMode && projectDirectReply === null && !fromBrief && !toolHit && !!detectSkill(work) && !isWebExplicit(work);
    const skillMode = deckMode || docMode || explicitSkill;
    let ops: EditOps | null = null;
    if (composerHasSite && projectDirectReply === null && !fromBrief && !toolHit && !skillMode) {
      const sf = await readSiteFile(activeProjectId);
      if (sf) {
        ops = await understandSiteMessage(work, history, sf, apiKey).catch(() => null);
        if (ops?.action === "rebuild") {
          answers = `${work}${ops.summary ? ` (${ops.summary})` : ""}`;
          work = sf.request;
        }
      }
    }
    const wantsUndo = skillMode ? false : ops ? ops.action === "undo" : siteExists && /\b(undo|batalin|batalkan|balikin|kembalikan)\b/i.test(work);
    const videoReq = !deckMode && !fromBrief && projectDirectReply === null && isVideoRequest(work);
    const codeIntent = skillMode || wantsUndo || videoReq
      ? null
      : fromBrief
        ? "create"
        : ops
          ? ops.action === "edit"
            ? "edit"
            : ops.action === "rebuild"
              ? "create"
              : null
          : toolHit
            ? null
            : detectCodeIntent(work, siteExists);
    const kindNow = detectKind(`${work} ${answers}`).kind;
    if (researchNotes) work = `${work}\n\nBahan riset (pakai ini, jangan mengarang data):\n${researchNotes}`;
    if (attachMatch) work = `${work}\n\nIsi lampiran "${attachMatch[1]}" (pakai sebagai sumber, jangan mengarang):\n${attachMatch[2].slice(0, 30000)}`;

    // Proyek backend + frontend terpisah (Express/Go + React/Next.js): buat, install & jalankan, cek status, matikan
    let stackFlow: Awaited<ReturnType<typeof handleStackMessage>> = null;
    if (projectDirectReply === null && !fromBrief && !skillMode && (!ops || ops.action === "chat")) {
      stackFlow = await handleStackMessage({ message: work, conversationId: convId, projectId: sanitizeSlug(activeProjectId) || "default-workspace" });
    }

    const councilQ = projectDirectReply === null && !fromBrief ? detectCouncil(work) : null;
    let councilText: string | null = null;
    let councilVerdict = "";
    if (councilQ) {
      const cr = await runCouncil(councilQ, apiKey);
      councilText = formatCouncil(cr);
      councilVerdict = cr.verdict;
    }

    // Tugas browser bertahap (buka + cari/klik/baca); pembukaan halaman biasa tetap lewat detectBrowse di bawah
    const browseTask = projectDirectReply === null && !fromBrief && !skillMode && !councilQ ? detectBrowserTask(work) : null;
    if (browseTask) {
      const run = await runBrowserTask(browseTask);
      projectDirectReply = run.reply;
      emailOut = { spoken: run.spoken };
    }

    const browseQ = projectDirectReply === null && !fromBrief && !councilQ ? detectBrowse(work) : null;
    let browseText: string | null = null;
    let browseSpoken = "";
    if (browseQ) {
      try {
        const pg = await openPage(browseQ.url, { screenshot: browseQ.screenshot });
        const gist = pg.text.replace(/\s+/g, " ").slice(0, 600);
        browseText = `Aku buka ${pg.url}\nJudul: ${pg.title || "(tanpa judul)"}\nIsi: ${gist || "(kosong)"}${pg.screenshot ? `\n\n![screenshot](${pg.screenshot})` : ""}`;
        browseSpoken = `Sudah aku buka. Judulnya ${pg.title || "tanpa judul"}.`;
      } catch (e) {
        browseText = `Gagal membuka ${browseQ.url}: ${(e as Error).message}`;
        browseSpoken = "Gagal membuka halamannya.";
      }
    }

    const auditQ = projectDirectReply === null && !fromBrief && !councilQ && !browseQ ? detectAudit(work) : null;
    let auditOut: { reply: string; spoken: string } | null = null;
    if (auditQ) {
      try {
        auditOut = formatAudit(await auditProject({ self: auditQ.self, projectId: sanitizeSlug(activeProjectId) || "default-workspace", appBase: new URL(req.url).origin }));
      } catch (e) {
        auditOut = { reply: `Cek keamanan gagal: ${(e as Error).message}`, spoken: "Cek keamanannya gagal." };
      }
    }

    const adviceQ = projectDirectReply === null && !fromBrief && !auditQ && !councilQ && !browseQ ? detectDesignAdvice(work) : null;
    const advice = adviceQ
      ? designAdvice(adviceQ) ||
        `Kategori "${adviceQ}" belum ada di data desainku, jadi ini aturan umum yang tetap berlaku:\n${topUxRules(6).map((r) => `• ${r}`).join("\n")}\n\nCoba sebut jenis usahanya lebih jelas, misalnya "saran desain untuk klinik gigi".`
      : null;

    // Pertanyaan library (cara pakai X, error Y): jawab dari dokumentasi terbaru via Context7. Tidak dipakai untuk
    // permintaan membuat website/stack (itu ditangani alurnya sendiri).
    const docsQ = projectDirectReply === null && !fromBrief && !advice && !detectUiReview(work) && !auditQ && !councilQ && !browseQ && !stackFlow ? detectDocsQuestion(work) : null;
    let docsOut: { reply: string; spoken: string } | null = null;
    if (docsQ) {
      try {
        docsOut = await answerWithDocs(docsQ.lib, docsQ.query, apiKey);
      } catch (e) {
        docsOut = null;
        console.warn("context7:", (e as Error).message);
      }
    }

    const uiReviewQ = projectDirectReply === null && !fromBrief && !auditQ && !councilQ && !browseQ && !adviceQ && detectUiReview(work);
    let uiReviewOut: { reply: string; spoken: string } | null = null;
    if (uiReviewQ) {
      try {
        uiReviewOut = await reviewProjectUi(sanitizeSlug(activeProjectId) || "default-workspace", apiKey);
      } catch (e) {
        uiReviewOut = { reply: `Review UI gagal: ${(e as Error).message}`, spoken: "Review-nya gagal." };
      }
    }

    if (uiReviewOut) {
      reply = uiReviewOut.reply;
      spoken = uiReviewOut.spoken;
    } else if (docsOut) {
      reply = docsOut.reply;
      spoken = docsOut.spoken;
    } else if (advice) {
      reply = advice;
      spoken = "Ini saran desainnya. Detailnya aku tulis di chat.";
    } else if (auditOut) {
      reply = auditOut.reply;
      spoken = auditOut.spoken;
    } else if (browseText) {
      reply = browseText;
      spoken = browseSpoken;
    } else if (councilText) {
      reply = councilText;
      spoken = `Hasil rapat. ${councilVerdict}`.slice(0, 600);
    } else if (projectDirectReply !== null) {
      reply = projectDirectReply;
      if (emailOut) {
        spoken = emailOut.spoken;
        suggestions = emailOut.suggestions;
      }
    } else if (codeIntent === "create" && !fromBrief && !ops && isSiteKind(kindNow) && needsBrief(work)) {
      // Permintaan masih kabur: tanya dulu supaya hasilnya pas
      const g = await grillQuestions(work, kindNow, apiKey);
      const b = g || briefMessage(kindNow);
      await saveBrief(convId, { request: work, projectId: activeProjectId, recommended: g?.recommended });
      reply = b.text;
      spoken = b.spoken;
      suggestions = b.suggestions;
    } else if (siteExists && !skillMode && SHOW_RESULT.test(work) && (!ops || ops.action === "chat")) {
      const sf = await readSiteFile(activeProjectId);
      const html = await readProjectHtml(activeProjectId);
      if (html) {
        const pid = sanitizeSlug(activeProjectId) || "default-workspace";
        const previewUrl = `/api/preview?projectId=${encodeURIComponent(pid)}&t=${Date.now()}`;
        reply = "Ini hasilnya. Klik tombol Preview di kartu ini buat membukanya di panel kanan.";
        spoken = "Ini hasilnya. Klik tombol Preview buat membukanya.";
        updatedPreviewUrl = previewUrl;
        artifact = {
          id: `art-web-${Date.now()}`,
          type: "website",
          title: sf ? `${sf.spec.brand}${sf.spec.tagline ? ` — ${sf.spec.tagline}` : ""}` : "Website",
          status: "completed",
          website: { html, projectId: pid, previewUrl, mode: "edit", lines: html.split("\n").length },
        };
      } else {
        reply = "Belum ada website di project ini. Bilang aja mau dibuatin apa.";
      }
    } else if (stackFlow) {
      reply = stackFlow.reply;
      spoken = stackFlow.spoken;
      suggestions = stackFlow.suggestions;
      if (stackFlow.previewUrl) updatedPreviewUrl = stackFlow.previewUrl;
    } else if (wantsUndo) {
      const restored = await restorePreviousWebsite(activeProjectId);
      if (restored) {
        await swapPrevSpec(activeProjectId);
        reply = "Oke, website-nya udah aku balikin ke versi sebelumnya.";
        updatedPreviewUrl = restored.previewUrl;
        artifact = {
          id: `art-web-${Date.now()}`,
          type: "website",
          title: "Dikembalikan ke versi sebelumnya",
          status: "completed",
          website: {
            html: restored.html,
            projectId: sanitizeSlug(activeProjectId) || "default-workspace",
            previewUrl: restored.previewUrl,
            mode: "undo",
            lines: restored.html.split("\n").length,
          },
        };
      } else {
        reply = "Belum ada versi sebelumnya yang bisa dibalikin.";
      }
    } else if (codeIntent) {
      try {
        // Website biasa dirakit dari komponen (hasil konsisten bagus); game/aplikasi/dashboard tetap kode bebas
        const useComposer = codeIntent === "create" ? isSiteKind(kindNow) : composerHasSite;
        const site = useComposer
          ? codeIntent === "create"
            ? await buildSite({ request: work, answers, projectId: activeProjectId, apiKey, forceStyle: ops?.style, forceDark: ops?.dark })
            : await editSite({ request: work, projectId: activeProjectId, apiKey, ops })
          : await buildWebsite({ request: work, mode: codeIntent, projectId: activeProjectId, apiKey, history });
        const secs = Math.round(site.durationMs / 1000);
        reply =
          site.mode === "edit"
            ? `Udah aku ubah. ${site.summary || "Perubahannya udah diterapkan."} Cek hasilnya di Preview.`
            : useComposer
              ? `Udah jadi: ${site.title}. ${site.summary} Selesai dalam ${secs} detik. Klik Preview buat lihat hasilnya. Mau diubah? Bilang aja, misalnya "ganti warna jadi hijau", "mode gelap", atau "tambah FAQ".`
              : `Udah jadi: ${site.title}. ${site.summary || ""} Tim AI rapat ${site.meeting.length} putaran${site.score ? `, skor review ${site.score}/10` : ""}, total ${site.lines} baris kode dalam ${secs} detik. Kalau mau diubah, bilang aja, misalnya "ganti warnanya jadi hijau".`.replace(/\s+/g, " ");
        if (useComposer) suggestions = site.mode === "edit" ? ["Balikin", "Mode gelap", "Tambah FAQ"] : ["Coba gaya mewah gelap", "Coba gaya modern minimalis", "Ganti warna jadi hijau", "Tambah FAQ"];
        spoken = site.mode === "edit" ? "Udah aku ubah. Klik Preview buat lihat hasilnya." : `Udah jadi, website ${site.title.split(" — ")[0]}. Klik Preview buat lihat hasilnya. Mau aku ubah apa?`;
        if (site.warnings.length) {
          // Ringkasan dari model bisa terlalu optimis; temuan mesin ditaruh paling akhir supaya tidak tertutup
          reply += ` ⚠ Perhatian: ${site.warnings.join(" ")}`;
        }
        const unsupported = work.match(UNSUPPORTED_STACK_RE)?.[1] || (ops?.wantsStack && UNSUPPORTED_STACK_RE.test(ops.wantsStack) ? ops.wantsStack : "");
        if (unsupported) {
          reply += ` Soal ${unsupported}: ${STACK_HONEST(unsupported).replace(/^Jujur ya: /, "")}`;
        }
        updatedPreviewUrl = site.previewUrl;
        artifact = {
          id: `art-web-${Date.now()}`,
          type: "website",
          title: site.title,
          summary: site.summary,
          status: "completed",
          website: {
            html: site.html,
            projectId: site.projectId,
            previewUrl: site.previewUrl,
            mode: site.mode,
            model: site.model,
            lines: site.lines,
            previousLines: site.previousLines,
            durationMs: site.durationMs,
            score: site.score,
            warnings: site.warnings,
            meeting: site.meeting,
          },
        };
      } catch (err) {
        console.error("Website build failed:", err);
        reply = `Gagal bikin kodenya: ${(err as Error).message}`;
      }
    } else if (!createdFolderInfo && videoReq) {
      try {
        const v = await makeVideo(work, apiKey);
        reply = v.reply;
        artifact = { id: `video-${v.video.id}`, type: "video", title: v.title, video: v.video, status: "completed" };
      } catch (err) {
        console.error("Video failed:", err);
        reply = `Gagal bikin video: ${(err as Error).message}`;
      }
    } else if ((skillMode || detectSkill(work)) && !createdFolderInfo) {
      const kind = deckMode ? "slides" : docMode ? "document" : detectSkill(work)!;
      try {
        const out = await runSkill(kind, work, apiKey, kind === "slides" ? { history: history.slice(-12), prevDeck } : kind === "document" ? { history: history.slice(-12), prevDoc: docMode || /\b(revisi|ubah|ganti|perbaiki|tambah)/i.test(work) ? prevDoc : undefined } : undefined);
        reply = out!.reply;
        artifact = out!.artifact;
      } catch (err) {
        console.error(`Skill ${kind} failed, falling back:`, err);
        const aiRes = await generateAIResponse({
          prompt: work,
          history,
          apiKey,
          language: language === "en-US" ? "en-US" : "id-ID",
          systemPrompt,
        });
        reply = aiRes.reply;
        artifact = aiRes.artifact;
      }
    } else {
      // Skill komunitas on-demand (katalog di lib/skillCatalog.ts); gagal = chat biasa
      const hub = createdFolderInfo ? null : await skillContextFor(work).catch(() => null);
      const aiRes = await generateAIResponse({
        skillContext: hub?.context,
        prompt: work,
        history,
        apiKey,
        language: language === "en-US" ? "en-US" : "id-ID",
        systemPrompt,
        imageUri: imageUri || undefined,
        imageDataUri: imageDataUri || undefined,
        createdFolderInfo: createdFolderInfo || undefined,
      });
      reply = aiRes.reply;
      artifact = aiRes.artifact;
    }

    // Chat biasa tidak boleh membuang potongan kode ke user yang punya website, kecuali memang diminta
    if (composerHasSite && artifact?.type === "code_diff" && !/\b(kode|code|css|html|script|snippet|sintaks)\b/i.test(trimmedMessage)) {
      artifact = undefined;
      reply = reply.replace(/```[\s\S]*?```/g, "").replace(/\n{3,}/g, "\n\n").trim();
    }
    if (projectPrefix && projectDirectReply === null) reply = projectPrefix + reply;

    // 5. Save assistant message
    const assistantMsg = await addMessage(convId, {
      role: "assistant",
      content: reply,
      artifact,
      artifacts: chainArtifacts,
    });

    return NextResponse.json({
      success: true,
      reply,
      artifact,
      createdFolder: createdFolderInfo,
      projectId: activeProjectId,
      projectAction,
      spoken,
      suggestions,
      previewUrl: updatedPreviewUrl,
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      conversationId: convId,
    });
  } catch (error) {
    console.error("POST /api/chat error:", error);
    return NextResponse.json({ success: false, error: "Failed to process chat message" }, { status: 500 });
  }
}
