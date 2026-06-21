import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { classifyApiError, describeApiError } from "@/lib/apiError";

describe("classifyApiError", () => {
  it("maps a network failure (status 0) to offline", () => {
    expect(classifyApiError(new ApiError("Network error", 0)).kind).toBe("offline");
  });

  it("maps 401/403 to auth and 404 to not_found", () => {
    expect(classifyApiError(new ApiError("nope", 401)).kind).toBe("auth");
    expect(classifyApiError(new ApiError("nope", 403)).kind).toBe("auth");
    expect(classifyApiError(new ApiError("missing", 404)).kind).toBe("not_found");
  });

  it("maps 429 to rate_limited and 5xx to server", () => {
    expect(classifyApiError(new ApiError("slow down", 429)).kind).toBe("rate_limited");
    expect(classifyApiError(new ApiError("boom", 500)).kind).toBe("server");
    expect(classifyApiError(new ApiError("boom", 503)).kind).toBe("server");
  });

  it("falls back to the raw message for unknown errors", () => {
    expect(describeApiError(new Error("weird"))).toBe("weird");
    expect(classifyApiError(new Error("weird")).kind).toBe("unknown");
  });

  it("always yields a non-empty actionable message", () => {
    for (const s of [0, 401, 403, 404, 429, 500]) {
      expect(describeApiError(new ApiError("x", s)).length).toBeGreaterThan(0);
    }
  });
});
