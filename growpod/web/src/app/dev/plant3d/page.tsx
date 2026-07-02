import { notFound } from "next/navigation";
import { Plant3DPanel } from "./Plant3DPanel";

export const metadata = { title: "Whole-Plant 3D Studio (dev)" };

// DEV-ONLY studio preview for the layered whole-plant 3D asset (Blue Dream
// pilot). Gated on NODE_ENV exactly like app/dev/morphology and
// app/dev/plant-review: a production build 404s before the client panel renders,
// so this standalone review surface never ships to players. Wiring the asset
// into the pod comes later, after owner approval.
export default function Plant3DDevPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Plant3DPanel />;
}
