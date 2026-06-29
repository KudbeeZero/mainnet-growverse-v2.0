"use client";

// Plant NFTs — ARC-69 (mutable metadata carried in the asset-config note field,
// prefixed "arc69:"). Mint a 1-of-1 ASA per plant, update its metadata as the plant
// grows, read it back via the indexer, and transfer it. Best-effort and gated by
// isSimulate(): in simulate mode we log the JSON and return a synthetic id; nothing
// here ever blocks gameplay.

import {
  makeAssetCreateTxnWithSuggestedParamsFromObject,
  makeAssetConfigTxnWithSuggestedParamsFromObject,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  makePaymentTxnWithSuggestedParamsFromObject,
  assignGroupID,
} from "algosdk";
import type { PlantState } from "@/lib/types";
import {
  AlgoClientError,
  algoNetwork,
  encodeNote,
  getAlgodClient,
  getIndexerClient,
  getNetworkParams,
  isSimulate,
  simId,
  simulateLog,
} from "./client";
import { getWalletAddress, signAndSend } from "./wallet";
import { encodeGenotype, traitsFromSeed } from "./genotypeCodec";
import { seedForPlant } from "@/lib/chamber/morphology";

const ARC69_PREFIX = "arc69:";
const GPE_PREFIX = "gpe:";

export interface PlantNFTProperties {
  strain: string;
  strain_name: string;
  genotype_hex: string;
  grow_stage: string;
  grow_day: number;
  bud_dev: number;
  trich_density: number;
  pistil_color: number;
  boost_history: string[];
  stage_timestamps: Record<string, string>;
  harvest_yield_g: number | null;
  minted_at: string;
  network: string;
}

export interface PlantNFTMetadata {
  standard: "arc69";
  description: string;
  external_url: string;
  mime_type: string;
  properties: PlantNFTProperties;
}

export interface MintOptions {
  strainName?: string;
  genotypeHex?: string;
  growDay?: number;
  budDev?: number;
}

function shortId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
}

/** Build the ARC-69 metadata object for a plant at its current state. */
export function buildPlantMetadata(plant: PlantState, opts: MintOptions = {}): PlantNFTMetadata {
  const strainName = opts.strainName ?? plant.strain_id;
  const genotypeHex = opts.genotypeHex ?? encodeGenotype(traitsFromSeed(seedForPlant(plant.id)));
  const trich = plant.trichomes?.density ?? 0;
  return {
    standard: "arc69",
    description: `Growverse Plant — ${strainName}`,
    external_url: `https://growverse.app/lab/strains/${plant.strain_id}`,
    mime_type: "image/png",
    properties: {
      strain: plant.strain_id,
      strain_name: strainName,
      genotype_hex: genotypeHex,
      grow_stage: plant.growth_stage,
      grow_day: opts.growDay ?? 0,
      bud_dev: opts.budDev ?? 0,
      trich_density: trich,
      pistil_color: 0,
      boost_history: [],
      stage_timestamps: {},
      harvest_yield_g: null,
      minted_at: new Date().toISOString(),
      network: algoNetwork(),
    },
  };
}

function requireAddress(): string {
  const addr = getWalletAddress();
  if (!addr) throw new AlgoClientError("Connect a wallet first.");
  return addr;
}

/** Mint a 1-of-1 plant NFT. Returns the asset id + tx id (synthetic in simulate). */
export async function mintPlantNFT(
  plant: PlantState,
  opts: MintOptions = {},
): Promise<{ assetId: number; txId: string; metadata: PlantNFTMetadata }> {
  const metadata = buildPlantMetadata(plant, opts);
  if (isSimulate()) {
    simulateLog("mintPlantNFT", metadata);
    return { assetId: 0, txId: simId("mint"), metadata };
  }
  const sender = requireAddress();
  const suggestedParams = await getNetworkParams();
  const assetName = `${metadata.properties.strain_name} #${shortId(plant.id)}`.slice(0, 32);
  const txn = makeAssetCreateTxnWithSuggestedParamsFromObject({
    sender,
    total: 1,
    decimals: 0,
    defaultFrozen: false,
    unitName: "GROW",
    assetName,
    manager: sender,
    reserve: sender,
    note: encodeNote(ARC69_PREFIX, metadata),
    suggestedParams,
  });
  const res = await signAndSend([txn]);
  if (res.assetIndex == null) throw new AlgoClientError("Mint confirmed but no asset id was returned.");
  return { assetId: res.assetIndex, txId: res.txId, metadata };
}

/** Rewrite a plant NFT's ARC-69 metadata via an asset-config (acfg) transaction. */
export async function updatePlantMetadata(
  assetId: number,
  metadata: PlantNFTMetadata,
): Promise<{ txId: string }> {
  if (isSimulate()) {
    simulateLog("updatePlantMetadata", { assetId, metadata });
    return { txId: simId("acfg") };
  }
  const sender = requireAddress();
  const suggestedParams = await getNetworkParams();
  const txn = makeAssetConfigTxnWithSuggestedParamsFromObject({
    sender,
    assetIndex: assetId,
    manager: sender,
    reserve: sender,
    strictEmptyAddressChecking: false,
    note: encodeNote(ARC69_PREFIX, metadata),
    suggestedParams,
  });
  const res = await signAndSend([txn]);
  return { txId: res.txId };
}

/** Read a plant NFT's latest ARC-69 metadata from the indexer (null if none). */
export async function getPlantNFT(assetId: number): Promise<PlantNFTMetadata | null> {
  if (isSimulate()) return null;
  try {
    const resp = await getIndexerClient().searchForTransactions().assetID(assetId).txType("acfg").do();
    const txns = resp.transactions ?? [];
    for (let i = txns.length - 1; i >= 0; i--) {
      const note = txns[i].note;
      if (!note) continue;
      const text = new TextDecoder().decode(note);
      if (!text.startsWith(ARC69_PREFIX)) continue;
      return JSON.parse(text.slice(ARC69_PREFIX.length)) as PlantNFTMetadata;
    }
    return null;
  } catch {
    return null; // best-effort read; never throw to the caller
  }
}

/**
 * Transfer a plant NFT to another address. NOTE: the recipient must have opted into
 * the asset first (a standard Algorand requirement) — this sends the transfer leg.
 */
export async function transferPlantNFT(assetId: number, toAddress: string): Promise<{ txId: string }> {
  if (isSimulate()) {
    simulateLog("transferPlantNFT", { assetId, toAddress });
    return { txId: simId("axfer") };
  }
  const sender = requireAddress();
  const suggestedParams = await getNetworkParams();
  const txn = makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender,
    receiver: toAddress,
    amount: 1,
    assetIndex: assetId,
    suggestedParams,
  });
  const res = await signAndSend([txn]);
  return { txId: res.txId };
}

export interface HarvestRecord {
  yieldG: number;
  quality: number;
  finalGenotype: string;
  fromStage: string;
}

/**
 * Harvest as a single atomic group: final ARC-69 metadata update + two pay-to-self
 * grow-event notes (harvest + stage transition). All confirm together or not at all.
 */
export async function harvestAtomicGroup(
  assetId: number,
  metadata: PlantNFTMetadata,
  record: HarvestRecord,
): Promise<{ txId: string }> {
  if (isSimulate()) {
    simulateLog("harvestAtomicGroup", { assetId, metadata, record });
    return { txId: simId("harvest-group") };
  }
  const sender = requireAddress();
  const suggestedParams = await getNetworkParams();
  const ts = Math.floor(Date.now() / 1000);
  const acfg = makeAssetConfigTxnWithSuggestedParamsFromObject({
    sender,
    assetIndex: assetId,
    manager: sender,
    reserve: sender,
    strictEmptyAddressChecking: false,
    note: encodeNote(ARC69_PREFIX, metadata),
    suggestedParams,
  });
  const harvestNote = makePaymentTxnWithSuggestedParamsFromObject({
    sender,
    receiver: sender,
    amount: 0,
    note: encodeNote(GPE_PREFIX, {
      v: 1,
      event: "HARVEST",
      plant_id: String(assetId),
      strain: metadata.properties.strain,
      data: { yield_g: record.yieldG, quality: record.quality, final_genotype: record.finalGenotype },
      ts,
    }),
    suggestedParams,
  });
  const stageNote = makePaymentTxnWithSuggestedParamsFromObject({
    sender,
    receiver: sender,
    amount: 0,
    note: encodeNote(GPE_PREFIX, {
      v: 1,
      event: "STAGE_TRANSITION",
      plant_id: String(assetId),
      strain: metadata.properties.strain,
      data: { from: record.fromStage, to: "harvest" },
      ts,
    }),
    suggestedParams,
  });
  const group = assignGroupID([acfg, harvestNote, stageNote]);
  const res = await signAndSend(group);
  return { txId: res.txId };
}
