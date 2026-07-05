"use client";

import { useAvailablePartners, usePurchasePartner } from "@/hooks/usePartners";
import type { StorePartner } from "@/lib/api/store";

export function PartnerPanel() {
  const { data: partners = [], isLoading } = useAvailablePartners();
  const purchase = usePurchasePartner();

  if (isLoading || partners.length === 0) return null;

  const activePartners = partners.filter((p) => p.active);
  if (activePartners.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-300">Partner Drops</h3>
      <div className="space-y-2">
        {activePartners.map((partner) => (
          <PartnerCard
            key={partner.id}
            partner={partner}
            onPurchase={() => purchase.mutate(partner.id)}
            isPending={purchase.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function PartnerCard({
  partner,
  onPurchase,
  isPending,
}: {
  partner: StorePartner;
  onPurchase: () => void;
  isPending: boolean;
}) {
  const itemType = partner.product_type === "consumable" ? "Consumable" : "Strain";

  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900/60 p-3">
      <div className="mb-2 flex items-start gap-3">
        {partner.logo_url && (
          <img
            src={partner.logo_url}
            alt={partner.name}
            className="h-12 w-12 rounded-md bg-ink-800 object-cover"
          />
        )}
        <div className="flex-1">
          <h4 className="font-semibold text-gray-100">{partner.name}</h4>
          <p className="text-[10px] text-gray-500">{partner.tagline}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[9px] font-mono text-gray-400">
              {itemType}
            </span>
            <span className="text-[10px] font-bold text-gray-300">{partner.product_name}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-ink-700 pt-2">
        <span className="font-mono text-sm font-bold text-grow-300">{partner.price_gc} GC</span>
        <button
          onClick={onPurchase}
          disabled={isPending}
          className="rounded-md border border-grow-400/60 bg-grow-600/40 px-3 py-1.5 text-xs font-semibold text-grow-200 transition-colors hover:bg-grow-600/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Buying…" : "Buy"}
        </button>
      </div>
    </div>
  );
}
