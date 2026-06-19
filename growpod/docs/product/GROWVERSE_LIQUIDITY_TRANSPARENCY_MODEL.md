# GROWVERSE — Pricing & Liquidity-First Transparency Model

> **Status:** planning only. **No payments are implemented.** **No code.**
> **Principle:** if/when paid boosts go live, the funds split is **published before activation**. Boost revenue is **planned** to support **liquidity and development** — **not** secretly funneled into contest prizes. Developer revenue is acknowledged honestly because the creator needs sustainable income.
> **Banned framing:** no "guaranteed profit / investment / guaranteed NFT value / guaranteed liquidity return." Boost purchases buy **in-game convenience**, nothing more.

---

## Part A — Pricing / ALGO conversion model (`planned`)

**Concept:** prices displayed in **USD** with a **real-time approximate ALGO** equivalent.

**Display rule:** `"$9.99 / approximately X ALGO"` — always say **approximate** when price moves.

**Requirements (future implementation, not built here):**
- ALGO amount derived from a **live price feed / trusted API** (future).
- UI clearly says **"approximate"** because price fluctuates.
- **Payment confirmation shows the final ALGO amount before purchase.**
- **Testing mode** shows **"Free in testing"** / **"QA Free."**
- Chain status today: Algorand provider is **TestNet / mock-by-default** (`chain/factory.py`); **no fiat rails exist**. Do not imply mainnet payments are live.

**Suggested tiers (planning reference only):**
| Tier | USD band | Example boosts |
|---|---|---|
| Small convenience | $0.99–$2.99 | Speed Growth (small), short Time Skip, Care Kit, Climate Fix |
| Medium boost | $4.99–$9.99 | Larger Time Skip, Plant Recovery, Harvest Rush |
| Major recovery/rewind | $14.99–$49.99 | Rewind/Save, Lineage Protection (scarcity/impact-dependent) |
| Event-only / limited | clearly labeled | time-boxed seasonal boosts — always tagged "limited" |

> Tiers are **planning placeholders**, not committed prices. Final pricing is an owner decision published before activation.

---

## Part B — Liquidity-first allocation models

The owner wants boost revenue to **feed liquidity**, with an **honest developer portion**, and **no secret mixing into contest prizes**. Three candidate splits:

### Option A — Liquidity-max: 70% liquidity / 20% development / 10% operations
| Dimension | Assessment |
|---|---|
| Player trust | **Highest** — strongest "we're building the pool, not our pockets" signal |
| Sustainability | **Lower** — thin dev budget may slow the roadmap |
| Liquidity impact | **Highest** |
| Developer revenue | **Lowest** — risk of creator burnout/underfunding |
| Risks | Roadmap stalls if revenue is modest; dev under-resourced |

### Option B — Balanced: 60% liquidity / 30% development / 10% operations
| Dimension | Assessment |
|---|---|
| Player trust | **High** — liquidity still majority |
| Sustainability | **Good** — meaningful dev funding |
| Liquidity impact | **High** |
| Developer revenue | **Moderate** — supports continued building |
| Risks | Must clearly justify the 30% dev share publicly |

### Option C — Dev-sustainable: 50% liquidity / 35% development / 15% treasury/operations
| Dimension | Assessment |
|---|---|
| Player trust | **Moderate** — liquidity only half; needs strong messaging |
| Sustainability | **Highest** — best-funded development/ops |
| Liquidity impact | **Moderate** |
| Developer revenue | **Highest** |
| Risks | Could read as dev-favoring; treasury/ops must be transparently defined |

**Recommendation framing (owner decides):** Option **B** balances the liquidity-first promise with enough dev funding to actually ship — but the choice is the owner's and must be **published before any paid activation**. Whatever is chosen, **publish the exact split and report against it**.

---

## Part C — Public-facing copy (paste-ready, verbatim)

> "Boost purchases are optional. During alpha testing they are free. When paid boosts go live, the allocation model will be published clearly before activation."

> "Paid boost revenue is planned to support liquidity and development, not secretly fund contest prizes."

**Additional safe copy:**
> "Prices are shown in USD with an approximate ALGO equivalent. The final ALGO amount is confirmed before any purchase."

> "Buying a boost gives you in-game convenience. It is not an investment and does not promise any financial return."

---

## Part D — Transparency mechanics (planned)
- **Pre-activation publication:** post the chosen split + definitions of "liquidity / development / operations / treasury" before turning on payments.
- **Allocation receipt:** each future purchase shows which buckets it fed (no amounts implied as returns).
- **Public allocation reporting:** periodic, plain-language report of totals per bucket.
- **No commingling:** contest/Cup prize pools are funded **only** by their own entry-fee sinks (today: `balance.yaml` Cup entry fee → prize pool), **never** by boost revenue, unless separately and explicitly approved + disclosed.

## Open decisions for the owner
1. Pick allocation model **A / B / C** (and define each bucket).
2. Define what "liquidity support" concretely means (which pool, which pair, custody).
3. Reporting cadence + format for public allocation reports.
4. Whether any boost is in-game-GROW-only (no real money) to reduce regulatory surface.
