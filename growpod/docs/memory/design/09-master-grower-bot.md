# 🤖🌿 GrowVerse Master Grower Bot — product design + monetization PLAN (09)

> The product design for the **GrowVerse Master Grower AI Bot** and a **monetization PLAN** — design
> only. **No payment/billing code, no entitlement code, no ledger changes** here: UNI-011 freeze +
> CLAUDE.md "stop and ask for player-facing economy changes." **Real-money pricing, payment provider,
> and any economy interaction are owner-gated and launch-gated.** Knowledge/grounding architecture:
> `docs/research/2026-06-23-master-grower-bot-knowledge-graph.md` (C1). Tags: ✅ built · 🔨 partial ·
> ⬜ planned. **All monetization items here are ⬜ planned / owner-gated.**

## 1. Product vision
A premium **AI growing mentor** that knows GrowVerse's full knowledge canon **and your live grow**,
and coaches you the way a master grower would coach an apprentice — grounded, cited, personal. It's
the natural product surface for everything the university teaches.

## 2. The reconciling principle (how a PAID bot keeps "earned, never bought")
The moat is that **in-game power and credentials are earned, never bought**. The bot honors it with one
hard rule:

> **Sell guidance and convenience. Never sell power or progress.**

The bot may teach you faster, watch your grow, and help you avoid mistakes. It may **not** grant XP,
GROW, KXP, degrees, yield/quality multipliers, faster timers, or **anything that posts to the ledger
or substitutes for an earned credential**. A subscriber and a free player who make the same in-game
decisions get the **same in-game outcome**. The bot is a tutor, not a cheat code. This is the line
that keeps the brand intact — and it must be stated publicly.

## 3. Free vs. Paid boundary (the core design)
**The game is fully playable, winnable, and learnable for free.** Paid buys depth, convenience, and a
better mentor — not advantage.

| Capability | Free | Paid ("Master Grower+") |
|---|---|---|
| Per-plant advisor (shipped `AdvisorReport`) | ✅ | ✅ |
| FTUE coaching (shipped) | ✅ | ✅ |
| Conversational Q&A grounded in the corpus | ✅ limited (e.g. daily cap) | ✅ unlimited |
| Proactive grow monitoring + alerts ("your VPD is drifting") | ❌ | ✅ |
| Multi-plant / whole-garden analysis & planning | ❌ | ✅ |
| Personalized grow plans + strain-specific coaching | basic | ✅ deep |
| Faculty "office hours" (persona chat tied to courses) | ❌ | ✅ |
| Higher-capability model / priority responses | standard | ✅ |
| Conversation history & saved grow journal insights | short | ✅ extended |

Everything paid is **time, attention, depth, and convenience** — never a number that changes the sim's
outcome.

## 4. Tiers & pricing posture (ranges — owner sets the actual numbers)
- **Free** — the advisor + capped chat. The honest, complete game.
- **Master Grower+ (subscription)** — the full mentor. Posture: a low monthly price point in the
  casual-companion-app range; **exact pricing is an owner decision**, not set here.
- **Possible add-ons (later)** — seasonal pass; a one-time "course mentor" unlock. Not v1.
- **University tie-in (brand-reinforcing):** earned **degrees could unlock richer bot grounding**
  (the bot "knows" what you've been certified in) — paid depth that *rewards* earned mastery instead of
  bypassing it. Optional, owner call.

## 5. Entitlement model to build LATER (design only — no code now)
- A **real-money entitlement** (via an external billing provider — Stripe / app-store IAP) that sets a
  simple `pro` flag on the account. **Strictly decoupled from the in-game GROW economy:** buying Pro
  adds **zero** GROW/XP/KXP and posts **nothing** to the ledger (preserves the faucet/sink invariant
  and the moat). Two ledgers conceptually: *real money* (subscriptions) and *in-game economy* (GROW) —
  they never touch.
- Feature-gating reads the `pro` flag; the bot core (C1) is identical for both tiers — paid just
  unlocks capabilities/limits. **CI-safe & feature-flagged** (mock entitlement in tests; matches the
  existing flag discipline).
- **Stop-and-ask before any of this is built:** payment provider choice, real pricing, refund/cancel
  policy, and confirmation that entitlements never write to the game ledger.

## 6. Trust & safety (the product *is* trust)
- **Grounding is the product.** The bot's worth = accurate, cited, personal advice (C1's
  cite-or-don't-answer discipline). A paid bot that hallucinates a feeding schedule is worse than no
  bot — grounding quality is the retention driver, not a nice-to-have.
- **Transparency:** show the "why" + sources; no dark patterns; clear cancel; clear that this is an
  educational simulation, not real-world cultivation/medical/legal advice (inherits age-gating &
  compliance from the launch-readiness track).
- **No manipulation:** the bot never nudges spending in the real-money OR game economy for engagement's
  sake.

## 7. Complement, don't replace, earned mastery
Degrees still require **real study time + a proven live-grow practical** (shipped
`university_service.py`). The bot helps you **learn and execute** faster; it never completes the
practical for you or issues the credential. If anything, the bot drives people **into** the university
(it can recommend the exact course that fixes their knowledge gap). Mentor → student → earned degree —
the bot strengthens the moat's funnel rather than shortcutting it.

## 8. Risks & mitigations
- **Pay-to-win perception** → the §2 rule, stated publicly + provably (same decisions → same outcome);
  nothing paid touches the ledger.
- **Cannibalizing the free advisor** → keep a genuinely useful free tier; paid is depth/convenience.
- **Brand dilution of "earned, never bought"** → frame paid as *coaching*, align it with the
  university, never sell credentials/power.
- **Advice liability** → simulation/educational framing, scope lock, no medical/legal claims (C1 §8).
- **Cost of inference at scale** → tiered model usage, caps on free, cache common grounded answers.

## 9. What's decided vs. owner-gated
- **Decided (design):** sell guidance not power; free game stays complete; entitlement decoupled from
  the ledger; grounding-first; complements the university.
- **Owner-gated (do not build until approved + launch):** real pricing, payment provider, the
  entitlement/billing code, any ledger-adjacent logic, the degrees-unlock-grounding tie-in.

## Invariants honored
- **Earned, never bought** — paid sells guidance/convenience; power/progress/credentials stay earned.
- **Faucet/sink integrity** — real-money entitlements never post to the in-game ledger.
- **No code under the freeze** — this is a plan; build is owner- and launch-gated.
- **CI-safe by design** — mock entitlement + mock bot provider; no keys in CI.

## Cross-links
- Knowledge/grounding architecture: `docs/research/2026-06-23-master-grower-bot-knowledge-graph.md` (C1)
- Shipped advisor it builds on: `src/growpodempire/services/advisor_service.py` · `ai/provider.py` · `ai/autocare.py`
- University moat (what stays earned): `docs/memory/design/06-university.md` · `07-university-phase-2.md`
- Economy invariants: `CLAUDE.md` (faucet/sink, stop-and-ask on economy) · `src/growpodempire/data/balance.yaml`
- Master plan/ledger: `docs/research/university/IMMERSIVE_UNIVERSITY_MASTER_PLAN.md`
