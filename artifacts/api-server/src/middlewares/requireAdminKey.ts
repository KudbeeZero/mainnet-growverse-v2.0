// ============================================================================
// FRONTIER — Clone Room :: requireAdminKey guard (Manual Section 9)
// ----------------------------------------------------------------------------
// Temporary auth gate for the /api/plant/* routes until wallet-signature auth
// ships. Mirrors the admin-route gate referenced in the manual: a shared admin
// key supplied via the `x-admin-key` header is checked against ADMIN_KEY.
// ============================================================================

import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

/** Constant-time string compare (avoids a timing side-channel on the key). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // timingSafeEqual requires equal-length buffers; compare a fixed-size digest
  // surrogate by length-guarding first, but still run the compare to keep the
  // timing flat for equal-length mismatches.
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function requireAdminKey(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const expected = process.env.ADMIN_KEY;

  // Fail closed: if no admin key is configured, deny rather than allow all.
  if (!expected) {
    res.status(503).json({ error: "admin_key_not_configured" });
    return;
  }

  const provided = req.header("x-admin-key");
  if (!provided || !safeEqual(provided, expected)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  next();
}
