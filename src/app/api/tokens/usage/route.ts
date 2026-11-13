import { NextResponse } from "next/server";
import { getUsageSummary } from "@/lib/tokenTracker";

export async function GET() {
  try {
    const summary = await getUsageSummary();
    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
