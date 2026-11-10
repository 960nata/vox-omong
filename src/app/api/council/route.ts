import { NextResponse } from "next/server";
import { runCouncil } from "@/lib/council";

export async function POST(req: Request) {
  try {
    const { question, apiKey } = await req.json();
    if (typeof question !== "string" || question.trim().length < 3) {
      return NextResponse.json({ success: false, error: "Pertanyaan kosong" }, { status: 400 });
    }
    return NextResponse.json({ success: true, ...(await runCouncil(question, apiKey)) });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
