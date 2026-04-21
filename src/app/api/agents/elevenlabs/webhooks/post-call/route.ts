import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  deductCredits,
  getBalance,
  hasBeenProcessed,
  RATE_CREDITS_PER_MIN,
} from "@/lib/credits";

/**
 * ElevenLabs post-call webhook. Configured in the ElevenLabs dashboard to POST
 * here when a conversation finishes. Deducts credits based on billed minutes.
 *
 * Secured with a shared secret sent in `X-NextNote-Secret` — set the same value
 * in ElevenLabs → Settings → Webhooks → Custom Header.
 *
 * Idempotent: credit_transactions.ref_id = conversation_id, so replays no-op.
 */
export async function POST(req: NextRequest) {
  try {
    const expected = process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (!expected) {
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }
    const provided = req.headers.get("x-nextnote-secret") || req.headers.get("x-elevenlabs-secret");
    if (provided !== expected) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    // ElevenLabs wraps conversation info under `data` for post_call_transcription.
    const data = (body?.data ?? body) as Record<string, unknown>;
    const meta = (data?.metadata ?? {}) as Record<string, unknown>;

    const agentId = (data?.agent_id as string) || (body?.agent_id as string) || "";
    const conversationId =
      (data?.conversation_id as string) ||
      (body?.conversation_id as string) ||
      "";
    const durationSecs =
      (meta?.call_duration_secs as number | undefined) ??
      (data?.call_duration_secs as number | undefined) ??
      (body?.call_duration_secs as number | undefined) ??
      0;

    if (!agentId || !conversationId) {
      return NextResponse.json({ error: "Missing agent_id or conversation_id" }, { status: 400 });
    }

    // Idempotency — ElevenLabs retries on 5xx/timeout.
    const refId = `call:${conversationId}`;
    if (await hasBeenProcessed(refId)) {
      return NextResponse.json({ success: true, already_processed: true });
    }

    // Find the owning user.
    const { data: owner } = await supabaseAdmin
      .from("user_agents")
      .select("user_id")
      .eq("elevenlabs_agent_id", agentId)
      .maybeSingle();
    if (!owner?.user_id) {
      // Not one of ours — likely the shared platform agent; acknowledge so ElevenLabs stops retrying.
      return NextResponse.json({ success: true, skipped: "agent_not_owned" });
    }

    const secs = Math.max(0, Math.round(Number(durationSecs) || 0));
    if (secs === 0) {
      return NextResponse.json({ success: true, skipped: "zero_duration" });
    }
    const minutes = Math.ceil(secs / 60);
    const cost = minutes * RATE_CREDITS_PER_MIN;

    // Can't refuse a call that already happened — charge what they have, log any shortfall.
    const balance = await getBalance(owner.user_id);
    const charge = Math.min(balance, cost);
    const shortfall = cost - charge;

    if (charge > 0) {
      await deductCredits(owner.user_id, charge, {
        reason: "voice_call",
        refId,
        metadata: {
          conversation_id: conversationId,
          agent_id: agentId,
          duration_secs: secs,
          minutes_billed: minutes,
          rate_per_min: RATE_CREDITS_PER_MIN,
          shortfall,
        },
      });
    } else {
      // Still write a zero-delta log so hasBeenProcessed returns true on retry.
      // addCredits rejects zero, so use a tiny trick: log via a separate insert.
      await supabaseAdmin.from("credit_transactions").insert({
        user_id: owner.user_id,
        delta: 0,
        reason: "voice_call_uncollectible",
        ref_id: refId,
        metadata: {
          conversation_id: conversationId,
          agent_id: agentId,
          duration_secs: secs,
          minutes_billed: minutes,
          rate_per_min: RATE_CREDITS_PER_MIN,
          shortfall,
        },
      });
    }

    return NextResponse.json({
      success: true,
      charged: charge,
      shortfall,
      minutes_billed: minutes,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Webhook failed";
    console.error("post-call webhook error:", msg);
    // Return 500 so ElevenLabs retries transient errors. Don't leak internals.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
