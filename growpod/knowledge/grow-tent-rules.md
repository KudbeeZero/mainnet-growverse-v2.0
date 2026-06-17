# Grow Tent Rules

> The chamber/grow-tent scene that houses the live plant (distinct from the macro
> Detailed Bud View). See `botanical-bible.md`.
> Implementation: `web/src/components/viz/GrowChamber.tsx` (`view="chamber"`),
> `web/src/app/dashboard/plants/[plantId]/chamber/page.tsx`.

## Scene
- Orbital grow-pod interior: gradient backdrop, faint star/link field, a glowing
  halo light ring, soil disc with cracks, and rig props — a **CO₂ canister**
  (glow scales with CO₂) and a **fan** (blade speed scales with airflow; windburn
  streaks at high fan).
- The **plant** grows on a spine with nodes (branches + fan leaves), node buds in
  flowering, and a top cola — server-stage-gated.

## Climate controls (chamber "CLIMATE" tab)
Five persisted fields + a visual-only FAN: temperature, humidity, CO₂, light, pH.
Each slider shows the no-penalty optimal band; out-of-band values tint orange.
Slider drags are debounced (~700ms) into one persisted write to the pod.

## Climate model (visual)
`climateModel()` in `morphology.ts` turns climate into sway/windburn, a CO₂ growth
hint, and an on-screen health hint. **Optimal bands mirror `balance.yaml`** so the
card / advisor / sim agree — keep them in sync.

## Growth-preview slider (chamber "TIME" tab)
Scrubs the plant seed→harvest as a **preview** (never mutates server state);
development is scaled to the strain's flowering window (`previewDev`).

## Environment → bud
The pod's committed climate + the plant's water level feed
`applyEnvironmentToBudDNA` (see `environment-rules.md`), so the bud's phenotype
reflects the real grow conditions.

## Optimal bands (from `balance.yaml`, keep authoritative)
Temp ~20–28°C · Humidity ~40–60% · Light (PPFD) ~300–900 · CO₂ ~800–1500 ·
pH ~6.0–7.0. The Botanical Bible's strain grow ranges must stay within / cite these.
