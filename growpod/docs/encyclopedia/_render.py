#!/usr/bin/env python3
"""Render a batch of researched strain entries into the encyclopedia.

Reads a JSON list of entry dicts (from the research workflow), writes one
docs/encyclopedia/strains/<slug>.md per entry, appends INDEX rows, updates the
ledger (queue -> done), and logs a _PROGRESS row. Idempotent: skips slugs that
already have a file. Touches no game code.

Usage: python render_strains.py <entries.json> [batch_label]
"""
import json, sys, os, datetime, yaml

ENC = "/home/dziostar/projects/Grovers/docs/encyclopedia"
STRAINS = os.path.join(ENC, "strains")


def fm(entry):
    """Build YAML frontmatter via PyYAML so all quoting (e.g. 'Gelato #42',
    values with ':' or ',') is handled correctly. flow_style=None keeps leaf
    lists/dicts inline while nesting stays block — matches strains.yaml style."""
    g = entry.get("game_mapping", {}) or {}
    d = {
        "name": entry.get("name"),
        "slug": entry.get("slug"),
        "aka": entry.get("aka") or [],
        "type": entry.get("type", "hybrid"),
        "lineage_type": entry.get("lineage_type", "hybrid"),
        "parents": entry.get("parents") or [],
        "breeder": entry.get("breeder", "unknown"),
        "origin": entry.get("origin", "unknown"),
        "rarity": entry.get("rarity", "common"),
        "thc_pct": entry.get("thc_pct") or [],
        "cbd_pct": entry.get("cbd_pct") or [],
        "indica_ratio": entry.get("indica_ratio"),
        "flowering_days": entry.get("flowering_days") or [],
        "yield_indoor_g_m2": entry.get("yield_indoor_g_m2") or [],
        "difficulty": entry.get("difficulty"),
        "terpenes": entry.get("terpenes") or [],
        "effects": entry.get("effects") or [],
        "flavors": entry.get("flavors") or [],
        "aromas": entry.get("aromas") or [],
        "awards": entry.get("awards") or [],
        "game_mapping": {
            "name": g.get("name", entry.get("name")),
            "lineage_type": g.get("lineage_type", entry.get("lineage_type", "hybrid")),
            "rarity": g.get("rarity", entry.get("rarity", "common")),
            "stability": g.get("stability", 0.8),
            "terpenes": g.get("terpenes") or [],
            "traits": g.get("traits") or {},
            "dominant": g.get("dominant") or [],
        },
        "sources": entry.get("sources") or [],
        "status": entry.get("status", "complete"),
    }
    dumped = yaml.safe_dump(d, sort_keys=False, allow_unicode=True,
                            width=10 ** 9, default_flow_style=None)
    return "---\n" + dumped + "---"


def body(entry):
    parts = [f"\n# {entry['name']}\n"]
    if entry.get("summary"):
        parts.append(entry["summary"].strip() + "\n")
    if entry.get("history"):
        parts.append("## Lineage & history\n\n" + entry["history"].strip() + "\n")
    if entry.get("growing"):
        parts.append("## Growing notes\n\n" + entry["growing"].strip() + "\n")
    gm = entry.get("game_mapping", {}) or {}
    if gm:
        parts.append(
            "## Game mapping note\n\n"
            "The `game_mapping` block in the frontmatter is a ready-to-paste "
            "`strains.yaml` entry. Only the 4 modeled terpene genes "
            "(myrcene, limonene, caryophyllene, pinene) appear there; the full "
            "real terpene profile is in the top-level `terpenes` field. Trait "
            "values are game-design estimates derived from the real-world ranges "
            "above — review before promoting.\n"
        )
    return "\n".join(parts)


def index_row(n, e):
    thc = "–".join(str(x) for x in (e.get("thc_pct") or [])) or "?"
    cbd = "–".join(str(x) for x in (e.get("cbd_pct") or [])) or "?"
    flo = "–".join(str(x) for x in (e.get("flowering_days") or [])) or "?"
    src = (e.get("sources") or ["?"])[0]
    return (f"| {n} | [{e['name']}](strains/{e['slug']}.md) | {e.get('type','')} "
            f"| {thc} | {cbd} | {e.get('rarity','')} | {flo} "
            f"| {e.get('lineage_type','')} | [src]({src}) |")


def main():
    entries_path = sys.argv[1]
    label = sys.argv[2] if len(sys.argv) > 2 else "batch"
    with open(entries_path) as f:
        entries = json.load(f)
    if isinstance(entries, dict):
        entries = entries.get("entries", [])

    with open(os.path.join(ENC, "_ledger.json")) as f:
        ledger = json.load(f)
    done = set(ledger.get("done", []))
    queue = ledger.get("queue", [])

    written = []
    for e in entries:
        if not e or not e.get("slug") or not e.get("name"):
            continue
        path = os.path.join(STRAINS, f"{e['slug']}.md")
        if os.path.exists(path):
            continue  # idempotent: never clobber
        with open(path, "w") as fh:
            fh.write(fm(e) + "\n" + body(e))
        written.append(e)

    # Update INDEX
    existing = sum(1 for ln in open(os.path.join(ENC, "INDEX.md"))
                   if ln.startswith("| ") and "Strain" not in ln and "---" not in ln)
    rows = []
    for i, e in enumerate(written, start=existing + 1):
        rows.append(index_row(i, e))
    if rows:
        with open(os.path.join(ENC, "INDEX.md"), "a") as fh:
            fh.write("\n".join(rows) + "\n")

    # Update ledger: move written names out of queue into done
    written_names = {e["name"] for e in written}
    # also try to match queue items by case-insensitive name containment
    new_queue = []
    for q in queue:
        base = q.split(" (")[0].strip().lower()
        if any(base == wn.lower() or base in wn.lower() or wn.lower() in q.lower()
               for wn in written_names):
            continue
        new_queue.append(q)
    ledger["queue"] = new_queue
    ledger["done"] = sorted(done | {e["slug"] for e in written})
    lm = ledger["meta"]["loop"]
    lm["iterations_done"] = lm.get("iterations_done", 0) + 1
    now = datetime.datetime.now(datetime.UTC)
    if not lm.get("started_at"):
        lm["started_at"] = now.isoformat()
        lm["stop_after_iso"] = (now + datetime.timedelta(hours=lm.get("planned_hours", 4))).isoformat()
    with open(os.path.join(ENC, "_ledger.json"), "w") as f:
        json.dump(ledger, f, indent=2)

    # Progress log
    total = len(ledger["done"])
    with open(os.path.join(ENC, "_PROGRESS.md"), "a") as fh:
        names = ", ".join(e["name"] for e in written) or "(none — all dupes/failed)"
        fh.write(f"| {label} | {now.strftime('%Y-%m-%d %H:%M')} | "
                 f"{len(written)} | {total} | {names} |\n")

    print(f"Wrote {len(written)} new entries. Total done: {total}. Queue left: {len(new_queue)}.")
    print("New:", ", ".join(e["name"] for e in written))


if __name__ == "__main__":
    main()
