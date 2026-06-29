"use client";

// Algorand TestNet client layer.
//
// Thin singletons over algod + indexer, plus the global enable/simulate gates.
// Invariant (repo charter): DB is authoritative; the chain is a mirror/settlement
// layer. Nothing here gates gameplay — every caller treats chain work as best-effort.
//
// Two flags govern everything:
//   NEXT_PUBLIC_ALGO_ENABLE   — false → the whole chain layer is a no-op.
//   NEXT_PUBLIC_ALGO_SIMULATE — true (default) → log JSON, never send real txns.

import { Algodv2, Indexer, waitForConfirmation as algoWait, type SuggestedParams } from "algosdk";

const NETWORK = process.env.NEXT_PUBLIC_ALGO_NETWORK ?? "testnet";
const NODE_URL = process.env.NEXT_PUBLIC_ALGO_NODE_URL ?? "https://testnet-api.algonode.cloud";
const INDEXER_URL = process.env.NEXT_PUBLIC_ALGO_INDEXER_URL ?? "https://testnet-idx.algonode.cloud";
const NODE_TOKEN = process.env.NEXT_PUBLIC_ALGO_NODE_TOKEN ?? "";

/** A user-friendly chain error (callers surface `.message` in a non-blocking toast). */
export class AlgoClientError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "AlgoClientError";
  }
}

/** The chain layer is active at all only when explicitly enabled. */
export function isAlgoEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ALGO_ENABLE === "true";
}

/** Default-ON simulate: only `=== "false"` arms real transactions. */
export function isSimulate(): boolean {
  return process.env.NEXT_PUBLIC_ALGO_SIMULATE !== "false";
}

export function algoNetwork(): string {
  return NETWORK;
}

let _algod: Algodv2 | null = null;
let _indexer: Indexer | null = null;

export function getAlgodClient(): Algodv2 {
  if (!_algod) _algod = new Algodv2(NODE_TOKEN, NODE_URL, "");
  return _algod;
}

export function getIndexerClient(): Indexer {
  if (!_indexer) _indexer = new Indexer(NODE_TOKEN, INDEXER_URL, "");
  return _indexer;
}

// Suggested params change slowly (per round); cache for 30s to spare the node.
let _paramsCache: { params: SuggestedParams; at: number } | null = null;
const PARAMS_TTL_MS = 30_000;

export async function getNetworkParams(): Promise<SuggestedParams> {
  const now = Date.now();
  if (_paramsCache && now - _paramsCache.at < PARAMS_TTL_MS) return _paramsCache.params;
  try {
    const params = await getAlgodClient().getTransactionParams().do();
    _paramsCache = { params, at: now };
    return params;
  } catch (e) {
    throw new AlgoClientError("Couldn't reach the Algorand node. Try again in a moment.", e);
  }
}

export async function waitForConfirmation(txId: string, rounds = 4) {
  try {
    return await algoWait(getAlgodClient(), txId, rounds);
  } catch (e) {
    throw new AlgoClientError(`Transaction ${txId.slice(0, 8)}… didn't confirm in time.`, e);
  }
}

/** AlgoExplorer link for a confirmed transaction. */
export function explorerTxUrl(txId: string): string {
  const host = NETWORK === "mainnet" ? "algoexplorer.io" : `${NETWORK}.algoexplorer.io`;
  return `https://${host}/tx/${txId}`;
}

/** Encode a prefixed JSON note for a transaction's note field (ARC-69 / gpe events). */
export function encodeNote(prefix: string, obj: unknown): Uint8Array {
  return new TextEncoder().encode(prefix + JSON.stringify(obj));
}

let _simSeq = 0;
/** A deterministic-ish synthetic id for simulate mode (never an on-chain value). */
export function simId(prefix: string): string {
  _simSeq += 1;
  return `${prefix}-SIM-${Date.now().toString(36)}-${_simSeq}`;
}

/** In simulate mode we log the JSON payload instead of broadcasting. */
export function simulateLog(kind: string, payload: unknown): void {
  // eslint-disable-next-line no-console
  console.info(`[algo:simulate] ${kind}`, payload);
}
