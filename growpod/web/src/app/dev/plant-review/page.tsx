import { notFound } from "next/navigation";
import { PlantReviewPanel } from "./PlantReviewPanel";

export const metadata = { title: "Plant Visual Review (dev)" };

// DEV-ONLY review surface. This route is gated on NODE_ENV exactly like
// app/dev/morphology: in a production build `process.env.NODE_ENV === "production"`,
// so we 404 before the client panel ever renders. Players never see this — it
// exists only so a developer/owner can inspect the real <GrowChamber> renderer
// across stage / day / morphology / view / climate / condition states.
export default function PlantReviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PlantReviewPanel />;
}
