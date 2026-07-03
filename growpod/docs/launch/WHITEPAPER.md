# GrowPod Empire (GROWv2) — White Paper

**Version 1.0 · July 2026**

> A scientifically grounded cultivation simulator whose outputs are unique, verifiable,
> player-owned genetic assets — discovered through earned mastery and settled on Algorand.

This document describes what GrowPod Empire is, how its economy and genetics work, the role
of the Algorand blockchain in the design, and — plainly — what is live today versus what is
planned. It makes no investment claims. See the **Legal Disclaimer** at the end.

---

## Abstract

Most "grow games" are reskinned idle timers: tap, wait, collect, repeat, over a fixed list of
pre-authored strains. GrowPod Empire (internally *GROWv2*) is built on a different premise: a
server-authoritative, deterministic simulation of plant growth and quantitative genetics, wrapped
in a disciplined double-entry economy, with a blockchain layer used strictly for what a blockchain
is genuinely good at — portable, third-party-verifiable ownership of the unique assets the game
produces.

The core design commitment is a strict separation of concerns. The relational database is the
single source of gameplay truth. The chain is a **mirror and settlement layer** — it proves and
transports ownership; it never governs gameplay. Money inside the game is `Decimal`, ledger-posted,
and audited, with every faucet matched by a sink. Genetics are a real inheritance model with seeded,
replayable randomness, so any cultivar's creation can be independently re-derived and verified.

The result is a game whose most valuable outputs — rare, stabilized strains and premium harvests —
can become Algorand Standard Assets (ASAs) carrying ARC-3 metadata sourced from server truth. This
paper explains the mechanisms behind that claim, and is deliberate about the boundary between what
is implemented and what is on the roadmap.

---

## The game, and why a persistent economy

The core loop is short and complete:

> **grow → care → harvest → cure → sell / breed / stabilize → mint → trade**

A player runs grow pods, tends plants through a real-time physiological simulation, harvests and
cures the product, and then chooses what to do with it: sell it into the in-game economy, breed it
to pursue new genetics, stabilize a promising line so it breeds true, or — for rare, stabilized
results — mint it as a blockchain asset and trade it.

The economy is **persistent** because the interesting outcomes take real time and accumulate. A
stabilized strain is the product of many grows and deliberate breeding decisions; a champion line is
a season's worth of work. Persistence is what makes those decisions matter: assets are long-lived,
lineage compounds, and reputation is earned by doing rather than bought. The in-game currency, **GC
(GROW credits)**, circulates on an auditable internal ledger and denominates all economic activity —
inputs, upgrades, harvest sales, breeding fees, and stabilization costs.

Persistence only works if players trust the world isn't rigged and isn't quietly inflating away the
value of their time. That trust requirement is why the economy and genetics were engineered the way
they are, described next.

---

## The moat: genetics and breeding

The defensible core of GrowPod Empire is its genetics system — not one clever feature, but a set of
properties that compound.

### A real quantitative-genetics model (live today)

Each strain carries a **genome**: a set of traits, each expressed as a value plus a dominance mode
(`dominant`, `recessive`, or `codominant`). The current model tracks fourteen traits — indica ratio,
THC, CBD, flowering time, yield, difficulty, disease resistance, pest resistance, vigor, and four
terpenes (myrcene, limonene, caryophyllene, pinene). This is a genuine inheritance model, not a
lookup table.

**Crossbreeding** combines two parents per trait using a dominance-weighted blend, then applies
Gaussian *segregation noise* scaled by the line's instability, and finally re-inherits dominance
probabilistically. The founder catalog seeds twenty-two strains — sixteen originals plus six iconic
landraces and classics — each backed by a scientist-grade encyclopedia entry (lineage, origin,
cannabinoid and terpene detail, cultivation parameters). A design note grounds the whole system: peer-
reviewed work shows strain *names* are unreliable genetic identifiers, so the game treats the
**genome plus verifiable lineage** as the authoritative identity, exactly as a serious breeder would.

### Determinism is the load-bearing property

Every random draw in breeding is **seeded and recorded**. A breeding event persists its RNG seed, so
the exact offspring genome can be re-derived from the parents and that seed by anyone. This is not a
convenience — it is the foundation of everything downstream. Because outcomes are reproducible, they
are cheat-proof; because they are cheat-proof, the assets minted from them can carry a meaningful
proof of how they came to exist. The game even refuses a client-supplied seed at breed time, closing
the door on seed-shopping.

### Stabilization and rarity

Fresh crosses are usually unstable — their phenotypes vary widely and typically drop a rarity tier.
**Stabilization** (selfing across generations) raises a line's stability, which narrows the displayed
trait ranges so a stable line breeds true. Extreme traits plus high stability push a strain up the
rarity ladder. This gives breeding a genuine skill gradient: anyone can make a cross; making a
*stable, rare, valuable* line takes deliberate, time-consuming work.

### Verifiable provenance (partly live, expanding)

Provenance is already persisted and partly exposed. Strain records store the full genome, stability,
generation, both parent references, and the creating player, alongside the breeding seed. Two
verification endpoints are live today: one replays a single cross and confirms the resulting genome
matches, and one walks a strain's entire ancestry back to catalog roots, replaying every bred node
from its stored seed. Together these are the provable family tree behind the planned **GenBank** — a
shared registry of player-created cultivars whose value grows with the community and cannot be cloned
by a competitor starting from zero.

The deeper genetics targets — a polygenic genome with many loci per trait, rare novel-allele
mutations, gene-by-gene epistasis, genotype-by-environment expression, and a first-discoverer
"discovery economy" — are **design intent, not shipped features.** They are described here as
direction, not as current capability.

---

## Economy design

The economy is one of the most complete subsystems in the game, and its rules are non-negotiable.

- **All money is `Decimal` and ledger-posted.** No floating-point currency, ever. Every spend and
  every earn writes a double-entry-style ledger record, so the entire money supply is auditable and
  reconstructable from the log.
- **Every faucet has a sink.** Any mechanism that creates GC (harvest sales, stipends, rewards) is
  matched against mechanisms that remove it (input costs, breeding and stabilization fees, upgrades).
  This is the anti-inflation stance: value is defended by design, not by discretion.
- **Concurrency-safe by construction.** Wallets use optimistic locking plus a database-level
  non-negative-balance constraint, and each plant can be harvested exactly once. Concurrent debits or
  a raced double-harvest cannot double-spend GC or mint duplicate currency; a lost race rolls back
  cleanly rather than corrupting the ledger.
- **Balance is data, not code.** Tuning — prices, fees, stabilization increments, minting thresholds
  — lives in a single configuration surface (`balance.yaml`) that the engine reads. Balance changes
  are data changes, reviewed as a protected surface, not code rewrites.

The anti-inflation posture is deliberate and central. In a persistent economy where players invest
real time, uncontrolled currency creation is the fastest way to destroy trust. The ledger makes the
money supply *visible*; a planned public transparency view will publish faucets, sinks, and the live
inflation picture directly from that ledger, so players can check the health of the economy rather
than take it on faith.

---

## The Algorand layer

### Why Algorand

The blockchain's job in this design is narrow and specific: give the game's unique outputs an
ownership record that a third party can verify and that a player can carry off-platform. For that
job, Algorand fits well:

- **Fast blocks and instant finality.** Algorand produces blocks in roughly under three seconds and
  offers finality at the block level — once a transaction appears in a certified block it is final,
  with no forks or reorganizations to wait out. A minting or transfer action resolves in a single
  confirmation rather than requiring many. This matters for a responsive game UI.
- **Very low, predictable fees.** A standard transaction costs on the order of 0.001 ALGO — a small
  fraction of a cent under normal conditions. Minting and trading many small game assets is only
  viable if per-transaction cost is negligible.
- **A first-class token standard.** The Algorand Standard Asset (ASA) is a native primitive — no
  smart contract is required to mint a fungible token or a 1-of-1 NFT — which keeps the asset layer
  simple and auditable.
- **Established metadata norms.** The ecosystem has mature conventions for NFT metadata (below),
  which lets the game's assets be legible to standard Algorand wallets and marketplaces.

### NFT genetics assets and metadata

The game's assets follow **ARC-3**, the Algorand convention where an asset points to a JSON metadata
document (typically hosted on IPFS) and stores a 32-byte hash of that document on-chain for integrity.
GrowPod Empire builds this metadata from **server truth**: a strain NFT's metadata carries its
rarity, lineage type, trait ranges, stability, generation, and terpene profile; a harvest NFT carries
weight, quality, cannabinoid readings, and timestamp; a seed or proof-of-play token anchors the
entropy inputs (block hash, nonce) and derived traits so anyone can re-derive the genetics. Because
the metadata is generated from the authoritative database and hashed on-chain, the asset is a
faithful, tamper-evident mirror of the in-game object.

For genetics specifically, the web client includes a compact **genotype codec** that encodes a
plant's gene pairs into a fixed 32-byte (64-hex-character) string with a trailing checksum — a
portable, deterministic DNA representation that is safe to embed in NFT metadata and validate on
read.

Where an asset needs to *change* after minting — a plant NFT whose metadata updates as the grow
progresses — the design follows the ecosystem's current recommendation to pair ARC-3 with **ARC-19**,
which stores the metadata pointer in the asset's reserve address so it can be updated without
reminting. (The older on-chain ARC-69 approach is being phased out in the ecosystem, so the game does
not build on it.) The treasury account is set as manager and reserve on created assets, which is what
makes the ARC-19 update path and asset lifecycle management possible.

### Wallet integration

The web client integrates non-custodial wallet signing through Pera Wallet: a player's keys live in
their own wallet and never touch game code. A separate ephemeral "dev" mode generates an in-memory
account for automated UI testing only — it holds no funds, and its key is never persisted, logged, or
committed. The game deliberately does not read any mnemonic from the browser environment; any
funded, server-side signing goes through the Python chain provider, not the client.

### The mirror-not-authority principle

This is the invariant that governs the entire chain layer: **the database is authoritative; the chain
mirrors it.** On-chain ASA balances and NFT state are settlement, never gameplay truth. The game runs
completely against a deterministic mock chain provider — which is exactly how continuous integration
runs, with no network and no funded account required. The chain proves and transports ownership; it
does not, and must not, drive the simulation, the economy, or genetics.

### What is live versus planned on-chain

Honesty here is a design value, so this is explicit:

- **Live:** a swappable provider interface with a deterministic mock (the CI default) *and* a real
  Algorand provider implemented against the SDK; the ARC-3 metadata builders; the genotype codec;
  client-side Pera wallet integration; and an NFT mint path that runs in a default-on **simulate
  mode**, logging the exact JSON payload and returning a synthetic id rather than broadcasting.
- **Planned / gated:** wiring the mint path to a funded Algorand TestNet with real ASAs and IPFS-
  hosted metadata; the on-chain GenBank and pedigree graph; and any mainnet settlement. The real
  provider exists and is exercised by an opt-in integration test, but the production asset id is
  unset and metadata is not yet on IPFS. **No real-money settlement is live.**

---

## Payments roadmap

Payments are approached conservatively and in stages.

**Today**, an in-progress store and payments **simulation** is being wired: the flows that will one
day move value are being built and exercised end-to-end in simulate mode, where transactions are
logged rather than broadcast. This lets the team prove the mechanics — pricing, atomic transfer
groups, confirmation handling, error paths — without any value at risk.

**Next**, those same flows run against **Algorand TestNet**, where transactions are real on a test
network but carry no monetary value, validating the live-signing and settlement path with actual
confirmations.

**Later, and explicitly gated**, mainnet settlement of real value would follow — only after a
security review of key custody and the settlement path, and only behind a deliberate configuration
gate. The current owner decision is **bring-your-own ALGO** liquidity via a wallet the player already
controls (the non-custodial Pera / WalletConnect path). There is no fiat payment rail (Stripe or
otherwise) in scope, and there is no payments code carrying real value in the repository today. Real-
money settlement remains a future, gated milestone, not a current feature.

---

## Security and trust

Trust is treated as a product surface, not a slogan — which is fitting for a game with an economy and
NFTs, a category that has trained players to expect scams.

- **Server-authoritative, no client-trusted state.** The simulation is a pure, deterministic engine
  computed on the server on read. Spending paths pass through guards (for example, a per-invocation
  cap on the AI auto-care budget). Writes require API-key authentication and are rate-limited; reads
  are public.
- **An auditable ledger.** Every unit of GC that moves leaves a record. The money supply can be
  reconstructed and inspected; there is no hidden money printing.
- **Provable fairness.** Because breeding is seeded and the seed is disclosed, a player or a third
  party can replay a cross and verify the outcome. Verification endpoints for a single cross and for
  a full lineage are live today. Generalizing the same "replay and verify" to weather and other draws
  is planned.
- **Protected surfaces and change discipline.** Migrations, the economy configuration, feature flags,
  wallet/auth code, and dependency lockfiles are designated protected surfaces, changed only under
  explicit review rules. Migrations are forward-only and tested in CI.
- **CI never needs a live key.** The mock chain and mock AI providers make the entire test suite
  runnable offline, so correctness is proven continuously without touching a real network, a funded
  account, or a paid API. Property and invariant tests specifically guard the ledger and genetics.

The design intent extends this into a published, versioned "no dark patterns" charter — disclosed
odds, no loot-box manipulation, no manufactured FOMO, no pay-to-win obfuscation — which is planned,
not yet shipped, and labeled as such.

---

## Roadmap phases

1. **Testnet beta.** Harden the core loop end-to-end with the mock chain and the payments simulation.
   Ship the public economy transparency view. Broaden provable-fairness verification.
2. **NFT genesis mint.** Wire the mint path to a funded Algorand TestNet with real ASAs and IPFS-
   hosted ARC-3 (paired with ARC-19 for updatable assets) metadata. Mint the first stabilized,
   rarity-gated cultivars and premium harvests as real test-network assets.
3. **Payments simulation → TestNet.** Promote the store/payments flows from simulate mode to TestNet,
   validating live signing and settlement with bring-your-own ALGO wallets.
4. **Audited mainnet settlement (gated).** After a security review of key custody and the settlement
   path, enable mainnet settlement behind a deliberate configuration gate. Stand up the on-chain
   GenBank and pedigree graph as a mirror of the authoritative database.
5. **Depth expansion.** Advance the genetics model toward its polygenic, mutation-bearing target and
   deepen the physiological simulation, always preserving determinism and the core loop.

Phase ordering is a commitment: no real value moves before the settlement path is audited and gated.

---

## Team and agent-native development

GrowPod Empire is built with an unusually explicit, agent-native engineering discipline. The project
maintains a layered memory system — always-loaded invariants, an architecture map, an append-only
decision log, a design codex, and a prioritized backlog — that keeps development honest across
sessions. Every capability in the design docs is tagged as *built*, *partial*, or *planned*, and a
built claim must cite a real file. Automated checks fail the build if documentation drifts from the
code or overstates what exists. This same honesty discipline is what makes this white paper's
built-versus-planned distinctions trustworthy: they are drawn from the same tagged, enforced record
the engineers work from.

---

## Legal Disclaimer

**Please read this section carefully.**

**Nature of the product.** GrowPod Empire (GROWv2) is a **video game**. Any digital assets it may
issue — in-game GROW credits (GC), Algorand Standard Assets, and NFTs representing strains, seeds, or
harvests — are **utility items for use within the game**. They are intended for gameplay, collection,
and interoperability, not as investments.

**No investment promises.** Nothing in this document is an offer, solicitation, or recommendation to
buy, sell, or hold any token, asset, or security. GrowPod Empire makes **no promise or representation
of profit, yield, appreciation, return, or future value** of any in-game currency, ASA, or NFT. The
value of any such asset may go to zero. Do not acquire any game asset with an expectation of financial
return.

**Not financial, legal, or tax advice.** This document is informational only and does not constitute
financial, investment, legal, accounting, or tax advice. Blockchain assets carry significant risk,
including total loss. Consult your own qualified professional advisors before taking any action, and
make your own independent assessment.

**Cannabis is a game theme only.** GrowPod Empire is a **simulation and fantasy**. It depicts the
cultivation of cannabis plants **as a game mechanic and creative theme**. It does **not** involve,
facilitate, enable, or promote the cultivation, sale, purchase, possession, or distribution of any
real cannabis, cannabis product, controlled substance, or any other physical good. No real plants,
seeds, or cannabis products are grown, sold, shipped, or exchanged. All strains, genetics, harvests,
and related content are **entirely virtual and fictional.**

**Regulatory compliance.** The legal treatment of blockchain assets, NFTs, and online games with
economies varies by jurisdiction and continues to evolve. GrowPod Empire may restrict or decline
access, features, minting, or settlement in any jurisdiction to comply with applicable law. Users are
responsible for ensuring their participation is lawful where they live. Access may be unavailable to
persons in restricted jurisdictions or below the applicable age of majority. Real-money settlement,
where and if offered, will be gated and subject to applicable regulatory requirements.

**Forward-looking statements.** This document distinguishes features that are live today from those
that are planned. Planned features are **statements of current intent, not commitments**, and may
change, be delayed, or be abandoned. Descriptions of on-chain functionality that are labeled as
planned or simulated do **not** describe currently live, real-value, on-chain behavior.

**No warranty.** The game and any associated assets are provided "as is," without warranties of any
kind to the extent permitted by law.

---

*GrowPod Empire (GROWv2) — White Paper v1.0. This document reflects the state of the project as of
July 2026 and is subject to change.*
