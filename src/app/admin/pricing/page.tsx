import {
  CREDIT_UNIT_USD_RETAIL,
  PRICING_TABLE,
  SIGNUP_BONUS_CREDITS,
} from "@/lib/credits";
import { TIERS } from "@/lib/subscriptions";
import PricingTable from "./PricingTable";

export default function PricingPage() {
  // Worst-case cost-per-credit across every billable feature. Used to compute
  // the floor margin on a subscription if a user burns all their bonus credits
  // on the costliest-per-credit feature.
  const worstCostPerCredit = PRICING_TABLE.reduce((max, e) => {
    const costPerCredit = e.estUpstreamCostUsd / e.creditsPerUnit;
    return costPerCredit > max ? costPerCredit : max;
  }, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pricing &amp; margins</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Live credit costs, upstream-API cost estimates, and current margins. Edit values in
          <code className="mx-1 rounded bg-neutral-900 px-1 py-0.5 text-[11px]">src/lib/credits.ts</code>
          and redeploy.
        </p>
      </div>

      <PricingTable entries={PRICING_TABLE} retail={CREDIT_UNIT_USD_RETAIL} />

      <section>
        <div className="mb-3 text-xs uppercase tracking-wider text-neutral-500">Subscriptions</div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.keys(TIERS) as Array<keyof typeof TIERS>).map((key) => {
            const t = TIERS[key];
            const priceUsd = t.monthlyPriceCents / 100;
            const retailValue = t.bonusCredits * CREDIT_UNIT_USD_RETAIL;
            const worstCost = t.bonusCredits * worstCostPerCredit;
            const floorMargin = priceUsd - worstCost;
            const floorMarginPct = priceUsd > 0 ? (floorMargin / priceUsd) * 100 : 0;
            const effectivePerCredit = t.bonusCredits > 0 ? priceUsd / t.bonusCredits : 0;
            return (
              <div
                key={key}
                className="rounded-xl border border-neutral-900 bg-neutral-950 p-5"
              >
                <div className="flex items-baseline justify-between">
                  <div className="text-base font-medium capitalize text-neutral-100">{t.name}</div>
                  <div className="font-mono text-xl text-neutral-100">
                    ${priceUsd.toFixed(0)}
                    <span className="text-xs text-neutral-500">/mo</span>
                  </div>
                </div>
                <div className="mt-0.5 text-[11px] text-neutral-500">{t.tagline}</div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <dt className="text-neutral-500">Credits included</dt>
                  <dd className="text-right font-mono text-neutral-300">
                    {t.bonusCredits.toLocaleString()}
                  </dd>

                  <dt className="text-neutral-500">Retail value of credits</dt>
                  <dd className="text-right font-mono text-neutral-400">
                    ${retailValue.toFixed(2)}
                  </dd>

                  <dt className="text-neutral-500">Effective $/credit paid</dt>
                  <dd className="text-right font-mono text-neutral-400">
                    ${effectivePerCredit.toFixed(3)}
                  </dd>

                  <dt className="text-neutral-500">Worst-case upstream cost</dt>
                  <dd
                    className="text-right font-mono text-neutral-400"
                    title="If every included credit is spent on the costliest-per-credit feature."
                  >
                    ${worstCost.toFixed(2)}
                  </dd>

                  <dt className="text-neutral-500">Floor margin</dt>
                  <dd className="text-right font-mono">
                    <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                      ${floorMargin.toFixed(2)} ({floorMarginPct.toFixed(0)}%)
                    </span>
                  </dd>
                </dl>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Monthly $ prices here are for display only. The authoritative price is whatever the
          Stripe product is set to (env
          <code className="mx-1 rounded bg-neutral-900 px-1 py-0.5 text-[11px]">STRIPE_PRICE_STARTER</code>
          /
          <code className="mx-1 rounded bg-neutral-900 px-1 py-0.5 text-[11px]">STRIPE_PRICE_PRO</code>).
          Keep them in sync by editing
          <code className="mx-1 rounded bg-neutral-900 px-1 py-0.5 text-[11px]">monthlyPriceCents</code>
          in <code className="mx-1 rounded bg-neutral-900 px-1 py-0.5 text-[11px]">src/lib/subscriptions.ts</code>.
        </p>
      </section>

      <section>
        <div className="mb-3 text-xs uppercase tracking-wider text-neutral-500">Ad-hoc top-ups</div>
        <div className="rounded-xl border border-neutral-900 bg-neutral-950 p-5">
          <p className="text-sm text-neutral-300">
            Users buy credits one-off at a flat{" "}
            <span className="font-mono text-neutral-100">${CREDIT_UNIT_USD_RETAIL.toFixed(2)}/credit</span>
            {" "}via <code className="mx-1 rounded bg-neutral-900 px-1 py-0.5 text-[11px]">/api/credits/topup</code>.
            Stripe&apos;s $0.50 minimum forces a 50-credit floor. No volume discount.
          </p>
        </div>
      </section>

      <div className="rounded-xl border border-neutral-900 bg-neutral-950 p-5">
        <div className="text-xs uppercase tracking-wider text-neutral-500">Signup bonus</div>
        <div className="mt-2 flex items-baseline gap-3">
          <div className="font-mono text-2xl text-neutral-100">
            {SIGNUP_BONUS_CREDITS.toLocaleString()}
          </div>
          <div className="text-sm text-neutral-500">
            credits = ${(SIGNUP_BONUS_CREDITS * CREDIT_UNIT_USD_RETAIL).toFixed(2)} retail value — actual cost depends
            on what the new user spends them on.
          </div>
        </div>
      </div>
    </div>
  );
}
