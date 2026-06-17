import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { isAuthError } from "@/lib/authError";

describe("isAuthError", () => {
  it("is true for 401 and 403 ApiErrors", () => {
    expect(isAuthError(new ApiError("unauthorized", 401))).toBe(true);
    expect(isAuthError(new ApiError("forbidden", 403))).toBe(true);
  });

  it("is false for other ApiError statuses", () => {
    expect(isAuthError(new ApiError("bad request", 400))).toBe(false);
    expect(isAuthError(new ApiError("not found", 404))).toBe(false);
    expect(isAuthError(new ApiError("server", 500))).toBe(false);
    expect(isAuthError(new ApiError("network", 0))).toBe(false);
  });

  it("is false for non-ApiError values", () => {
    expect(isAuthError(new Error("401"))).toBe(false);
    expect(isAuthError({ status: 401 })).toBe(false);
    expect(isAuthError(null)).toBe(false);
    expect(isAuthError(undefined)).toBe(false);
    expect(isAuthError("403")).toBe(false);
  });
});
