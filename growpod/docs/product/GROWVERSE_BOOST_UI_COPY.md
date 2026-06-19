# GROWVERSE — Boost UI Copy & Purchase Flow

> **Status:** copy + flow planning only. **No code.**
> **Safe-language rule:** use only "planned / optional / testing / approximate / not live yet / final rules will be published before activation." **Never** use "guaranteed profit," "investment," "guaranteed NFT value," "guaranteed liquidity return," "pay to win," or "contest prize funding" (the last unless actually approved).
> All copy below is paste-ready for tickets/prompts.

---

## 1. Testing-mode (alpha) copy

**Buttons**
```
QA Speed Boost — Free
QA Time Skip — Free
QA Recovery — Free
QA Climate Fix — Free
QA Harvest Rush — Free
```

**Confirmation modal (testing)**
```
Title: Testing mode
Body:  No payment required. This applies a test boost so we can tune gameplay.
       Effects here are for testing only.
Buttons: [Apply test boost]  [Cancel]
```

**Result toast (testing)**
```
✅ Test boost applied (QA). Logged to your Grow Log. No payment was taken.
```

---

## 2. Future paid-mode copy (NOT for implementation here)

**Button**
```
Speed Growth
```

**Effect modal**
```
Title:   Speed Growth
Effect:  Reduces remaining grow time on this plant.
Price:   $2.99  (approximately X ALGO)
Note:    Optional convenience. The game is fully playable without boosts.
         Allocation: liquidity support + development (full split published before activation).
Fine print: ALGO amount is approximate and confirmed on the next screen before purchase.
Buttons: [Continue]  [Cancel]
```

**Confirm-final-amount screen**
```
Title:   Confirm purchase
Line 1:  Speed Growth — $2.99
Line 2:  Final amount: 12.34 ALGO  (locked for this purchase)
Line 3:  This is optional and is not an investment or financial return.
Buttons: [Confirm & pay]  [Back]
```

**Receipt**
```
Growth Boost applied.
Allocation: liquidity support + development.
Transaction details will appear here once on-chain payments are live.
```

**Grow Log / Journal event**
```
⚡ Speed Growth applied — remaining grow time reduced. (Optional boost)
```

---

## 3. Honest "not live yet" states

**Boost not yet enabled**
```
Boosts aren't live yet. During alpha, testing boosts are free and clearly labeled.
Final boost rules and prices will be published before anything goes live.
```

**Selling not live (Market Sell Feedback, Lane 8)**
```
Selling isn't live yet — it's coming. Your harvest is safe.
```

**QA placeholder action (no silent no-ops)**
```
Recorded (testing) — this action isn't live yet, but we logged it so we can tune it.
```

---

## 4. Funny in-character copy (approved tone, for Speed/Recovery)
```
Want to speed the growth of your plant?
Smoked too much this weekend? Friend stole the bag? Supergrow your plant and get back on track.
```
```
Reverse the sickness and stabilize your plant.
```
```
Spent too much time building this lineage? Rewind the damage and save your plant.
```
> Keep humor on the **flavor**, never on the **terms**. The price, "approximate ALGO," "optional," and "not an investment" lines stay literal and clear.

---

## 5. Full purchase flow (state-by-state)

**Testing mode**
1. Button: `QA Speed Boost — Free`
2. Tap → confirmation: "Testing mode: no payment required."
3. Apply simulated boost / placeholder feedback.
4. Result toast + Grow Log entry (labeled QA).

**Future paid mode**
1. Button: `Speed Growth`
2. Effect modal: what it does + USD price + approximate ALGO + allocation note.
3. Require explicit **Continue**.
4. Confirm screen: **final ALGO amount shown before purchase** + "not an investment" line.
5. **Confirm & pay** → transaction status (pending → done) / receipt.
6. Add event to Grow Log / Journal.

---

## 6. Boosted-plant + leaderboard labels (ties to fairness doc)
```
Badge:        Boosted
Tooltip:      This plant used optional boosts.
Leaderboards: "Organic" | "Boosted"
```

## 7. Disclaimer footer (reusable anywhere boosts appear)
```
Boosts are optional and provide in-game convenience only. They are not an investment
and promise no financial return. During alpha, boosts are free and labeled for testing.
Final rules and pricing will be published before activation.
```
