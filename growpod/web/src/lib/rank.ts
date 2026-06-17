/**
 * Client-side rank ladder — mirrors badge_service.RANKS on the backend.
 * Kept here so the nav badge and profile page can both derive rank without
 * an extra API round-trip (level is already in the player object).
 */

export interface RankInfo {
  index: number;
  name: string;
  icon: string;
  level_min: number;
  next_level_min: number | null;
}

const RANKS: Omit<RankInfo, "next_level_min">[] = [
  { index: 1,  name: "Seedling Scout",    icon: "🌱", level_min: 1  },
  { index: 2,  name: "Sprout Keeper",     icon: "🪴", level_min: 2  },
  { index: 3,  name: "Clone Crafter",     icon: "🔬", level_min: 3  },
  { index: 4,  name: "Garden Hand",       icon: "🤲", level_min: 4  },
  { index: 5,  name: "Terpene Tracker",   icon: "🧪", level_min: 5  },
  { index: 6,  name: "Strain Seeker",     icon: "🔭", level_min: 6  },
  { index: 7,  name: "Phenotype Hunter",  icon: "🎯", level_min: 8  },
  { index: 8,  name: "Harvest Master",    icon: "🌿", level_min: 10 },
  { index: 9,  name: "Genetics Artisan",  icon: "⚗️", level_min: 13 },
  { index: 10, name: "Terpene Tactician", icon: "🧠", level_min: 16 },
  { index: 11, name: "Grand Cultivar",    icon: "🌳", level_min: 20 },
  { index: 12, name: "Supreme Cultivar",  icon: "👸", level_min: 25 },
];

export function rank_for_level_client(level: number): RankInfo {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (level >= r.level_min) rank = r;
    else break;
  }
  const next = RANKS.find((r) => r.level_min > rank.level_min);
  return { ...rank, next_level_min: next?.level_min ?? null };
}
