import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // A. Handle JSON with base64 data URI
    if (contentType.includes("application/json")) {
      const { dataUri, filename = "upload.png" } = await req.json();

      if (!dataUri || !dataUri.startsWith("data:image/")) {
        return NextResponse.json({ success: false, error: "Invalid image data URI" }, { status: 400 });
      }

      const match = dataUri.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      if (!match) {
        return NextResponse.json({ success: false, error: "Malformed base64 image" }, { status: 400 });
      }

      const ext = match[1] === "jpeg" ? "jpg" : match[1];
      const buffer = Buffer.from(match[2], "base64");
      const name = `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${ext}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads");

      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(path.join(uploadDir, name), buffer);

      const publicUrl = `/uploads/${name}`;
      return NextResponse.json({
        success: true,
        filename: name,
        url: publicUrl,
        dataUri,
      });
    }

    // B. Handle multipart/form-data
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = path.extname(file.name) || ".png";
    const name = `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");

    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, name), buffer);

    const publicUrl = `/uploads/${name}`;
    const base64Str = buffer.toString("base64");
    const mime = file.type || "image/png";
    const dataUri = `data:${mime};base64,${base64Str}`;

    return NextResponse.json({
      success: true,
      filename: name,
      url: publicUrl,
      dataUri,
    });
  } catch (error: any) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
