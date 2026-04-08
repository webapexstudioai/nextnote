import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthSession } from "@/lib/session";

const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_SECRET || process.env.SESSION_SECRET || "nextnote_default_encryption_key_32ch";

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(encrypted: string): string {
  const [ivHex, encHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 7) + "..." + key.slice(-4);
}

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: settings } = await supabaseAdmin
      .from("user_settings")
      .select("*")
      .eq("user_id", session.userId)
      .single();

    if (!settings) {
      return NextResponse.json({
        anthropic_api_key: null,
        openai_api_key: null,
        anthropic_connected: false,
        openai_connected: false,
        accent_color: "red-orange",
        ui_density: "default",
      });
    }

    return NextResponse.json({
      anthropic_api_key: settings.anthropic_api_key_encrypted
        ? maskKey(decrypt(settings.anthropic_api_key_encrypted))
        : null,
      openai_api_key: settings.openai_api_key_encrypted
        ? maskKey(decrypt(settings.openai_api_key_encrypted))
        : null,
      anthropic_connected: !!settings.anthropic_api_key_encrypted,
      openai_connected: !!settings.openai_api_key_encrypted,
      accent_color: settings.accent_color,
      ui_density: settings.ui_density,
    });
  } catch (err) {
    console.error("Get settings error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const updates: Record<string, string | null> = { updated_at: new Date().toISOString() };

    // Handle API keys
    if ("anthropic_api_key" in body) {
      if (body.anthropic_api_key === null || body.anthropic_api_key === "") {
        updates.anthropic_api_key_encrypted = null;
      } else {
        updates.anthropic_api_key_encrypted = encrypt(body.anthropic_api_key);
      }
    }

    if ("openai_api_key" in body) {
      if (body.openai_api_key === null || body.openai_api_key === "") {
        updates.openai_api_key_encrypted = null;
      } else {
        updates.openai_api_key_encrypted = encrypt(body.openai_api_key);
      }
    }

    // Handle customization
    if (body.accent_color) updates.accent_color = body.accent_color;
    if (body.ui_density) updates.ui_density = body.ui_density;

    // Upsert settings
    const { data: existing } = await supabaseAdmin
      .from("user_settings")
      .select("id")
      .eq("user_id", session.userId)
      .single();

    if (existing) {
      await supabaseAdmin
        .from("user_settings")
        .update(updates)
        .eq("user_id", session.userId);
    } else {
      await supabaseAdmin
        .from("user_settings")
        .insert({ user_id: session.userId, ...updates });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update settings error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
