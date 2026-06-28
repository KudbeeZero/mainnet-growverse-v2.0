"use client";

// Wallet layer — connect, disconnect, sign & send.
//
// Real signing goes through Pera Wallet: the user's keys live in their wallet and
// never touch our code. The 'dev' mode creates an EPHEMERAL in-memory account
// (algosdk.generateAccount()) for local automated UI testing — it holds no funds
// until the TestNet faucet tops it up, and its secret key is never persisted,
// logged, or committed. We deliberately do NOT read a mnemonic from env in the
// browser (NEXT_PUBLIC_* is client-exposed); any real funded automation should sign
// server-side via the existing Python chain ABC, not here.

import { generateAccount, type Transaction } from "algosdk";
import { PeraWalletConnect } from "@perawallet/connect";
import { create } from "zustand";
import { AlgoClientError, getAlgodClient, waitForConfirmation } from "./client";

export type WalletMode = "pera" | "dev";

interface WalletState {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  mode: WalletMode | null;
  _set: (patch: Partial<WalletState>) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  connected: false,
  connecting: false,
  error: null,
  mode: null,
  _set: (patch) => set(patch),
}));

// Pera singleton (lazy — constructing it touches browser-only globals).
let _pera: PeraWalletConnect | null = null;
function getPera(): PeraWalletConnect {
  if (!_pera) _pera = new PeraWalletConnect();
  return _pera;
}

// Ephemeral dev signer — sk kept module-private, never exported or logged.
let _devSk: Uint8Array | null = null;

export function getWalletAddress(): string | null {
  return useWalletStore.getState().address;
}

export async function connectWallet(mode: WalletMode): Promise<{ address: string; connected: boolean }> {
  const { _set } = useWalletStore.getState();
  _set({ connecting: true, error: null });
  try {
    if (mode === "dev") {
      const acct = generateAccount();
      _devSk = acct.sk;
      const address = acct.addr.toString();
      _set({ address, connected: true, connecting: false, mode: "dev" });
      return { address, connected: true };
    }
    const accounts = await getPera().connect();
    const address = accounts[0];
    if (!address) throw new AlgoClientError("No account returned from Pera.");
    // Surface a wallet-initiated disconnect.
    getPera().connector?.on("disconnect", () => disconnectWallet());
    _set({ address, connected: true, connecting: false, mode: "pera" });
    return { address, connected: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Wallet connection failed.";
    _set({ connecting: false, error: msg });
    throw e instanceof AlgoClientError ? e : new AlgoClientError(msg, e);
  }
}

export async function disconnectWallet(): Promise<void> {
  const { mode, _set } = useWalletStore.getState();
  try {
    if (mode === "pera") await getPera().disconnect();
  } catch {
    // Ignore — we reset local state regardless.
  }
  _devSk = null;
  _set({ address: null, connected: false, mode: null, error: null });
}

/**
 * Sign a transaction (or atomic group) with the connected wallet and submit it.
 * Callers gate on isSimulate() before reaching here — this is the real-send path.
 */
export async function signAndSend(
  txns: Transaction[],
): Promise<{ txId: string; confirmedRound: number; assetIndex?: number }> {
  const { mode, address } = useWalletStore.getState();
  if (!address || !mode) throw new AlgoClientError("Connect a wallet first.");
  if (!txns.length) throw new AlgoClientError("No transactions to send.");

  const algod = getAlgodClient();
  let signed: Uint8Array[];
  if (mode === "dev") {
    if (!_devSk) throw new AlgoClientError("Dev signer is not initialised.");
    signed = txns.map((t) => t.signTxn(_devSk as Uint8Array));
  } else {
    const groups = [txns.map((txn) => ({ txn }))];
    signed = await getPera().signTransaction(groups);
  }

  try {
    await algod.sendRawTransaction(signed).do();
    const txId = txns[0].txID();
    const res = await waitForConfirmation(txId, 4);
    const confirmedRound = Number(res.confirmedRound ?? 0);
    const assetIndex = res.assetIndex != null ? Number(res.assetIndex) : undefined;
    return { txId, confirmedRound, assetIndex };
  } catch (e) {
    throw e instanceof AlgoClientError ? e : new AlgoClientError("Failed to submit the transaction.", e);
  }
}
