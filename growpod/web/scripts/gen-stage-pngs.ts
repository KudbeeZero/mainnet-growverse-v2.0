// Canonical Stage PNG Generation (PR #29) — headless renderer.
//
// Renders the whole-plant chamber (and a macro bud) for the curated strains across
// the growth-stage matrix, straight to PNG, with NO browser. It drives the exact
// same shared renderer the live <GrowChamber> uses (`chamberCore`), so these images
// are a faithful, deterministic snapshot of what ships — not a reimplementation.
//
// Run:  cd web && npx tsx scripts/gen-stage-pngs.ts
// Out:  web/canonical-stages/<strain>__<stage>.png  (+ <strain>__macro.png)
//
// The structural stills are drawn with motion OFF (sway = 0) so bud-weight droop
// and top-cola lean read cleanly; a short motion strip per strain shows the
// airflow wave (heavier colas lag/▽damp) for the PR #26 review.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "@napi-rs/canvas";

import { createChamberCore, type ChamberView, type LiveState } from "../src/lib/chamber/chamberCore";
import {
  morphologyFor,
  effectiveDev,
  seedForPlant,
  type ClimateInput,
} from "../src/lib/chamber/morphology";
import { silhouetteFor, budColorForStrain, slugify } from "../src/lib/chamber/strainVisuals";
import { budDnaFor } from "../src/lib/chamber/budDna";
import type { GrowthStage } from "../src/lib/types";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "canonical-stages");
const W = 600;
const H = 760;
const SCALE = 2; // device-pixel-ratio equivalent for crisp output

// The curated launch strains (indica_ratio mirrors src/growpodempire/data/strains.yaml).
const STRAINS = [
  { name: "G13", indica: 0.7 },
  { name: "Purple Diddy Punch", indica: 0.8 },
  { name: "Animal Mints", indica: 0.75 },
  { name: "White Rhino", indica: 0.85 },
  { name: "White Fire OG", indica: 0.55 },
  { name: "Gelato", indica: 0.55 },
  { name: "Wedding Cake", indica: 0.6 },
];

// Nominal-day scale matches devParams thresholds (buds 34→66, ripe 40→62, etc.),
// the same scale <GrowChamber> is fed (the strain hero passes day≈62 for flower).
// Seed and germination use their own stage gates so they render the new visuals.
const STAGES: Array<{ label: string; stage: GrowthStage; day: number }> = [
  { label: "0-seed",        stage: "seed",        day:  1 },
  { label: "1-germination", stage: "germination",  day:  5 },
  { label: "2-seedling",    stage: "seedling",     day: 14 },
  { label: "3-vegetative",  stage: "vegetative",   day: 30 },
  { label: "4-early-flower",stage: "flowering",    day: 46 },
  { label: "5-late-flower", stage: "flowering",    day: 62 },
  { label: "6-harvest",     stage: "harvest",      day: 72 },
];

const CLIMATE: ClimateInput = { fan: 45, temp: 24, hum: 50, co2: 900 };

function strainInputs(name: string, indica: number) {
  const slug = slugify(name);
  const morphology = morphologyFor(indica);
  const silhouette = silhouetteFor(slug, indica);
  const budColor = budColorForStrain(slug, morphology.hue, seedForPlant(slug));
  const budDna = budDnaFor(slug, budColor);
  const seed = seedForPlant(slug);
  return { slug, morphology, silhouette, budColor, budDna, seed };
}

function render(opts: {
  seed: number;
  day: number;
  stage: GrowthStage;
  view: ChamberView;
  motionOK: boolean;
  tt: number;
  morphology: ReturnType<typeof morphologyFor>;
  silhouette: ReturnType<typeof silhouetteFor>;
  live: LiveState;
}): Buffer {
  const canvas = createCanvas(W * SCALE, H * SCALE);
  // Cast: @napi-rs/canvas's SKRSContext2D is structurally compatible with the 2D
  // API the renderer uses (verified: setTransform/roundRect/ellipse/gradients/etc).
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  const core = createChamberCore({
    ctx,
    motionOK: opts.motionOK,
    seed: opts.seed,
    day: opts.day,
    stage: opts.stage,
    morphology: opts.morphology,
    silhouette: opts.silhouette,
    view: opts.view,
    live: { current: opts.live },
  });
  core.setSize(W, H);
  core.draw(opts.tt);
  return canvas.toBuffer("image/png");
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  let count = 0;
  for (const s of STRAINS) {
    const { slug, morphology, silhouette, budColor, budDna, seed } = strainInputs(s.name, s.indica);

    // Whole-plant chamber across the stage matrix (structural still, motion off).
    for (const st of STAGES) {
      const live: LiveState = {
        climate: CLIMATE,
        dev: effectiveDev(st.stage, st.day),
        flags: [],
        budColor,
        budDna,
      };
      const buf = render({
        seed, day: st.day, stage: st.stage, view: "chamber",
        motionOK: false, tt: 0, morphology, silhouette, live,
      });
      writeFileSync(join(OUT_DIR, `${slug}__chamber__${st.label}.png`), buf);
      count++;
    }

    // Macro bud (detailed view) at late flower — bud read / frost / colour identity.
    const macroLive: LiveState = {
      climate: CLIMATE, dev: effectiveDev("flowering", 62), flags: [], budColor, budDna,
    };
    writeFileSync(
      join(OUT_DIR, `${slug}__macro.png`),
      render({ seed, day: 62, stage: "flowering", view: "macro", motionOK: false, tt: 0, morphology, silhouette, live: macroLive }),
    );
    count += 1;

    // Motion strip: a few frames of the airflow wave at harvest mass (heavy colas
    // lag/damp) — stills can't show inertia, so emit a small sequence.
    const motionLive: LiveState = {
      climate: { ...CLIMATE, fan: 70 }, dev: effectiveDev("harvest", 72), flags: [], budColor, budDna,
    };
    [0, 0.45, 0.9, 1.35].forEach((tt, i) => {
      writeFileSync(
        join(OUT_DIR, `${slug}__motion__f${i}.png`),
        render({ seed, day: 72, stage: "harvest", view: "chamber", motionOK: true, tt, morphology, silhouette, live: motionLive }),
      );
      count++;
    });
  }
  console.log(`Wrote ${count} canonical PNGs to ${OUT_DIR}`);
}

main();
