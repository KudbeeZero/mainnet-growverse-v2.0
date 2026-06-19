import Link from "next/link";
import { APP_VERSION, BUILD_SHA, IS_DEPLOYED_BUILD } from "@/lib/version";

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
        {/* Build stamp: version + the deployed commit SHA so you can confirm at a
            glance which build is live. The SHA only renders for real deploys. */}
        <span className="font-mono" title={IS_DEPLOYED_BUILD ? `build ${BUILD_SHA}` : "local build"}>
          v{APP_VERSION}
          {IS_DEPLOYED_BUILD && <span className="text-gray-600"> · {BUILD_SHA}</span>}
        </span>
      </p>
    </footer>
  );
}
