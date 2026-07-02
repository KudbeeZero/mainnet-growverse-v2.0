import { notFound } from "next/navigation";
import { BudGLDevPanel } from "./BudGLDevPanel";

export const metadata = { title: "Close-up Bud Studio (dev)" };

// DEV-ONLY studio for the LIVE close-up bud renderer (BudGL / StrainBud3D). Gated
// on NODE_ENV exactly like app/dev/plant3d, so a production build 404s before the
// client panel renders. Used to review the shipped close-up bud in isolation
// against the reference photos + 3D quality rubric.
export default function BudGLDevPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <BudGLDevPanel />;
}
