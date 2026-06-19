# GROWVERSE — Pay-to-Win / Fairness Guardrails

> **Status:** policy/planning only. **No code.**
> **Goal:** optional paid boosts must never make the game feel unfair. The **free path stays fully viable**; paid = **convenience/recovery**, not power. Avoid pay-to-win perception explicitly. (We never use the phrase "pay to win" as a feature — only as the thing we prevent.)

## Core guardrails
1. **Free path remains viable** — every grow → care → harvest → sell/breed/cure loop is completable with zero purchases.
2. **Paid boosts are optional convenience/recovery**, never mandatory; **no hard paywall**.
3. **Competition/Cup rules may restrict or separate boosted plants** (see below).
4. **Boosted plants can be labeled** so the community can see organic vs boosted results.
5. **Boost caps prevent whales from instantly dominating** (per-plant and per-day limits).
6. **Recovery cannot infinitely undo bad decisions** — limited uses; care skill still matters.
7. **Time skip cannot be spammed** — enforced cooldown + daily cap.
8. **Rare rewards are not minted from paid shortcuts** without explicit balancing review (respects the inflation-audited ledger, `economy/ledger.py`).
9. **Testing-mode boost behavior is clearly labeled QA/testing** (mirrors the existing `base_cost:0 # FREE for testing` convention).

## Options menu (owner picks the mix)
| Guardrail option | What it does | Recommended default |
|---|---|---|
| **Separate boosted vs organic leaderboards** | Two boards so paid speed doesn't distort the "pure" ranking | ✅ strong option |
| **Boost limits per plant** | Cap total boosts a single plant can receive per cycle | ✅ |
| **Boost limits per day** | Cap boosts per account per day | ✅ |
| **No boosts during official competitions** | Cup entries must be unboosted (or use a boosted-allowed side bracket) | ✅ recommended for ranked integrity |
| **Boosted plant tag** | Visible badge on any boosted plant/harvest | ✅ |
| **Liquidity contribution receipt** | Purchase shows which buckets it fed (ties to transparency model) | ✅ |
| **Public allocation reporting** | Periodic totals-per-bucket report | ✅ |

## Cup / ranked policy (recommended)
- **Cup entries:** boosts that change growth timing or rewind damage (Speed Growth, Time Skip, Rewind, Harvest Rush) are **excluded** from official Cup entries, OR allowed only in a clearly separate "boosted bracket."
- Today the Cup is **`live` in code** with deterministic, server-authoritative scoring and an entry-fee sink (`services/cup_service.py`, `balance.yaml` Cup section). Any boost policy must plug into that scoring honestly — a boosted plant must be flagged before judging.
- **Convenience-only boosts** that mirror existing free consumables (e.g. Premium Care Kit) *may* be allowed in ranked — owner decision.

## Anti-abuse specifics
- **Recovery/Rewind:** finite uses per plant/lifetime; cannot resurrect a fully dead plant by default; cannot be chained to ignore care entirely.
- **Time Skip:** cooldown between uses + hard daily cap; never "skip to harvest" unless explicitly approved.
- **No new rares from money alone:** any rare genetics/asset must be reachable on the free path; paid shortcuts don't fabricate scarcity-value items without balancing.
- **Ledger integrity:** boosts that grant in-game value post to the ledger like any faucet/sink; paid (real-money) boosts must not silently mint GROW or yield.

## Honest labeling
- Boosted plant badge text: **"Boosted"** with a tooltip "This plant used optional boosts."
- Leaderboard label: **"Organic"** vs **"Boosted"** boards.
- Testing: **"QA / testing — boosts are free and effects are for testing."**

## Open decisions for the owner
1. Separate boosted/organic leaderboards — **yes/no**.
2. Cup policy — **ban boosts** vs **separate boosted bracket**.
3. Exact caps: per-plant, per-day, time-skip cooldown values.
4. Whether convenience-only boosts (Care Kit) are ranked-legal.
