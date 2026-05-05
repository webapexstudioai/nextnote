import { NextResponse } from "next/server";

// The "claim a free agency line" trial has been retired alongside the
// paid agency-phone feature. Outreach now uses each user's verified
// personal caller-id for ringless voicemails (which is how it worked
// before the agency-line experiment).

export async function POST() {
  return NextResponse.json(
    {
      error:
        "The phone-line trial is no longer available. Verify your personal phone in Settings to send ringless voicemails from your own number.",
      code: "retired",
    },
    { status: 410 },
  );
}
