"use client";

// Wallet connect chip for the Arcade HUD chain row. Pera for real signing; a small
// "Dev" option spins up an ephemeral TestNet account for local testing. Always wears
// a TESTNET pill so there's no confusion about which network this is.

import { useState } from "react";
import {
  useWalletStore,
  connectWallet,
  disconnectWallet,
} from "@/lib/chain/algorand/wallet";
import { isFaucetAvailable, requestTestnetAlgo } from "@/lib/chain/algorand/devFaucet";

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletConnect() {
  const address = useWalletStore((s) => s.address);
  const connected = useWalletStore((s) => s.connected);
  const connecting = useWalletStore((s) => s.connecting);
  const error = useWalletStore((s) => s.error);
  const [funding, setFunding] = useState(false);

  async function onConnect(mode: "pera" | "dev") {
    try {
      await connectWallet(mode);
    } catch {
      // error is surfaced via the store
    }
  }

  async function onFund() {
    if (!address) return;
    setFunding(true);
    try {
      await requestTestnetAlgo(address);
    } catch {
      // best-effort
    } finally {
      setFunding(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-[#08141e]/85 px-2.5 py-1.5 backdrop-blur">
      <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-300">
        Testnet
      </span>

      {connected && address ? (
        <>
          <span className="font-mono text-[11px] text-cyan-100">{truncate(address)}</span>
          {isFaucetAvailable() && (
            <button
              onClick={onFund}
              disabled={funding}
              className="rounded-md border border-cyan-400/40 px-2 py-0.5 text-[10px] font-bold text-cyan-200 hover:bg-cyan-400/10 disabled:opacity-50"
            >
              {funding ? "Funding…" : "Fund"}
            </button>
          )}
          <button
            onClick={() => disconnectWallet()}
            className="ml-auto rounded-md px-1.5 py-0.5 text-[10px] text-cyan-200/60 hover:text-cyan-100"
          >
            Disconnect
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => onConnect("pera")}
            disabled={connecting}
            className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-bold text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-50"
          >
            {connecting ? "Connecting…" : "Connect Wallet"}
          </button>
          {isFaucetAvailable() && (
            <button
              onClick={() => onConnect("dev")}
              disabled={connecting}
              className="rounded-md px-1.5 py-1 text-[10px] text-cyan-200/60 hover:text-cyan-100"
            >
              Dev
            </button>
          )}
        </>
      )}

      {error && <span className="ml-1 text-[10px] text-orange-300">{error}</span>}
    </div>
  );
}
