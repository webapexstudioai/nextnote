import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAuthSession } from "@/lib/session";
import { encrypt, decrypt, maskKey } from "@/lib/crypto";

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
        preferred_provider: "anthropic",
        theme_mode: "dark",
        accent_color: "#e8553d",
        background_intensity: "balanced",
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
      preferred_provider: settings.preferred_provider || "anthropic",
      theme_mode: settings.theme_mode || "dark",
      accent_color: settings.accent_color || "#e8553d",
      background_intensity: settings.background_intensity || "balanced",
      cal_api_key: settings.cal_api_key_encrypted
        ? maskKey(decrypt(settings.cal_api_key_encrypted))
        : null,
      cal_connected: !!settings.cal_api_key_encrypted,
      cal_event_type_id: settings.cal_event_type_id || "",
      cal_timezone: settings.cal_timezone || "America/New_York",
      google_calendar_connected: !!settings.google_refresh_token_encrypted,
      google_calendar_id: settings.google_calendar_id || "primary",
      calendar_provider: settings.calendar_provider || null,
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
    const settingsUpdates: Record<string, string | null> = { updated_at: new Date().toISOString() };

    // Handle profile fields — update users table
    const profileUpdates: Record<string, string> = {};
    if (body.name !== undefined && typeof body.name === "string" && body.name.trim()) {
      profileUpdates.name = body.name.trim();
    }
    if (body.email !== undefined && typeof body.email === "string" && body.email.trim()) {
      profileUpdates.email = body.email.trim().toLowerCase();
    }
    if (body.agency_name !== undefined && typeof body.agency_name === "string") {
      profileUpdates.agency_name = body.agency_name.trim();
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from("users")
        .update(profileUpdates)
        .eq("id", session.userId);

      if (profileError) {
        console.error("Profile update error:", profileError);
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
      }

      // Update session with new values
      if (profileUpdates.name) session.name = profileUpdates.name;
      if (profileUpdates.email) session.email = profileUpdates.email;
      if (profileUpdates.agency_name) session.agencyName = profileUpdates.agency_name;
      await session.save();
    }

    // Handle API keys
    if ("anthropic_api_key" in body) {
      if (body.anthropic_api_key === null || body.anthropic_api_key === "") {
        settingsUpdates.anthropic_api_key_encrypted = null;
      } else {
        settingsUpdates.anthropic_api_key_encrypted = encrypt(body.anthropic_api_key);
      }
    }

    if ("openai_api_key" in body) {
      if (body.openai_api_key === null || body.openai_api_key === "") {
        settingsUpdates.openai_api_key_encrypted = null;
      } else {
        settingsUpdates.openai_api_key_encrypted = encrypt(body.openai_api_key);
      }
    }

    if (body.preferred_provider === "anthropic" || body.preferred_provider === "openai") {
      settingsUpdates.preferred_provider = body.preferred_provider;
    }

    if ("cal_api_key" in body) {
      if (body.cal_api_key === null || body.cal_api_key === "") {
        settingsUpdates.cal_api_key_encrypted = null;
      } else if (typeof body.cal_api_key === "string" && !body.cal_api_key.includes("...")) {
        settingsUpdates.cal_api_key_encrypted = encrypt(body.cal_api_key);
      }
    }
    if (typeof body.cal_event_type_id === "string") {
      settingsUpdates.cal_event_type_id = body.cal_event_type_id.trim() || null;
    }
    if (typeof body.cal_timezone === "string" && body.cal_timezone.trim()) {
      settingsUpdates.cal_timezone = body.cal_timezone.trim();
    }

    if (body.google_disconnect === true) {
      settingsUpdates.google_access_token_encrypted = null;
      settingsUpdates.google_refresh_token_encrypted = null;
      settingsUpdates.google_token_expiry = null;
    }
    if (typeof body.google_calendar_id === "string" && body.google_calendar_id.trim()) {
      settingsUpdates.google_calendar_id = body.google_calendar_id.trim();
    }
    if (body.calendar_provider === "cal" || body.calendar_provider === "google") {
      settingsUpdates.calendar_provider = body.calendar_provider;
    } else if (body.calendar_provider === null) {
      settingsUpdates.calendar_provider = null;
    }

    // Handle theme + appearance
    if (body.theme_mode) settingsUpdates.theme_mode = body.theme_mode;
    if (typeof body.accent_color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.accent_color)) {
      settingsUpdates.accent_color = body.accent_color.toLowerCase();
    }
    if (body.background_intensity === "minimal" || body.background_intensity === "balanced" || body.background_intensity === "cinematic") {
      settingsUpdates.background_intensity = body.background_intensity;
    }

    // Upsert settings
    const { data: existing } = await supabaseAdmin
      .from("user_settings")
      .select("id")
      .eq("user_id", session.userId)
      .single();

    if (existing) {
      await supabaseAdmin
        .from("user_settings")
        .update(settingsUpdates)
        .eq("user_id", session.userId);
    } else {
      await supabaseAdmin
        .from("user_settings")
        .insert({ user_id: session.userId, ...settingsUpdates });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update settings error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
