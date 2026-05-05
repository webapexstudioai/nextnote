import { NextResponse } from "next/server";

// The "buy a NextNote-owned phone line" feature has been retired.
// Outreach now uses each user's verified personal caller-id (see
// /api/voicemail/caller-ids) for ringless voicemail drops, which is what
// the product did before the agency-line experiment.
//
// Existing paying customers keep their numbers — only new purchases are
// blocked. Manage/release routes still respond normally.

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Buying a NextNote phone line is no longer offered. Verify your personal phone in Settings to send ringless voicemails from your own number.",
      code: "retired",
    },
    { status: 410 },
  );
}
