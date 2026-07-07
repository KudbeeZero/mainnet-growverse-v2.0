import { apiFetch } from "./client";

export interface StorePartner {
  id: string;
  name: string;
  logo_url: string;
  tagline: string;
  product_type: "strain" | "consumable";
  product_id: string;
  product_name: string;
  price_gc: number;
  active: boolean;
  display_order: number;
}

export interface FeaturedItem {
  id: string;
  item_type: "strain" | "consumable" | "seasonal";
  item_id: string;
  label: string;
  badge: "seasonal" | "limited" | "new";
  active: boolean;
  valid_through: string | null;
  price_gc: number | null;
  product_name: string;
}

export interface StorePartnerUpdate {
  active?: boolean;
  display_order?: number;
  price_gc?: number;
  tagline?: string;
}

export interface BundleComponent {
  type: "consumable";
  key: string;
  qty: number;
  name?: string;
  cost?: number;
}

export interface StoreBundle {
  id: string;
  name: string;
  description: string;
  discount_pct: number;
  components: BundleComponent[];
  full_price: number;
  bundle_price: number;
  active: boolean;
}

// A shop consumable, as returned by GET /players/:id/shop — the whole catalog,
// each with the player's `owned` count. `owned > 0` = usable on a plant.
export interface ConsumableItem {
  key: string;
  name: string;
  cost: number;
  description: string;
  stage_req: string | null;
  owned: number;
}

export type GearCategory = "light" | "fan" | "soil";

// Gear-effect keys the sim consumes (simulation/gear.py); all optional, all
// omitted for lights (which stay the separate PPFD-write mechanism).
export interface GearEffects {
  temp_offset_c?: number;
  humidity_offset_pct?: number;
  pest_spawn_mult?: number;
  disease_growth_mult?: number;
  water_decay_mult?: number;
  nutrient_decay_mult?: number;
  flowering_quality_bonus?: number;
}

export interface GearItem {
  key: string;
  name: string;
  category: GearCategory;
  cost: number;
  description: string;
  image: string | null;
  specs: Record<string, string | number>;
  owned: number;
  equipped_pod_id: string | null;
  effects?: GearEffects;
}

export const store = {
  partners: () =>
    apiFetch<StorePartner[]>("/store/partners"),

  // The consumables catalog + this player's owned counts (GET /players/:id/shop).
  consumables: (playerId: string) =>
    apiFetch<ConsumableItem[]>(`/players/${playerId}/shop`, { auth: true }),

  gear: (playerId: string) =>
    apiFetch<GearItem[]>(`/players/${playerId}/store/gear`, { auth: true }),

  purchaseGear: (playerId: string, gearKey: string, quantity = 1) =>
    apiFetch<GearItem[]>(`/players/${playerId}/store/gear/${gearKey}/purchase`, {
      method: "POST",
      body: { quantity },
    }),

  equipLight: (playerId: string, podId: string, gearKey: string) =>
    apiFetch<unknown>(`/players/${playerId}/pods/${podId}/equip-light`, {
      method: "POST",
      body: { gear_key: gearKey },
    }),

  // Generalized equip/unequip — any gear category (light/fan/soil).
  // Supersedes equipLight for new callers; equipLight stays for existing ones.
  equipGear: (playerId: string, podId: string, gearKey: string) =>
    apiFetch<unknown>(`/players/${playerId}/pods/${podId}/equip-gear`, {
      method: "POST",
      body: { gear_key: gearKey },
    }),

  unequipGear: (playerId: string, podId: string, gearKey: string) =>
    apiFetch<unknown>(`/players/${playerId}/pods/${podId}/unequip-gear`, {
      method: "POST",
      body: { gear_key: gearKey },
    }),

  featured: () =>
    apiFetch<FeaturedItem[]>("/store/featured"),

  bundles: () =>
    apiFetch<StoreBundle[]>("/store/bundles"),

  purchaseBundle: (playerId: string, bundleId: string) =>
    apiFetch<{ purchased: string; items_delivered: BundleComponent[] }>(
      `/players/${playerId}/store/bundles/${bundleId}/purchase`,
      { method: "POST" },
    ),

  purchasePartner: (playerId: string, partnerId: string) =>
    apiFetch<{ purchased: string; product_type: string; product_id: string }>(
      `/players/${playerId}/store/partners/${partnerId}/purchase`,
      { method: "POST" },
    ),

  adminAddPartner: (data: {
    name: string;
    logo_url: string;
    tagline: string;
    product_type: string;
    product_id: string;
    price_gc: number;
    display_order?: number;
  }) => apiFetch<StorePartner>("/admin/store/partners", { method: "POST", body: data }),

  adminUpdatePartner: (id: string, data: StorePartnerUpdate) =>
    apiFetch<StorePartner>(`/admin/store/partners/${id}`, { method: "PATCH", body: data }),

  adminDeletePartner: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/admin/store/partners/${id}`, { method: "DELETE" }),

  adminAddFeatured: (data: {
    item_type: string;
    item_id: string;
    label: string;
    badge?: string;
    valid_through?: string;
  }) => apiFetch<FeaturedItem>("/admin/store/featured", { method: "POST", body: data }),

  adminDeleteFeatured: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/admin/store/featured/${id}`, { method: "DELETE" }),
};
