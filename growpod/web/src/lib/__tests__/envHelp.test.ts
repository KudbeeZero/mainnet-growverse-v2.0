import { describe, expect, it } from "vitest";
import { BANDS } from "@/lib/envBands";
import { bandDirection, fixFor, metricHelp } from "@/lib/envHelp";

describe("envHelp", () => {
  it("returns help copy for every env-rail row key", () => {
    for (const key of [
      "temperature",
      "humidity",
      "vpd",
      "dli",
      "ppfd",
      "co2",
      "ph",
      "water",
      "nutrients",
    ]) {
      const help = metricHelp(key);
      expect(help, key).not.toBeNull();
      expect(help!.what.length).toBeGreaterThan(0);
      expect(help!.low.length).toBeGreaterThan(0);
      expect(help!.high.length).toBeGreaterThan(0);
    }
  });

  it("covers every Grow Console row key (glossary completeness)", () => {
    for (const key of ["ppm", "vpd", "dli", "ppfd", "ph"]) {
      expect(metricHelp(key), key).not.toBeNull();
    }
  });

  it("is case-insensitive and null for unknown keys", () => {
    expect(metricHelp("TEMPERATURE")).toEqual(metricHelp("temperature"));
    expect(metricHelp("does-not-exist")).toBeNull();
  });

  it("reports the band edge a value fell outside of", () => {
    expect(bandDirection(15, BANDS.temperature)).toBe("low"); // optimal 20–28
    expect(bandDirection(35, BANDS.temperature)).toBe("high");
    expect(bandDirection(24, BANDS.temperature)).toBeNull();
    expect(bandDirection(null, BANDS.temperature)).toBeNull();
  });

  it("gives the directional fix only when out of band", () => {
    expect(fixFor("humidity", 25, BANDS.humidity)).toBe(metricHelp("humidity")!.low);
    expect(fixFor("humidity", 80, BANDS.humidity)).toBe(metricHelp("humidity")!.high);
    expect(fixFor("humidity", 50, BANDS.humidity)).toBeNull();
  });
});
