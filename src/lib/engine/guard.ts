import { hasStudioSession } from "@/lib/studioAuth";

/**
 * Route mesin bisa menjalankan agent dan menulis berkas project, jadi pakai penjaga yang sama
 * dengan `/api/chat`: kalau `STUDIO_PIN` diisi, request wajib membawa sesi studio.
 */
export function allowEngineRequest(req: Request): boolean {
  return !process.env.STUDIO_PIN?.trim() || hasStudioSession(req);
}
