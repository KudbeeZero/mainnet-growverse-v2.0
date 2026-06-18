import { notFound } from "next/navigation";
import { MorphologyPanel } from "./MorphologyPanel";

export const metadata = { title: "Morphology Debug Panel (dev)" };

// DEV-ONLY tuning surface. This route is gated on NODE_ENV: in a production
// build `process.env.NODE_ENV === "production"`, so we 404 before the client
// panel ever renders. Players never see this — it exists only so a developer
// can live-tune strain morphology against the real <GrowChamber> renderer.
export default function MorphologyDebugPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <MorphologyPanel />;
}
