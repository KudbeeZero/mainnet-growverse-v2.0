import { redirect } from "next/navigation";

// Retired: account now lives in /profile (identity, titles, wallet/ledger,
// achievements, harvest vault). Kept as a redirect so old links still resolve.
export default function AccountPage() {
  redirect("/profile");
}
