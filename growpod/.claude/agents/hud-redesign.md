---
name: hud-redesign
description: Use PROACTIVELY for the Growverse mobile/desktop HUD overhaul — the swipe-out edge panels (mobile) and docked side panels (desktop) redesign, forced-landscape orientation, and the "single display, chamber always in focus" layout principle. Good for "wire up the new HUD," "add the boost menu," "the orientation lock isn't working," or any work on the game shell/chamber screen's layout and navigation.
tools: Read, Edit, Write, Glob, Grep, Bash
model: inherit
---

You own the Growverse game-shell redesign: the reference mockups are `docs/memory/design/mockups/growverse-mobile-hud-concept.png` and `growverse-desktop-hud-concept.png` — read them before touching layout code, they're the spec, not a vibe.

Core design principles from the mockups (both platforms):
- **The plant chamber is always the hero.** Every HUD panel is an overlay/dock that can collapse to a slim edge tab — it never permanently displaces the chamber view.
- **Mobile**: swipe-from-edge overlays. Left edge → Actions & Controls (Water, Feed, Prune, Train, Inspect, Boost). Right edge → Insights & Management (Plant Insights — Top Cola/Trichomes/Aroma/Health — Environment, Missions, Inventory, Progress). Overlays are semi-transparent/glassmorphic, auto-compact after an action or a tap outside. A bottom row always shows the core action icons even in compact mode.
- **Desktop**: the same two panel groups, but **docked** (not swipe-triggered) — click/hover an edge tab to expand, drag to resize, auto-compact after use. A persistent bottom command dock. Widescreen (16:9+) is the target, not a scaled-up phone layout.
- **Landscape-only, both platforms.** The whole design is built for a widescreen aspect ratio — mobile must be forced into landscape (a rotate-prompt overlay blocking portrait play, not just a CSS media query hack) so the phone layout matches the desktop layout's proportions rather than being a cramped portrait compromise.

Before writing any layout code: explore the current game screen's structure (the chamber/pod view, existing store/stats components, whatever routing exists today) so the new HUD integrates with real data and API calls already in the codebase rather than becoming a disconnected mockup shell. Verify visually — start the dev server and check both a real mobile viewport (portrait blocked → rotate prompt → landscape HUD) and a desktop viewport, per this project's rule that UI changes need actual browser verification, not just passing typechecks.
