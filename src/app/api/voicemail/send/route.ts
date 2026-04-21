import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";
import {
  getBalance,
  deductCredits,
  RATE_CREDITS_PER_VOICEMAIL,
} from "@/lib/credits";

interface DropTarget {
  prospect_id?: string;
  prospect_name?: string;
  phone: string;
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      return NextResponse.json({ error: "Twilio not configured" }, { status: 503 });
    }

    const { from_number, audio_url, campaign_name, targets } = await req.json();

    if (!from_number || !audio_url || !Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json(
        { error: "Missing from_number, audio_url, or targets" },
        { status: 400 }
      );
    }
    if (targets.length > 100) {
      return NextResponse.json({ error: "Maximum 100 drops per batch" }, { status: 400 });
    }

    // Verify caller ID belongs to user and is verified
    const { data: callerIdRow } = await supabaseAdmin
      .from("user_caller_ids")
      .select("*")
      .eq("user_id", session.userId)
      .eq("phone_number", from_number)
      .eq("verified", true)
      .maybeSingle();
    if (!callerIdRow) {
      return NextResponse.json(
        { error: "Caller ID not verified. Add and verify it in Settings first." },
        { status: 400 }
      );
    }

    // Dedupe + validate targets
    const seen = new Set<string>();
    const validTargets: DropTarget[] = [];
    for (const t of targets as DropTarget[]) {
      const phone = normalizePhone(String(t.phone || ""));
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      validTargets.push({ ...t, phone });
    }
    if (validTargets.length === 0) {
      return NextResponse.json({ error: "No valid phone numbers in targets" }, { status: 400 });
    }

    const totalCost = validTargets.length * RATE_CREDITS_PER_VOICEMAIL;
    const balance = await getBalance(session.userId);
    if (balance < totalCost) {
      return NextResponse.json(
        { error: "Insufficient credits", required: totalCost, balance },
        { status: 402 }
      );
    }

    // Create campaign
    const { data: campaign, error: campErr } = await supabaseAdmin
      .from("voicemail_campaigns")
      .insert({
        user_id: session.userId,
        name: campaign_name || `Drop ${new Date().toISOString().slice(0, 16)}`,
        audio_url,
        from_number,
        total_drops: validTargets.length,
      })
      .select()
      .single();
    if (campErr || !campaign) {
      return NextResponse.json(
        { error: `Failed to create campaign: ${campErr?.message}` },
        { status: 500 }
      );
    }

    // Deduct credits upfront
    await deductCredits(session.userId, totalCost, {
      reason: "voicemail_drop_batch",
      refId: campaign.id,
      metadata: { drops: validTargets.length, campaign_name: campaign.name },
    });

    // Derive public origin for Twilio callbacks
    const origin = req.nextUrl.origin;
    const authHeader = `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;

    const results: Array<{ phone: string; ok: boolean; call_sid?: string; error?: string; drop_id: string }> = [];

    for (const t of validTargets) {
      // Create drop row first so we have an ID for TwiML URL
      const { data: drop, error: dropErr } = await supabaseAdmin
        .from("voicemail_drops")
        .insert({
          campaign_id: campaign.id,
          user_id: session.userId,
          prospect_id: t.prospect_id || null,
          prospect_name: t.prospect_name || null,
          to_number: t.phone,
          from_number,
          status: "queued",
        })
        .select()
        .single();

      if (dropErr || !drop) {
        results.push({ phone: t.phone, ok: false, error: dropErr?.message || "DB error", drop_id: "" });
        continue;
      }

      try {
        const twimlUrl = `${origin}/api/voicemail/twiml/${drop.id}`;
        const statusCallback = `${origin}/api/voicemail/status/${drop.id}`;

        const body = new URLSearchParams({
          From: from_number,
          To: t.phone,
          Url: twimlUrl,
          MachineDetection: "DetectMessageEnd",
          MachineDetectionTimeout: "30",
          StatusCallback: statusCallback,
          StatusCallbackEvent: "completed",
          StatusCallbackMethod: "POST",
          Timeout: "45",
        });

        const callRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,
          {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
          }
        );
        const callData = await callRes.json();

        if (!callRes.ok) {
          await supabaseAdmin
            .from("voicemail_drops")
            .update({
              status: "failed",
              error_message: callData?.message || "Twilio rejected",
              completed_at: new Date().toISOString(),
            })
            .eq("id", drop.id);
          results.push({ phone: t.phone, ok: false, error: callData?.message || "Twilio error", drop_id: drop.id });
          continue;
        }

        await supabaseAdmin
          .from("voicemail_drops")
          .update({ twilio_call_sid: callData.sid, status: "initiated" })
          .eq("id", drop.id);

        results.push({ phone: t.phone, ok: true, call_sid: callData.sid, drop_id: drop.id });
      } catch (err: unknown) {
        await supabaseAdmin
          .from("voicemail_drops")
          .update({
            status: "failed",
            error_message: err instanceof Error ? err.message : "Unknown",
            completed_at: new Date().toISOString(),
          })
          .eq("id", drop.id);
        results.push({
          phone: t.phone,
          ok: false,
          error: err instanceof Error ? err.message : "Unknown",
          drop_id: drop.id,
        });
      }
    }

    const successful = results.filter((r) => r.ok).length;
    const failed = results.length - successful;

    await supabaseAdmin
      .from("voicemail_campaigns")
      .update({
        successful_drops: successful,
        failed_drops: failed,
        credits_spent: totalCost,
      })
      .eq("id", campaign.id);

    return NextResponse.json({
      campaign_id: campaign.id,
      total: results.length,
      successful,
      failed,
      credits_spent: totalCost,
      results,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
