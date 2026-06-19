# GROWVERSE — Optional Paid Plant Boost / Recovery Economy (Concept)

> **Status:** concept/planning only. **No code.** Every boost below is **`planned`** unless noted.
> **Core principle:** boosts are **optional convenience and recovery** — not pay-to-win, not a paywall, not contest-prize funding. The core game stays fully playable **without** paid boosts.
> **Alpha behavior:** during testing, all boost/recovery buttons are **FREE and QA-labeled** so we can test gameplay before any real payment exists. This mirrors the project's existing convention (`balance.yaml:16` — `base_cost: 0 # FREE for testing — restore to 25 before launch`).

## What already exists vs what is new (honest baseline)
| Mechanic | Status | Evidence |
|---|---|---|
| Consumables: Cal-Mag (30), Ladybugs (45), Neem (40), Bloom Booster (60, flowering), **Rejuvenation Tonic (80, full reset)** | `live` (in-game GROW) | `balance.yaml:340–355`, `/players/<id>/shop/buy` + `/apply`, `ConsumableInventory` |
| Global grow pacing lever `time_scale` (0.075) | `live` (admin/balance only) | `balance.yaml:178`, `simulation/engine.py` |
| **Time-skip / speed-growth item** | `planned` (does not exist) | no per-plant time-accel item in engine |
| **Plant Recovery / Rewind item** | `planned` (does not exist) | consumables fix *current* state; no time-reversal exists. Rejuvenation Tonic is the closest live analog |
| Real-money / USD / ALGO payment | `planned` | chain is TestNet/mock-default (`chain/factory.py`); no fiat rails |

**Engine reality that constrains design:** plant state is **compute-on-read and forward-only**; there is **no stored history to "rewind."** Consumables set instant levels (water/nutrient/pest/disease) and add health. A true "rewind X days" would be a **new engine concept** (owner decision — see roadmap). The safe MVP for "recovery" is a **forward-only stabilize** (like Rejuvenation Tonic), not time travel.

**Economy guardrail (must respect):** money is `Decimal` 6-dp on a **double-entry, append-only, inflation-audited ledger** (`economy/ledger.py`). Any boost that grants in-game value is a faucet/sink and must be tracked. Paid boosts that bypass in-game GROW (real money → effect) must **not** silently mint GROW or yield.

---

## Boost catalog

For each: what it does · when usable · caps/cooldowns · abuse risk · fairness risk · economy risk · UI copy · test-mode · future-paid · affects harvest/rewards? · allowed in Cup/ranked?

### B1 — Speed Growth `planned`
- **Does:** reduces remaining grow time / accelerates the plant's current stage.
- **When:** any growing stage (not on a dead plant).
- **Caps/cooldowns:** suggest max 1 active speed effect per plant; cooldown 6–12h; cap total speed purchased per plant per cycle.
- **Abuse risk:** chain-buying to trivialize timing; **Fairness:** faster harvest cadence than free players; **Economy:** compresses the grow→sell faucet (more GROW/real-day).
- **UI copy:** "Want to speed the growth of your plant?" / "Smoked too much this weekend? Friend stole the bag? Supergrow your plant and get back on track."
- **Test-mode:** "QA Speed Boost — Free."
- **Future-paid:** small-tier price; shows USD + approx ALGO; allocation note.
- **Affects harvest/rewards?** Yes (earlier harvest). **Cup/ranked?** **No** — exclude or tag (see fairness doc).

### B2 — Time Skip `planned`
- **Does:** jumps the plant forward a fixed amount (6h / 12h / 24h, or a limited event amount).
- **When:** mid-grow; not seed→full-harvest in one tap unless owner approves.
- **Caps/cooldowns:** hard daily cap; cooldown between skips; never "skip to harvest" by default.
- **Abuse:** spamming to instantly finish; **Fairness:** bypasses the wait that defines the game; **Economy:** same faucet-compression as B1.
- **UI copy:** "Skip ahead 12 hours and check on your grow sooner."
- **Test-mode:** "QA Time Skip — Free (testing)."
- **Future-paid:** small/medium tier by amount.
- **Affects harvest/rewards?** Yes. **Cup/ranked?** **No.**

### B3 — Plant Recovery `planned` (forward-only; safe analog exists)
- **Does:** reverses sickness/stress by stabilizing current condition (clears pests/disease, restores water/nutrient bands, adds health) — **not** time travel.
- **When:** when a plant is stressed/sick and still alive.
- **Caps/cooldowns:** limited uses per cycle so it can't erase all bad decisions; cooldown.
- **Abuse:** neglect-then-rescue loops; **Fairness:** removes consequence of care skill; **Economy:** moderate sink, low faucet impact.
- **UI copy:** "Reverse the sickness and stabilize your plant."
- **Test-mode:** "QA Recovery — Free."
- **Future-paid:** medium tier.
- **Affects harvest/rewards?** Indirectly (healthier plant → better quality). **Cup/ranked?** Restrict or tag.

### B4 — Rewind / Save My Plant `planned` (⚠ needs new engine concept)
- **Does:** rewinds plant damage/sickness by a limited number of days.
- **When:** emergency only; expensive.
- **Caps/cooldowns:** strict — e.g. once per plant lifetime, limited days; never near-infinite.
- **Abuse:** undo any mistake repeatedly; **Fairness:** strongest pay-to-win vector; **Economy:** high.
- **UI copy:** "Spent too much time building this lineage? Rewind the damage and save your plant."
- **Test-mode:** "QA Rewind — Free (testing)."
- **Future-paid:** major tier ($14.99–$49.99 band).
- **Affects harvest/rewards?** Yes. **Cup/ranked?** **No.**
- **Note:** the engine has **no history to rewind today**. Owner must decide forward-only stabilize vs a real (costly to build) rewind. Until then this stays `planned` and is described, not promised.

### B5 — Premium Care Kit `planned` (bundle of `live` consumables)
- **Does:** bundles improvements to water/nutrient/stress (a convenience pack over existing Cal-Mag/Neem/Ladybugs/Tonic).
- **When:** any time.
- **Caps/cooldowns:** standard consumable cooldown.
- **Abuse:** low; **Fairness:** low (mirrors free consumables); **Economy:** sink-positive.
- **UI copy:** "Top up water, nutrients, and defenses in one tap."
- **Test-mode:** "QA Care Kit — Free."
- **Future-paid:** small/medium tier; or purely in-game GROW (no real money needed).
- **Affects harvest/rewards?** Indirect. **Cup/ranked?** Allowed if it only mirrors free items (owner call).

### B6 — Emergency Climate Fix `planned` (relates to `placeholder` AUTO)
- **Does:** corrects an environment/climate problem for a limited time.
- **When:** when climate is out of band.
- **Caps/cooldowns:** time-limited effect; cooldown.
- **Abuse:** permanent auto-perfect climate; **Fairness:** removes environment skill; **Economy:** low-moderate.
- **UI copy:** "Stabilize your climate for the next few hours."
- **Test-mode:** "QA Climate Fix — Free."
- **Future-paid:** small tier.
- **Affects harvest/rewards?** Indirect. **Cup/ranked?** Restrict.
- **Note:** Automatic Climate is a `placeholder` ("coming soon", `EnvironmentRail.tsx`); this boost must not imply auto-climate is live.

### B7 — Lineage Protection `planned` (conditional on future genetic risk)
- **Does:** protects rare genetics from total loss **if** the game later supports genetic risk/death of lineage.
- **When:** only meaningful once genetic-loss risk exists.
- **Caps/cooldowns:** per-strain; high cost.
- **Abuse:** trivializing risk; **Fairness:** whales protect rares free players lose; **Economy:** high-value sink.
- **UI copy:** "Protect this lineage from total loss."
- **Test-mode:** "QA Lineage Protection — Free (testing)."
- **Future-paid:** major tier.
- **Affects harvest/rewards?** Protects assets. **Cup/ranked?** Out of scope until genetic risk ships.
- **Note:** depends on a system that **does not exist yet** — describe as `planned`, never as protecting against a live risk.

### B8 — Harvest Rush `planned`
- **Does:** a limited rush **near the end** of growth (not seed→harvest instantly unless approved).
- **When:** only in late flowering / late-flower window.
- **Caps/cooldowns:** once per plant near harvest; bounded time reduction.
- **Abuse:** instant-finish; **Fairness:** high if unbounded; **Economy:** faucet-compression at the payoff moment.
- **UI copy:** "Almost there — rush the final stretch to harvest."
- **Test-mode:** "QA Harvest Rush — Free."
- **Future-paid:** medium tier.
- **Affects harvest/rewards?** Yes. **Cup/ranked?** **No.**

---

## Test-mode behavior (alpha) — applies to ALL boosts
- Buttons read **"QA <Boost> — Free."**
- Confirmation: **"Testing mode: no payment required."**
- Effect applies a **simulated boost or placeholder feedback**, logged to the Grow Log/Journal as a testing event.
- No real money, no ALGO, no GROW minted beyond the documented effect. Clearly labeled QA everywhere.

## Future-paid behavior (not in this doc to implement)
- Optional only; core loop remains free.
- Shows USD + **approximate** ALGO; confirms final ALGO before purchase; shows the allocation note (see liquidity doc).
- Posts a receipt + a Grow Log/Journal entry. Respects caps/cooldowns and Cup exclusions (fairness doc).

## Open design questions for the owner
1. Recovery/Rewind: **forward-only stabilize** (safe, ships on existing mechanics) vs **true rewind** (new engine + economy risk)?
2. Are speed/time-skip boosts purchasable with **in-game GROW only**, real money, or both?
3. Which boosts are **flatly banned** in Cup/ranked vs merely **tagged**?
4. Caps: per-plant and per-day limits, and the time-skip cooldown.
