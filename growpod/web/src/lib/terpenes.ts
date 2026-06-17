// Terpene reference — the aroma, effect, and a display colour for each terpene
// the genetics layer can express. Used by the Microscope lab to label the
// terpene droplets you find at max zoom and to render the side-panel legend.
//
// Keys are lower-cased terpene names; strain.terpenes[] entries are matched
// case-insensitively against these (unknown ones fall back to a neutral entry).

export interface TerpeneInfo {
  name: string;
  /** Dominant aroma notes. */
  aroma: string;
  /** Commonly reported effect/vibe. */
  effect: string;
  /** Hex colour for the droplet + legend chip. */
  color: string;
}

export const TERPENES: Record<string, TerpeneInfo> = {
  myrcene: {
    name: "Myrcene",
    aroma: "Earthy, musky, ripe mango",
    effect: "Relaxing, sedative ‘couch-lock’",
    color: "#8b9a46",
  },
  limonene: {
    name: "Limonene",
    aroma: "Bright citrus, lemon zest",
    effect: "Uplifting, mood-elevating",
    color: "#e6c229",
  },
  caryophyllene: {
    name: "Caryophyllene",
    aroma: "Black pepper, clove, spice",
    effect: "Calming, anti-inflammatory",
    color: "#c0612b",
  },
  pinene: {
    name: "Pinene",
    aroma: "Fresh pine, rosemary",
    effect: "Alert, clear-headed focus",
    color: "#3f9d5a",
  },
  linalool: {
    name: "Linalool",
    aroma: "Floral lavender, soft spice",
    effect: "Soothing, stress-relief",
    color: "#9b7ad1",
  },
  terpinolene: {
    name: "Terpinolene",
    aroma: "Fruity, herbal, fresh",
    effect: "Gently uplifting, creative",
    color: "#5bb6c9",
  },
  humulene: {
    name: "Humulene",
    aroma: "Hoppy, woody, earthy",
    effect: "Grounding, appetite-balancing",
    color: "#a8884f",
  },
  ocimene: {
    name: "Ocimene",
    aroma: "Sweet herbal, woody",
    effect: "Energizing, fresh",
    color: "#7fc241",
  },
};

const FALLBACK: TerpeneInfo = {
  name: "Terpene",
  aroma: "Aromatic resin",
  effect: "Contributes to the entourage effect",
  color: "#6fae3d",
};

/** Look up a terpene by (case-insensitive) name, with a neutral fallback. */
export function terpeneInfo(name: string): TerpeneInfo {
  const key = name.trim().toLowerCase();
  return TERPENES[key] ?? { ...FALLBACK, name: name || FALLBACK.name };
}
