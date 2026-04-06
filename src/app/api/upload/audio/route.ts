import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = "/tmp/nextnote-audio";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a", "audio/m4a"];
const ALLOWED_EXTS = [".mp3", ".wav", ".m4a"];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json({ error: "Only MP3, WAV, and M4A files are allowed" }, { status: 400 });
    }

    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      // Fall back to extension check which already passed
    }

    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    const uniqueId = crypto.randomBytes(8).toString("hex");
    const filename = `${uniqueId}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const url = `/api/audio/${filename}`;

    return NextResponse.json({ url, filename });
  } catch (error) {
    console.error("Audio upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
