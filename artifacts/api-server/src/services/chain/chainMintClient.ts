// ============================================================================
// FRONTIER — Clone Room :: Chain mint client (CLONE-10)
// ----------------------------------------------------------------------------
// The on-chain ASA is minted at plant time. The Algorand client lives in the
// Python chain service, so this TS api-server calls it over HTTP. Mirroring the
// Python Mock/real split, the client is swappable behind an interface:
//   - MockChainMintClient: offline, deterministic — default for dev/CI/tests.
//   - HttpChainMintClient:  POSTs to the Python service when CHAIN_SERVICE_URL
//                           is configured (prod).
// CI never needs a live key or network.
//
// The DB stays authoritative (growpod/CLAUDE.md): this client only materializes
// the asset and returns its id/txid; the caller persists them onto plant_seeds.
// ============================================================================

import type { PlantSeed } from "@workspace/db";

/** What the chain service needs to mint a seed (the plant_seeds row). */
export type SeedMintInput = Pick<
  PlantSeed,
  | "seedId"
  | "ownerAddress"
  | "blockHash"
  | "nonce"
  | "traits"
  | "generationNum"
  | "parentSeedId"
>;

export interface SeedMintResult {
  assetId: number;
  txId: string | null;
  network: string;
}

export interface ChainMintClient {
  mintSeed(seed: SeedMintInput): Promise<SeedMintResult>;
}

/**
 * Offline client: deterministic, incrementing asset ids and synthetic txids.
 * No network, no secrets — keeps dev and CI fully self-contained.
 */
export class MockChainMintClient implements ChainMintClient {
  private nextAssetId: number;
  private txSeq = 0;

  constructor(startAssetId = 1000) {
    this.nextAssetId = startAssetId;
  }

  async mintSeed(_seed: SeedMintInput): Promise<SeedMintResult> {
    const assetId = this.nextAssetId++;
    this.txSeq += 1;
    return {
      assetId,
      txId: `MOCKTX${String(this.txSeq).padStart(10, "0")}`,
      network: "mock",
    };
  }
}

/**
 * Calls the Python chain service's POST /api/chain/mint-seed. The seed row is
 * sent as JSON and the service returns { assetId, txId, network }.
 */
export class HttpChainMintClient implements ChainMintClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async mintSeed(seed: SeedMintInput): Promise<SeedMintResult> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/chain/mint-seed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
      },
      body: JSON.stringify(seed),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`mint-seed failed: ${res.status} ${detail}`.trim());
    }

    const body = (await res.json()) as Partial<SeedMintResult>;
    if (typeof body.assetId !== "number") {
      throw new Error("mint-seed response missing assetId");
    }
    return {
      assetId: body.assetId,
      txId: body.txId ?? null,
      network: body.network ?? "unknown",
    };
  }
}

let cached: ChainMintClient | null = null;

/**
 * Process-wide client. Uses the HTTP client when CHAIN_SERVICE_URL is set,
 * otherwise the offline mock so dev/CI run without the Python service.
 */
export function getChainMintClient(): ChainMintClient {
  if (cached !== null) return cached;

  const baseUrl = process.env.CHAIN_SERVICE_URL;
  if (baseUrl) {
    cached = new HttpChainMintClient(baseUrl, process.env.CHAIN_SERVICE_API_KEY ?? "");
  } else {
    cached = new MockChainMintClient();
  }
  return cached;
}

/** Test seam: override the active client. */
export function setChainMintClient(client: ChainMintClient | null): void {
  cached = client;
}
