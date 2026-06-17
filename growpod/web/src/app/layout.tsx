import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "GROWv2 — GrowPod Empire",
  description:
    "Grow, breed, and trade real-genetics cannabis strains in real time. A research instrument crossed with a grow dashboard.",
};

export const viewport: Viewport = {
  // `cover` lets the mobile tab bar reach under the home indicator and use
  // env(safe-area-inset-*); themeColor tints the mobile browser chrome to match
  // the near-black app canvas.
  themeColor: "#070a0e",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
