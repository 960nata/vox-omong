import { NextRequest, NextResponse } from "next/server";
import {
  bootEngine,
  deleteRoutine,
  listRoutines,
  nextRunOf,
  saveRoutine,
  setRoutineEnabled,
  tickRoutines,
} from "@/lib/engine";
import { allowEngineRequest } from "@/lib/engine/guard";

export const runtime = "nodejs";

const denied = () => NextResponse.json({ success: false, error: "Butuh sesi studio." }, { status: 401 });

export async function GET(req: NextRequest) {
  if (!allowEngineRequest(req)) return denied();
  const routines = await listRoutines();
  return NextResponse.json({
    success: true,
    routines: routines.map((routine) => ({
      ...routine,
      nextRunAt: nextRunOf(routine)?.toISOString() ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!allowEngineRequest(req)) return denied();
  bootEngine();
  try {
    const body = await req.json();
    const action = String(body?.action ?? "save");

    switch (action) {
      case "save": {
        const routine = await saveRoutine({
          id: body.id,
          name: String(body.name ?? "").trim() || "Routine baru",
          target: body.target,
          cron: body.cron ?? null,
          runAt: body.runAt,
          timezone: body.timezone,
          enabled: body.enabled,
          missedRunPolicy: body.missedRunPolicy,
          deliverTo: body.deliverTo,
        });
        return NextResponse.json({
          success: true,
          routine: { ...routine, nextRunAt: nextRunOf(routine)?.toISOString() ?? null },
        });
      }
      case "delete":
        return NextResponse.json({ success: await deleteRoutine(String(body.id ?? "")) });
      case "enable":
      case "disable": {
        const routine = await setRoutineEnabled(String(body.id ?? ""), action === "enable");
        if (!routine) return NextResponse.json({ success: false, error: "Routine tidak ketemu." }, { status: 404 });
        return NextResponse.json({ success: true, routine });
      }
      case "tick":
        // Dipicu dari luar: loop interval, cron OS, atau Vercel Schedules.
        return NextResponse.json({ success: true, result: await tickRoutines() });
      default:
        return NextResponse.json({ success: false, error: `Aksi "${action}" tidak dikenal.` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
