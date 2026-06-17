import type { ReactNode } from "react";
import { RequireFeature } from "@/components/layout/RequireFeature";

export default function UniversityLayout({ children }: { children: ReactNode }) {
  return <RequireFeature feature="university">{children}</RequireFeature>;
}
