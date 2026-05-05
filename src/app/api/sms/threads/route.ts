import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/crm";

// Returns one entry per conversation. A "conversation" is keyed by prospect_id
// when the message is matched to a prospect, or by remote phone number when
// the inbound came from an unknown contact (so the user can still reply).

interface Thread {
  key: string;
  prospect_id: string | null;
  prospect_name: string | null;
  remote_number: string;
  last_message: {
    body: string;
    direction: "inbound" | "outbound";
    created_at: string;
    status: string;
  };
  unread_count: number;
}

export async function GET() {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Pull recent messages (cap reasonably large — 500 covers months of activity
  // for most users; we'll add pagination if anyone hits the ceiling).
  const { data: msgs, error } = await supabaseAdmin
    .from("sms_messages")
    .select("id, prospect_id, direction, body, to_number, from_number, status, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const threads = new Map<string, Thread>();
  const prospectIds = new Set<string>();

  for (const m of msgs ?? []) {
    const remote = m.direction === "inbound" ? m.from_number : m.to_number;
    const key = m.prospect_id ? `p:${m.prospect_id}` : `n:${remote}`;
    const existing = threads.get(key);

    if (!existing) {
      threads.set(key, {
        key,
        prospect_id: m.prospect_id,
        prospect_name: null,
        remote_number: remote,
        last_message: {
          body: m.body,
          direction: m.direction as "inbound" | "outbound",
          created_at: m.created_at,
          status: m.status,
        },
        unread_count: m.direction === "inbound" && !m.read_at ? 1 : 0,
      });
      if (m.prospect_id) prospectIds.add(m.prospect_id);
    } else if (m.direction === "inbound" && !m.read_at) {
      existing.unread_count += 1;
    }
  }

  if (prospectIds.size > 0) {
    const { data: prospects } = await supabaseAdmin
      .from("prospects")
      .select("id, name")
      .in("id", Array.from(prospectIds));
    const nameById = new Map((prospects ?? []).map((p) => [p.id, p.name]));
    Array.from(threads.values()).forEach((t) => {
      if (t.prospect_id) t.prospect_name = nameById.get(t.prospect_id) ?? null;
    });
  }

  return NextResponse.json({
    threads: Array.from(threads.values()),
    total_unread: Array.from(threads.values()).reduce((sum, t) => sum + t.unread_count, 0),
  });
}
