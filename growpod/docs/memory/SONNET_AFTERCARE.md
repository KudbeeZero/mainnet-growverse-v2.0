# 🌅 SONNET AFTERCARE — the "what's next after everything is done" roadmap

> **What this is.** The owner's forward vision doc (requested 2026-07-07). When the
> [90-day plan](ROADMAP_90D_2026Q3.md) is complete — weeks 1–12 shipped, the weeks-13+ queue
> (p08–p22) worked through, beta hardened — **start here.** This is the big-feature roadmap:
> what makes GrowVerse top-notch and makes people *want to come back*, not just a working game.
>
> **How Sonnet uses this doc (the aftercare loop):**
> 1. Confirm the precondition: 90-day plan + phase queue complete, `main` green, beta live.
> 2. Pick the next feature in §3 order (or the owner names one).
> 3. Write a one-page pitch (player story · retention thesis · scope tiers · risks · owner
>    decisions) and get the owner's go — **big features always get a pitch first.**
> 4. Spec it as a mini-phase (GROWVERSE_ROADMAP format: purpose/tech/acceptance/do-not-touch),
>    then build it branch-by-branch through the [Execution Machine](EXECUTION_MACHINE.md),
>    under the same end-of-session contract (ROADMAP_90D §7b: green main, closed loop,
>    GitHub == local).
> 5. Every feature ships with its telemetry (p02 taxonomy) so the *next* pick is data-informed.
>
> **Unchanged guardrails:** fun first, speculation never; no P2W (real money never buys
> yield/quality); education/simulation framing; DB authoritative, chain a mirror; testnet until
> the owner's mainnet call; faucets matched to sinks; every economy number owner-gated;
> `balance.yaml` is the tuning surface.

---

## 1. The retention thesis (why people come back to games like this)

The 90-day plan makes the core loop *true* (items work, the pod shows it, you own what you
grow). Aftercare makes it *sticky*. Long-term retention in a nurture game comes from five
forces, and every feature below is chosen to feed at least two:

- **Appointment** — something real happens while you're away, and a reason to check in *today*
  (daily challenge, cure timers, event windows).
- **Investment** — a thing that grows in value with your time: a genetics library, a facility,
  a reputation, a museum. Quitting means leaving it.
- **Social fabric** — other humans see your work; co-op and light rivalry. The strongest
  retention force in live games.
- **Mastery curve** — visible skill growth: this week you diagnose mildew from the leaf visual
  alone; next month you're pheno-hunting.
- **Novelty cadence** — seasons, drops, and discoveries so the game is never "finished."

---

## 2. Flagship features (the top-notch tier — each is a season-defining bet)

### F1 · The Daily Pheno — one seed, every grower, one leaderboard 🏆
**The single highest-retention/effort ratio in this list.** Every day, one deterministic
challenge: the same genetics + starting climate + constraint ("heat wave week", "no bloom
booster", "exhaust fan broken") for every player, on a compressed sim clock. Best
quality/yield/recovery score wins the day; streaks and percentile history accrue.
**Why it works:** appointment + mastery + fair competition (identical inputs — pure skill);
Wordle-class shareability ("Day 214: 97.2 quality 🟩🟩🟨").
**Builds on:** the deterministic pure engine (`simulation/`, seeded RNG per plant) — the sim
IS the puzzle generator; turbo clock; Cup scoring (`services/cup_service.py`); p02 telemetry.
**Owner gates:** none economy-side if prizes are cosmetic/prestige (title, museum plaque).

### F2 · Grow Collectives — guild greenhouses 🤝
Factions grow up: 5–20 players share a **collective greenhouse** — a big pod where members
contribute care shifts, gear, and genetics toward weekly collective goals (a Cup entry, a
contract mega-order, an event boss like a facility-wide pest outbreak). Care shifts rotate
across timezones; the greenhouse *needs* the group.
**Why it works:** social fabric + appointment ("my shift is 8pm") + the mercy mechanic
socialized — the collective covers you when life happens (guilt-free absence is retention,
not loss).
**Builds on:** factions (`/factions`), pods/automation, contracts, the care loop, ledger
(collective treasury = ledgered sub-account, same Decimal rules).
**Owner gates:** collective treasury rules (faucet/sink review); moderation surface for names.

### F3 · Pheno-Hunt Expeditions — the genetics endgame 🧬
Unlock the parked **generative genetics** (BACKLOG #35, design codex) as *content*, not just
math: seasonal expeditions to regions (Hindu Kush, Durban, Emerald Triangle…) yield landrace
seed packs with polygenic variance; players pheno-hunt — grow a pack, keeper-select, stabilize
— to discover named phenos **no one else has**. Discoveries enter the on-chain GenBank with
breeder attribution; when another player grows your cut, you earn prestige (and a capped GROW
royalty sink→faucet loop).
**Why it works:** investment (a genetics library with your name in it) + novelty (regions
rotate) + the collector's "one more pack" pull — this is the endgame the Mendelian engine has
been waiting for.
**Builds on:** `genetics/` (deterministic core stays), p09 lineage UI, ARC-19 dynamic NFTs
(o06/p07), rarity/stability progression, the strain encyclopedia research DB.
**Owner gates:** royalty numbers (economy), region/lore approval, generative-genetics scope
(explicitly listed as post-MVP in GROWVERSE_ROADMAP §9 — this is its planned unlock).

### F4 · Facility Ladder — closet → tent → greenhouse → vertical farm 🏗️
A visible **metagame progression**: your grow space itself levels. Each facility tier changes
the play (more plants, zone climate control, staff/automation to manage, new failure modes),
and the pod visual sells the fantasy — the closet you started in stays in your museum.
**Why it works:** investment + mastery; the "one more upgrade" arc that carries months. Also
the natural home for every future gear SKU (the store becomes a facility outfitter).
**Builds on:** pods/tiers/capacity, gear + equipment sim (o02/o03), automation flags,
`create_pod` tier system — the seams already exist.
**Owner gates:** tier pricing (economy), scope per tier.

### F5 · The Grower's Almanac — AI mentor with memory 🧠
The Scout/Analyst (p05) grows into a persistent **mentor who remembers your journey**
(design/11 Global Learning Memory is the spec): "Last winter your Blue Dream got mildew in
week 3 — your humidity discipline has improved 40% since." Weekly "almanac pages"
auto-generated from your event log: a beautiful, shareable grow-journal chapter (stats, story
beats, the harvest glamour shot from capture-shots tech).
**Why it works:** the emotional core — the game *knows you*. Mastery made visible; journals
are organic marketing.
**Builds on:** p05 pipeline, design/11 (P1/P2 queued in p16), PlantEvent log, chamber renderer
for the glamour shot, telemetry.
**Owner gates:** AI budget ceiling per player; journal-sharing privacy defaults.

---

## 3. Big features (season fillers — one to two per season alongside a flagship)

| # | Feature | One-liner | Retention force | Builds on |
|---|---|---|---|---|
| B1 | **World Weather Fronts** | Server-wide weather systems roll across regions for a week (humid front → mildew meta; drought → water discipline); the whole community adapts together, Scout narrates | Appointment + novelty | `weather_service.py`, balance weather config |
| B2 | **Pest Outbreak Events** | Co-op defense event: an outbreak spreads player-to-player unless collectives quarantine + treat; IPM knowledge finally pays off publicly | Social + mastery | pests/disease sim, factions, university IPM track |
| B3 | **The Auction Block** | Weekly live-window auction house with bid drama, provenance display (lineage + care history on the card), and a "sold for" ticker | Investment + appointment | marketplace, ARC-69 history, p04 projection |
| B4 | **Strain Charts** | Billboard-style weekly charts: most-grown, highest-quality, fastest-rising strains; growing a chart-topper earns zeitgeist bonuses; charts feed the meta | Novelty + social | telemetry, strains data, market data |
| B5 | **Clone Gifting & Plant-Sitting** | Send a friend a rooted cut of your best pheno; plant-sit each other's pods during absences (bounded actions, full audit log) | Social + mercy | clone/cutting machinery (Clone Room concepts, post-o06), care auth |
| B6 | **Trophy Museum** | A personal, visitable gallery: cured jars, Cup trophies, first-harvest keepsake, extinct-pheno plaques — every artifact a dynamic NFT with its true story | Investment | NFTAsset registry (o06), ARC-19, profile |
| B7 | **Story Campaign: Closet to Cup** | A narrative arc with characters (your first mentor, a rival grower, the Cup judge) gating region/feature unlocks — onboarding becomes Chapter 1 | Mastery + novelty | FTUE/onboarding rework, missions (p10), lore (p19) |
| B8 | **Rival Growers (AI NPCs)** | Persistent NPC growers with personalities who compete in your league, trash-talk via the feed, and lose gracefully — the ladder is never empty | Social(ish) + novelty | ai/ ABCs + mocks, leaderboards, Cup |
| B9 | **Terpene Sommelier** | A collection metagame: assemble terpene wheels, run blind "tasting" minigames from your cured jars, earn sommelier ranks that gate premium contract lines | Mastery + investment | terpene genetics, university, contracts |
| B10 | **Time-lapse Reels** | One-tap auto-generated grow time-lapse (event log + renderer replay) with music, stage stamps, final stats — built to be posted | Social (acquisition) | chamber renderer determinism, event log |

---

## 4. Support systems (unlock the above; build once, everything benefits)

- **S1 · LiveOps console** — the p11 TDE grows an owner-facing events panel: schedule fronts,
  drops, seasons, chart features; kill switches per event. (BACKLOG #37 lands here.)
- **S2 · Season framework** — a first-class `season` object (theme, event calendar, cosmetic
  track free+premium, leaderboard resets, archive ritual). Every flagship above plugs into it.
- **S3 · Social graph primitives** — friends, visits, gifting, activity feed, block/report,
  privacy defaults. Prerequisite for F2/B5/B6/B10; build deliberately and once.
- **S4 · Notification & widget layer** — opt-in push/home-screen widgets for cure timers, care
  windows, event starts, auction endings. Appointment mechanics need a doorbell. (Respect quiet
  hours; never dark-pattern — the trust layer, BACKLOG #30, applies.)
- **S5 · Replay & determinism service** — the seeded sim already makes any grow replayable;
  formalize it (state → replay token) to power F1 verification, B10 reels, and dispute-proof
  leaderboards.
- **S6 · Moderation & fair-play** — names/journals/feeds need moderation before social ships;
  the parked anti-bot framework (BACKLOG #26) activates when F1 leaderboards go live.

---

## 5. Suggested season arc (post-beta; owner reorders freely)

| Season | Flagship | Big features | Support built |
|---|---|---|---|
| 1 — "First Frost" | F1 Daily Pheno | B1 Weather Fronts, B4 Strain Charts | S2 seasons, S5 replay, S6 fair-play |
| 2 — "Good Neighbors" | F2 Grow Collectives | B5 Gifting/Plant-Sitting, B2 Outbreak Events | S3 social graph, S4 notifications |
| 3 — "The Hunt" | F3 Pheno-Hunt Expeditions | B3 Auction Block, B6 Trophy Museum | S1 LiveOps console |
| 4 — "Empire" | F4 Facility Ladder | B7 Story Campaign ch. 1–3, B9 Sommelier | — |
| 5 — "The Almanac" | F5 AI Mentor + Journals | B8 Rival Growers, B10 Time-lapse Reels | — |

One flagship per season. If a season must shrink, cut big features before flagship scope —
a season is its flagship.

---

## 6. What stays off the table (unchanged owner gates)

Mainnet, fiat rails, and funds-path rewrites remain owner-decision items outside this doc.
Real-money cosmetics/passes follow p08/p20 rules (payments ABC, no fiat rail until its own
gated phase). Sponsored/branded content (BACKLOG #41) needs the owner's business call first.
Nothing in this doc may convert GROW or NFTs into promised real-world value — collectibles and
records of play, never investments.

---

*Created 2026-07-07 at the owner's request, alongside the 90-day plan. This doc is
deliberately ambitious and deliberately unscheduled — it activates only when
[ROADMAP_90D_2026Q3.md](ROADMAP_90D_2026Q3.md) (including its §8 weeks-13+ queue) is done and
the owner says "aftercare." Until then it is a reading list for where this game is going:
**alive, social, owned, and worth coming back to every single day.***
