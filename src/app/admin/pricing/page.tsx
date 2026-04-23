import {
  CREDIT_PACKS,
  CREDIT_UNIT_USD_FLOOR,
  CREDIT_UNIT_USD_RETAIL,
  PRICING_TABLE,
  SIGNUP_BONUS_CREDITS,
} from "@/lib/credits";
import { TIERS } from "@/lib/subscriptions";
import PricingTable from "./PricingTable";

export default function PricingPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pricing &amp; margins</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Live credit costs, upstream-API cost estimates, and current margins. Edit the values in
          <code className="mx-1 rounded bg-neutral-900 px-1 py-0.5 text-[11px]">src/lib/credits.ts</code>
          and redeploy to change them.
        </p>
      </div>

      <PricingTable
        entries={PRICING_TABLE}
        retail={CREDIT_UNIT_USD_RETAIL}
        floor={CREDIT_UNIT_USD_FLOOR}
      />

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-900 bg-neutral-950 p-5">
          <div className="text-xs uppercase tracking-wider text-neutral-500">Credit packs</div>
          <table className="mt-3 w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="pb-2 text-left font-medium">Pack</th>
                <th className="pb-2 text-right font-medium">Credits</th>
                <th className="pb-2 text-right font-medium">Price</th>
                <th className="pb-2 text-right font-medium">$/credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {CREDIT_PACKS.map((p) => {
                const perCredit = p.priceCents / 100 / p.credits;
                return (
                  <tr key={p.id}>
                    <td className="py-2 text-neutral-200">{p.name}</td>
                    <td className="py-2 text-right font-mono text-neutral-300">
                      {p.credits.toLocaleString()}
                    </td>
                    <td className="py-2 text-right font-mono text-neutral-300">
                      ${(p.priceCents / 100).toFixed(2)}
                    </td>
                    <td className="py-2 text-right font-mono text-neutral-400">
                      ${perCredit.toFixed(4)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-neutral-900 bg-neutral-950 p-5">
          <div className="text-xs uppercase tracking-wider text-neutral-500">Subscriptions</div>
          <table className="mt-3 w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="pb-2 text-left font-medium">Tier</th>
                <th className="pb-2 text-right font-medium">Monthly credit bonus</th>
                <th className="pb-2 text-right font-medium">Retail value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {(Object.keys(TIERS) as Array<keyof typeof TIERS>).map((key) => {
                const t = TIERS[key];
                return (
                  <tr key={key}>
                    <td className="py-2 capitalize text-neutral-200">{t.name}</td>
                    <td className="py-2 text-right font-mono text-neutral-300">
                      {t.bonusCredits.toLocaleString()}
                    </td>
                    <td className="py-2 text-right font-mono text-neutral-400">
                      ${((t.bonusCredits * CREDIT_UNIT_USD_RETAIL)).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-neutral-500">
            Monthly $ prices are set in Stripe (env
            <code className="mx-1 rounded bg-neutral-900 px-1 py-0.5 text-[11px]">STRIPE_PRICE_STARTER</code>
            and
            <code className="mx-1 rounded bg-neutral-900 px-1 py-0.5 text-[11px]">STRIPE_PRICE_PRO</code>).
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
            credits = ${(SIGNUP_BONUS_CREDITS * CREDIT_UNIT_USD_RETAIL).toFixed(2)} retail value — cost
            depends on what the new user spends them on.
          </div>
        </div>
      </div>
    </div>
  );
}
