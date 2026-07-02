import { notFound } from "next/navigation";
import { TrichomeRushPanel } from "./TrichomeRushPanel";

export const metadata = { title: "Trichome Rush Preview (dev)" };

// DEV-ONLY preview surface for the Trichome Rush arcade overlay. Gated on
// NODE_ENV exactly like app/dev/morphology and app/dev/plant3d: a production
// build 404s before the client panel renders, so this never ships to players.
export default function TrichomeRushDevPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <TrichomeRushPanel />;
}
