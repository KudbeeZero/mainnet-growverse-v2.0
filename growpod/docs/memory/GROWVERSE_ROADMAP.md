# 🌱 GrowVerse Master Roadmap — 22-phase execution plan

> **What this is.** The branch-by-branch buildout plan that turns today's GROWv2 into **GrowVerse**:
> a world-class grow-game + AI plant-intelligence platform with Algorand ownership, dynamic plant
> NFTs, an AI Plant Analyst/Scout, sustainable monetization, and an agent-driven control center.
> It is an **upgrade path over existing systems** (see [ARCHITECTURE_TRUTH.md](ARCHITECTURE_TRUTH.md)),
> not a rebuild. Sonnet 5 (+ depth-1 sub-agents) executes it one branch at a time via the
> [Execution Machine](EXECUTION_MACHINE.md).
>
> **Guardrails (never violated):** DB authoritative / chain a mirror; pure sim engine; `Decimal`
> ledger with matched faucets↔sinks; provider ABCs with CI mocks; `balance.yaml` is the owner-gated
> tuning surface; no mainnet actions; no funds-path rewrites; no securities-like promises; all agent
> autonomy visible, permissioned, depth-1. Protected surfaces follow the gate in `docs/BUILD_RULES.md`.
>
> Capability tags: ✅ built · 🔨 partial · ⬜ planned.

---

## 1. Product vision

**One sentence:** *Your plant is alive, intelligent, and yours.*

Tamagotchi-depth care loop × real plant science × verifiable Algorand ownership × an AI grow-coach
that makes every player feel like an expert.

**Five pillars:**
1. **The plant feels alive.** Every care action gets a visible reaction within one second; stage,
   mood, stress, and rarity readable at a glance from the pod visual alone.
2. **Teaches real science, plainly.** Morphology, stress signs, trichomes, canopy health — as
   gameplay, grounded in the university layer. Simulation/education framing, no real-world
   illegal-cultivation instructions, age-appropriate.
3. **You own what you grow.** Harvests and discovered genetics become dynamic Algorand NFTs whose
   metadata evolves with the plant's story. Testnet first; every transaction previewed; nothing
   hidden.
4. **AI makes every player great.** The Scout says *what changed, why it matters, what to do next* —
   with confidence and freshness labels. Premium deepens intelligence, never gates the fun.
5. **Fun first, speculation never.** Economy separates gameplay utility from asset value. No promised
   returns, no purchasable stat advantages, faucets matched to sinks.

---

## 2. Architectures (reference)

### System
Client (Next.js) → REST → Flask API (key-auth writes, rate-limited) → Services (economy/ledger, care,
genetics, missions, analyst-pipeline, metadata-projector, txn-watcher) → **pure simulation engine**
(compute-on-read) → DB (authoritative) + telemetry store. Side planes: Algorand (mirror only,
simulate-default) and the AI layer (`ai/` ABCs, CI mocks). A dev plane (the TDE/Agent OS) reads
repo + PR + memory + gate state.

### Agent architecture — two planes, one rulebook
- **Product agents** (player-facing, via `ai/` ABCs): Plant Analyst, Scout, Genetics Advisor (later).
  They **read** game state + the knowledge layer and **write only advisory artifacts**. They never
  mutate plants, ledger, or chain.
- **Dev agents** (build/ops-time, via Claude Code + skills): Security Reviewer, Transaction Watcher,
  Economy Balancer, Visual Director, Lore/Quest Writer, Training Scribe, QA Tester, Community/Event
  Planner. Their writes land **only as PRs, docs, or CI artifacts**.
- **Global rules:** depth-1 sub-agents by default (depth-2 needs recorded owner approval; depth-3
  forbidden); every agent has an allow/deny list + a kill switch flag `agent.<name>.enabled`; no
  hidden actions (every output attributable: name, model tier, inputs hash, timestamp); prompt-
  injection defense at every boundary where player text or chain metadata enters a prompt.

### Gameplay loop stack
| Loop | Duration | Beats |
|---|---|---|
| Micro | 30 sec | open pod → read mood/visual → one care tap → visible reaction <1s → micro-reward |
| Session | 5 min | care rotation → climate tune → Scout card → mission tick → market glance |
| Daily | 1/day | streak claim → daily missions → boost window → micro-lesson → listings |
| Weekly | 7 days | harvest → cure → sell/breed/stabilize → cup/faction standing → genetics discovery |
| Seasonal | 6–10 wks | event strains, cup seasons, partner drops, leaderboard resets |

Design rules: consequence visible within 1s (visual) and 1 session (state); **mercy mechanics** (no
hard death <72h absence; recovery is its own satisfying arc); 30-sec loop one-handed on phone;
losing states teach (every failure links a lesson).

### Algorand
Keep the correct pattern. Add, in order: **ARC-19** dynamic metadata for evolving plant/harvest NFTs
+ **ARC-69** `gpe` event notes (existing `encodeNote`) for append-only care history; ARC-3 static for
immutable badges. Wallet UX via Pera/Defly WalletConnect with a **preview-before-sign** modal (asset,
amount, fee, receiver, decoded note), loud TESTNET badge, explorer deep-links. **Transaction watcher**
service tracking `built→previewed→signed→pending→confirmed→indexed` with replay protection (lease /
idempotency key). **Lazy-mint at harvest.** Mainnet locked behind the security pass + owner approval.

### AI / model / data
Scout pipeline: sim state → deterministic feature extractor (pure code) → prompt + university-KB
excerpts → tiered call (Scout = Haiku, Analyst = Sonnet) → schema-validated JSON report → stored +
rendered. Cost control: cache by state-hash, per-player daily budget, tier gating; target AI cost
< $0.02/player/day free tier. The **pure sim is a free eval oracle** — we can verify whether Scout
advice actually improves plant outcomes. Injection defense: untrusted-data wrapping, length clamps,
schema validation, deterministic fallback text.

### Security
Wallet preview-before-sign / no hidden spend / anti-phishing (never request seed phrases). Txn replay
protection + watcher capture. API key-auth + scrubbed errors. Economy invariants + property tests +
caps + marketplace-abuse limits. Agents: allow/deny registry, kill switches, depth limits, schema
validation, budget caps. Secrets env-only, never in CI. Codified PR gate on protected surfaces.

### Monetization (fun-first, no P2W)
Cosmetics (zero stat impact) · premium Analyst tier · genetics passes · seasonal pass (free track
always present) · marketplace fee 2.5–5% · optional at-harvest mint fee · partner/creator packs.
Boosts stay capped time-shifters; no purchasable yield/quality. No ROI/"investment" language; NFTs
are collectibles/records of play. Baseline targets (tuned at p20): D1 ≥ 40%, D7 ≥ 20%, D30 ≥ 10%;
payer conversion 3–5%.

---

## 3. The 22 phases

> Each phase is one focused branch (clusters split into `pXXa/pXXb`). Branch names `claude/gv-pNN-slug`.
> Phases are thematic workstreams; the [Execution Machine](EXECUTION_MACHINE.md) sequences slices into
> PRs (see First 10 PRs). Every field below is what Sonnet needs to build without guessing.

### Phase 1 — Architecture Truth Audit · `claude/gv-p01-architecture-truth`
Freeze the verified current state ([ARCHITECTURE_TRUTH.md](ARCHITECTURE_TRUTH.md)) and reconcile with
ARCHITECTURE.md + BACKLOG.md. **Value:** every later phase builds on truth, not assumption.
**Tech:** this doc set already lands the audit; p01 keeps it current and links from MAP.md.
**Do NOT touch:** any code, `balance.yaml`, migrations. **Acceptance:** links resolve, `make
check-memory` green, BACKLOG reconciled. *(Effectively delivered by this documentation PR.)*

### Phase 2 — Core Game Loop (codify + instrument) · `claude/gv-p02-game-loop-codex`
**Purpose:** commit the loop stack as design-codex truth, then instrument every beat with telemetry.
**Value:** tighter play; measurable retention from day one. **Tech:** `design/GAME_LOOPS.md`; a
lightweight `telemetry` table (event, player_id, plant_id?, payload, ts) posted from existing
GameService action handlers (server-side, no new client calls); Alembic migration. **Game design:**
define 30-sec/5-min/daily/weekly/seasonal beats against existing systems; specify mercy mechanics
(no hard death <72h — verify decay curve, propose deltas as owner-gated follow-up). **Data:** ~15
events (care_action, streak_claim, stage_transition, harvest, cure_start/finish, sale, breed,
mint_offer_view, mission_complete, session_start/end…). **Security:** no PII beyond player_id;
payloads schema-validated. **Sonnet prompt:** "Write GAME_LOOPS.md; add telemetry table + migration
+ service hooks; test that events post inside the same txn as the action; closeout." **Acceptance:**
codex doc merged; ≥12 events firing in tests; alembic green; zero new client latency. **Do NOT
touch:** `balance.yaml` values, sim engine internals (hooks live in services).

### Phase 3 — Pod Visual System V1 (moods, mutation, rarity) · `claude/gv-p03-pod-visual-moods`
**Purpose:** close the two visual gaps — animated mood states + mutation/rarity indicators. **Value:**
highest-emotion upgrade; the plant visibly *feels* boosted/stressed/recovering/rare. **Tech:** extend
`chamberCore.ts` with a `mood` layer derived from `condition_flags[]` + health + recent-care recency
(`idle|boosted|stressed|recovering|rare|mutation`); animate via the existing canvas ticker; honor
`prefers-reduced-motion` (static tint fallback); rarity aura + mutation markers from genome/rarity
fields already in state. **Game design:** transitions legible in <1s; stressed→recovering→thriving is
a designed emotional arc. **AI/agent:** Visual Director golden-diffs every mood × 3 stages via the
capture-shots skill. **UI/UX:** mood pill syncs with visual mood; color-blind-safe (icon + label).
**Sonnet prompt:** "Implement the mood layer behind the `grow_chamber` flag; capture + promote
goldens; closeout." **Acceptance:** 6 moods render distinctly at phone size; reduced-motion honored;
goldens promoted; no frame-rate regression. **Do NOT touch:** sim engine, 3D bud viewer (frozen),
`plant_state.py` schema.

### Phase 4 — Plant State Engine (extend, don't rebuild) · `claude/gv-p04-plant-state-ext`
**Purpose:** add care-history aggregate, trait-expression summary, stress-event log, and a **pure
dynamic-metadata projection** (`project_metadata(plant_state) -> dict`) producing the ARC-19 JSON +
ARC-69 note payload. **Value:** richer Scout insight + NFTs that tell the true story. **Tech:** new
pure functions in `simulation/` (no player-scoped logic); `care_history` rollup in `services/` +
migration; stress-event log from condition-flag transitions returned by catch-up. **Algorand:**
projection is the single source for mint + metadata-update payloads; extend the SHA-256 hash pattern
in `chain/metadata.py`, don't duplicate. **Security:** sanitize player-provided plant names at
projection (injection defense at the source). **Sonnet prompt:** "Add projection + expression summary
as pure functions; add care_history rollup + migration; determinism property tests; closeout."
**Acceptance:** projection deterministic (same state → same dict + hash); engine purity preserved
(no player-scoped economy/research logic added to `simulation/` — the existing catch-up path already
imports `db.models` for session-scoped state reads/writes, per `ARCHITECTURE_TRUTH.md`; that's an
established pattern, not a purity bar this phase needs to newly satisfy); migration passes drift
check. **Do NOT touch:** genome/breeding math, `balance.yaml`, settlement paths.

### Phase 5 — AI Plant Analyst / Scout · `claude/gv-p05-scout-reports`
**Purpose:** ship Scout report cards (frequent, cheap) + Analyst briefings (weekly, deep) on the
existing Advisor agent. **Value:** the signature differentiator. **Tech:** deterministic extractor
(p04 outputs) → prompt with KB grounding → tiered call (Scout=Haiku, Analyst=Sonnet) via the existing
provider factory (mock in CI) → schema-validated report (`messages.parse()`) → `scout_reports` table
+ migration → card UI; cache by state-hash; per-player daily budget. **Game design:** advisory, never
blocking; exactly one recommended action mapped to a real button. **UI/UX:** ScoutReportCard
(confidence badge, freshness stamp, lesson link, action button); drawer on chamber; history on plant
detail. **Data:** recommendation-shown/accepted/outcome telemetry (sim is the outcome oracle).
**Security:** injection defense; schema-rejection degrades to deterministic Advisor text; budget
kill-switch `agent.scout.enabled`. **Monetization:** Analyst tier = flagship premium (`premium_analyst`
flag). **Sonnet prompt:** "Build extractor→prompt→parse pipeline + `scout_reports` table + card UI
behind `master_grower_advisor` flag; mock returns fixtures in CI; telemetry hooks; two slices —
(1) pipeline+mock+UI, (2) live Haiku call + budget guard; closeout." **Acceptance:** card renders all
schema fields; CI green with zero keys; cache-hit testable; budget guard enforces cap. **Do NOT
touch:** Auto-Care's action-execution paths, ledger.

### Phase 6 — Plant Science Knowledge Layer · `claude/gv-p06-knowledge-layer`
**Purpose:** backfill the 14 missing assessment banks + formalize the KB as the Scout's grounding
corpus. **Value:** real plain-language plant science; every Scout claim traceable to a lesson.
**Tech:** normalize `data/strain_knowledge.yaml` + curriculum into a tagged, retrievable KB with an
excerpt helper the Scout consumes; author 14 deterministic assessment YAMLs (matching the `bio-101`
pattern). **Security:** simulation/education framing only; no real-world illegal-cultivation
instructions; age-appropriate. **Sonnet prompt:** "Build the tagged KB + excerpt helper; author the
14 banks; wire Scout lesson-links; closeout." **Acceptance:** excerpt helper returns relevant text by
tag; 14 banks validated by the 1:1 enforcement test pattern; Scout cards cite real lessons. **Do NOT
touch:** economy, chain, sim engine.

### Phase 7 — Algorand Ownership Layer (testnet, dynamic NFTs) · `claude/gv-p07-ownership-testnet`
*(cluster: p07a wallet+preview, p07b watcher+txn_log, p07c lazy-mint-at-harvest)*
**Purpose:** turn harvests/strains into dynamic verifiable NFTs on **testnet only**, with explicit
wallet UX + a transaction watcher. **Value:** provable ownership; the "mint your harvest" climax.
**Tech:** enable the real provider on testnet — ARC-19 metadata (p04 projector) + ARC-69 `gpe` notes;
WalletConnect (Pera/Defly); preview-before-sign modal; transaction-watcher service with a `txn_log`
migration + replay protection; lazy-mint at harvest, atomic-group multi-asset harvests. **AI/agent:**
Transaction Watcher surfaces lifecycle to the wallet panel + TDE; read-only algod/indexer scope.
**UI/UX:** wallet panel with loud TESTNET badge; preview modal; watcher chips; explorer links.
**Security:** highest but scoped — **no funds/withdrawal rewrite here** (that's p13), no mainnet,
every txn previewed + replay-protected; Security Reviewer sign-off mandatory. **Sonnet prompt:** "On
testnet only, enable minting via ARC-19 + ARC-69; add WalletConnect + preview modal + watcher +
`txn_log` migration + replay protection; lazy-mint at harvest; keep withdraw/deposit/settlement
untouched; attach Security-Reviewer checklist + owner testnet click-test + watcher capture to the PR;
closeout." **Acceptance:** owner testnet click-test mints a harvest NFT; watcher shows full lifecycle;
preview modal blocks silent signing; explorer link resolves; CI stays mock/simulate with zero keys.
**Do NOT touch:** `settlement_service` withdraw/deposit logic, `MAX_WITHDRAWAL_PER_DAY`, mainnet
config, `balance.yaml` economy numbers.

### Phase 8 — Economy / Monetization V1 (no P2W) · `claude/gv-p08-economy-v1`
*(owner-gated: any `balance.yaml` number change needs approval + a sim report)*
**Purpose:** premium lanes (cosmetics, Analyst tier, genetics passes) with sim-verified balance;
restore the launch seed cost. **Tech:** entitlements table + cosmetic/tier gating via flags; wire the
Analyst-tier gate to p05; restore seed cost 0→25 (owner-approved); Economy Balancer runs sims on any
candidate change. **Game design:** boosts stay capped time-shifters; no purchasable yield/quality.
**Sonnet prompt:** "Add entitlements + cosmetic/tier gating; gate the Analyst tier; restore seed cost
to 25 (owner-approved); add the Economy Balancer sim harness + attach a sim report; closeout."
**Acceptance:** tiers gate correctly; free loop unaffected; sim report shows stable faucet/sink
balance; seed cost restored. **Do NOT touch:** ledger double-entry invariants, withdrawal caps,
anything making purchases affect plant yield/quality.

### Phase 9 — Genetics / Breeding UI + discovery · `claude/gv-p09-genetics-ui`
**Purpose:** surface the deterministic breeding engine as a discovery system with lineage UI,
phenotype ranges, mutation/rarity reveals. **Tech:** lineage tree + phenotype-range UI over
`genetics/`; reveal animation (ties to p03 visuals); breeding-cooldown UX; flagged read-only Genetics
Advisor. **Sonnet prompt:** "Build lineage + phenotype + reveal UI over the existing engine; add a
flagged read-only Genetics Advisor; wire mutation visuals from p03; no breeding-math changes;
closeout." **Acceptance:** lineage renders; reveal plays; advisor behind flag; breeding determinism
unchanged. **Do NOT touch:** `genetics/` cross math, rarity-assignment logic.

### Phase 10 — Player Missions + Agent Feed · `claude/gv-p10-mission-control`
**Purpose:** build a player-facing daily/weekly mission (quest) system from scratch — there is no
existing `MissionService` or player quest UI to wire; the current `/mission` route is a separate,
nav-hidden, owner/admin-only "Mission Control v0" ops board (`web/src/app/mission/page.tsx`) and
stays exactly that. Also add the agent-report feed with attribution/confidence/freshness.
**Tech:** new `MissionService` + mission schema + player-facing mission UI (new components, not the
admin `MissionPacketCard`/`WiringPanel`); agent-feed surface reading `scout_reports` + the agent
registry; dev/debug toggle. **Security:** feed renders only sanitized text (reuse p04
sanitization). **Sonnet prompt:** "Build a player-facing mission/quest system (new MissionService +
schema + UI, distinct from the existing admin-only /mission ops board); build the attributed
agent-report feed; add a dev/debug toggle; closeout." **Acceptance:** player missions serve +
complete; feed shows attributed reports; sanitization holds; the admin `/mission` ops board is
untouched. **Do NOT touch:** economy reward numbers (missions read `balance.yaml`, don't redefine);
the existing admin `/mission` ops board.

### Phase 11 — GrowVerse TDE / Agent OS · `claude/gv-p11-tde-agent-os`
**Purpose:** the owner's control center — repo/PR/CI status, plant-systems health, agent map + last
reports, economy safety gates, model status, flag audit, deploy status, next-recommended branch.
**Tech:** a dev/owner-gated dashboard (NODE_ENV/flag-gated like `/dev/blockchain`) aggregating GitHub
PR state, CI gates, agent registry + outputs, the txn watcher log, deploy status; kill switches
toggle `agent.*.enabled` flags only. **Security:** strictly dev/owner-gated; never renders secrets;
kill switches write only flags. **Sonnet prompt:** "Build the TDE dashboard aggregating repo/PR/CI +
agent registry + watcher log + flag audit + deploy status + next-branch recommendation; kill switches
flip `agent.*.enabled` only; 404 in prod; closeout." **Acceptance:** all panels render behind the dev
gate; a kill switch flips a flag; no secret leakage; route 404s in prod. **Do NOT touch:** production
auth, secrets, any direct economy/chain mutation.

### Phase 12 — Agent Runtime Guard · `claude/gv-p12-agent-runtime-guard`
**Purpose:** enforce the registry — per-agent allow/deny, approval gates, depth limits, budget caps,
output schema validation, kill switches. **Tech:** a thin guard reading the agent registry: validates
allowed actions; enforces depth-1 (depth-2 needs a recorded owner-approval token; depth-3 rejected);
budget caps; schema-validates outputs; audit-logs every run; wires kill switches. **Security:**
central to agent safety — recursive-spawn prevention, injection rejection, budget kill. **Sonnet
prompt:** "Implement the guard enforcing allow/deny, depth policy, budget caps, schema validation,
kill switches; audit-log every run; surface violations in the TDE; closeout." **Acceptance:** depth-3
rejected; disallowed action blocked; budget kill fires; audit log written; kill switch disables an
agent. **Do NOT touch:** product-agent output semantics (guard wraps, doesn't rewrite), economy,
chain funds.

### Phase 13 — Security / Safety / Compliance pass · `claude/gv-p13-security-pass-v1`
**Purpose:** codify + verify the full security model; prerequisite for ever touching funds paths or
mainnet. **Tech:** extend `docs/BUILD_RULES.md` with the protected-surface PR gate; add/verify wallet-
preview coverage, replay protection, anti-phishing UI (never request seed phrases), secret-handling
audit, marketplace-abuse limits, economy-exploit property tests, admin-action audit; run a full
injection + exploit sweep; produce a `SECURITY_PASS_V1` report. **Algorand:** verify testnet safety
end-to-end; assemble (do not execute) the mainnet checklist. **Sonnet prompt:** "Codify the PR gate;
add anti-phishing UI; verify replay protection + preview coverage; add abuse + exploit property tests;
audit secrets + admin actions; run an injection/exploit sweep; commit SECURITY_PASS_V1; do NOT touch
mainnet or funds-path math; closeout." **Acceptance:** all new security tests green; gate documented;
report committed; mainnet checklist defined but unexecuted. **Do NOT touch:** mainnet config,
withdrawal/settlement math (audit only, no rewrite).

### Phase 14 — UI/UX Master Design · `claude/gv-p14-uiux-master`
*(cluster: p14a tokens+components, p14b screens, p14c a11y)*
**Purpose:** land the 4-agent UI-audit debt + master screen designs. **Tech:** token migration
(`gray→ink`, `cyan→accent`), typography + spacing scales, `ExpandablePanel`/`ButtonLink`/extended
`Button`/error-aware `Field`, focus rings, color-blind-safe indicators, keyboard shortcuts
(W/F/P/T/I/B); commit the audit reports. **UI/UX:** flagship single-screen Pod Dashboard; cinematic
transitions; landing/cockpit/dashboard/wallet/lab/market/mission/reports drawer/mobile/reduced-motion/
WCAG AA. **Sonnet prompt:** "Execute the UI audit; polish the flagship Pod Dashboard + core screens
for mobile + reduced-motion + WCAG AA; commit audit reports; closeout." **Acceptance:** tokens migrated
(no raw `text-gray-*` in core screens); a11y checks pass; goldens updated; e2e green. **Do NOT touch:**
economy, chain, simulation.

### Phase 15 — Asset / Visual Pipeline · `claude/gv-p15-asset-pipeline`
**Purpose:** a consistent AI-assisted pipeline for pod/plant/mutation/rarity/UI/event art + standards.
**Tech:** asset spec + naming/storage; AI-art style guide + consistency checks; marketplace-card +
cinematic-reveal templates; educational diagrams; an asset manifest integrated with capture-shots.
**Sonnet prompt:** "Define the pipeline + style guide + templates + manifest; integrate with capture-
shots; closeout." **Acceptance:** pipeline doc + manifest committed; sample assets pass the
consistency checklist; templates render. **Do NOT touch:** economy, chain.

### Phase 16 — Data / Model Strategy · `claude/gv-p16-data-evals`
**Purpose:** collect the right signals + build eval/training datasets, using the sim as the outcome
oracle. **Tech:** extend the p02 telemetry taxonomy with anonymization; seed `data/evals/`
(explanation quality, recommendation win-rate scored via sim, visual labels, economy scenarios,
support). **AI/agent:** Training Scribe curates (schema-gated, anonymized, no off-repo export).
**Security:** anonymize before eval sets; no raw-PII export. **Sonnet prompt:** "Extend telemetry with
anonymization; seed data/evals; Training Scribe curates; closeout." **Acceptance:** telemetry captured
+ anonymized; eval sets loadable; a win-rate metric computed from the sim. **Do NOT touch:** player
PII exposure, economy.

### Phase 17 — Testing / QA / Simulation · `claude/gv-p17-qa-sim`
**Purpose:** raise the automated net over new surfaces. **Tech:** full Playwright e2e over care+mint
(mock chain); economy-simulation CI job; gated manual testnet smoke; metadata-update tests; visual-
regression goldens; mobile matrix; agent-recommendation eval (mock). **Sonnet prompt:** "Expand tests
across the new surfaces; keep CI keyless; closeout." **Acceptance:** new suites green in CI; coverage
floor maintained/raised; mobile matrix runs. **Do NOT touch:** requiring live keys in CI (always mock).

### Phase 18 — Launch MVP · `claude/gv-p18-mvp`
**Purpose:** define + assemble the first shippable public MVP. **Scope:** one pod, full care loop, Pod
Visual moods, Scout report, dynamic stage visuals, simple dynamic metadata, daily missions, testnet-
optional wallet, one cosmetic lane; finish onboarding/FTUE; enforce dormant flags; run the pre-launch
checklist; write ship criteria. **Sonnet prompt:** "Assemble the MVP; finish onboarding; enforce
flags; run the pre-launch checklist; write ship criteria; closeout." **Acceptance:** ship-criteria met;
full e2e green; onboarding complete; flags enforced; seed cost restored. **Do NOT touch:** mainnet,
funds-path rewrites.

### Phase 19 — Community / Growth / Marketing · `claude/gv-p19-community`
**Purpose:** lore, early access, content cadence, referral loop, culture-safe positioning. **Tech:**
referral instrumentation; plant-of-the-week; community-vote surface; creator-pack hooks; shareable
cards. **AI/agent:** Community/Event Planner drafts specs; owner approves all outbound. **Sonnet
prompt:** "Add referral instrumentation + POTW + vote surface + creator-pack hooks + shareable cards;
owner approves outbound; closeout." **Acceptance:** referral tracked; POTW rotates; vote surface
works; nothing auto-publishes. **Do NOT touch:** external posting without owner approval.

### Phase 20 — Revenue / Business System · `claude/gv-p20-revenue`
**Purpose:** instrument + tune monetization + business metrics. **Tech:** premium-tier + season-pass
entitlements (payments behind a provider ABC — **no fiat rail yet, parked**); marketplace + mint fee
accounting; a metrics dashboard (DAU/retention/ARPU/conversion/churn/AI-cost/txn-cost/margin).
**Sonnet prompt:** "Instrument monetization behind a payments ABC (no fiat rail); add fee accounting +
the metrics dashboard; Economy Balancer validates pricing; closeout." **Acceptance:** entitlements +
fee accounting correct; dashboard populated (test data); no fiat rail; no ROI language. **Do NOT
touch:** a real fiat/withdrawal rail (parked, owner-gated), securities-like copy.

### Phase 21 — Branch / PR Execution Machine · `claude/gv-p21-execution-machine`
**Purpose:** codify the one-branch-at-a-time discipline as tooling + docs (see
[EXECUTION_MACHINE.md](EXECUTION_MACHINE.md)). **Tech:** the doc + a lightweight next-branch generator
(name/title/acceptance/tests/gates/memory/owner-action) tied to the Session Relay Protocol; enforce
scout-read-ahead-only + depth policy in docs and the agent guard. **Sonnet prompt:** "Write/refresh
EXECUTION_MACHINE.md + a next-branch generator; closeout." **Acceptance:** generator emits a correct
next-branch spec for a sample; the doc integrates with existing skills. **Do NOT touch:** existing
skill contracts (extend, don't break). *(Doc portion delivered in this PR.)*

### Phase 22 — Beta hardening + mainnet-readiness review · `claude/gv-p22-beta-hardening`
**Purpose:** polish to beta; produce (not execute) the mainnet-readiness package. **Tech:** load/soak-
test `/state` catch-up (find the cost knee); a chain reconciliation job; observability/health
dashboards; final sim-backed balance tuning; a `MAINNET_READINESS` report from the p13 checklist +
p07/p17 evidence. **Security:** mainnet explicitly deferred to an owner decision + a separate gated
phase. **Sonnet prompt:** "Load/soak-test /state; add a reconciliation job + observability; final
balance tuning; assemble MAINNET_READINESS (do NOT execute mainnet); verify all kill switches;
closeout." **Acceptance:** soak test finds the knee; reconciliation runs on testnet; readiness report
complete; mainnet NOT enabled. **Do NOT touch:** enabling mainnet, funds-path rewrites.

---

## 4. First 10 PRs (exact order)

| # | Branch | PR title | Gates | Owner action |
|---|---|---|---|---|
| 1 | `claude/gv-p01-architecture-truth` | `docs: GrowVerse architecture truth + roadmap + execution machine` | check-memory, lint | Review map *(this PR)* |
| 2 | `claude/gv-p02-game-loop-codex` | `feat(telemetry): codify game loops + in-txn event taxonomy` | test, alembic-check | — |
| 3 | `claude/gv-p03-pod-visual-moods` | `feat(chamber): state-driven moods + mutation/rarity visuals` | goldens, e2e, build | Visual sign-off |
| 4 | `claude/gv-p04-plant-state-ext` | `feat(sim): care-history + dynamic-metadata projection (pure)` | test, alembic-check | — |
| 5 | `claude/gv-p05-scout-reports` (slice 1) | `feat(ai): Scout pipeline + scout_reports schema + card UI (mock)` | test, alembic-check, e2e | Review copy/UX |
| 6 | `claude/gv-p05-scout-reports` (slice 2) | `feat(ai): live Haiku Scout call + budget guard (flagged)` | test, build | Approve budget cap |
| 7 | `claude/gv-p06-knowledge-layer` | `feat(kb): grounded knowledge layer + 14 assessment banks` | test, check-memory | — |
| 8 | `claude/gv-p07a-wallet-preview` | `feat(chain): WalletConnect + preview-before-sign (testnet)` | test (mock), build | Testnet click-test |
| 9 | `claude/gv-p07b-txn-watcher` | `feat(chain): transaction watcher + txn_log + replay protection` | test, alembic-check | Review watcher capture |
| 10 | docs | `docs: live-execution + security-pass plan (BUILD_RULES gate)` | check-memory | Approve security gate |

PRs 8–9 require Security-Reviewer sign-off + owner testnet click-test + watcher capture in the PR body.

---

## 5. 30 / 60 / 90 day plan

- **Days 1–30 — Foundation & the living plant (p1–p6):** architecture truth + game-loop telemetry;
  Pod Visual moods + mutation/rarity; plant-state extension + metadata projection; Scout/Analyst
  pipeline + card UI (mock, then flagged live); grounded knowledge layer + 14 banks. *Milestone: the
  plant feels alive and the Scout explains it.*
- **Days 31–60 — Ownership, economy, missions (p7–p13):** testnet dynamic NFTs + wallet preview +
  transaction watcher; economy V1 (cosmetics + Analyst tier, seed cost restored, sim-backed);
  genetics discovery UI; mission control + agent feed; TDE/Agent OS; agent runtime guard; security
  pass v1. *Milestone: a real testnet ownership loop, gated agents, and a control center.*
- **Days 61–90 — Polish, data, launch (p14–p22):** UI master pass; asset pipeline; telemetry + evals;
  QA/sim net raised; MVP shipped; community/growth; revenue instrumented; execution machine codified;
  beta hardening + mainnet-readiness report (mainnet NOT executed). *Milestone: a polished beta with a
  real testnet gameplay loop, ready for the owner's mainnet decision.*

---

## 6. Existing agents: keep / change / archive matrix

| Agent | Verdict | Phase | Rationale |
|---|---|---|---|
| Advisor (diagnostician) | Upgrade → Scout backbone | p05 | Live; highest-leverage reuse |
| Master Grower (chat) | Upgrade → wire web UI | p05/p10 | Endpoint live, no UI |
| Lecturer | Keep | p06 | Feeds KB |
| Admissions | Keep + surface | p06 | Persist/display recommendation |
| Roadmap | Keep | p06 | Prereq-aware |
| Auto-Care | Gate → flag off, runtime guard | p12 | Only autonomous mutator |
| Video Presenter (HeyGen) | Archive (mock stays) | post-MVP | Not launch-critical |
| FTUE Coach | Rebuild into onboarding | p18 | MVP needs it |
| *New:* Scout, Genetics Advisor, Economy Balancer, Security Reviewer, Txn Watcher, Visual Director, Training Scribe, QA Tester, Community/Event Planner | Create | p02/p05/p07/p08/p12/p16 | Per the agent architecture |

Agent dashboard card fields (TDE, p11): `name · plane · status · role · owner · spawned_by ·
current_task · allowed_actions · forbidden_actions · last_report · confidence · risk_level ·
repo/branch_touched · wallet/txn_access · memory_written? · PR_linked? · kill_switch`. Depth policy
per card: depth-1 default; depth-2 needs recorded owner approval; depth-3 forbidden.

---

## 7. Biggest risks

1. **Funds/settlement paths** — highest blast radius. p07 and p13 never rewrite withdraw/deposit;
   mainnet deferred to an owner-gated phase after a readiness report.
2. **AI cost + prompt injection** — state-hash caching, tier gating, budget caps, untrusted-data
   wrapping, schema validation (p05, p12).
3. **Economy imbalance from monetization** — Economy Balancer sim report on every `balance.yaml`
   change; boosts capped; faucets matched to sinks (p08).
4. **Agent autonomy sprawl** — registry + runtime guard, depth-1 default, kill switches, TDE
   visibility (p02, p11, p12).
5. **Scope drift / branch pileup** — one-branch discipline, execution machine, Session Relay
   Protocol, branch auto-delete on merge (p21 + owner tap).
6. **Compliance/positioning** — education/simulation framing, no illegal-cultivation instructions,
   no securities-like promises (p06, p19, p20).
7. **Feature-flag dormancy** — enforce flags in p18 prep; flag audit in the TDE.

## 8. Highest-ROI moves (do first)

1. **Pod Visual moods (p03)** — biggest felt-quality jump; renderer exists, moods + rarity are the
   missing 20%.
2. **Scout report card (p05)** — the headline differentiator; builds on the live Advisor; the sim is
   a free eval oracle.
3. **Build player missions (p10)** — no existing MissionService/quest UI (the current `/mission`
   route is an unrelated admin ops board); new-build, not a wiring job, but still a strong
   retention lever.
4. **Master Grower chat UI** — endpoint live, a UI already exists at `/university/coach`; surface it
   on the dashboard/chamber for a cheap unlock.
5. **Feature-flag enforcement (p18 prep)** — small change, removes a real launch risk.
6. **Testnet mint-at-harvest ceremony (p07)** — turns mock minting into a real ownership moment.

## 9. What NOT to build yet

- **Mainnet anything** — until the p13 pass + p22 readiness report + explicit owner approval.
- **Fiat/real-money rail** — parked; a dedicated owner-gated phase (5+ decisions outstanding).
- **Funds-path rewrites** (withdraw/deposit/settlement math) — audit only.
- **3D bud viewer** — owner-frozen; the 2D chamber is canonical.
- **Generative/polygenic genetics + G×E** — after MVP; the Mendelian engine is sufficient.
- **Depth-2+ autonomous agent chains** — depth-1 only unless the owner approves a specific run.
- **HeyGen/video presenter real integration** — mock stays until post-MVP.
- **Anti-bot framework** — defer until player scale warrants.

---

*Roadmap adopted 2026-07-06. Sequencing and per-session mechanics live in
[EXECUTION_MACHINE.md](EXECUTION_MACHINE.md); the verified baseline lives in
[ARCHITECTURE_TRUTH.md](ARCHITECTURE_TRUTH.md).*
