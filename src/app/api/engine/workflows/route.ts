import { NextRequest, NextResponse } from "next/server";
import {
  bootEngine,
  deleteWorkflow,
  exportWorkflow,
  getWorkflow,
  importWorkflow,
  listRuns,
  listWorkflows,
  planWorkflow,
  runWorkflow,
  saveWorkflow,
  setWorkflowPaused,
} from "@/lib/engine";
import { allowEngineRequest } from "@/lib/engine/guard";

export const runtime = "nodejs";

const denied = () => NextResponse.json({ success: false, error: "Butuh sesi studio." }, { status: 401 });
const failed = (error: unknown) =>
  NextResponse.json(
    { success: false, error: error instanceof Error ? error.message : String(error) },
    { status: 400 }
  );

export async function GET(req: NextRequest) {
  if (!allowEngineRequest(req)) return denied();
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (searchParams.get("runs") !== null) {
      return NextResponse.json({ success: true, runs: await listRuns(id ?? undefined) });
    }
    if (id) {
      const workflow = await getWorkflow(id);
      if (!workflow) return NextResponse.json({ success: false, error: "Workflow tidak ketemu." }, { status: 404 });
      return NextResponse.json({
        success: true,
        workflow,
        // Gelombang step: yang satu baris boleh jalan paralel.
        plan: planWorkflow(workflow).map((wave) => wave.map((step) => step.id)),
      });
    }
    return NextResponse.json({ success: true, workflows: await listWorkflows() });
  } catch (error) {
    return failed(error);
  }
}

export async function POST(req: NextRequest) {
  if (!allowEngineRequest(req)) return denied();
  bootEngine();
  try {
    const body = await req.json();
    const action = String(body?.action ?? "save");

    switch (action) {
      case "save": {
        const workflow = await saveWorkflow({
          id: body.id,
          name: String(body.name ?? "").trim() || "Workflow baru",
          description: body.description,
          steps: Array.isArray(body.steps) ? body.steps : [],
          trigger: body.trigger,
          paused: body.paused,
        });
        return NextResponse.json({ success: true, workflow });
      }
      case "delete":
        return NextResponse.json({ success: await deleteWorkflow(String(body.id ?? "")) });
      case "pause":
      case "resume": {
        const workflow = await setWorkflowPaused(String(body.id ?? ""), action === "pause");
        if (!workflow) return NextResponse.json({ success: false, error: "Workflow tidak ketemu." }, { status: 404 });
        return NextResponse.json({ success: true, workflow });
      }
      case "export": {
        const workflow = await getWorkflow(String(body.id ?? ""));
        if (!workflow) return NextResponse.json({ success: false, error: "Workflow tidak ketemu." }, { status: 404 });
        return NextResponse.json({ success: true, bundle: exportWorkflow(workflow) });
      }
      case "import": {
        const workflow = await importWorkflow(body.bundle);
        return NextResponse.json({ success: true, workflow });
      }
      case "run": {
        const workflow = await getWorkflow(String(body.id ?? ""));
        if (!workflow) return NextResponse.json({ success: false, error: "Workflow tidak ketemu." }, { status: 404 });
        const previous = body.previousRunId
          ? (await listRuns(workflow.id)).find((r) => r.id === body.previousRunId)
          : undefined;
        const run = await runWorkflow(workflow, {
          triggerFields: body.triggerFields,
          fromStep: body.fromStep,
          previous,
        });
        return NextResponse.json({ success: true, run });
      }
      default:
        return NextResponse.json({ success: false, error: `Aksi "${action}" tidak dikenal.` }, { status: 400 });
    }
  } catch (error) {
    return failed(error);
  }
}
