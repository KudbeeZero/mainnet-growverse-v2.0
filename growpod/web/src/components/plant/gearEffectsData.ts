import type { GearEffects } from "@/lib/api/store";

/** Human-readable preview lines for a gear item's `effects` block — e.g.
 * "−15% pest risk · −10% mildew growth" — so a player can see the tradeoff
 * before equipping (ROADMAP_90D week 2-3, "equip/unequip for fans+soils with
 * an effect preview line"). Order is fixed so the same gear always previews
 * identically. Returns [] for gear with no effects (lights today). */
export function formatGearEffects(effects: GearEffects | undefined): string[] {
  if (!effects) return [];
  const lines: string[] = [];
  // A multiplier < 1 is a reduction (shown as a negative %); > 1 an increase.
  const pctChange = (mult: number) => Math.round((mult - 1) * 100);

  if (effects.pest_spawn_mult !== undefined && effects.pest_spawn_mult !== 1) {
    lines.push(signed(pctChange(effects.pest_spawn_mult)) + "% pest risk");
  }
  if (effects.disease_growth_mult !== undefined && effects.disease_growth_mult !== 1) {
    lines.push(signed(pctChange(effects.disease_growth_mult)) + "% mildew growth");
  }
  if (effects.humidity_offset_pct) {
    lines.push(signed(effects.humidity_offset_pct) + "% humidity");
  }
  if (effects.temp_offset_c) {
    lines.push(signed(effects.temp_offset_c) + "°C");
  }
  if (effects.water_decay_mult !== undefined && effects.water_decay_mult !== 1) {
    lines.push(signed(pctChange(effects.water_decay_mult)) + "% water use");
  }
  if (effects.nutrient_decay_mult !== undefined && effects.nutrient_decay_mult !== 1) {
    lines.push(signed(pctChange(effects.nutrient_decay_mult)) + "% nutrient use");
  }
  if (effects.flowering_quality_bonus) {
    lines.push(signed(effects.flowering_quality_bonus) + " quality (flowering)");
  }
  return lines;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
