import { NextResponse } from "next/server";
import { getConversation, deleteConversation } from "@/lib/storage";

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const conv = await getConversation(params.id);
    if (!conv) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, conversation: conv });
  } catch (error) {
    console.error("GET /api/conversations/[id] error:", error);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const deleted = await deleteConversation(params.id);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    console.error("DELETE /api/conversations/[id] error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
}
