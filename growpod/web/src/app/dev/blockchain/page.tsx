import { notFound } from "next/navigation";
import { BlockchainTestPanel } from "./BlockchainTestPanel";

export const metadata = { title: "Blockchain Testing (dev)" };

// DEV-ONLY blockchain testing surface. This route is gated on NODE_ENV exactly like
// app/dev/morphology and app/dev/plant-review: in a production build NODE_ENV !== "development",
// so we 404 before the client panel ever renders. Players never see this — it exists only for
// developers to test blockchain connectivity, wallet integration, NFT minting, settlement flows,
// and testnet faucet operations.
export default function BlockchainTestPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <BlockchainTestPanel />;
}
