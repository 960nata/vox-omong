import { NextResponse } from "next/server";
import { getConversations, createConversation } from "@/lib/storage";

export async function GET() {
  try {
    const list = await getConversations();
    return NextResponse.json({ success: true, conversations: list });
  } catch (error) {
    console.error("GET /api/conversations error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch conversations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const newConv = await createConversation(body.title);
    return NextResponse.json({ success: true, conversation: newConv });
  } catch (error) {
    console.error("POST /api/conversations error:", error);
    return NextResponse.json({ success: false, error: "Failed to create conversation" }, { status: 500 });
  }
}
