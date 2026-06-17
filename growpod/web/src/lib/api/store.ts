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

export type GearCategory = "light" | "fan" | "soil";

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
}

export const store = {
  partners: () =>
    apiFetch<StorePartner[]>("/store/partners"),

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
