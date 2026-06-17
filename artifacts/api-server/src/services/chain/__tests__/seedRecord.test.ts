import { buildSeedRecord } from "../seedRecord";
import { deriveSeedTraits } from "../seedGen";

const ADDR = "FRONTIERPLAYERADDRESS7XYZ";
const BLOCK = "ABCDEF0123456789BLOCKHASH";
const NONCE = "11111111-2222-3333-4444-555555555555";

describe("buildSeedRecord", () => {
  it("derives the same genetics as deriveSeedTraits for the given entropy", () => {
    const row = buildSeedRecord({ ownerAddress: ADDR, blockHash: BLOCK, nonce: NONCE });
    expect(row.traits).toEqual(deriveSeedTraits(BLOCK, ADDR, NONCE));
  });

  it("is deterministic — same entropy yields identical genetics", () => {
    const a = buildSeedRecord({ ownerAddress: ADDR, blockHash: BLOCK, nonce: NONCE });
    const b = buildSeedRecord({ ownerAddress: ADDR, blockHash: BLOCK, nonce: NONCE });
    expect(a.traits).toEqual(b.traits);
  });

  it("generates a unique seedId per mint", () => {
    const a = buildSeedRecord({ ownerAddress: ADDR, blockHash: BLOCK, nonce: NONCE });
    const b = buildSeedRecord({ ownerAddress: ADDR, blockHash: BLOCK, nonce: NONCE });
    expect(a.seedId).not.toEqual(b.seedId);
  });

  it("generates a nonce when none is supplied (entropy guarantee)", () => {
    const row = buildSeedRecord({ ownerAddress: ADDR, blockHash: BLOCK });
    expect(typeof row.nonce).toBe("string");
    expect((row.nonce ?? "").length).toBeGreaterThan(0);
  });

  it("leaves chain fields null — no ASA is minted at seed-mint time", () => {
    const row = buildSeedRecord({ ownerAddress: ADDR, blockHash: BLOCK, nonce: NONCE });
    expect(row.asaId).toBeNull();
    expect(row.mintTxId).toBeNull();
    expect(row.mintedAt).toBeNull();
  });

  it("records the entropy inputs so genetics stay reproducible", () => {
    const row = buildSeedRecord({ ownerAddress: ADDR, blockHash: BLOCK, nonce: NONCE });
    expect(row.ownerAddress).toBe(ADDR);
    expect(row.blockHash).toBe(BLOCK);
    expect(row.nonce).toBe(NONCE);
  });

  it("defaults to a Gen 0 original (generationNum 0, no parent)", () => {
    const row = buildSeedRecord({ ownerAddress: ADDR, blockHash: BLOCK, nonce: NONCE });
    expect(row.generationNum).toBe(0);
    expect(row.parentSeedId).toBeNull();
    expect(row.traits.parentSeedId).toBeNull();
  });

  it("carries lineage for bred seeds into both the column and the traits blob", () => {
    const parentSeedId = "99999999-8888-7777-6666-555555555555";
    const row = buildSeedRecord({
      ownerAddress: ADDR,
      blockHash: BLOCK,
      nonce: NONCE,
      parentSeedId,
      generationNum: 2,
    });
    expect(row.parentSeedId).toBe(parentSeedId);
    expect(row.generationNum).toBe(2);
    expect(row.traits.parentSeedId).toBe(parentSeedId);
  });

  it("links the owning player when supplied", () => {
    const row = buildSeedRecord({
      ownerAddress: ADDR,
      ownerPlayerId: "player-123",
      blockHash: BLOCK,
      nonce: NONCE,
    });
    expect(row.ownerPlayerId).toBe("player-123");
  });
});
