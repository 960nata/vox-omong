import { NextResponse } from "next/server";
import { auditProject } from "@/lib/securityAudit";

export async function POST(req: Request) {
  try {
    const { projectId, self } = await req.json();
    const appBase = new URL(req.url).origin;
    return NextResponse.json({ success: true, ...(await auditProject({ projectId, self: !!self, appBase })) });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 400 });
  }
}
