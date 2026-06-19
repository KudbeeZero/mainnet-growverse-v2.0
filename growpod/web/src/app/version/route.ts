import { NextResponse } from "next/server";
import { BUILD_INFO } from "@/lib/version";

// GET /version — machine-readable build stamp (version, commit SHA, build time,
// deploy env). Lets you (or a status dashboard / Mission Control) confirm which
// exact build is live without opening the UI. Values are baked at build time,
// so this is a static, cacheable response.
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(BUILD_INFO);
}
