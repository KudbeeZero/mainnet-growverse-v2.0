"use client";

import { useAvailableBundles, usePurchaseBundle } from "@/hooks/useBundles";
import type { StoreBundle } from "@/lib/api/store";

export function BundlePanel() {
  const { data: bundles = [], isLoading } = useAvailableBundles();
  const purchase = usePurchaseBundle();

  if (isLoading || bundles.length === 0) return null;

  const activeBundles = bundles.filter((b) => b.active);
  if (activeBundles.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-300">Bundle Deals</h3>
      <div className="space-y-2">
        {activeBundles.map((bundle) => (
          <BundleCard key={bundle.id} bundle={bundle} onPurchase={() => purchase.mutate(bundle.id)} isPending={purchase.isPending} />
        ))}
      </div>
    </div>
  );
}

function BundleCard({
  bundle,
  onPurchase,
  isPending,
}: {
  bundle: StoreBundle;
  onPurchase: () => void;
  isPending: boolean;
}) {
  const discountSavings = bundle.full_price - bundle.bundle_price;
  const discountLabel = `${bundle.discount_pct}% off`;

  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900/60 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-100">{bundle.name}</h4>
            <span className="rounded bg-grow-600/40 px-1.5 py-0.5 text-[10px] font-bold text-grow-300">
              {discountLabel}
            </span>
          </div>
          <p className="text-[11px] text-gray-500">{bundle.description}</p>
        </div>
      </div>

      <div className="mb-2 space-y-1 border-t border-ink-700 pt-2">
        {bundle.components.map((comp) => (
          <div key={comp.key} className="flex items-center justify-between text-[11px]">
            <span className="text-gray-300">{comp.name || comp.key}</span>
            <span className="text-gray-500">×{comp.qty}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-ink-700 pt-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-bold text-grow-300">{bundle.bundle_price}</span>
          <span className="text-[10px] text-gray-500 line-through">{bundle.full_price}</span>
          <span className="text-[10px] text-gray-500">save {discountSavings}</span>
        </div>
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
