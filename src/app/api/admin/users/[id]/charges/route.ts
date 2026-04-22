import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("stripe_customer_id")
    .eq("id", params.id)
    .single();

  if (!user?.stripe_customer_id) {
    return NextResponse.json({ charges: [] });
  }

  try {
    const charges = await stripe.charges.list({
      customer: user.stripe_customer_id,
      limit: 20,
    });

    return NextResponse.json({
      charges: charges.data.map((c) => ({
        id: c.id,
        amount: c.amount,
        currency: c.currency,
        description: c.description,
        created: c.created,
        paid: c.paid,
        refunded: c.refunded,
        amountRefunded: c.amount_refunded,
        status: c.status,
        receiptUrl: c.receipt_url,
        metadata: c.metadata,
      })),
    });
  } catch (err) {
    console.error("Fetch charges error:", err);
    return NextResponse.json({ error: "Failed to fetch charges" }, { status: 500 });
  }
}
