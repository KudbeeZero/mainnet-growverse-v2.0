import { redirect } from "next/navigation";

// Retired: NPC contracts now live under the Market → Contracts tab.
export default function ContractsPage() {
  redirect("/market");
}
