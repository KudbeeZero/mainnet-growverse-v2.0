import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetch } from "../client";
import { store } from "../store";

// Pure, seam-free unit test: mock the apiFetch transport and assert that each
// store helper builds the correct request (path, method, body). No DOM, no
// network, no React — mirrors the existing `vi`-mock pattern in
// `lib/__tests__/format.test.ts`.
vi.mock("../client", () => ({ apiFetch: vi.fn() }));

const mockApiFetch = vi.mocked(apiFetch);

// A sentinel the mocked transport resolves with, so we can also assert that the
// helpers pass the response straight through.
const RESPONSE = { ok: true } as unknown;

beforeEach(() => {
  mockApiFetch.mockReset();
  mockApiFetch.mockResolvedValue(RESPONSE as never);
});

describe("store admin helpers", () => {
  it("adminAddPartner POSTs to /admin/store/partners with the partner body", async () => {
    const data = {
      name: "Green Thumb Collective",
      logo_url: "https://example.com/logo.png",
      tagline: "Farm-to-bong, since 2018",
      product_type: "consumable",
      product_id: "bloom_booster",
      price_gc: 120,
      display_order: 2,
    };

    const res = await store.adminAddPartner(data);

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith("/admin/store/partners", {
      method: "POST",
      body: data,
    });
    expect(res).toBe(RESPONSE);
  });

  it("adminUpdatePartner PATCHes /admin/store/partners/:id with the update body", async () => {
    const data = { active: false, price_gc: 250 };

    await store.adminUpdatePartner("partner-123", data);

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith("/admin/store/partners/partner-123", {
      method: "PATCH",
      body: data,
    });
  });

  it("adminDeletePartner DELETEs /admin/store/partners/:id with no body", async () => {
    await store.adminDeletePartner("partner-456");

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith("/admin/store/partners/partner-456", {
      method: "DELETE",
    });
  });

  it("adminAddFeatured POSTs to /admin/store/featured with the featured body", async () => {
    const data = {
      item_type: "consumable",
      item_id: "bloom_booster",
      label: "Bloom Booster — Deal of the week",
      badge: "limited",
    };

    await store.adminAddFeatured(data);

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith("/admin/store/featured", {
      method: "POST",
      body: data,
    });
  });

  it("adminDeleteFeatured DELETEs /admin/store/featured/:id with no body", async () => {
    await store.adminDeleteFeatured("feat-789");

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith("/admin/store/featured/feat-789", {
      method: "DELETE",
    });
  });
});

describe("store read-path builders", () => {
  it("partners GETs /store/partners with no options", async () => {
    const res = await store.partners();

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith("/store/partners");
    expect(res).toBe(RESPONSE);
  });

  it("featured GETs /store/featured with no options", async () => {
    await store.featured();

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith("/store/featured");
  });

  it("bundles GETs /store/bundles with no options", async () => {
    await store.bundles();

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith("/store/bundles");
  });

  it("gear GETs /players/:playerId/store/gear with auth", async () => {
    await store.gear("player-001");

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith("/players/player-001/store/gear", {
      auth: true,
    });
  });
});

describe("store player-scoped purchase/equip builders", () => {
  it("purchaseGear POSTs to the gear-purchase path with a default quantity of 1", async () => {
    await store.purchaseGear("player-001", "led_125w");

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/players/player-001/store/gear/led_125w/purchase",
      { method: "POST", body: { quantity: 1 } },
    );
  });

  it("purchaseGear forwards an explicit quantity", async () => {
    await store.purchaseGear("player-001", "led_125w", 3);

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/players/player-001/store/gear/led_125w/purchase",
      { method: "POST", body: { quantity: 3 } },
    );
  });

  it("equipLight POSTs the gear key to the pod equip-light path", async () => {
    await store.equipLight("player-001", "pod-42", "led_125w");

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/players/player-001/pods/pod-42/equip-light",
      { method: "POST", body: { gear_key: "led_125w" } },
    );
  });

  it("purchaseBundle POSTs to the bundle-purchase path with no body", async () => {
    await store.purchaseBundle("player-001", "bundle-7");

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/players/player-001/store/bundles/bundle-7/purchase",
      { method: "POST" },
    );
  });

  it("purchasePartner POSTs to the partner-purchase path with no body", async () => {
    await store.purchasePartner("player-001", "partner-9");

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/players/player-001/store/partners/partner-9/purchase",
      { method: "POST" },
    );
  });
});
