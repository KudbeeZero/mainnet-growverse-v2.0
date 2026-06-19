# GROWVERSE — Build Priority Roadmap, Risks & Owner Decisions

> **Status:** planning only. **No code.** Sequencing across UI, testing, economy, payment, and on-chain.
> Honest baseline: most core surfaces are **`live` in code** but **gated OFF in the MVP launch profile** (`HANDOFF.md` — "MVP off-chain"); chain is **TestNet/mock-by-default**; QA 10× is **fail-closed in production**.

## Guiding sequencing rules
- **Stabilize before features:** the onboarding bundle green-screened in production due to a **deploy/asset issue** (new JS chunks 404'd → stuck green spinner), not a code bug. Re-land onboarding/demo **only behind a clean deploy + green CI + cache purge**.
- **One PR = one purpose** (project rule, `HANDOFF.md`: one active PR at a time).
- **Honesty first:** ship transparency (Grow Board, status labels) before monetization.
- **Free-in-alpha:** all boosts QA-free until the owner approves real payments.

## Phased roadmap

### Phase 0 — Incident close-out (now)
- Confirm prod is healthy on the reverted build.
- Diagnose the asset/deploy pipeline (Vercel vs Cloudflare-in-front), purge cache, re-land onboarding/demo verified.

### Phase 1 — UI honesty + onboarding (re-land)
- Grow Board (Lane 2) + Grow Guide (Lane 3) using `live|in-progress|placeholder|planned|not-wired` labels.
- Deep Guided Onboarding (Lane 1) re-landed.
- Mobile Grow Dashboard (Lane 10).

### Phase 2 — Feedback systems
- Notifications + Grow Log (Lane 4), Plant Suggestions (Lane 5), Market Sell Feedback honest states (Lane 8).
- Plant Journal / Persona (Lanes 6–7) as flavor.

### Phase 3 — Boosts in QA-free mode
- Implement boosts (B1–B8) **free + QA-labeled**, applying simulated effects; caps/cooldowns wired; boosted-plant tag.
- Early Tester Status (Lane 9) with strictly non-promissory copy.

### Phase 4 — Pricing display (no charges)
- USD + **approximate ALGO** display; "Free in testing" mode; confirm-final-amount screen scaffolding. **No real charges.**

### Phase 5 — Liquidity model publication
- Owner picks allocation model (A/B/C); publish split + bucket definitions **before** any payment.

### Phase 6 — Real payments (gated, optional)
- Turn on optional paid boosts behind a flag; allocation receipts; public reporting. Respect Cup exclusions + caps.

### Phase 7 — On-chain hardening
- Move chain from TestNet/mock toward configured real provider per owner readiness; minting + wallet flows; never claim mainnet-live until it is.

---

## Risks / Legal / Trust notes (Part 7)
| Area | Risk | Safe handling |
|---|---|---|
| Payment/regulatory | Selling boosts for money may trigger money-transmission/securities scrutiny | Keep boosts as in-game convenience; "not an investment"; legal review before Phase 6 |
| Age / cannabis content | Cannabis theme → age-gating, store-policy limits | Age gate; clearly fictional/simulation; check store policies |
| Gambling / contests | Paid entry + prizes can look like gambling | Cup uses in-game entry-fee sink only; keep boost money **out** of prize pools |
| Pay-to-win perception | Boosts seen as buying wins | Free path viable; caps; Cup exclusion; boosted tags (fairness doc) |
| Liquidity claims | Over-promising liquidity outcomes | Say "planned to support liquidity"; never "guaranteed liquidity return" |
| Token price claims | Implying price appreciation | Never discuss price/returns anywhere |
| Refund / support | Disputes on paid boosts | Define refund/support policy before Phase 6 |
| Taxes / accounting | Revenue + crypto accounting | Track via the audited ledger; get accounting guidance |
| App store / processors | IAP rules, crypto-payment restrictions | Choose rails deliberately (decision #2 below) |
| Algorand wallet UX | Linking/signing friction, testnet vs mainnet confusion | Label TestNet clearly; confirm final ALGO before purchase |

**Use:** "planned / optional / testing / approximate / not live yet / final rules will be published before activation."
**Avoid:** "guaranteed profit / investment / guaranteed NFT value / guaranteed liquidity return / pay to win / contest prize funding" (last unless approved).

---

## TOP 5 DECISIONS THE OWNER MUST MAKE BEFORE ANY REAL PAID BOOST
1. **Allocation model — A (70/20/10) vs B (60/30/10) vs C (50/35/15).** Must be chosen and **published before activation.** (Recommendation: B, balanced — owner's call.)
2. **Real-money rails — Algorand on-chain pay vs app-store IAP vs card processor.** Drives legal, store-policy, and refund design. (Could also keep some boosts **in-game GROW only** to shrink regulatory surface.)
3. **Recovery/Rewind reality — forward-only stabilize (ships on existing mechanics) vs true time-rewind (new engine concept + economy risk).**
4. **Cup/ranked policy — ban boosts in competitions, or run a separate "boosted" bracket + organic leaderboard.**
5. **Boost caps — per-plant limit, per-day limit, and time-skip cooldown** to prevent whale dominance.

> None of the above is live. All paid behavior is `planned`. During alpha, boosts are **free and QA-labeled**, and the full rules + allocation split will be **published before activation.**
