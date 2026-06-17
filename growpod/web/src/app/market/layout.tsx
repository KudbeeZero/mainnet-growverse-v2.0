import type { ReactNode } from "react";
import { RequireFeature } from "@/components/layout/RequireFeature";

export default function MarketLayout({ children }: { children: ReactNode }) {
  return <RequireFeature feature="marketplace">{children}</RequireFeature>;
}
