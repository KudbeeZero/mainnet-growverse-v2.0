import Link from "next/link";
import { APP_VERSION, BUILD_SHA, BUILD_TIME_CT, IS_DEPLOYED_BUILD } from "@/lib/version";

// Tasteful creator branding so people arriving from Twitter recognize Kudbee,
// plus a quick path to the in-game Guide. Lives at the bottom of the app shell.
export function Footer() {
  return (
    <footer className="mt-10 border-t border-ink-700 pt-4 text-center text-xs text-gray-500">
      <p>
        <span className="text-gray-400">GrowVerse</span> by{" "}
        <span className="font-semibold text-grow-300">Kudbee</span>
        <span className="mx-1">·</span>built on Algorand
      </p>
      <p className="mt-1">
        <Link href="/guide" className="hover:text-grow-300 hover:underline">
          Grow Guide
        </Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="hover:text-grow-300 hover:underline">
          Privacy
        </Link>
        <span className="mx-2">·</span>
        {/* Build stamp: version + the deployed commit SHA so you can confirm at a
            glance which build is live. The SHA only renders for real deploys. */}
        <span className="font-mono" title={IS_DEPLOYED_BUILD ? `build ${BUILD_SHA}` : "local build"}>
          v{APP_VERSION}
          {IS_DEPLOYED_BUILD && <span className="text-gray-600"> · {BUILD_SHA}</span>}
        </span>
        {BUILD_TIME_CT && (
          <>
            <span className="mx-2">·</span>
            {/* suppressHydrationWarning: BUILD_TIME_CT is formatted via
                Date#toLocaleString on BOTH server and client, and Node's ICU vs
                the browser's differ on the narrow-no-break-space before AM/PM —
                a benign text-only mismatch that was firing React #418 on every
                page (the footer is in the app shell). Same value, different
                whitespace; suppress the one span rather than re-architect it. */}
            <span
              className="font-mono text-gray-600"
              title="Build time (US Central)"
              suppressHydrationWarning
            >
              {BUILD_TIME_CT}
            </span>
          </>
        )}
      </p>
    </footer>
  );
}
