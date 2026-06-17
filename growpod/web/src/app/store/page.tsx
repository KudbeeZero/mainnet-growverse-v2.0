"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingBlock } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import {
  useStorePartners,
  useStoreFeatured,
  useStoreBundles,
  useSeasonalStrains,
} from "@/hooks/queries";
import { useSession } from "@/lib/session";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { StorePartner, StoreBundle, FeaturedItem } from "@/lib/api/store";

function gcFmt(v: number) {
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K GC`;
  return `${v.toFixed(0)} GC`;
}

function rarityColor(rarity: string) {
  if (rarity === "legendary") return "text-yellow-400";
  if (rarity === "epic") return "text-purple-400";
  if (rarity === "rare") return "text-blue-400";
  if (rarity === "uncommon") return "text-green-400";
  return "text-gray-400";
}

function BadgeChip({ badge }: { badge: string }) {
  const map: Record<string, string> = {
    seasonal: "bg-amber-700/60 text-amber-200",
    limited: "bg-red-800/60 text-red-200",
    new: "bg-grow-700/60 text-grow-200",
  };
  const cls = map[badge] ?? "bg-gray-700/60 text-gray-300";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-widest font-semibold ${cls}`}>
      {badge}
    </span>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-2xl">{icon}</span>
      <div>
        <h2 className="text-lg font-bold text-gray-100">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function FeaturedShelf() {
  const featured = useStoreFeatured();
  const seasonal = useSeasonalStrains();
  const { playerId, isAuthed } = useSession();
  const qc = useQueryClient();
  const [buying, setBuying] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const seasonalItems = (seasonal.data ?? []).map((s) => ({
    id: `seasonal-${s.id}`,
    item_type: "seasonal" as const,
    item_id: s.id,
    label: `${s.strain_name} — Seasonal drop · ${gcFmt(s.price_gc)}`,
    badge: "seasonal" as const,
    valid_through: null,
    price_gc: s.price_gc,
    strain_id: s.strain_id,
  }));

  const pinnedItems = (featured.data ?? []).map((f: FeaturedItem) => ({
    ...f,
    price_gc: null as number | null,
    strain_id: null as string | null,
  }));

  const allItems = [...pinnedItems, ...seasonalItems];

  if (featured.isLoading) return <LoadingBlock />;
  if (allItems.length === 0) return null;

  async function buySeasonal(seasonalId: string, strainId: string, label: string) {
    if (!isAuthed || !playerId) return;
    setBuying(seasonalId);
    setMsg(null);
    try {
      await api.seasonal.purchase(playerId, seasonalId);
      await qc.invalidateQueries({ queryKey: queryKeys.seeds(playerId) });
      setMsg(`✓ ${label} added to your seed inventory`);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBuying(null);
    }
  }

  return (
    <section>
      <SectionHeader icon="⭐" title="This Week's Drops" subtitle="Curated picks — seasonal and limited items" />
      <div className="flex gap-4 overflow-x-auto pb-2">
        {allItems.map((item) => (
          <div
            key={item.id}
            className="shrink-0 w-56 rounded-xl border border-ink-700 bg-ink-900/70 p-4 flex flex-col gap-3 hover:border-grow-600 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <BadgeChip badge={item.badge} />
            </div>
            <p className="text-sm text-gray-200 leading-snug">{item.label}</p>
            {item.price_gc != null && (
              <div className="font-mono text-grow-300 text-sm">{gcFmt(item.price_gc)}</div>
            )}
            {"strain_id" in item && item.strain_id && item.price_gc != null && isAuthed && (
              <button
                onClick={() => buySeasonal(item.item_id, item.strain_id!, item.label)}
                disabled={buying === item.item_id}
                className="mt-auto rounded bg-grow-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-grow-600 disabled:opacity-50"
              >
                {buying === item.item_id ? "Buying…" : "Buy Seeds"}
              </button>
            )}
          </div>
        ))}
      </div>
      {msg && (
        <p className={`mt-2 text-xs ${msg.startsWith("✓") ? "text-grow-400" : "text-red-400"}`}>
          {msg}
        </p>
      )}
    </section>
  );
}

function PartnerCard({ partner }: { partner: StorePartner }) {
  const { playerId, isAuthed } = useSession();
  const qc = useQueryClient();
  const [buying, setBuying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function buy() {
    if (!isAuthed || !playerId) return;
    setBuying(true);
    setMsg(null);
    try {
      await api.store.purchasePartner(playerId, partner.id);
      await qc.invalidateQueries({ queryKey: queryKeys.seeds(playerId) });
      setMsg(`✓ Added to your inventory`);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBuying(false);
    }
  }

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/70 p-5 flex flex-col gap-4 hover:border-amber-600/50 transition-colors">
      <div className="flex items-center gap-3">
        <img
          src={partner.logo_url}
          alt={partner.name}
          className="w-12 h-12 rounded-lg object-cover shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-100 truncate">{partner.name}</h3>
          <p className="text-[11px] text-gray-500 truncate">{partner.tagline}</p>
        </div>
        <span className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-widest bg-amber-700/40 text-amber-300 font-semibold">
          Partner
        </span>
      </div>
      <div className="rounded-lg border border-ink-700 bg-ink-800/50 px-3 py-2">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">Featured product</p>
        <p className="text-sm text-gray-200">{partner.product_name}</p>
        <p className="text-[10px] text-gray-500 capitalize">{partner.product_type}</p>
      </div>
      <div className="flex items-center justify-between gap-3 mt-auto">
        <span className="font-mono text-grow-300 font-bold">{gcFmt(partner.price_gc)}</span>
        {isAuthed ? (
          <button
            onClick={buy}
            disabled={buying}
            className="rounded bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {buying ? "Buying…" : "Buy"}
          </button>
        ) : (
          <span className="text-xs text-gray-500">Sign in to buy</span>
        )}
      </div>
      {msg && (
        <p className={`text-xs ${msg.startsWith("✓") ? "text-grow-400" : "text-red-400"}`}>{msg}</p>
      )}
    </div>
  );
}

function PartnerDropsSection() {
  const partners = useStorePartners();
  if (partners.isLoading) return <LoadingBlock />;
  if (!partners.data?.length) return null;
  return (
    <section>
      <SectionHeader icon="🤝" title="Partner Drops" subtitle="Featured products from dispensary partners" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {partners.data.map((p) => <PartnerCard key={p.id} partner={p} />)}
      </div>
    </section>
  );
}

function BundleCard({ bundle }: { bundle: StoreBundle }) {
  const { playerId, isAuthed } = useSession();
  const qc = useQueryClient();
  const [buying, setBuying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function buy() {
    if (!isAuthed || !playerId) return;
    setBuying(true);
    setMsg(null);
    try {
      const res = await api.store.purchaseBundle(playerId, bundle.id);
      await qc.invalidateQueries({ queryKey: queryKeys.seeds(playerId) });
      setMsg(`✓ ${res.purchased} purchased — ${res.items_delivered.length} items delivered`);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBuying(false);
    }
  }

  const savePct = Math.round(bundle.discount_pct * 100);

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-100">{bundle.name}</h3>
            <span className="rounded px-1.5 py-0.5 text-[9px] uppercase tracking-widest bg-grow-700/60 text-grow-200 font-semibold">
              Save {savePct}%
            </span>
          </div>
          <p className="text-xs text-gray-500">{bundle.description}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-grow-300 font-bold text-lg">{gcFmt(bundle.bundle_price)}</div>
          <div className="font-mono text-gray-600 text-xs line-through">{gcFmt(bundle.full_price)}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {bundle.components.map((c, i) => (
          <span key={i} className="rounded border border-ink-700 bg-ink-800 px-2 py-1 text-xs text-gray-300">
            {c.qty > 1 ? `${c.qty}× ` : ""}{c.name ?? c.key}
          </span>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        {isAuthed ? (
          <button
            onClick={buy}
            disabled={buying}
            className="rounded bg-grow-700 px-4 py-2 text-sm font-medium text-white hover:bg-grow-600 disabled:opacity-50"
          >
            {buying ? "Purchasing…" : `Buy Bundle · ${gcFmt(bundle.bundle_price)}`}
          </button>
        ) : (
          <span className="text-xs text-gray-500">Sign in to buy</span>
        )}
        {msg && (
          <p className={`text-xs ${msg.startsWith("✓") ? "text-grow-400" : "text-red-400"}`}>{msg}</p>
        )}
      </div>
    </Card>
  );
}

function BundlesSection() {
  const bundles = useStoreBundles();
  if (bundles.isLoading) return <LoadingBlock />;
  if (!bundles.data?.length) return null;
  return (
    <section>
      <SectionHeader icon="📦" title="Bundle Deals" subtitle="Curated kits at a discount" />
      <div className="space-y-4">
        {bundles.data.map((b) => <BundleCard key={b.id} bundle={b} />)}
      </div>
    </section>
  );
}

interface ConsumableItem {
  key: string;
  name: string;
  cost: number;
  description: string;
  stage_req?: string | null;
  owned: number;
}

function ConsumablesSection() {
  const { playerId, isAuthed } = useSession();
  const [items, setItems] = useState<ConsumableItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    if (!isAuthed || !playerId) return;
    setLoading(true);
    try {
      const { apiFetch } = await import("@/lib/api/client");
      const data = await apiFetch<ConsumableItem[]>(`/players/${playerId}/shop`);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }

  async function buy(key: string) {
    if (!isAuthed || !playerId) return;
    setBuying(key);
    setMsg(null);
    try {
      const { apiFetch } = await import("@/lib/api/client");
      const updated = await apiFetch<ConsumableItem[]>(`/players/${playerId}/shop/buy`, {
        method: "POST",
        body: { item_key: key, quantity: 1 },
      });
      setItems(updated);
      setMsg(`✓ Purchased`);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBuying(null);
    }
  }

  return (
    <section>
      <SectionHeader icon="🧪" title="Consumables" subtitle="One-shot plant boosters" />
      {!isAuthed ? (
        <p className="text-sm text-gray-500">Sign in to browse consumables.</p>
      ) : items === null ? (
        <Button onClick={load} disabled={loading} size="sm">
          {loading ? "Loading…" : "Load Consumables"}
        </Button>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.key} className="rounded-xl border border-ink-700 bg-ink-900/70 p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-medium text-gray-100">{item.name}</h4>
                {item.stage_req && (
                  <span className="shrink-0 rounded bg-ink-800 px-1.5 py-0.5 text-[9px] uppercase text-gray-500">
                    {item.stage_req}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 flex-1">{item.description}</p>
              <div className="flex items-center justify-between mt-1">
                <div>
                  <span className="font-mono text-grow-300 font-bold">{gcFmt(item.cost)}</span>
                  {item.owned > 0 && (
                    <span className="ml-2 text-xs text-gray-500">Own: {item.owned}</span>
                  )}
                </div>
                <button
                  onClick={() => buy(item.key)}
                  disabled={buying === item.key}
                  className="rounded bg-grow-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-grow-600 disabled:opacity-50"
                >
                  {buying === item.key ? "…" : "Buy"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {msg && <p className={`mt-2 text-xs ${msg.startsWith("✓") ? "text-grow-400" : "text-red-400"}`}>{msg}</p>}
    </section>
  );
}

interface CatalogStrain {
  id: string;
  name: string;
  rarity: string;
  season: string;
  thc_min: number;
  thc_max: number;
  indica_ratio: number;
}

function SeedsSection() {
  const { playerId, isAuthed } = useSession();
  const qc = useQueryClient();
  const [strains, setStrains] = useState<CatalogStrain[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { apiFetch } = await import("@/lib/api/client");
      const data = await apiFetch<CatalogStrain[]>("/strains?catalog_only=true");
      setStrains(data);
    } finally {
      setLoading(false);
    }
  }

  async function buy(strainId: string) {
    if (!isAuthed || !playerId) return;
    setBuying(strainId);
    setMsg(null);
    try {
      const { apiFetch } = await import("@/lib/api/client");
      await apiFetch(`/players/${playerId}/seeds/buy`, {
        method: "POST",
        body: { strain_id: strainId, quantity: 1 },
      });
      await qc.invalidateQueries({ queryKey: queryKeys.seeds(playerId) });
      setMsg("✓ Seed added to inventory");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBuying(null);
    }
  }

  return (
    <section>
      <SectionHeader icon="🌱" title="Seeds" subtitle="Catalog genetics — buy and grow" />
      {strains === null ? (
        <Button onClick={load} disabled={loading} size="sm">
          {loading ? "Loading catalog…" : "Browse Seeds"}
        </Button>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {strains.map((s) => (
            <div key={s.id} className="rounded-xl border border-ink-700 bg-ink-900/70 p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-medium text-gray-100 truncate">{s.name}</h4>
                {s.season !== "all" && (
                  <BadgeChip badge="seasonal" />
                )}
              </div>
              <div className="flex gap-3 text-[11px] text-gray-500">
                <span className={rarityColor(s.rarity)}>{s.rarity}</span>
                <span>{s.indica_ratio >= 0.6 ? "Indica" : s.indica_ratio <= 0.4 ? "Sativa" : "Hybrid"}</span>
                <span>THC {s.thc_min.toFixed(0)}–{s.thc_max.toFixed(0)}%</span>
              </div>
              {isAuthed ? (
                <button
                  onClick={() => buy(s.id)}
                  disabled={buying === s.id}
                  className="mt-auto rounded bg-grow-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-grow-600 disabled:opacity-50"
                >
                  {buying === s.id ? "Buying…" : "Buy Seed"}
                </button>
              ) : (
                <span className="mt-auto text-xs text-gray-500">Sign in to buy</span>
              )}
            </div>
          ))}
        </div>
      )}
      {msg && <p className={`mt-2 text-xs ${msg.startsWith("✓") ? "text-grow-400" : "text-red-400"}`}>{msg}</p>}
    </section>
  );
}

interface ResearchNode {
  key: string;
  name: string;
  description: string;
  cost: number;
  unlocked: boolean;
  available: boolean;
}

function ResearchSection() {
  const { playerId, isAuthed } = useSession();
  const [nodes, setNodes] = useState<ResearchNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    if (!isAuthed || !playerId) return;
    setLoading(true);
    try {
      const { apiFetch } = await import("@/lib/api/client");
      const data = await apiFetch<ResearchNode[]>(`/players/${playerId}/research`);
      setNodes(data);
    } finally {
      setLoading(false);
    }
  }

  async function unlock(key: string) {
    if (!isAuthed || !playerId) return;
    setUnlocking(key);
    setMsg(null);
    try {
      const { apiFetch } = await import("@/lib/api/client");
      const updated = await apiFetch<ResearchNode[]>(`/players/${playerId}/research/${key}/unlock`, {
        method: "POST",
      });
      setNodes(updated);
      setMsg("✓ Research unlocked");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Unlock failed");
    } finally {
      setUnlocking(null);
    }
  }

  return (
    <section>
      <SectionHeader icon="🔬" title="Research" subtitle="Permanent upgrades to your grow operation" />
      {!isAuthed ? (
        <p className="text-sm text-gray-500">Sign in to browse research upgrades.</p>
      ) : nodes === null ? (
        <Button onClick={load} disabled={loading} size="sm">
          {loading ? "Loading…" : "Browse Research"}
        </Button>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {nodes.map((n) => (
            <div
              key={n.key}
              className={`rounded-xl border p-4 flex flex-col gap-2 transition-colors ${
                n.unlocked
                  ? "border-grow-700/60 bg-grow-950/30"
                  : n.available
                  ? "border-ink-700 bg-ink-900/70 hover:border-grow-600"
                  : "border-ink-800 bg-ink-900/40 opacity-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-medium text-gray-100">{n.name}</h4>
                {n.unlocked && (
                  <span className="text-[9px] uppercase tracking-widest text-grow-400 font-semibold">Unlocked</span>
                )}
              </div>
              <p className="text-xs text-gray-500 flex-1">{n.description}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="font-mono text-grow-300 font-bold">{gcFmt(n.cost)}</span>
                {!n.unlocked && n.available && (
                  <button
                    onClick={() => unlock(n.key)}
                    disabled={unlocking === n.key}
                    className="rounded bg-grow-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-grow-600 disabled:opacity-50"
                  >
                    {unlocking === n.key ? "…" : "Unlock"}
                  </button>
                )}
                {!n.unlocked && !n.available && (
                  <span className="text-xs text-gray-600">Locked</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {msg && <p className={`mt-2 text-xs ${msg.startsWith("✓") ? "text-grow-400" : "text-red-400"}`}>{msg}</p>}
    </section>
  );
}

function StoreInner() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="GROWPOD EMPIRE"
        title="Store"
        subtitle="Seeds, consumables, bundles, and partner drops — all in one place"
      />
      <FeaturedShelf />
      <PartnerDropsSection />
      <BundlesSection />
      <SeedsSection />
      <ConsumablesSection />
      <ResearchSection />
    </div>
  );
}

export default function StorePage() {
  return (
    <RequireAuth>
      <StoreInner />
    </RequireAuth>
  );
}
