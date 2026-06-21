"use client";

// The algofaucet-style "Connect wallet" control: one button that expands to the
// three wallet choices (Pera · Defly · Lute). Connected → shows the address +
// Disconnect. Pure wallet UX; linking the address to the player is handled by the
// caller via `onConnected` / `onDisconnected` (see the Profile wallet section).

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { Button } from "@/components/ui/Button";

function shorten(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

export function ConnectWalletButton({
  onConnected,
  onDisconnected,
}: {
  onConnected?: (address: string) => void;
  onDisconnected?: () => void;
}) {
  const { wallets, activeAddress, activeWallet } = useWallet();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Surface connect/disconnect to the caller (e.g. link/unlink to the player).
  const lastAddr = useRef<string | null>(null);
  useEffect(() => {
    if (activeAddress && activeAddress !== lastAddr.current) {
      lastAddr.current = activeAddress;
      onConnected?.(activeAddress);
    } else if (!activeAddress && lastAddr.current) {
      lastAddr.current = null;
      onDisconnected?.();
    }
  }, [activeAddress, onConnected, onDisconnected]);

  // Close the wallet menu on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (activeAddress) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded bg-grow-700/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-grow-300">
          Connected
        </span>
        <code className="rounded-md border border-ink-600 bg-ink-900 px-2 py-1 text-xs text-gray-300">
          {shorten(activeAddress)}
        </code>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            try {
              await activeWallet?.disconnect();
            } catch {
              /* ignore — surface nothing if the wallet rejects */
            }
          }}
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="relative inline-block" ref={menuRef}>
      <Button size="sm" onClick={() => setOpen((o) => !o)} disabled={busy}>
        {busy ? "Connecting…" : "Connect wallet"}
      </Button>
      {open && (
        <div className="absolute z-50 mt-2 w-56 overflow-hidden rounded-xl border border-ink-600 bg-ink-800 shadow-glow-soft">
          {wallets.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={async () => {
                setOpen(false);
                setBusy(true);
                try {
                  await w.connect();
                } catch {
                  /* user closed the wallet / rejected — no-op */
                } finally {
                  setBusy(false);
                }
              }}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-gray-100 transition-colors hover:bg-grow-700/20"
            >
              {w.metadata.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.metadata.icon} alt="" className="h-6 w-6 rounded" />
              ) : null}
              <span className="font-medium">{w.metadata.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
