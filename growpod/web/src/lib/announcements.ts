// Static launch announcements shown in the banner above the onboarding hero.
// Newest first. Keep entries true — only ship things that exist in the game.

export interface Announcement {
  id: string;
  date: string; // YYYY-MM-DD
  text: string;
}

export const announcements: Announcement[] = [
  {
    id: "grovers-v2-leaf",
    date: "2026-06-11",
    text: "GROVERS v2 — the O in the logo is now a living particle leaf. Go ahead, poke it.",
  },
  {
    id: "university-open",
    date: "2026-06-08",
    text: "GrowPod University is open: enroll, study, earn degrees with permanent grower perks.",
  },
  {
    id: "cannabis-cup",
    date: "2026-06-08",
    text: "The seasonal Cannabis Cup is live — enter your best harvest, climb the Hall of Fame.",
  },
];
