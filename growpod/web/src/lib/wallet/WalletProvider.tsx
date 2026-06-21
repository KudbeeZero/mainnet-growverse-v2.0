"use client";

// Real Algorand wallet connection — the same library (@txnlab/use-wallet) and the
// same three wallets as algofaucet.org: Pera · Defly · Lute, on TestNet. Lute is
// a browser wallet (no setup); Pera/Defly connect via their own SDKs. To target a
// different network later, change defaultNetwork.

import type { ReactNode } from "react";
import {
  NetworkId,
  WalletId,
  WalletManager,
  WalletProvider as UseWalletProvider,
} from "@txnlab/use-wallet-react";

const manager = new WalletManager({
  wallets: [WalletId.PERA, WalletId.DEFLY, WalletId.LUTE],
  defaultNetwork: NetworkId.TESTNET,
});

export function WalletProvider({ children }: { children: ReactNode }) {
  return <UseWalletProvider manager={manager}>{children}</UseWalletProvider>;
}
