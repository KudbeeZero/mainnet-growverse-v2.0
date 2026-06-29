"use client";

// Arcade HUD chain row — wallet chip, Mint NFT, event-queue status dot, last tx link.
// Mounted only when NEXT_PUBLIC_ALGO_ENABLE=true (the chamber gates it). All actions
// are best-effort and non-blocking; failures surface as small inline text, never a
// modal, and never block the game.

import { useState } from "react";
import type { PlantState } from "@/lib/types";
import { WalletConnect } from "./WalletConnect";
import { useWalletStore } from "@/lib/chain/algorand/wallet";
import { useEventQueueStore } from "@/lib/chain/algorand/growEvents";
import { explorerTxUrl } from "@/lib/chain/algorand/client";
import { mintPlantNFT, type MintOptions } from "@/lib/chain/algorand/plantNFT";
import { BOOST_APPLIED_EVENT } from "@/lib/arcade/boostEngine";

const DOT_COLOR: Record<string, string> = {
  synced: "#22c55e",
  queued: "#f59e0b",
  disconnected: "#ef4444",
};

export function ChainRow({ plant, mintOptions }: { plant: PlantState; mintOptions?: MintOptions }) {
  const connected = useWalletStore((s) => s.connected);
  const status = useEventQueueStore((s) => s.status);
  const queueCount = useEventQueueStore((s) => s.count);
  const lastTxId = useEventQueueStore((s) => s.lastTxId);

  const [minting, setMinting] = useState(false);
  const [mintErr, setMintErr] = useState<string | null>(null);
  const [minted, setMinted] = useState<{ assetId: number; txId: string } | null>(null);

  async function onMint() {
    setMinting(true);
    setMintErr(null);
    try {
      const res = await mintPlantNFT(plant, mintOptions);
      setMinted({ assetId: res.assetId, txId: res.txId });
      // Celebrate with a NutrientPop burst (visual only — not a real grow boost).
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(BOOST_APPLIED_EVENT, {
            detail: { type: "NUTRIENT_SURGE", multiplier: 1, duration: 0 },
          }),
        );
      }
    } catch (e) {
      setMintErr(e instanceof Error ? e.message : "Mint failed.");
    } finally {
      setMinting(false);
    }
  }

  const txLink = minted?.txId ?? lastTxId;

  return (
    <div className="mb-2 flex flex-col gap-1.5">
      <WalletConnect />
      <div className="flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-[#08141e]/85 px-2.5 py-1.5 backdrop-blur">
        <button
          onClick={onMint}
          disabled={!connected || minting}
          className="rounded-md border border-grow-500/50 bg-grow-500/15 px-2.5 py-1 text-[11px] font-bold text-grow-100 hover:bg-grow-500/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {minting ? "Minting…" : minted ? "Minted ✓" : "Mint NFT"}
        </button>

        {minted && minted.assetId > 0 && (
          <span className="font-mono text-[10px] text-cyan-200/70">#{minted.assetId}</span>
        )}

        {/* Event-queue status dot. */}
        <span className="ml-auto flex items-center gap-1" title={`events: ${status} (${queueCount})`}>
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: DOT_COLOR[status] ?? "#64748b" }}
            aria-hidden
          />
          <span className="font-mono text-[9px] uppercase tracking-wide text-cyan-200/60">
            {status}
            {queueCount > 0 ? ` ${queueCount}` : ""}
          </span>
        </span>

        {txLink && !txLink.includes("SIM") && (
          <a
            href={explorerTxUrl(txLink)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-cyan-300 underline hover:text-cyan-100"
          >
            {txLink.slice(0, 6)}…
          </a>
        )}

        {mintErr && <span className="text-[10px] text-orange-300">{mintErr}</span>}
      </div>
    </div>
  );
}
