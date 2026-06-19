import Link from "next/link";
import { APP_VERSION } from "@/lib/version";

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
        <span className="font-mono">v{APP_VERSION}</span>
      </p>
    </footer>
  );
}
