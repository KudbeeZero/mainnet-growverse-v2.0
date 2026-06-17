import {
  MockChainMintClient,
  getChainMintClient,
  setChainMintClient,
  type SeedMintInput,
} from "../chainMintClient";

const SEED: SeedMintInput = {
  seedId: "11111111-2222-3333-4444-555555555555",
  ownerAddress: "FRONTIERPLAYERADDRESS7XYZ",
  blockHash: "ABCDEF0123456789BLOCKHASH",
  nonce: "99999999-8888-7777-6666-555555555555",
  generationNum: 0,
  parentSeedId: null,
  traits: {
    strainFamily: "indica",
    growthRate: 1,
    internodeSpacing: 0.5,
    leafDensity: 0.5,
    resinProfile: 0.5,
    colorShift: 180,
    mutationFlag: false,
    parentSeedId: null,
  },
};

afterEach(() => setChainMintClient(null));

describe("MockChainMintClient", () => {
  it("returns an asset id, a txid and the mock network", async () => {
    const result = await new MockChainMintClient().mintSeed(SEED);
    expect(typeof result.assetId).toBe("number");
    expect(result.txId).toMatch(/^MOCKTX\d{10}$/);
    expect(result.network).toBe("mock");
  });

  it("hands out unique, incrementing asset ids per mint", async () => {
    const client = new MockChainMintClient(2000);
    const a = await client.mintSeed(SEED);
    const b = await client.mintSeed(SEED);
    expect(a.assetId).toBe(2000);
    expect(b.assetId).toBe(2001);
    expect(a.txId).not.toEqual(b.txId);
  });
});

describe("getChainMintClient", () => {
  const original = process.env.CHAIN_SERVICE_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.CHAIN_SERVICE_URL;
    else process.env.CHAIN_SERVICE_URL = original;
    setChainMintClient(null);
  });

  it("defaults to the offline mock client when no service URL is set", () => {
    delete process.env.CHAIN_SERVICE_URL;
    setChainMintClient(null);
    expect(getChainMintClient()).toBeInstanceOf(MockChainMintClient);
  });

  it("honours an explicit override (test seam)", () => {
    const stub = new MockChainMintClient(5000);
    setChainMintClient(stub);
    expect(getChainMintClient()).toBe(stub);
  });
});
