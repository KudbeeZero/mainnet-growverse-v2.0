"use client";

// The signature visual language of GROWv2 — a glowing force-directed particle
// constellation on a dark canvas. "Anywhere you see DNA." One component, two
// layout modes:
//   • mode="leaf"  — particles arranged into a cannabis-leaf silhouette (brand
//     hero / empty states). Ignores nodes/edges; generates its own cloud.
//   • mode="graph" — force-directed layout over the supplied nodes + edges
//     (genome loci, breeding crosses, lineage pedigrees, the GenBank galaxy).
//
// Hand-rolled Canvas 2D (no graph/charting dependency) so the look is bespoke,
// the bundle stays lean, and it honours the strict CSP (script-src 'self').
// Honours prefers-reduced-motion by rendering a single settled static frame.

import { useEffect, useRef, useState } from "react";

export interface ConstNode {
  id: string;
  label?: string;
  /** 0..1 — drives radius/brightness; expressed traits become luminous hubs. */
  weight?: number;
  /** Hex fill; defaults to the accent color. */
  color?: string;
  /** Render larger + brighter (a "hub"). */
  hub?: boolean;
  /** Optional pinned position in normalized [-1,1] space (y up). */
  fx?: number;
  fy?: number;
}

export interface ConstEdge {
  a: string;
  b: string;
  /** 0..1 line strength. */
  strength?: number;
}

interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hx: number; // home x (leaf mode springs back here)
  hy: number;
  r: number;
  color: string;
  hub: boolean;
  label?: string;
  phase: number;
  pinned: boolean;
}

interface Props {
  mode?: "leaf" | "graph";
  nodes?: ConstNode[];
  edges?: ConstEdge[];
  height?: number;
  className?: string;
  /** Show the "NODES: n" instrument readout. */
  showCount?: boolean;
  /** Subtitle hint, e.g. "DRAG · SCROLL · LIVE PARTICLES". */
  caption?: string;
  /** Base accent color (hex). */
  accent?: string;
  /** Particle count for leaf mode. */
  leafCount?: number;
  /** Drop the framed-card chrome (border/rounding/backdrop) — for inline logo use. */
  frameless?: boolean;
  /** Disable pan + zoom (view stays centered). Particles still react to the pointer. */
  lockView?: boolean;
  onSelect?: (id: string) => void;
}

const TAU = Math.PI * 2;
const HEX6 = /^#[0-9a-f]{6}$/i;

/** Guarantee a 6-digit hex so `color + "88"` (alpha) is always valid CSS. */
function safeHex(color: string | undefined, fallback: string): string {
  return color && HEX6.test(color) ? color : fallback;
}

/** Generate points filling a 7-leaflet cannabis leaf in normalized [-1,1], y up. */
function leafParticles(count: number, accentRaw: string): Particle[] {
  const accent = safeHex(accentRaw, "#76c024");
  // angle (deg from +x), relative length — longest leaflet straight up.
  const leaflets: Array<[number, number]> = [
    [90, 1.0],
    [62, 0.86],
    [118, 0.86],
    [36, 0.66],
    [144, 0.66],
    [12, 0.44],
    [168, 0.44],
  ];
  const totalLen = leaflets.reduce((s, [, l]) => s + l, 0);
  const out: Particle[] = [];
  let idn = 0;
  const push = (nx: number, ny: number, hub = false) => {
    out.push({
      id: `p${idn++}`,
      x: nx,
      y: ny,
      vx: 0,
      vy: 0,
      hx: nx,
      hy: ny,
      r: 1 + Math.random() * 1.6 + (hub ? 1.4 : 0),
      color: accent,
      hub,
      phase: Math.random() * TAU,
      pinned: false,
    });
  };

  for (const [angDeg, len] of leaflets) {
    const n = Math.max(8, Math.round((count * len) / totalLen));
    const a = (angDeg * Math.PI) / 180;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (let i = 0; i < n; i++) {
      const t = Math.pow((i + 1) / n, 0.92); // density toward base
      const r = t * len * 0.95;
      // teardrop half-width: fat near base-middle, pointed tip & narrow base
      const hw = 0.16 * len * Math.pow(Math.sin(Math.PI * Math.min(t, 0.98)), 0.7) * (1 - t * 0.25);
      const samples = Math.max(1, Math.round((hw / 0.02) * (0.4 + Math.random() * 0.6)));
      for (let j = 0; j < samples; j++) {
        const u = (Math.random() * 2 - 1) * hw;
        // axis point + perpendicular offset; serration jitter
        const jitter = (Math.random() - 0.5) * 0.012;
        const px = ca * r - sa * u + jitter;
        const py = sa * r + ca * u + jitter;
        push(px, py - 0.05);
      }
    }
    // luminous tip hub
    push(ca * len * 0.98, sa * len * 0.98 - 0.05, true);
  }
  // stem
  for (let i = 0; i < Math.max(6, count * 0.03); i++) {
    const t = i / 10;
    push((Math.random() - 0.5) * 0.02, -0.05 - t * 0.06, false);
  }
  // floating sparks drifting above (like the reference logo)
  for (let i = 0; i < Math.max(10, count * 0.05); i++) {
    const px = (Math.random() - 0.5) * 1.6;
    const py = 0.7 + Math.random() * 0.5;
    out.push({
      id: `s${idn++}`,
      x: px,
      y: py,
      vx: 0,
      vy: 0,
      hx: px,
      hy: py,
      r: 0.8 + Math.random() * 1.2,
      color: Math.random() > 0.7 ? "#ffffff" : accent,
      hub: false,
      phase: Math.random() * TAU,
      pinned: false,
    });
  }
  return out;
}

function graphParticles(nodes: ConstNode[], accentRaw: string): Particle[] {
  const accent = safeHex(accentRaw, "#76c024");
  const n = nodes.length;
  return nodes.map((node, i) => {
    const pinned = node.fx !== undefined && node.fy !== undefined;
    // seed on a spiral so the force layout untangles quickly
    const ang = i * 2.399;
    const rad = 0.15 + (i / Math.max(1, n)) * 0.75;
    const x = pinned ? node.fx! : Math.cos(ang) * rad;
    const y = pinned ? node.fy! : Math.sin(ang) * rad;
    const w = node.weight ?? 0.5;
    return {
      id: node.id,
      x,
      y,
      vx: 0,
      vy: 0,
      hx: x,
      hy: y,
      r: 2.5 + w * 5 + (node.hub ? 3 : 0),
      color: safeHex(node.color, accent),
      hub: !!node.hub,
      label: node.label,
      phase: Math.random() * TAU,
      pinned,
    };
  });
}

export function Constellation({
  mode = "leaf",
  nodes = [],
  edges = [],
  height = 420,
  className = "",
  showCount = true,
  caption,
  accent = "#76c024",
  leafCount = 520,
  frameless = false,
  lockView = false,
  onSelect,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [count, setCount] = useState(0);

  // Keep the latest onSelect without re-running (and resetting) the whole
  // simulation when the parent re-creates the callback.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Re-run when the structural inputs OR their content change. Node ids alone
  // aren't enough: a strain's genome graph reuses the same locus ids across
  // strains (thc, cbd, …), so we must key on weights/colors/edges too, or the
  // canvas would show a stale graph after navigating strain→strain.
  const graphKey =
    mode === "graph"
      ? JSON.stringify({
          n: nodes.map((n) => [n.id, n.weight ?? 0, n.color ?? "", n.hub ? 1 : 0, n.fx ?? "", n.fy ?? ""]),
          e: edges.map((e) => [e.a, e.b, e.strength ?? 1]),
        })
      : `leaf:${leafCount}:${accent}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let w = wrap.clientWidth || 600;
    let h = height;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const particles =
      mode === "leaf" ? leafParticles(leafCount, accent) : graphParticles(nodes, accent);
    setCount(particles.length);
    const byId = new Map(particles.map((p) => [p.id, p]));
    const eList = edges
      .map((e) => ({ a: byId.get(e.a), b: byId.get(e.b), s: e.strength ?? 1 }))
      .filter((e) => e.a && e.b) as Array<{ a: Particle; b: Particle; s: number }>;

    // Leaf mode generates its own mesh: each body particle (not the floating
    // sparks) links to its two nearest neighbors within a small radius, so the
    // cloud reads as one connected leaf — rubber-bands, not loose beads. Built
    // once per init from home positions; the lines ride the particles live.
    if (mode === "leaf") {
      const body = particles.filter((p) => p.id[0] === "p");
      const LINK_R2 = 0.0045; // ≈0.067 world units — only true neighbors qualify
      const seen = new Set<number>();
      for (let i = 0; i < body.length; i++) {
        let n1 = -1;
        let n2 = -1;
        let d1 = LINK_R2;
        let d2 = LINK_R2;
        for (let j = 0; j < body.length; j++) {
          if (j === i) continue;
          const dx = body[i].hx - body[j].hx;
          const dy = body[i].hy - body[j].hy;
          const dd = dx * dx + dy * dy;
          if (dd < d1) {
            d2 = d1;
            n2 = n1;
            d1 = dd;
            n1 = j;
          } else if (dd < d2) {
            d2 = dd;
            n2 = j;
          }
        }
        for (const j of [n1, n2]) {
          if (j < 0) continue;
          const key = i < j ? i * 100000 + j : j * 100000 + i;
          if (seen.has(key)) continue;
          seen.add(key);
          eList.push({ a: body[i], b: body[j], s: 0.5 });
        }
      }
    }

    // view transform (world [-1,1] → screen). scale auto-fits; user can zoom/pan.
    let userScale = 1;
    let panX = 0;
    let panY = 0;
    let hovered: Particle | null = null;

    function resize() {
      w = wrap!.clientWidth || 600;
      h = height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      // Setting canvas.width wipes the backing store. The animated path
      // repaints on the next RAF, but reduced-motion renders exactly one
      // static frame — and ResizeObserver.observe() always fires an initial
      // async callback, which would land after that frame and leave the
      // canvas permanently blank. Repaint synchronously instead.
      if (reduced) draw();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    function toScreen(p: { x: number; y: number }) {
      const base = Math.min(w, h) * 0.42 * userScale;
      return {
        sx: w / 2 + p.x * base + panX,
        sy: h / 2 - p.y * base + panY,
      };
    }
    function fromScreen(sx: number, sy: number) {
      const base = Math.min(w, h) * 0.42 * userScale;
      return { x: (sx - w / 2 - panX) / base, y: -(sy - h / 2 - panY) / base };
    }

    // ---- spatial hash (graph repulsion acceleration) ----
    // Repulsion (f = repel / d²) falls off fast, so beyond a cutoff it is
    // visually negligible and can be skipped. We bin particles into a uniform
    // grid whose cell size equals the cutoff radius; then each particle only
    // pairs with particles in its own + 8 neighboring cells. For tiny graphs
    // (genome ~14, lineage) every node falls within a cell or two, so the grid
    // degenerates to near all-pairs within the cutoff — the look is preserved.
    //
    // Particles live roughly in [-2.5, 2.5]. CELL = REPEL_CUTOFF; pairs farther
    // apart than the cutoff contribute negligibly and are dropped.
    const REPEL_CUTOFF = 0.8;
    const REPEL_CUTOFF2 = REPEL_CUTOFF * REPEL_CUTOFF;
    const INV_CELL = 1 / REPEL_CUTOFF;
    // Reused across ticks to avoid per-frame heap churn. Keyed by packed cell
    // coords; each bucket holds particle indices (lower index = visited-first,
    // matching the original i<j ordering so pinned-source semantics are kept).
    const grid = new Map<number, number[]>();
    // Pack a cell coordinate pair into one number. World is small and bounded,
    // so a generous offset keeps both coords non-negative within a 16-bit field.
    const cellKey = (cx: number, cy: number) => (cx + 4096) * 8192 + (cy + 4096);

    // ---- physics (graph mode) ----
    function step(settleBoost = 1) {
      if (mode === "graph") {
        const repel = 0.0009 * settleBoost;

        // (Re)build the spatial grid for this tick. Clear existing buckets in
        // place (reusing the arrays) so we don't churn the heap every frame.
        for (const bucket of grid.values()) bucket.length = 0;
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const cx = Math.floor(p.x * INV_CELL);
          const cy = Math.floor(p.y * INV_CELL);
          const key = cellKey(cx, cy);
          let bucket = grid.get(key);
          if (bucket === undefined) {
            bucket = [];
            grid.set(key, bucket);
          }
          bucket.push(i);
        }

        // Repulsion: for each non-empty cell, pair its particles with those in
        // the same cell and the four "forward" neighbor cells (E, NE, N, NW).
        // Visiting only forward neighbors counts each unordered cell-pair once,
        // mirroring the original j > i sweep without double-counting.
        const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [-1, 1],
        ];
        for (const [keyStr, bucket] of grid) {
          if (bucket.length === 0) continue;
          // Recover this cell's coords to address neighbors.
          const cx = Math.floor(keyStr / 8192) - 4096;
          const cy = (keyStr % 8192) - 4096;
          for (const [ox, oy] of NEIGHBORS) {
            const sameCell = ox === 0 && oy === 0;
            const other = sameCell ? bucket : grid.get(cellKey(cx + ox, cy + oy));
            if (other === undefined || other.length === 0) continue;
            for (let ii = 0; ii < bucket.length; ii++) {
              const i = bucket[ii];
              // Within one cell, only pair j > i to avoid self/double pairs;
              // across cells, every (i, j) is a distinct unordered pair.
              const jStart = sameCell ? ii + 1 : 0;
              for (let jj = jStart; jj < other.length; jj++) {
                const j = other[jj];
                // Preserve the original semantics: the pair was processed only
                // when the lower-indexed particle was unpinned (the outer loop
                // `continue`d on a pinned source). So skip if min is pinned.
                const lo = i < j ? i : j;
                if (particles[lo].pinned) continue;
                const a = particles[i];
                const b = particles[j];
                let dx = a.x - b.x;
                let dy = a.y - b.y;
                const r2 = dx * dx + dy * dy;
                if (r2 > REPEL_CUTOFF2) continue; // beyond cutoff: negligible
                const d2 = r2 + 0.0001;
                const f = repel / d2;
                dx *= f;
                dy *= f;
                // Match the original's asymmetry: the lower-indexed particle
                // played the role of `a` (always pushed; it was unpinned here),
                // the higher-indexed one played `b` (pushed only if unpinned).
                const aLo = i < j;
                const pa = aLo ? a : b;
                const pb = aLo ? b : a;
                const sdx = aLo ? dx : -dx;
                const sdy = aLo ? dy : -dy;
                pa.vx += sdx;
                pa.vy += sdy;
                if (!pb.pinned) {
                  pb.vx -= sdx;
                  pb.vy -= sdy;
                }
              }
            }
          }
        }

        // Gravity to center — applied once per unpinned particle, exactly as
        // before (this lived in the old outer repulsion loop).
        for (const a of particles) {
          if (a.pinned) continue;
          a.vx -= a.x * 0.002;
          a.vy -= a.y * 0.002;
        }
        for (const e of eList) {
          const dx = e.b.x - e.a.x;
          const dy = e.b.y - e.a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
          const target = 0.5;
          const f = (dist - target) * 0.01 * e.s;
          const ux = (dx / dist) * f;
          const uy = (dy / dist) * f;
          if (!e.a.pinned) {
            e.a.vx += ux;
            e.a.vy += uy;
          }
          if (!e.b.pinned) {
            e.b.vx -= ux;
            e.b.vy -= uy;
          }
        }
        for (const p of particles) {
          if (p.pinned) continue;
          p.vx *= 0.86;
          p.vy *= 0.86;
          p.x += p.vx;
          p.y += p.vy;
        }
      } else {
        // leaf: gentle drift + spring home
        const time = performance.now() / 1000;
        for (const p of particles) {
          const drift = 0.0008;
          p.vx += Math.cos(time * 0.6 + p.phase) * drift;
          p.vy += Math.sin(time * 0.5 + p.phase) * drift;
          p.vx += (p.hx - p.x) * 0.02;
          p.vy += (p.hy - p.y) * 0.02;
          p.vx *= 0.9;
          p.vy *= 0.9;
          p.x += p.vx;
          p.y += p.vy;
          // hard bound so sustained dragging can't drift particles to NaN-land
          p.x = Math.max(-2.5, Math.min(2.5, p.x));
          p.y = Math.max(-2.5, Math.min(2.5, p.y));
        }
      }
    }

    function draw() {
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, w, h);
      ctx!.globalCompositeOperation = "lighter";

      // edges
      for (const e of eList) {
        const A = toScreen(e.a);
        const B = toScreen(e.b);
        const lit = hovered === e.a || hovered === e.b;
        ctx!.strokeStyle = lit ? "rgba(125,211,252,0.55)" : "rgba(118,192,36,0.16)";
        ctx!.lineWidth = lit ? 1.4 : 0.7;
        ctx!.beginPath();
        ctx!.moveTo(A.sx, A.sy);
        ctx!.lineTo(B.sx, B.sy);
        ctx!.stroke();
      }

      // particles
      for (const p of particles) {
        const { sx, sy } = toScreen(p);
        const lit = p === hovered;
        const r = p.r * (p.hub ? 1.3 : 1) * (lit ? 1.5 : 1);
        const glow = ctx!.createRadialGradient(sx, sy, 0, sx, sy, r * 4);
        glow.addColorStop(0, p.color);
        glow.addColorStop(0.4, p.color + "88");
        glow.addColorStop(1, "transparent");
        ctx!.fillStyle = glow;
        ctx!.beginPath();
        ctx!.arc(sx, sy, r * 4, 0, TAU);
        ctx!.fill();
        ctx!.fillStyle = p.hub || lit ? "#ffffff" : p.color;
        ctx!.beginPath();
        ctx!.arc(sx, sy, Math.max(0.8, r * 0.6), 0, TAU);
        ctx!.fill();
      }

      // hovered label
      if (hovered?.label) {
        const { sx, sy } = toScreen(hovered);
        ctx!.globalCompositeOperation = "source-over";
        ctx!.font =
          "11px ui-monospace, SFMono-Regular, Menlo, monospace";
        const tw = ctx!.measureText(hovered.label).width;
        ctx!.fillStyle = "rgba(7,10,14,0.9)";
        ctx!.fillRect(sx + 8, sy - 9, tw + 10, 18);
        ctx!.fillStyle = "#e5e7eb";
        ctx!.fillText(hovered.label, sx + 13, sy + 4);
      }
      ctx!.globalCompositeOperation = "source-over";
    }

    let raf = 0;
    if (reduced) {
      // settle then a single static frame
      for (let i = 0; i < 220; i++) step(2);
      draw();
    } else {
      // warm up the graph layout off-screen so it opens settled
      if (mode === "graph") for (let i = 0; i < 120; i++) step(2);
      const loop = () => {
        step();
        draw();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    // ---- interaction ----
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    function onDown(e: PointerEvent) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      // lockView never pans, so don't capture — a touch that slides off a
      // locked logo belongs to the page, not to us.
      if (!lockView) canvas!.setPointerCapture(e.pointerId);
    }
    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (dragging && !lockView) {
        panX += e.clientX - lastX;
        panY += e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
      }
      if (mode === "leaf") {
        // proximity repulsion — a cursor (or finger) near the leaf scatters
        // nearby particles; the home springs pull them back. Fires on hover,
        // not just drag, so the leaf feels alive before you grab it.
        const wp = fromScreen(mx, my);
        for (const p of particles) {
          const dx = p.x - wp.x;
          const dy = p.y - wp.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 0.05) {
            p.vx += dx * 0.4;
            p.vy += dy * 0.4;
          }
        }
      } else if (!dragging) {
        // hover detection
        let best: Particle | null = null;
        let bestD = 16 * 16;
        for (const p of particles) {
          const s = toScreen(p);
          const dd = (s.sx - mx) ** 2 + (s.sy - my) ** 2;
          if (dd < bestD) {
            bestD = dd;
            best = p;
          }
        }
        hovered = best;
        canvas!.style.cursor = best ? "pointer" : "grab";
      }
    }
    function onUp(e: PointerEvent) {
      dragging = false;
      try {
        canvas!.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    function onClick(e: MouseEvent) {
      if (!onSelectRef.current || mode !== "graph") return;
      const rect = canvas!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let best: Particle | null = null;
      let bestD = 18 * 18;
      for (const p of particles) {
        const s = toScreen(p);
        const dd = (s.sx - mx) ** 2 + (s.sy - my) ** 2;
        if (dd < bestD) {
          bestD = dd;
          best = p;
        }
      }
      if (best) onSelectRef.current?.(best.id);
    }
    function onWheel(e: WheelEvent) {
      // lockView: leave the wheel to the page (no preventDefault → scroll works).
      if (lockView) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      userScale = Math.max(0.4, Math.min(4, userScale * factor));
    }

    canvas.style.cursor = lockView ? "default" : "grab";
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onUp);
    // pointercancel: the browser hijacked the pointer mid-drag (touch scroll
    // takeover, system gesture, pen out of range). Spec-compliant engines fire
    // pointerleave afterwards, but engines have skipped it under active
    // capture — and a stranded `dragging` pans + injects velocity on every
    // subsequent buttonless hover.
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("click", onClick);
    // lockView never preventDefaults, so register passive (no sync hit-testing).
    canvas.addEventListener("wheel", onWheel, { passive: lockView });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphKey, mode, height, accent, leafCount, lockView]);

  return (
    <div
      ref={wrapRef}
      className={`relative overflow-hidden ${
        frameless ? "" : "canvas-dark rounded-xl border border-ink-700"
      } ${className}`}
      style={{ height }}
    >
      {/* lockView: let vertical swipes scroll the page (the logo must not be a
          scroll trap); horizontal/hold gestures still reach the particles. */}
      <canvas ref={canvasRef} className={`block ${lockView ? "touch-pan-y" : "touch-none"}`} />
      {showCount && (
        <div className="instrument-label pointer-events-none absolute right-3 top-3 text-grow-300/70">
          NODES: {count}
        </div>
      )}
      {caption && (
        <div className="instrument-label pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-center text-gray-600">
          {caption}
        </div>
      )}
    </div>
  );
}
