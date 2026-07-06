import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { APP_VERSION } from "@/lib/version";

// Plain-language privacy policy. FLAGGED FOR LEGAL REVIEW before a public/App
// Store launch — this describes what GrowVerse actually collects today (see
// db/models.py: Player, WaitlistSignup) in good faith, but is not a substitute
// for counsel sign-off.
export const metadata = {
  title: "Privacy Policy — GrowVerse",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-grow-200">Privacy Policy</h1>
        <p className="text-sm text-gray-400">
          GrowVerse by Kudbee · v{APP_VERSION}
        </p>
      </div>

      <Card className="border-yellow-700/40 bg-yellow-900/10">
        <p className="text-xs text-yellow-500">
          ⚠️ Draft — flagged for legal review before a public or App Store launch.
          This page describes what we collect in plain language; it is not a
          substitute for a lawyer-reviewed policy.
        </p>
      </Card>

      <Card>
        <CardHeader title="What we collect" />
        <div className="space-y-2 text-sm text-gray-400">
          <p>
            <strong className="text-gray-300">Account &amp; gameplay data.</strong>{" "}
            A username, your in-game progress (plants, harvests, strains, GC
            balance), and a per-account API key used to authenticate your
            requests. No password or real name is required to play.
          </p>
          <p>
            <strong className="text-gray-300">Wallet address (optional).</strong>{" "}
            If you link an Algorand wallet, we store the public wallet address
            you provide so on-chain assets (minted strains/harvests) can be
            associated with your account. We never store or have access to
            your private keys or seed phrase — wallet signing always happens
            in your own wallet app.
          </p>
          <p>
            <strong className="text-gray-300">Waitlist signup (optional).</strong>{" "}
            If you join the pre-launch waitlist, we store your chosen faction
            and, if you provide them, an email address and/or wallet address —
            used only to notify you about launch and any future reward
            airdrop. This is separate from the in-game economy.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="What we don't do" />
        <div className="space-y-1 text-sm text-gray-400">
          <p>We don&apos;t sell your data.</p>
          <p>We don&apos;t require real-world identity to play.</p>
          <p>
            We don&apos;t share your data with third parties beyond what&apos;s
            needed to run the game: hosting/database providers, and an AI
            provider (Anthropic) that powers the in-game Master Grower advisor
            and lecture features — your gameplay questions and plant/strain
            context are sent there to generate a response, never your wallet
            address or account credentials.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Your choices" />
        <p className="text-sm text-gray-400">
          You can unlink your wallet at any time from your account settings.
          Self-serve account deletion isn&apos;t built yet — this is tracked
          as a known gap ahead of a public launch. See the{" "}
          <Link href="/guide" className="text-grow-300 hover:underline">
            Grow Guide
          </Link>{" "}
          for what&apos;s live today.
        </p>
      </Card>
    </div>
  );
}
