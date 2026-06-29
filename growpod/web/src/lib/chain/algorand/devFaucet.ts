"use client";

// Dev-only TestNet faucet. Tops up an ephemeral dev wallet so automated UI testing
// can sign real transactions. Active ONLY on testnet AND in dev — never in prod, and
// never for mainnet. Best-effort: a failure just means "go use the web dispenser".

import { AlgoClientError, algoNetwork } from "./client";

const DISPENSER_URL = "https://dispenser.testnet.aws.algodev.network/";
const DEFAULT_MICROALGO = 10_000_000; // 10 ALGO

function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** True when the faucet button should be offered at all. */
export function isFaucetAvailable(): boolean {
  return algoNetwork() === "testnet" && isDev();
}

export async function requestTestnetAlgo(
  address: string,
  amount = DEFAULT_MICROALGO,
): Promise<{ txId: string; amount: number }> {
  if (!isFaucetAvailable()) throw new AlgoClientError("Faucet is only available on testnet in dev.");
  try {
    const resp = await fetch(DISPENSER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiver: address, amount }),
    });
    if (!resp.ok) throw new AlgoClientError(`Faucet returned ${resp.status}.`);
    const body = (await resp.json().catch(() => ({}))) as { txId?: string };
    return { txId: body.txId ?? "", amount };
  } catch (e) {
    throw e instanceof AlgoClientError ? e : new AlgoClientError("Couldn't reach the TestNet faucet.", e);
  }
}
