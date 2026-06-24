# AI-Presenter Lecture Video Pipeline — research + design (B1)

> **Records/Research only** (UNI-011 freeze-safe). Designs the **talking-presenter video** layer for
> GrowPod University lectures, **layered on top of the narration pipeline that already ships**. Part
> of the Immersive University pass (`docs/research/university/IMMERSIVE_UNIVERSITY_MASTER_PLAN.md`,
> Track B). Status: **draft for owner review.**

## 1. The key finding — narration is already built; only the *video* is new
The Phase-2 doc lists the ElevenLabs pipeline as ⬜ greenfield. **It is not** — it's shipped:
- `src/growpodempire/ai/elevenlabs_narrator.py` — full TTS provider with a **3-layer cache**
  (L1 `/tmp` → L2 GCS object storage → L3 DB `lecture_audio` BLOB), keyed on **`(voice_id,
  text_hash)`** (`sha256[:16]`). Generate-once, serve-from-cache-forever; survives restarts/deploys.
- `ai/object_storage.py` (GCS get/put/exists), `api/audio_prewarm.py` (prewarm endpoint),
  `db.models.LectureAudio` (+ migrations `fa3e2b1c9d07` add `lecture_audio`, `c8d9e0f1a2b3` add
  `object_path`). Without a key → text-only mode, no audio (CI-safe by construction).
- **A real faculty→voice roster is already assigned in code** (`_DEPT_VOICES`), which **supersedes
  the Phase-2 proposal** (Flora/Verdant/Mycelia/Atlas/Nova). The shipped roster:

  | Department | Faculty persona | ElevenLabs voice |
  |---|---|---|
  | cultivation | **Professor Flora** | Rachel |
  | genetics | **Vera Lindqvist** | Antoni |
  | nutrients | **Dr. Sage Harlow** | Rachel (alias) |
  | ipm | **Dr. Mira Okafor** | Elli |
  | chemistry | **Dr. Chem Torres** | Domi |
  | postharvest | **Dr. Petra Nance** | Josh |
  | (fallback) | — | Adam |

  > ⚠️ **Owner decision flagged:** the design codex (`07-university-phase-2.md` §7) and the code
  > disagree on faculty names/roster. The **code is authoritative**; Phase-2 §7 should be reconciled
  > to this roster (or the roster renamed) in a docs-only pass. (Also note `nutrients` reuses Rachel
  > = Flora's voice — two faculty share a voice; worth a distinct voice for Sage Harlow.)

**Design consequence:** do **not** redesign narration. The avatar-video layer **consumes the
existing narration MP3 as its audio track** and lip-syncs to it — one source of truth, no double-TTS,
the `(voice_id, text_hash)` hash flows straight through.

## 2. Goal
Turn each lecture into a **talking faculty presenter** that lip-syncs the already-generated
narration, with captions = transcript, slotted into the Lecture Hall (A2). Every faculty gets a
consistent **avatar identity** the same way they already have a **voice identity**.

## 3. Recommended pipeline (mirror the narration pattern exactly)
```
LectureReport (shipped: title/summary/content) ── build spoken text (shipped) ──▶ ElevenLabs MP3  [(voice_id, text_hash) cache — SHIPPED]
                                                                                        │
                                                  faculty → avatar_id (new _DEPT_AVATARS, mirrors _DEPT_VOICES)
                                                                                        ▼
                                            HeyGen "audio-driven" avatar render  ──▶  MP4  [(avatar_id, audio_hash) cache — NEW]
                                                                                        │
                            ElevenLabs timestamps / Forced Alignment  ──▶  WebVTT captions  [= transcript, parity]
                                                                                        ▼
                                                         Lecture Hall player (A2): video + captions + transcript panel
```
- **HeyGen Video Generation API** renders an avatar speaking **audio you provide** (the "Golden Path"
  feeds the avatar its audio for best lip-sync). Feed it the cached narration MP3 → the avatar speaks
  the exact narration. Avatars/templates are created once on HeyGen's web platform, then referenced
  by `avatar_id` from the API.
- **Captions/transcript**: ElevenLabs `convert-with-timestamps` (or Forced Alignment over the cached
  MP3) yields per-character/word start/end times → generate WebVTT. The narration script **is** the
  transcript (Phase-2 §10 parity) — captions are just the timing layer over it.

## 4. New artifacts (design only — no code under the freeze)
- **`VideoPresenterProvider` ABC + `MockVideoPresenter` + `HeyGenVideoPresenter`** — mirrors the
  `AdvisorProvider`/`LecturerProvider` ABC pattern in `ai/provider.py` and the chain/AI factory
  convention (`ai/factory.py`). **Mock returns a deterministic poster-frame/placeholder MP4 path** so
  **CI never needs a HeyGen key** (same discipline as narration's no-key text mode).
- **`lecture_video` table** mirroring `lecture_audio`: PK, `avatar_id`, `audio_hash` (= the narration
  `text_hash`, so video and audio share a key), `object_path`, optional `mp4_data` BLOB fallback,
  `status`, `duration_sec`, `checksum`, `created_at`. Same **L1/L2/L3 cache** + GCS reuse.
- **`_DEPT_AVATARS`** map (department → HeyGen `avatar_id`) parallel to `_DEPT_VOICES`.
- **Prewarm**: extend the `audio_prewarm` pattern to a `video_prewarm` so popular lectures render
  ahead of demand.

## 5. Regenerate-only-on-change (locked discipline)
The narration already enforces it via the content hash. Video inherits it: **the video cache key is
`(avatar_id, audio_hash)`**, and `audio_hash` only changes when the **script** changes. So a lecture
re-renders **only** when its text changes — exactly the Phase-2 §11 `script_hash` rule, achieved for
free by chaining the existing hash. Runtime path = pure cache lookup.

## 6. Cost model (bounded by unique scripts, not views)
- HeyGen Avatar III @ 1080p ≈ **$1.00/min**, billed per second generated; Avatar IV/4K up to $5/min.
- Because video is **generated once per unique script and cached forever**, cost = Σ(minutes of
  *distinct* lectures), **not** per play. Example: a 14-course catalog with ~10 min of presenter
  video each = ~140 min ≈ **~$140 one-time** at Avatar III, then ~$0 to serve to every player.
  Re-renders only on script edits.
- ElevenLabs narration cost is likewise one-time per script (already realized).
- **Posture:** Avatar III/1080p for scale; reserve Avatar IV for hero/orientation lectures only.

## 7. CI-safety & invariants
- **No live key in CI**: `MockVideoPresenter` (deterministic placeholder) + the existing no-key
  narration fallback. Real providers chosen by config/env, like `ai/factory.py` today.
- **Non-economic**: lectures/video grant no power and post nothing to the ledger ("earned, never
  bought"). *(Note: `seasonal_strains.price_gc` is the token sink that shipped alongside lecture
  audio — that's a separate economy feature, not the lecture path.)*
- **Accessibility (ship gate)**: captions on by default, full transcript panel, keyboard controls,
  no audio/video-only information, `prefers-reduced-motion` respects autoplay (Phase-2 §10).
- **DB authoritative**; object storage is the CDN mirror (same as audio).

## 8. Open questions for the owner
1. **Avatar sourcing**: HeyGen stock avatars (fast/cheap) vs. **custom-trained faculty avatars**
   (brand-consistent, on-brand identities — needs HeyGen custom-avatar training + commercial-rights
   review)?
2. **Fidelity tier**: Avatar III/1080p everywhere (recommended) vs. Avatar IV for hero lectures?
3. **Vendor lock**: design `VideoPresenterProvider` to keep HeyGen swappable (D-ID, Synthesia,
   open-source SadTalker) — recommended yes, ABC makes it cheap.
4. **Reconcile the faculty roster** (code vs. Phase-2 §7) and give Dr. Sage Harlow a distinct voice.
5. **In-hall placement**: flat video-on-a-surface in the 3D hall (cheap) vs. avatar composited as a
   "3D presenter" (ties to A1 §9 hall-realism question)?

## 9. Recommendation
Build the **video layer as a thin provider that reuses the shipped narration MP3 + cache pattern**:
`VideoPresenterProvider` ABC + Mock + HeyGen, a `lecture_video` table keyed on `(avatar_id,
audio_hash)`, captions from ElevenLabs timestamps, all CI-safe and freeze-gated. Cost stays bounded
(~$140 one-time for the current catalog) because everything is generate-once-cache-forever. **Do this
only after the University Build Phase opens; reconcile the faculty roster first (docs-only).**

## Sources
- [HeyGen Developers / Video Generation API](https://developers.heygen.com/) · [Create Video](https://developers.heygen.com/reference/create-video) · [API Guide](https://www.heygen.com/blog/heygen-api-guide)
- [HeyGen API Pricing](https://www.heygen.com/api-pricing) · [HeyGen Pricing 2026 — vidmetoo](https://www.vidmetoo.com/heygen-pricing-detailed-review-of-all-plans/) · [Custom-avatar/API/rights FAQ — Flowith](https://flowith.io/blog/heygen-faq-custom-avatar-api-limits-commercial-rights/)
- [ElevenLabs TTS with timestamps](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps) · [Forced Alignment](https://elevenlabs.io/docs/overview/capabilities/forced-alignment) · [TTS overview](https://elevenlabs.io/docs/overview/capabilities/text-to-speech)
- Repo: `src/growpodempire/ai/elevenlabs_narrator.py` · `ai/object_storage.py` · `ai/provider.py` · `api/audio_prewarm.py` · `db/models.py` (`LectureAudio`) · migrations `fa3e2b1c9d07`, `c8d9e0f1a2b3` · `docs/memory/design/07-university-phase-2.md` §7/§11
