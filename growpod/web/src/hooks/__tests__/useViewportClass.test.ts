import { describe, it, expect } from "vitest";
import {
  classifyViewportWidth,
  PHONE_SM_MAX_WIDTH,
  PHONE_MAX_WIDTH,
} from "@/hooks/useViewportClass";

describe("classifyViewportWidth (Command Center mobile tiers)", () => {
  it("classifies small phones (iPhone SE / mini class) as phone-sm", () => {
    expect(classifyViewportWidth(320)).toBe("phone-sm");
    expect(classifyViewportWidth(360)).toBe("phone-sm");
    expect(classifyViewportWidth(375)).toBe("phone-sm");
  });

  it("classifies standard-to-large phones (iPhone 14/15/16 through Pro Max) as phone", () => {
    expect(classifyViewportWidth(376)).toBe("phone");
    expect(classifyViewportWidth(390)).toBe("phone");
    expect(classifyViewportWidth(430)).toBe("phone");
    expect(classifyViewportWidth(639)).toBe("phone");
  });

  it("classifies tablets and desktop (Tailwind sm+) as tablet-plus", () => {
    expect(classifyViewportWidth(640)).toBe("tablet-plus");
    expect(classifyViewportWidth(1024)).toBe("tablet-plus");
    expect(classifyViewportWidth(1440)).toBe("tablet-plus");
  });

  it("has no gaps or overlaps at the tier boundaries", () => {
    expect(classifyViewportWidth(PHONE_SM_MAX_WIDTH)).toBe("phone-sm");
    expect(classifyViewportWidth(PHONE_SM_MAX_WIDTH + 1)).toBe("phone");
    expect(classifyViewportWidth(PHONE_MAX_WIDTH)).toBe("phone");
    expect(classifyViewportWidth(PHONE_MAX_WIDTH + 1)).toBe("tablet-plus");
  });
});
