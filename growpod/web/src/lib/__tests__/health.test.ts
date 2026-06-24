import { describe, expect, it } from "vitest";
import { healthDotClass, healthLabel, healthStatus } from "@/lib/health";

describe("health badge mappers", () => {
  it("labels each status", () => {
    expect(healthLabel("online")).toMatch(/online/i);
    expect(healthLabel("offline")).toMatch(/unreachable/i);
    expect(healthLabel("checking")).toMatch(/checking/i);
  });

  it("colours the dot green/red/amber", () => {
    expect(healthDotClass("online")).toContain("grow-500");
    expect(healthDotClass("offline")).toContain("red-500");
    expect(healthDotClass("checking")).toContain("amber-400");
  });

  it("derives status from query flags (error wins over loading)", () => {
    expect(healthStatus({ isLoading: true, isError: false })).toBe("checking");
    expect(healthStatus({ isLoading: false, isError: true })).toBe("offline");
    expect(healthStatus({ isLoading: true, isError: true })).toBe("offline");
    expect(healthStatus({ isLoading: false, isError: false })).toBe("online");
  });
});
