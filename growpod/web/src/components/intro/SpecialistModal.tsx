"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { CONDITION_VISUALS } from "@/lib/conditionVisuals";
import type { AgentFinding } from "./introScript";

/**
 * Confirm dialog for summoning a specialist about an agent's finding.
 *
 * Phase 1: the "payment" is a mock — confirming just shows a success state.
 * Phase 2 will POST a real GROW ledger debit (LedgerEntryType.SPECIALIST_CONSULT)
 * and dispatch the top advisor suggestion. The fee label format (`· NN 🌿`)
 * mirrors plant/CareButtons.tsx so it reads consistently with real care costs.
 */
export function SpecialistModal({
  finding,
  open,
  onClose,
}: {
  finding: AgentFinding | null;
  open: boolean;
  onClose: () => void;
}) {
  const [dispatched, setDispatched] = useState(false);

  if (!finding) return null;
  const visual = CONDITION_VISUALS[finding.condition];

  const handleClose = () => {
    setDispatched(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={finding.specialist}>
      {dispatched ? (
        <div className="text-center">
          <div className="text-3xl">🛰️</div>
          <p className="mt-2 text-sm font-medium text-grow-200">Specialist dispatched</p>
          <p className="mt-1 text-xs text-gray-400">
            {finding.specialist} is on the way to handle the{" "}
            {visual.label.toLowerCase()}.
          </p>
          <div className="mt-4">
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-xs ${visual.badgeClass}`}
            >
              {visual.label}
            </span>
          </div>
          <p className="text-sm text-gray-300">{finding.note}</p>
          <p className="mt-2 text-sm text-gray-400">
            Summon a {finding.specialist.toLowerCase()} to diagnose and treat this for
            you.
          </p>
          <div className="mt-5 flex items-center justify-between">
            <span className="instrument-label text-gray-400">
              Consult fee · {finding.feeGrow} 🌿
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleClose}>
                Not now
              </Button>
              <Button variant="primary" onClick={() => setDispatched(true)}>
                Request specialist · {finding.feeGrow} 🌿
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
