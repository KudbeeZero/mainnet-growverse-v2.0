"use client";

import { useState, useEffect } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingBlock } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { store as storeApi } from "@/lib/api/store";
import type { GearItem, GearCategory } from "@/lib/api/store";
import type { Pod } from "@/lib/types";
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
import { useInFlightGuard } from "@/hooks/useInFlightGuard";
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

// Every store shelf sits in a consistent elevated panel so the whole page reads
// as a set of distinct tiles/panels (owner: "some sort of panel or tile type of
// look") instead of loose headers-and-buttons stacked on the bare background.
// Presentation-only — no section's data or purchase logic changes.
const STORE_PANEL =
  "rounded-2xl border border-ink-800 bg-ink-950/40 p-4 sm:p-5";

function FeaturedShelf() {
  const featured = useStoreFeatured();
  const seasonal = useSeasonalStrains();
  const { playerId, isAuthed } = useSession();
  const qc = useQueryClient();
  const [buying, setBuying] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Record<string, string>>({});
  const guard = useInFlightGuard<string>();

  function setMsg(id: string, msg: string) {
    setMsgs((prev) => ({ ...prev, [id]: msg }));
  }

  // Merge pinned featured items with seasonal drops
  const pinnedItems = (featured.data ?? []).map((f: FeaturedItem) => ({
    id: f.id,
    item_type: f.item_type,
    item_id: f.item_id,
    label: f.label,
    badge: f.badge,
    price_gc: f.price_gc,
    product_name: f.product_name,
    source: "pinned" as const,
  }));

  const seasonalItems = (seasonal.data ?? []).map((s) => ({
    id: `seasonal-${s.id}`,
    item_type: "seasonal" as const,
    item_id: s.id,
    label: `${s.strain_name ?? "Seasonal strain"} — Seasonal genetics`,
    badge: "seasonal" as const,
    price_gc: s.price_gc as number,
    product_name: s.strain_name ?? "Seasonal strain",
    source: "seasonal" as const,
  }));

  // Pinned items take priority; seasonal fills remaining slots up to 3 total
  const allItems = [...pinnedItems, ...seasonalItems].slice(0, 3);

  if (featured.isLoading) return <LoadingBlock />;
  if (allItems.length === 0) return null;

  async function handleBuy(item: typeof allItems[number]) {
    if (!isAuthed || !playerId) return;
    // Synchronous in-flight guard (see useInFlightGuard): closes the
    // fast-double-click gap the `buying` state alone can't, since the state
    // update below isn't visible to a second click until React re-renders.
    if (!guard.start(item.id)) return;
    setBuying(item.id);
    setMsg(item.id, "");
    try {
      if (item.source === "seasonal") {
        await api.seasonal.purchase(playerId, item.item_id);
        await qc.invalidateQueries({ queryKey: queryKeys.seeds(playerId) });
        await qc.invalidateQueries({ queryKey: queryKeys.player(playerId) });
        await qc.invalidateQueries({ queryKey: queryKeys.wallet(playerId) });
        setMsg(item.id, "✓ Seed added to inventory");
      } else if (item.item_type === "consumable") {
        const { apiFetch } = await import("@/lib/api/client");
        await apiFetch(`/players/${playerId}/shop/buy`, {
          method: "POST",
          body: { item_key: item.item_id, quantity: 1 },
        });
        setMsg(item.id, "✓ Consumable purchased");
      } else if (item.item_type === "strain") {
        const { apiFetch } = await import("@/lib/api/client");
        await apiFetch(`/players/${playerId}/seeds/buy`, {
          method: "POST",
          body: { strain_id: item.item_id, quantity: 1 },
        });
        await qc.invalidateQueries({ queryKey: queryKeys.seeds(playerId) });
        await qc.invalidateQueries({ queryKey: queryKeys.player(playerId) });
        await qc.invalidateQueries({ queryKey: queryKeys.wallet(playerId) });
        setMsg(item.id, "✓ Seed added to inventory");
      }
    } catch (e: unknown) {
      setMsg(item.id, e instanceof Error ? e.message : "Purchase failed");
    } finally {
      guard.stop(item.id);
      setBuying(null);
    }
  }

  const canBuy = (item: typeof allItems[number]) =>
    item.source === "seasonal" ||
    item.item_type === "consumable" ||
    item.item_type === "strain";

  return (
    <section className={STORE_PANEL}>
      <SectionHeader icon="⭐" title="This Week's Drops" subtitle="Curated picks — limited, seasonal, and pinned items" />
      <div className="flex gap-4 overflow-x-auto pb-2">
        {allItems.map((item) => (
          <div
            key={item.id}
            className="shrink-0 w-56 rounded-xl border border-ink-700 bg-ink-900/70 p-4 flex flex-col gap-3 hover:border-grow-600 transition-colors"
          >
            <BadgeChip badge={item.badge} />
            <p className="text-sm text-gray-200 leading-snug">{item.label}</p>
            {item.price_gc != null && (
              <div className="font-mono text-grow-300 text-sm">{gcFmt(item.price_gc)}</div>
            )}
            {msgs[item.id] && (
              <p className={`text-xs ${msgs[item.id].startsWith("✓") ? "text-grow-400" : "text-red-400"}`}>
                {msgs[item.id]}
              </p>
            )}
            {isAuthed && canBuy(item) && item.price_gc != null ? (
              <button
                onClick={() => handleBuy(item)}
                disabled={buying === item.id}
                className="mt-auto rounded bg-grow-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-grow-600 disabled:opacity-50"
              >
                {buying === item.id ? "Buying…" : `Buy · ${gcFmt(item.price_gc)}`}
              </button>
            ) : !isAuthed ? (
              <span className="mt-auto text-xs text-gray-500">Sign in to buy</span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function PartnerCard({ partner }: { partner: StorePartner }) {
  const { playerId, isAuthed } = useSession();
  const qc = useQueryClient();
  const [buying, setBuying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const guard = useInFlightGuard();

  async function buy() {
    if (!isAuthed || !playerId) return;
    if (!guard.start(true)) return;
    setBuying(true);
    setMsg(null);
    try {
      await api.store.purchasePartner(playerId, partner.id);
      await qc.invalidateQueries({ queryKey: queryKeys.seeds(playerId) });
      await qc.invalidateQueries({ queryKey: queryKeys.player(playerId) });
      await qc.invalidateQueries({ queryKey: queryKeys.wallet(playerId) });
      setMsg(`✓ Added to your inventory`);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      guard.stop(true);
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
    <section className={STORE_PANEL}>
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
  const guard = useInFlightGuard();

  async function buy() {
    if (!isAuthed || !playerId) return;
    if (!guard.start(true)) return;
    setBuying(true);
    setMsg(null);
    try {
      const res = await api.store.purchaseBundle(playerId, bundle.id);
      await qc.invalidateQueries({ queryKey: queryKeys.seeds(playerId) });
      await qc.invalidateQueries({ queryKey: queryKeys.player(playerId) });
      await qc.invalidateQueries({ queryKey: queryKeys.wallet(playerId) });
      setMsg(`✓ ${res.purchased} purchased — ${res.items_delivered.length} items delivered`);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      guard.stop(true);
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
    <section className={STORE_PANEL}>
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
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ConsumableItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const guard = useInFlightGuard<string>();

  async function load() {
    if (!isAuthed || !playerId) return;
    setLoading(true);
    setMsg(null);
    try {
      const data = await storeApi.consumables(playerId);
      setItems(data);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Couldn't load consumables");
    } finally {
      setLoading(false);
    }
  }

  async function buy(key: string) {
    if (!isAuthed || !playerId) return;
    if (!guard.start(key)) return;
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
      queryClient.invalidateQueries({ queryKey: queryKeys.player(playerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet(playerId) });
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      guard.stop(key);
      setBuying(null);
    }
  }

  return (
    <section className={STORE_PANEL}>
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
  const guard = useInFlightGuard<string>();

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
    if (!guard.start(strainId)) return;
    setBuying(strainId);
    setMsg(null);
    try {
      const { apiFetch } = await import("@/lib/api/client");
      await apiFetch(`/players/${playerId}/seeds/buy`, {
        method: "POST",
        body: { strain_id: strainId, quantity: 1 },
      });
      await qc.invalidateQueries({ queryKey: queryKeys.seeds(playerId) });
      await qc.invalidateQueries({ queryKey: queryKeys.player(playerId) });
      await qc.invalidateQueries({ queryKey: queryKeys.wallet(playerId) });
      setMsg("✓ Seed added to inventory");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      guard.stop(strainId);
      setBuying(null);
    }
  }

  return (
    <section className={STORE_PANEL}>
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
  const queryClient = useQueryClient();
  const [nodes, setNodes] = useState<ResearchNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const guard = useInFlightGuard<string>();

  async function load() {
    if (!isAuthed || !playerId) return;
    setLoading(true);
    setMsg(null);
    try {
      const { apiFetch } = await import("@/lib/api/client");
      const data = await apiFetch<ResearchNode[]>(`/players/${playerId}/research`, { auth: true });
      setNodes(data);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Couldn't load research");
    } finally {
      setLoading(false);
    }
  }

  async function unlock(key: string) {
    if (!isAuthed || !playerId) return;
    if (!guard.start(key)) return;
    setUnlocking(key);
    setMsg(null);
    try {
      const { apiFetch } = await import("@/lib/api/client");
      const updated = await apiFetch<ResearchNode[]>(`/players/${playerId}/research/${key}/unlock`, {
        method: "POST",
      });
      setNodes(updated);
      setMsg("✓ Research unlocked");
      queryClient.invalidateQueries({ queryKey: queryKeys.player(playerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet(playerId) });
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Unlock failed");
    } finally {
      guard.stop(key);
      setUnlocking(null);
    }
  }

  return (
    <section className={STORE_PANEL}>
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

const GEAR_TABS: { key: GearCategory; label: string }[] = [
  { key: "light", label: "💡 Lights" },
  { key: "fan", label: "🌀 Fans" },
  { key: "soil", label: "🪴 Soil & Amendments" },
];

const GEAR_EMOJI: Record<GearCategory, string> = { light: "💡", fan: "🌀", soil: "🪴" };

function gearSpecLine(item: GearItem): string {
  const s = item.specs ?? {};
  if (item.category === "light") return `${s.watts}W · ${s.ppfd} PPFD · ${s.coverage}`;
  if (item.category === "fan") return `${s.cfm} CFM · ${s.coverage}`;
  return `NPK ${s.npk} · ${s.base}`;
}

function GearCard({
  item,
  pods,
  onBuy,
  onEquip,
  busy,
}: {
  item: GearItem;
  pods: Pod[];
  onBuy: (key: string) => void;
  onEquip: (key: string, podId: string) => void;
  busy: string | null;
}) {
  const [podId, setPodId] = useState<string>("");
  const equippedPod = pods.find((p) => p.id === item.equipped_pod_id);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-ink-700 bg-ink-900/70 p-4">
      <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-lg bg-ink-950/60">
        <span className="absolute text-4xl opacity-40">{GEAR_EMOJI[item.category]}</span>
        {item.image && (
          <img
            src={`/store/gear/${item.image}`}
            alt={item.name}
            className="relative h-full w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
      </div>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-100">{item.name}</h4>
        {item.owned > 0 && (
          <span className="shrink-0 rounded bg-ink-800 px-1.5 py-0.5 text-[10px] text-gray-400">
            Own {item.owned}
          </span>
        )}
      </div>
      <p className="font-mono text-[11px] text-accent-300">{gearSpecLine(item)}</p>
      <p className="flex-1 text-xs text-gray-500">{item.description}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="font-mono font-bold text-grow-300">{gcFmt(item.cost)}</span>
        <button
          onClick={() => onBuy(item.key)}
          disabled={busy === item.key}
          className="rounded bg-grow-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-grow-600 disabled:opacity-50"
        >
          {busy === item.key ? "…" : "Buy"}
        </button>
      </div>
      {item.category === "light" && item.owned > 0 && (
        <div className="mt-1 border-t border-ink-700 pt-2">
          {equippedPod ? (
            <p className="text-[11px] text-grow-400">✓ Powering “{equippedPod.name}”</p>
          ) : (
            <p className="text-[11px] text-gray-500">Not equipped</p>
          )}
          {pods.length > 0 && (
            <div className="mt-1 flex items-center gap-1.5">
              <select
                value={podId}
                onChange={(e) => setPodId(e.target.value)}
                className="flex-1 rounded border border-ink-600 bg-ink-900 px-1.5 py-1 text-[11px] text-gray-200"
              >
                <option value="">Equip to pod…</option>
                {pods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => podId && onEquip(item.key, podId)}
                disabled={!podId || busy === item.key}
                className="rounded bg-accent-700 px-2 py-1 text-[11px] text-white hover:bg-accent-600 disabled:opacity-40"
              >
                Equip
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GrowRoomGearSection() {
  const { playerId, isAuthed } = useSession();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<GearCategory>("light");
  const [items, setItems] = useState<GearItem[] | null>(null);
  const [pods, setPods] = useState<Pod[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const guard = useInFlightGuard<string>();

  useEffect(() => {
    if (!isAuthed || !playerId) return;
    let cancelled = false;
    (async () => {
      try {
        const [gear, podList] = await Promise.all([
          storeApi.gear(playerId),
          api.pods.list(playerId),
        ]);
        if (!cancelled) {
          setItems(gear);
          setPods(podList);
        }
      } catch {
        /* leave items null → section stays quiet */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthed, playerId]);

  async function buy(key: string) {
    if (!playerId) return;
    if (!guard.start(key)) return;
    setBusy(key);
    setMsg(null);
    try {
      setItems(await storeApi.purchaseGear(playerId, key));
      setMsg("✓ Purchased");
      queryClient.invalidateQueries({ queryKey: queryKeys.player(playerId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet(playerId) });
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      guard.stop(key);
      setBusy(null);
    }
  }

  async function equip(key: string, podId: string) {
    if (!playerId) return;
    // Key by gear AND pod: equipping the same light to a second pod while the
    // first equip is in flight is a distinct, legitimate request — keying by
    // gear alone silently dropped it (no request, no message).
    const k = `${key}:${podId}`;
    if (!guard.start(k)) return;
    setBusy(key);
    setMsg(null);
    try {
      await storeApi.equipLight(playerId, podId, key);
      setItems(await storeApi.gear(playerId));
      setMsg("✓ Light equipped — it now drives that pod's light level");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Equip failed");
    } finally {
      guard.stop(k);
      setBusy(null);
    }
  }

  const shown = (items ?? []).filter((i) => i.category === tab);

  return (
    <section className={STORE_PANEL}>
      <SectionHeader
        icon="🛠️"
        title="Grow Room Gear"
        subtitle="Lights, fans, and soil — equip a light to a pod to power its canopy"
      />
      {!isAuthed ? (
        <p className="text-sm text-gray-500">Sign in to browse grow-room gear.</p>
      ) : items === null ? (
        <LoadingBlock label="Loading gear…" />
      ) : (
        <>
          <Tabs
            tabs={GEAR_TABS}
            active={tab}
            onChange={(k) => setTab(k as GearCategory)}
            className="mb-4"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((item) => (
              <GearCard
                key={item.key}
                item={item}
                pods={pods}
                onBuy={buy}
                onEquip={equip}
                busy={busy}
              />
            ))}
          </div>
          {msg && (
            <p className={`mt-2 text-xs ${msg.startsWith("✓") ? "text-grow-400" : "text-red-400"}`}>
              {msg}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function StoreInner() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="GROWPOD EMPIRE"
        title="Store"
        subtitle="Seeds, gear, consumables, bundles, and partner drops — all in one place"
      />
      <FeaturedShelf />
      <PartnerDropsSection />
      <GrowRoomGearSection />
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
