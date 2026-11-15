import { NextRequest, NextResponse } from "next/server";
import {
  listInstalledSkills,
  installSkill,
  installAllFromCache,
  installFromCatalog,
  uninstallSkill,
  searchSkills,
  hasInstalledSkill,
} from "@/lib/skillInstaller";
import { executeSkillDirect, getPlaybook } from "@/lib/skillEngine";
import { loadSkill, loadSkillMetadata } from "@/lib/skillLoader";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const name = searchParams.get("name") || "";

    if (name) {
      const meta = loadSkillMetadata(name);
      const content = loadSkill(name);
      if (!content) {
        return NextResponse.json({ success: false, error: `Skill "${name}" tidak ditemukan.` }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        skill: {
          name,
          ...meta,
          content,
          isInstalled: true,
        },
      });
    }

    if (query) {
      const searchRes = await searchSkills(query);
      return NextResponse.json({ success: true, ...searchRes });
    }

    const installed = await listInstalledSkills();
    return NextResponse.json({
      success: true,
      totalInstalled: installed.length,
      installed,
    });
  } catch (error) {
    console.error("GET /api/skills error:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";

    switch (action) {
      case "install_all": {
        const res = await installAllFromCache();
        const currentList = await listInstalledSkills();
        return NextResponse.json({
          success: true,
          message: `Berhasil menginstal ${res.installedCount} skill ke folder skills/. (${res.skippedCount} dilewati).`,
          installedCount: res.installedCount,
          totalInstalled: currentList.length,
          skills: res.installedSkills,
        });
      }

      case "install": {
        const skillName = body.skill || body.name;
        if (!skillName) {
          return NextResponse.json({ success: false, error: "Parameter 'skill' atau 'name' wajib diisi." }, { status: 400 });
        }

        // Jika diberikan konten langsung
        if (body.content) {
          const res = await installSkill({
            name: skillName,
            content: body.content,
            description: body.description,
            repo: body.repo,
            license: body.license,
          });
          return NextResponse.json(res);
        }

        const res = await installFromCatalog(skillName);
        return NextResponse.json(res);
      }

      case "uninstall": {
        const skillName = body.skill || body.name;
        if (!skillName) {
          return NextResponse.json({ success: false, error: "Parameter 'skill' wajib diisi." }, { status: 400 });
        }
        const res = await uninstallSkill(skillName);
        return NextResponse.json(res);
      }

      case "run":
      case "execute": {
        const skillName = body.skill || body.name;
        const prompt = body.prompt || body.message;
        if (!skillName || !prompt) {
          return NextResponse.json(
            { success: false, error: "Parameter 'skill' dan 'prompt' wajib diisi untuk eksekusi." },
            { status: 400 }
          );
        }

        const result = await executeSkillDirect({
          skillName,
          prompt,
          input: body.input,
          history: body.history,
          apiKey: body.apiKey,
          language: body.language || "id-ID",
          mode: body.mode || "fast",
        });

        return NextResponse.json({
          success: true,
          result,
        });
      }

      case "search": {
        const query = body.query || body.q || "";
        const searchRes = await searchSkills(query);
        return NextResponse.json({ success: true, ...searchRes });
      }

      default: {
        const installed = await listInstalledSkills();
        return NextResponse.json({
          success: true,
          totalInstalled: installed.length,
          installed,
        });
      }
    }
  } catch (error) {
    console.error("POST /api/skills error:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
