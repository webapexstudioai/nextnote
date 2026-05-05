// Client-safe credit pack metadata. Kept separate from `@/lib/credits` so it
// can be imported into client components without pulling in supabaseAdmin.

export type CreditPack = {
  id: string;
  label: string;
  credits: number;
  bonus: number;
  priceCents: number;
  popular?: boolean;
  badge?: string;
};

export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack_500",   label: "Starter",  credits: 500,   bonus: 0,    priceCents: 500   },
  { id: "pack_2000",  label: "Standard", credits: 2000,  bonus: 200,  priceCents: 2000,  popular: true, badge: "Popular" },
  { id: "pack_5000",  label: "Pro",      credits: 5000,  bonus: 750,  priceCents: 5000,  badge: "Best value" },
  { id: "pack_15000", label: "Power",    credits: 15000, bonus: 3000, priceCents: 15000, badge: "Heavy use" },
];

export function getCreditPack(packId: string): CreditPack | null {
  return CREDIT_PACKS.find((p) => p.id === packId) ?? null;
}
