"use client";

// On-chain grow-event log — zero-value pay-to-self transactions carrying a small
// structured note (prefix "gpe:"). Best-effort and non-blocking: events are queued
// in memory and flushed in batches; if the wallet is disconnected they're held (up
// to 50), and anything older than an hour is dropped. Gameplay never waits on this.

import { makePaymentTxnWithSuggestedParamsFromObject, assignGroupID } from "algosdk";
import { create } from "zustand";
import { getNetworkParams, encodeNote, isAlgoEnabled, isSimulate, simId, simulateLog } from "./client";
import { useWalletStore, signAndSend } from "./wallet";

const GPE_PREFIX = "gpe:";
const FLUSH_INTERVAL_MS = 10_000;
const FLUSH_THRESHOLD = 8;
const MAX_QUEUE = 50;
const MAX_GROUP = 16;
const MAX_AGE_MS = 60 * 60_000;

export type GrowEventType =
  | "BOOST_APPLIED"
  | "STAGE_TRANSITION"
  | "HARVEST"
  | "GENETIC_DISCOVERY"
  | "REWIND";

export interface GrowEvent {
  v: 1;
  event: GrowEventType;
  plant_id: string;
  strain: string;
  data: Record<string, unknown>;
  ts: number;
}

type QueueStatus = "synced" | "queued" | "disconnected";

interface QueueStoreState {
  count: number;
  lastTxId: string | null;
  lastError: string | null;
  flushing: boolean;
  status: QueueStatus;
  _set: (patch: Partial<QueueStoreState>) => void;
}

export const useEventQueueStore = create<QueueStoreState>((set) => ({
  count: 0,
  lastTxId: null,
  lastError: null,
  flushing: false,
  status: "synced",
  _set: (patch) => set(patch),
}));

let queue: GrowEvent[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

function syncStore() {
  const connected = useWalletStore.getState().connected;
  const status: QueueStatus = queue.length === 0 ? "synced" : connected || isSimulate() ? "queued" : "disconnected";
  useEventQueueStore.getState()._set({ count: queue.length, status });
}

function ensureTimer() {
  if (timer || typeof window === "undefined") return;
  timer = setInterval(() => void flushEvents(), FLUSH_INTERVAL_MS);
}

function enqueue(event: GrowEvent) {
  if (!isAlgoEnabled()) return; // whole layer off → drop silently
  queue.push(event);
  // Drop anything stale.
  const cutoff = Date.now() - MAX_AGE_MS;
  const before = queue.length;
  queue = queue.filter((e) => e.ts * 1000 >= cutoff);
  if (queue.length < before) {
    // eslint-disable-next-line no-console
    console.warn(`[algo] dropped ${before - queue.length} grow event(s) older than 1h`);
  }
  // Cap the backlog (keep the most recent).
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  ensureTimer();
  syncStore();
  if (queue.length >= FLUSH_THRESHOLD) void flushEvents();
}

function mk(event: GrowEventType, plantId: string, strain: string, data: Record<string, unknown>): GrowEvent {
  return { v: 1, event, plant_id: plantId, strain, data, ts: Math.floor(Date.now() / 1000) };
}

export function logBoostEvent(plantId: string, strain: string, boostType: string, multiplier: number, durationMs: number) {
  enqueue(mk("BOOST_APPLIED", plantId, strain, { boost_type: boostType, multiplier, duration_ms: durationMs }));
}
export function logStageTransition(plantId: string, strain: string, fromStage: string, toStage: string, growDay: number) {
  enqueue(mk("STAGE_TRANSITION", plantId, strain, { from: fromStage, to: toStage, grow_day: growDay }));
}
export function logHarvest(plantId: string, strain: string, yieldG: number, quality: number, finalGenotype: string) {
  enqueue(mk("HARVEST", plantId, strain, { yield_g: yieldG, quality, final_genotype: finalGenotype }));
}
export function logGeneticDiscovery(plantId: string, strain: string, traitName: string, traitValue: number, rarity: string) {
  enqueue(mk("GENETIC_DISCOVERY", plantId, strain, { trait: traitName, value: traitValue, rarity }));
}
export function logRewind(plantId: string, strain: string, fromDay: number, toDay: number) {
  enqueue(mk("REWIND", plantId, strain, { from_day: fromDay, to_day: toDay }));
}

/** Send a batch of events as one or more atomic groups (≤16 each). Returns tx ids. */
export async function batchLogEvents(events: GrowEvent[]): Promise<string[]> {
  if (!events.length) return [];
  if (isSimulate()) {
    simulateLog("batchLogEvents", events);
    const txId = simId("gpe-batch");
    useEventQueueStore.getState()._set({ lastTxId: txId });
    return [txId];
  }
  const sender = useWalletStore.getState().address;
  if (!sender) throw new Error("Wallet not connected.");
  const suggestedParams = await getNetworkParams();
  const txIds: string[] = [];
  for (let i = 0; i < events.length; i += MAX_GROUP) {
    const slice = events.slice(i, i + MAX_GROUP);
    const txns = slice.map((e) =>
      makePaymentTxnWithSuggestedParamsFromObject({
        sender,
        receiver: sender,
        amount: 0,
        note: encodeNote(GPE_PREFIX, e),
        suggestedParams,
      }),
    );
    const group = assignGroupID(txns);
    const res = await signAndSend(group);
    txIds.push(res.txId);
  }
  return txIds;
}

/** Flush the queue. Holds (no-op) while disconnected in live mode. */
export async function flushEvents(): Promise<void> {
  if (queue.length === 0) return;
  const connected = useWalletStore.getState().connected;
  if (!isSimulate() && !connected) {
    syncStore();
    return; // hold for reconnect
  }
  const batch = queue.slice();
  queue = [];
  syncStore();
  const store = useEventQueueStore.getState();
  store._set({ flushing: true, lastError: null });
  try {
    const txIds = await batchLogEvents(batch);
    store._set({ flushing: false, lastTxId: txIds[txIds.length - 1] ?? store.lastTxId });
  } catch (e) {
    // Re-queue on failure so nothing is lost (capped).
    queue = [...batch, ...queue].slice(-MAX_QUEUE);
    store._set({ flushing: false, lastError: e instanceof Error ? e.message : "Event flush failed." });
    syncStore();
  }
}

/** Test/diagnostic helper. */
export function _queueLength(): number {
  return queue.length;
}
