import { describe, expect, it } from "vitest";
import {
  formatScalar,
  humanizeKnowledgeKey,
  humanizeList,
} from "@/lib/knowledgeFormat";

describe("humanizeKnowledgeKey", () => {
  it("uses unit-aware labels for known cultivation keys", () => {
    expect(humanizeKnowledgeKey("vpd_kpa")).toBe("VPD (kPa)");
    expect(humanizeKnowledgeKey("rh_flower_pct")).toBe("RH · flower (%)");
  });
  it("title-cases unknown keys", () => {
    expect(humanizeKnowledgeKey("some_new_field")).toBe("Some New Field");
  });
});

describe("formatScalar", () => {
  it("turns hyphen ranges into en-dashes", () => {
    expect(formatScalar("20-26")).toBe("20–26");
    expect(formatScalar("0.8-1.3")).toBe("0.8–1.3");
  });
  it("title-cases lowercase slugs and formats booleans", () => {
    expect(formatScalar("indoor")).toBe("Indoor");
    expect(formatScalar("flip to 12/12")).toBe("flip to 12/12");
    expect(formatScalar(true)).toBe("Yes");
  });
});

describe("humanizeList", () => {
  it("joins scalar arrays with a middot", () => {
    expect(humanizeList(["indoor", "greenhouse", "outdoor"])).toBe(
      "Indoor · Greenhouse · Outdoor",
    );
  });
  it("returns null for arrays that contain objects (render structurally)", () => {
    expect(humanizeList([{ a: 1 }])).toBeNull();
  });
});
