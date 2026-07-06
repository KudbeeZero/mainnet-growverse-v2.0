// Data-driven, player-friendly Guide content. Sourced + condensed from the repo
// docs (docs/manual/getting-started.md, strategy-guide.md, tokenomics.md,
// README.md) and the live system audit (docs/QA_AUDIT.md). Honest by rule: each
// item carries a status so the UI can label what's live vs in-progress vs
// placeholder vs planned. Edit copy here — the UI renders it generically.

export type GuideStatus = "live" | "in-progress" | "placeholder" | "planned";

export interface GuideItem {
  label?: string;
  body: string;
  /** Honesty label. Omit for plain instructional copy. */
  status?: GuideStatus;
}

export interface GuideSection {
  id: string;
  icon: string;
  title: string;
  intro?: string;
  items: GuideItem[];
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "getting-started",
    icon: "🚀",
    title: "Getting Started",
    intro: "From a cold start to your first growing plant.",
    items: [
      { label: "Create your account", body: "On the welcome screen choose “New account”. You’ll get a Player ID and an API key shown once — save the key; it’s how you sign in from another device." },
      { label: "Claim your starting tokens", body: "Open your Profile and claim your starting GROW tokens. You’ll spend them on seeds, pods, care, and upgrades.", status: "live" },
      { label: "Plant your first seed", body: "On the Grow dashboard, pick a seed in your Starter Pod and tap “Plant here”. Your plant appears as a card you can open.", status: "live" },
      { label: "How pods work", body: "A Pod is a grow chamber that holds plants and sets the climate (temperature, humidity, light, CO₂). Higher-tier pods hold more plants and automate care." },
      { label: "What to do after planting", body: "Open the plant to water, feed, and watch its vitals. Keep it healthy through each stage until it’s harvest-ready." },
    ],
  },
  {
    id: "grow-strategy",
    icon: "🌱",
    title: "Grow Strategy",
    intro: "How a grow actually works.",
    items: [
      { label: "Seeds", body: "Each seed is a strain with its own genetics — flowering time, yield, difficulty, and trait DNA. Buy more seeds in the Lab." },
      { label: "Plant stages", body: "Plants progress: seed → germination → seedling → vegetative → flowering → late flower → harvest. Each stage has different needs." },
      { label: "Care actions", body: "Water and Feed keep levels up; Treat Pests / Treat Disease clear problems. Over- and under-doing it both hurt health, so read the vitals.", status: "live" },
      { label: "Growth timing", body: "Growth is a real-time, server-authoritative simulation — plants advance on their own schedule, computed honestly on the server. Care nudges health and outcomes, not the clock." },
      { label: "What 10× QA speed means", body: "During testing, the ⚡10× badge asks the server’s test clock to fast-forward so testers see progression in minutes. It’s a QA/testing tool, not a reward — and it only works on test backends (it’s disabled on the live production backend, where it stops and tells you).", status: "in-progress" },
      { label: "Harvest", body: "When a plant is harvest-ready, harvest it. Yield weight and quality are computed on the server from how well you grew it — no way to cheat the roll.", status: "live" },
      { label: "Rewards", body: "Selling a harvest credits GROW to your wallet through an auditable ledger. Every earn and spend is recorded." },
    ],
  },
  {
    id: "lab",
    icon: "🧬",
    title: "Lab / Genetics",
    intro: "Where strains and genetics live.",
    items: [
      { label: "What the Lab is for", body: "The Lab is your genetics bench: buy seeds, inspect strain DNA, and cross strains to breed new ones." },
      { label: "Breeding", body: "Cross two strains to create a new one. The genome is blended and the result is generated on the server (no seed-shopping the RNG).", status: "live" },
      { label: "GenBank & Microscope", body: "Browse the strains you own and inspect bud genetics. These views are read-only for now.", status: "live" },
      { label: "What’s expanding", body: "Deeper genetics — trait stability, lineage/provenance, and richer crossing tools — are being expanded over time.", status: "in-progress" },
    ],
  },
  {
    id: "market",
    icon: "🛒",
    title: "Market",
    intro: "Buy and sell with other growers.",
    items: [
      { label: "What the Market is for", body: "List seeds and harvests for sale at a fixed price or as an auction, and buy from other players." },
      { label: "What’s live now", body: "Creating listings/auctions and buying are wired to the real economy — sales post to the GROW ledger.", status: "live" },
      { label: "Honesty note", body: "If any market action ever doesn’t complete, the UI will tell you plainly instead of pretending. No silent buttons." },
    ],
  },
  {
    id: "cup",
    icon: "🏆",
    title: "Grow Cup / Competitions",
    intro: "Seasonal competition for the best growers.",
    items: [
      { label: "What it’s for", body: "The Grow Cup is where growers will enter their best harvests/strains to compete for rankings and prizes." },
      { label: "Current status", body: "Competition features are being prepared. Treat anything you see here as early/coming-soon until labeled live.", status: "planned" },
    ],
  },
  {
    id: "status",
    icon: "📊",
    title: "Transparency / Status",
    intro: "We build in the open. Here’s the honest state of each system.",
    items: [
      { body: "Grow loop (plant → care → harvest → sell): working.", status: "live" },
      { body: "Market (list / auction / buy): working.", status: "live" },
      { body: "Lab breeding + strain views: working.", status: "live" },
      { body: "University (courses, perks): working.", status: "live" },
      { body: "Notifications & activity feed: being expanded.", status: "in-progress" },
      { body: "Deeper genetics / lineage tools: being expanded.", status: "in-progress" },
      { body: "Grow Cup / competitions: planned, not live yet.", status: "planned" },
      { body: "Curing room / on-chain rewards: NOT wired in this build.", status: "not-wired" as GuideStatus },
    ],
  },
  {
    id: "about",
    icon: "🛰️",
    title: "About",
    items: [
      { label: "GrowVerse by Kudbee", body: "GrowVerse / GrowPod Empire is an early, live build by Kudbee. We build transparently — live systems, placeholders, and upcoming features are labeled clearly." },
      { label: "Built on Algorand", body: "The economy runs on an auditable in-game GROW ledger, with an Algorand on-chain asset layer for rare strains (TestNet today; an offline mock by default). On-chain minting is optional and not required to play." },
      { label: "Early testers", body: "Thanks for testing early. Things will change quickly, some systems are still being built, and your feedback shapes the game." },
    ],
  },
];

export const GUIDE_STATUS_META: Record<GuideStatus, { label: string; cls: string }> = {
  "live": { label: "Live", cls: "border-grow-600 bg-grow-900/50 text-grow-200" },
  "in-progress": { label: "In progress", cls: "border-amber-700 bg-amber-950/50 text-amber-200" },
  "placeholder": { label: "Placeholder", cls: "border-sky-700 bg-sky-950/50 text-sky-200" },
  "planned": { label: "Coming soon", cls: "border-violet-700 bg-violet-950/50 text-violet-200" },
};
// "not-wired" reuses a neutral style.
