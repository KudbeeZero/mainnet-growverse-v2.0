# Environment Rules (§11)

> Canonical environmental reaction system. See `botanical-bible.md`.
> Implementation: `applyEnvironmentToBudDNA(base, env)` in
> `web/src/lib/chamber/budDna.ts`. **Non-mutating** — returns a modified copy of
> the genetic preset; never edits the shared preset.

## Principle
Grow conditions **nudge** the rendered phenotype; they never erase strain
identity. Green strains shift only slightly; purple-capable strains shift hard.

## Inputs (`GrowEnvironment`)
`temp` (°C), `light` (PPFD-ish 0–1000), `humidity` (%), `water` (plant 0–100).
On the chamber page these come from the pod's **committed** environment + the
plant's water level (not the live in-drag slider), so the bud reacts to the real
saved conditions.

## Reactions
| Condition | Trigger (factor) | Effect |
|-----------|------------------|--------|
| **Cool nights** | `temp < ~20°C` | +purple: a faint shadow on green strains, strong on purple-capable ones (scaled by existing purple palette share). Subtle edges first. |
| **High UV / strong light** | `light > ~600` | +`trichomeDensity`, +`highlightBoost` (brighter specular). |
| **Light stress** | `light > ~850` | +`foxtailBias`, +`topStretch` (more pointed/foxtail calyxes, stretched irregular top). |
| **Drought** | `water < ~45` | smaller `calyxSize`, lower `overlap`, tighter `maxBudWidth`, darker greens (palette `lit` ↓). |
| **High humidity** | `humidity > ~60` | sets hidden **`moldRisk`** only — no visual yet (reserved for a future disease layer). |

## Notes / altitude
- `moldRisk` is a placeholder. The authoritative source of a humidity→mold signal
  is the **server simulation** (`src/growpodempire/simulation/`), not the client;
  this field exists so the renderer can later read that signal, not invent it.
- Strain-profile hero uses the **genetic baseline** (no environment applied).
