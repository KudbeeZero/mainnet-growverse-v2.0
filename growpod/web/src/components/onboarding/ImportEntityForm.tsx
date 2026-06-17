"use client";

import { useState } from "react";
import { usePlantImport } from "@/hooks/useCareActions";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";

/** Recover a plant on a fresh device by pasting its id (validated via /state). */
export function ImportEntityForm() {
  const [plantId, setPlantId] = useState("");
  const importPlant = usePlantImport();

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (plantId.trim()) importPlant.mutate(plantId.trim(), { onSuccess: () => setPlantId("") });
      }}
    >
      <TextInput
        value={plantId}
        onChange={(e) => setPlantId(e.target.value)}
        placeholder="Import plant by ID…"
        className="max-w-xs"
      />
      <Button size="sm" variant="secondary" type="submit" loading={importPlant.isPending}>
        Import
      </Button>
    </form>
  );
}
