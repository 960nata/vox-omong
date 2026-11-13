import { NextResponse } from "next/server";
import {
  createBackgroundTask,
  getBackgroundTask,
  listBackgroundTasks,
  cancelBackgroundTask,
} from "@/lib/agentic/taskQueue";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { task, mode = "react", projectId = "default-workspace", conversationId, apiKey } = body;

    if (!task || typeof task !== "string" || !task.trim()) {
      return NextResponse.json({ error: "Parameter 'task' wajib diisi." }, { status: 400 });
    }

    const record = await createBackgroundTask(task.trim(), {
      mode,
      projectId,
      conversationId,
      apiKey,
    });

    return NextResponse.json({
      success: true,
      task: record,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const all = searchParams.get("all");

    if (id) {
      const task = await getBackgroundTask(id);
      if (!task) {
        return NextResponse.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
      }
      return NextResponse.json({ success: true, task });
    }

    if (all === "true" || all === "1") {
      const tasks = await listBackgroundTasks();
      return NextResponse.json({ success: true, tasks: tasks.slice(0, 30) });
    }

    return NextResponse.json({ error: "Berikan query parameter ?id=<task_id> atau ?all=true" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Parameter id wajib diisi." }, { status: 400 });
    }

    const cancelled = await cancelBackgroundTask(id);
    return NextResponse.json({ success: cancelled });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
