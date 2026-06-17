// ============================================================================
// FRONTIER — Clone Room :: requireAdminKey guard (Manual Section 9)
// ----------------------------------------------------------------------------
// Temporary auth gate for the /api/plant/* routes until wallet-signature auth
// ships. Mirrors the admin-route gate referenced in the manual: a shared admin
// key supplied via the `x-admin-key` header is checked against ADMIN_KEY.
// ============================================================================

import type { Request, Response, NextFunction } from "express";

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
  if (!provided || provided !== expected) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  next();
}
