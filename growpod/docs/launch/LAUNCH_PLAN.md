# GrowPod Empire (GROWv2) — Launch Plan

**Version 1.0 · July 2026**

Actionable plan to take GROWv2 from a working, tested backend to a live game with a real (test-first,
then gated-mainnet) on-chain asset layer. Owner decisions gate anything touching real value; agents
execute everything below the gates. This plan is honest about what is live today: the core loop and
economy are built and tested; NFT minting exists behind a default-on simulate flag; the store/payments
simulation is being wired now; mainnet settlement is explicitly future and gated.

---

## Lanes: owner vs agent

Two lanes run in parallel. The **agent lane** builds, tests, verifies, and ships within pre-approved
project scope. The **owner lane** owns the decisions that agents must never make alone: anything that
moves real money or chain value, treasury actions, player-facing economy tuning (faucets/sinks/prices),
key custody, and brand/visual identity forks.

**Stop-and-ask (owner only):** real-money / mainnet settlement · treasury or funded-account actions ·
economy balance changes · custodial key handling · deleting data or rewriting history · anything that
contradicts a core invariant.

---

## Phases

### Phase 0 — Launch readiness (now)
- Core loop hardened end-to-end on the mock chain; full suite green in CI (offline, no live keys).
- Complete the **store / payments simulation** (in progress today): pricing, atomic transfer groups,
  confirmation and error handling — all in simulate mode, nothing broadcast.
- White paper, launch plan, and one-pager published.
- **Exit criteria:** green CI; payments simulation drivable end-to-end; docs live.

### Phase 1 — Testnet beta
- Invite-limited beta on the real backend with the mock/simulate chain still default.
- Ship the **public economy transparency view** (faucets, sinks, live inflation from the ledger).
- Broaden provable-fairness verification beyond breeding toward weather/other draws.
- Instrument funnel + economy metrics (below).
- **Exit criteria:** stable core-loop retention over multi-day grows; no ledger/inflation anomalies;
  verification endpoints exercised by real players.

### Phase 2 — NFT genesis mint (TestNet)
- Wire the mint path to a **funded Algorand TestNet**: real ASAs, IPFS-hosted ARC-3 metadata (paired
  with ARC-19 for updatable plant NFTs), treasury as manager/reserve.
- Mint the first rarity-and-stability-gated stabilized cultivars and premium harvests as test assets.
- Reconciliation job: DB (authoritative) ↔ on-chain state (mirror).
- **Owner gate:** treasury/TestNet funding, mint thresholds. **Exit criteria:** assets visible in
  standard Algorand wallets/explorers; metadata hash integrity verified; DB stays authoritative.

### Phase 3 — Payments simulation → TestNet
- Promote store/payments flows from simulate mode to TestNet live-signing with **bring-your-own ALGO**
  (non-custodial Pera / WalletConnect). No fiat rail in scope.
- **Owner gate:** any liquidity/pricing decision. **Exit criteria:** end-to-end TestNet purchase/mint
  with real confirmations; clean failure/rollback behavior.

### Phase 4 — Audited mainnet settlement (gated)
- Security review of key custody (encrypted-at-rest / secrets-manager) and the settlement path.
- Enable mainnet behind a deliberate configuration gate; stand up the on-chain **GenBank** / pedigree
  graph as a mirror of the DB.
- **Owner gate (hard):** no real value moves until the audit passes and the gate is deliberately set.
- **Exit criteria:** passed audit; gated rollout; reconciliation proven on mainnet.

---

## Workstreams (with owners)

| Workstream | Scope | Lane / owner |
|---|---|---|
| Core loop & simulation | Keep grow→…→trade intact; deepen sim without breaking determinism | Agent |
| Economy & ledger | Faucet/sink discipline, transparency view, invariant tests | Agent builds · **Owner** approves balance changes |
| Genetics & provenance | Breeding, stabilization, lineage/verification endpoints | Agent |
| Chain integration | Provider ABC, ARC-3/ARC-19 metadata, mint path, reconciliation | Agent builds · **Owner** gates funded/real-value steps |
| Wallet & payments | Pera integration, payments simulation → TestNet | Agent builds · **Owner** gates liquidity/settlement |
| Key custody & security | Treasury custody, secrets, security review | **Owner** owns · Agent implements to spec |
| Web client & UX | Beta UI, transparency view, mint/lineage screens | Agent |
| Docs & memory | White paper, launch plan, layered memory, tagged honesty | Agent |
| Marketing & community | Beats below | **Owner** owns voice · Agent drafts |

---

## Marketing beats

1. **White paper drop.** Lead with the honest positioning: a scientifically grounded sim + provable,
   player-owned genetics on Algorand; DB-authoritative, chain-as-mirror; clear live-vs-planned lines.
2. **"The provably-honest grow game."** Differentiator in a category defined by mistrust: seeded RNG,
   replayable breeding, an auditable ledger, and a public economy transparency view.
3. **Community foundation.** Stand up the core channels; publish the (planned) no-dark-patterns
   charter as a versioned commitment. Recruit beta breeders.
4. **Genesis mint moment.** The first stabilized cultivars minted on Algorand TestNet — framed as
   proof-of-cultivation assets, not JPEGs, with verifiable lineage.
5. **Algorand ecosystem channels.** Engage Algorand developer/community and NFT-tooling channels; the
   ASA + ARC-3/ARC-19 story and low-fee, instant-finality fit are the technical hook.
6. **Transparency cadence.** Regular economy-health and provable-fairness posts — trust as ongoing
   content, not a one-time claim.

All external claims must match the white paper's live-vs-planned tagging. No marketing of vapor:
planned features are stated as intent, never as shipped.

---

## Risk register

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | **Regulatory** — securities/gambling/consumer-protection exposure; cannabis theme misread | Med | High | Utility-asset framing; no profit promises; cannabis is theme-only (no real commerce); jurisdictional gating; legal review before any real-value step | **Owner** |
| R2 | **Security** — key custody / treasury compromise; value-bearing route abuse | Med | High | Encrypted-at-rest custody / secrets-manager before real value; security review gate (Phase 4); auth + rate limits; protected surfaces; guarded spend paths | **Owner** + Agent |
| R3 | **Economy inflation** — faucets outrun sinks; time-value erodes | Med | High | Every faucet matched by a sink; `Decimal` ledger; property/invariant tests; public transparency view; balance changes owner-gated | Agent builds · **Owner** approves |
| R4 | **Chain dependency** — Algorand outage/latency/cost, or SDK/standard drift | Low | Med | DB-authoritative so gameplay never blocks on chain; mock provider is CI default; chain is settlement-only; reconciliation job; track ARC standard evolution | Agent |
| R5 | **Overpromising on-chain** — marketing outruns the mocked/simulated reality | Med | Med | Enforced built/partial/planned tagging; memory checks fail on doc drift; marketing mirrors white-paper tags | Agent + **Owner** |
| R6 | **Custodial/wallet UX** — players mishandle keys or funds | Med | Med | Non-custodial Pera path; bring-your-own ALGO; no browser mnemonics; server-side signing via the Python ABC only | Agent |
| R7 | **Scope creep pre-launch** — depth features delay the core loop | Med | Med | One-PR-one-purpose; backlog discipline; core loop is the non-negotiable | Agent |

---

## Success metrics

**Engagement / retention**
- Multi-day grow completion rate (do players return across a real-time grow?).
- D1 / D7 / D30 retention; active grow pods per player.
- Breeding actions per active player; stabilized lines created.

**Economy health**
- Net GC faucet-vs-sink balance over time (target: no runaway inflation).
- Ledger integrity: zero reconciliation anomalies; zero negative-balance events.
- Distribution of GC holdings (watch concentration).

**Genetics / provenance**
- Unique cultivars bred; lineage depth; verification-endpoint usage.
- Rarity distribution of minted assets.

**Chain (Phase 2+)**
- TestNet mints succeeded; metadata-hash integrity pass rate.
- DB↔chain reconciliation match rate (target: 100%).
- Median mint/transfer confirmation latency.

**Trust**
- Transparency-view engagement; provable-fairness replays performed by players.
- Support incidents tagged "fairness/economy" (target: trend to zero).

---

## Gate summary (the hard lines)

- No real value moves before Phase 4's security review passes and the mainnet gate is deliberately set.
- No economy balance change ships without owner approval.
- No custodial key handling before encrypted-at-rest custody is in place.
- Every external claim matches the white paper's live-vs-planned tagging.

*Launch Plan v1.0 — reflects project state as of July 2026; subject to change.*
