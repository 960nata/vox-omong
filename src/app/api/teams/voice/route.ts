import { chatTeamMember, TeamError } from "@/lib/agentTeams";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const input: unknown = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new TeamError("Body JSON tidak valid");
    body = input as Record<string, unknown>;
    if (typeof body.teamId !== "string" || !/^[a-f0-9-]{36}$/.test(body.teamId)) throw new TeamError("teamId tidak valid");
    if (typeof body.memberId !== "string" || !/^[a-f0-9-]{36}$/.test(body.memberId)) throw new TeamError("memberId tidak valid");
    if (typeof body.message !== "string" || !body.message.trim() || body.message.trim().length > 6000) throw new TeamError("Pesan wajib diisi dan maksimal 6.000 karakter");
    if (body.apiKey !== undefined && (typeof body.apiKey !== "string" || body.apiKey.length > 1024)) throw new TeamError("API key tidak valid");
  } catch (error) {
    return Response.json({ success: false, error: error instanceof TeamError ? error.message : "Body JSON tidak valid" }, { status: 400 });
  }

  const teamId = body.teamId as string;
  const memberId = body.memberId as string;
  const message = body.message as string;
  const apiKey = typeof body.apiKey === "string" && body.apiKey.trim().length > 0 ? body.apiKey.trim() : undefined;
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: unknown) => {
        if (closed || request.signal.aborted) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); }
        catch { closed = true; }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* The reader may have disconnected. */ }
      };
      const abort = () => close();
      request.signal.addEventListener("abort", abort, { once: true });
      // One invocation only. Disconnecting stops output, never starts a replacement/billed retry.
      void chatTeamMember(teamId, memberId, message, apiKey, (text) => emit({ type: "text", text }))
        .then((team) => emit({ type: "team", team }))
        .catch((error: unknown) => {
          let detail = error instanceof Error ? error.message : "Percakapan suara gagal";
          if (apiKey) detail = detail.split(apiKey).join("[API key]");
          detail = detail.replace(/([?&]key=)[^&\s]+/gi, "$1[redacted]").slice(0, 600);
          emit({ type: "error", error: detail });
        })
        .finally(() => {
          request.signal.removeEventListener("abort", abort);
          close();
        });
    },
    cancel() { closed = true; },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
