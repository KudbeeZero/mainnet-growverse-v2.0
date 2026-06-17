import type { ReactNode } from "react";
import { Badge } from "./Badge";
import { RARITY_STYLES, SEVERITY_STYLES, URGENCY_STYLES, titleCase } from "@/lib/format";
import type { Rarity } from "@/lib/types";

export function RarityChip({ rarity }: { rarity: Rarity }) {
  return <Badge className={RARITY_STYLES[rarity]}>{titleCase(rarity)}</Badge>;
}

export function SeverityPill({ severity }: { severity: string }) {
  const cls = SEVERITY_STYLES[severity] ?? "bg-ink-700 text-gray-300 border-ink-600";
  return <Badge className={cls}>{titleCase(severity)}</Badge>;
}

export function UrgencyPill({ urgency }: { urgency: string }) {
  const cls = URGENCY_STYLES[urgency] ?? "bg-ink-700 text-gray-300 border-ink-600";
  return <Badge className={cls}>{urgency}</Badge>;
}

/** Provably-fair verification result chip. */
export function VerifyBadge({
  verifiable,
  verified,
}: {
  verifiable: boolean;
  verified?: boolean;
}) {
  if (!verifiable)
    return <Badge className="border-ink-600 bg-ink-700 text-gray-400">◌ Base catalog</Badge>;
  return verified ? (
    <Badge className="border-grow-600 bg-grow-900/60 text-grow-200 shadow-glow-grow">
      ✓ Provably fair
    </Badge>
  ) : (
    <Badge className="border-red-700 bg-red-950/60 text-red-200">✕ Mismatch</Badge>
  );
}

export function TitleBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-600/60 bg-amber-950/40 px-2.5 py-0.5 text-xs font-medium text-amber-200">
      <span aria-hidden>♛</span>
      {children}
    </span>
  );
}

export function DepartmentChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-grow-500 bg-grow-700 text-white"
          : "border-ink-600 bg-ink-800 text-gray-300 hover:bg-ink-700"
      }`}
    >
      {label}
    </button>
  );
}
