import { buildPlantAssembly } from "./src/lib/plant3d/assembly.ts";
import { budDnaFor } from "./src/lib/chamber/budDna.ts";
import { budColorForStrain, silhouetteFor } from "./src/lib/chamber/strainVisuals.ts";
const dna = budDnaFor("blue-dream", budColorForStrain("blue-dream", 110, 42));
const sil = silhouetteFor("blue-dream", 0.4);
for (const lod of ["close","mid","far"] as const) {
  const a = buildPlantAssembly(dna, sil, 42, { lod });
  const c = a.counts;
  // tri-per-instance: calyx lathe(5prof,5rad)=40, core lathe(20,14 w/tip)=~532, frost octa=8, pistil tube(6,3)=36, sugar shape~8, leaf 9 leaflets~99
  const tris = c.calyxes*8 + c.colas*532 + c.frost*8 + c.pistils*36 + c.sugar*8 + c.leaves*99;
  const branchTubes = a.skeleton.branches.length*60 + 800; // approx stem+branch tubes
  console.log(lod, JSON.stringify(c), "~tris", (tris+branchTubes).toLocaleString());
}
