import type { ReactNode } from "react";
import { RequireFeature } from "@/components/layout/RequireFeature";

export default function CupLayout({ children }: { children: ReactNode }) {
  return <RequireFeature feature="cup">{children}</RequireFeature>;
}
