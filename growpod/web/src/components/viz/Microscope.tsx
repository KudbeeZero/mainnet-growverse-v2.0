"use client";

// Microscope — a hand-rolled Canvas 2D "lab bench" view of a cannabis bud you
// can pan, zoom, and inspect under a magnifier lens. Procedural (not a photo) so
// it zooms infinitely: at low magnification you see the whole frosty bud; zoom in
// and the calyxes, orange pistils, and the field of stalked glandular trichomes
// resolve; at max zoom each trichome head holds a glistening terpene droplet
// labelled with the strain's terpenes.
//
// Mirrors the project's canvas convention (GrowChamber/Constellation): refs +
// effect + ResizeObserver + prefers-reduced-motion + RAF cleanup, no externals.
// Geometry (calyxes/trichomes/pistils) is rebuilt only when the seed or terpene
// set changes; fast-changing inputs (maturity, pointer, camera) live in refs and
// are read each frame so interaction never rebuilds geometry.

import { useEffect, useRef, useState } from "react";
import { terpeneInfo } from "@/lib/terpenes";

interface Props {
  /** Deterministic layout seed (e.g. derived from the strain id). */
  seed: number;
  /** Strain terpenes — drive the droplet colours + labels at max zoom. */
  terpenes: string[];
  /** Trichome maturity 0..1: clear → cloudy → amber (harvest readiness). */
  maturity: number;
  /** Purple anthocyanin tint 0..1 for the calyxes (cool-night / strain trait). */
  purple?: number;
  className?: string;
}

const WORLD = 1000;

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Trichome {
  x: number;
  y: number;
  stalk: number;
  head: number;
  matJitter: number;
  terp: number; // index into terpenes, or -1
  glint: number;
}
interface Calyx {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rot: number;
  shade: number;
}
interface Pistil {
  x: number;
  y: number;
  ang: number;
  len: number;
  curl: number;
  amber: number;
}
interface Geometry {
  calyxes: Calyx[];
  trichomes: Trichome[];
  pistils: Pistil[];
}

function buildGeometry(seed: number, terpCount: number): Geometry {
  const rnd = mulberry32(seed || 1);
  const cx = WORLD / 2;
  const cy = WORLD / 2;
  // Bud silhouette: a vertical-ish cluster of overlapping calyx blobs.
  const radX = WORLD * 0.32;
  const radY = WORLD * 0.4;
  const inBud = (x: number, y: number) => {
    const dx = (x - cx) / radX;
    const dy = (y - cy) / radY;
    return dx * dx + dy * dy <= 1;
  };

  const calyxes: Calyx[] = [];
  for (let i = 0; i < 70; i++) {
    let x = 0;
    let y = 0;
    for (let t = 0; t < 8; t++) {
      x = cx + (rnd() * 2 - 1) * radX;
      y = cy + (rnd() * 2 - 1) * radY;
      if (inBud(x, y)) break;
    }
    const r = 60 + rnd() * 70;
    calyxes.push({
      x,
      y,
      rx: r,
      ry: r * (0.7 + rnd() * 0.5),
      rot: rnd() * Math.PI,
      shade: rnd(),
    });
  }

  const trichomes: Trichome[] = [];
  const COUNT = 460;
  for (let i = 0; i < COUNT; i++) {
    let x = 0;
    let y = 0;
    for (let t = 0; t < 8; t++) {
      x = cx + (rnd() * 2 - 1) * radX * 0.98;
      y = cy + (rnd() * 2 - 1) * radY * 0.98;
      if (inBud(x, y)) break;
    }
    const head = 5 + rnd() * 6;
    trichomes.push({
      x,
      y,
      stalk: head * (1.4 + rnd() * 1.6),
      head,
      matJitter: rnd() * 0.5 - 0.2,
      terp: terpCount > 0 && rnd() < 0.55 ? Math.floor(rnd() * terpCount) : -1,
      glint: rnd(),
    });
  }

  const pistils: Pistil[] = [];
  for (let i = 0; i < 46; i++) {
    let x = 0;
    let y = 0;
    for (let t = 0; t < 8; t++) {
      x = cx + (rnd() * 2 - 1) * radX * 0.8;
      y = cy + (rnd() * 2 - 1) * radY * 0.8;
      if (inBud(x, y)) break;
    }
    pistils.push({
      x,
      y,
      ang: rnd() * Math.PI * 2,
      len: 70 + rnd() * 130,
      curl: (rnd() * 2 - 1) * 0.9,
      amber: rnd(),
    });
  }

  return { calyxes, trichomes, pistils };
}

function headColor(m: number): string {
  // 0 clear (bluish glass) → 0.5 cloudy (milky) → 1 amber (gold)
  const c = Math.max(0, Math.min(1, m));
  if (c < 0.5) {
    const t = c / 0.5;
    const r = Math.round(205 + t * 30);
    const g = Math.round(225 + t * 20);
    const b = Math.round(235 - t * 35);
    return `rgba(${r},${g},${b},0.92)`;
  }
  const t = (c - 0.5) / 0.5;
  const r = Math.round(235 + t * 18);
  const g = Math.round(220 - t * 70);
  const b = Math.round(170 - t * 120);
  return `rgba(${r},${g},${b},0.95)`;
}

export function Microscope({ seed, terpenes, maturity, purple = 0, className = "" }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Camera + interaction state (refs so the RAF loop reads latest without rerender).
  const cam = useRef({ x: WORLD / 2, y: WORLD / 2, zoom: 1 });
  const pointer = useRef<{ x: number; y: number; inside: boolean }>({ x: 0, y: 0, inside: false });
  const drag = useRef<{ on: boolean; px: number; py: number }>({ on: false, px: 0, py: 0 });
  const live = useRef({ maturity, purple, terpenes });
  live.current = { maturity, purple, terpenes };

  const [zoomLabel, setZoomLabel] = useState(1);
  const geomKey = `${seed}|${terpenes.length}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const motionOK =
      typeof window === "undefined" ||
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const geom = buildGeometry(seed, terpenes.length);
    let W = 0;
    let H = 0;
    let base = 1; // fit scale (world → screen at zoom 1)

    function fit() {
      const r = wrap!.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width;
      H = r.height || 460;
      canvas!.width = Math.round(W * dpr);
      canvas!.height = Math.round(H * dpr);
      canvas!.style.width = `${W}px`;
      canvas!.style.height = `${H}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      base = Math.min(W, H) / (WORLD * 1.05);
    }

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);

    // ---- scene drawing (reused for the magnifier lens) --------------------
    function drawScene(
      camX: number,
      camY: number,
      scale: number,
      scx: number,
      scy: number,
      labels: boolean,
      time: number,
    ) {
      const sx = (wx: number) => (wx - camX) * scale + scx;
      const sy = (wy: number) => (wy - camY) * scale + scy;
      const mat = live.current.maturity;
      const pur = live.current.purple;
      const terps = live.current.terpenes;

      // bud mass — overlapping calyx blobs (green, slight purple by trait)
      for (const c of geom.calyxes) {
        const cxp = sx(c.x);
        const cyp = sy(c.y);
        const rx = c.rx * scale;
        const ry = c.ry * scale;
        const hue = 96 - pur * 50; // green → toward violet
        const sat = 45 + pur * 20;
        const lit = 22 + c.shade * 16;
        ctx.save();
        ctx.translate(cxp, cyp);
        ctx.rotate(c.rot);
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, Math.max(rx, ry));
        g.addColorStop(0, `hsla(${hue},${sat}%,${lit + 12}%,0.95)`);
        g.addColorStop(1, `hsla(${hue + 8},${sat}%,${lit}%,0.9)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // pistils — curved orange/amber hairs
      ctx.lineCap = "round";
      for (const p of geom.pistils) {
        const steps = 6;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const ang = p.ang + p.curl * t;
          const rr = p.len * t;
          const wx = p.x + Math.cos(ang) * rr;
          const wy = p.y + Math.sin(ang) * rr - rr * 0.25;
          const X = sx(wx);
          const Y = sy(wy);
          if (i === 0) ctx.moveTo(X, Y);
          else ctx.lineTo(X, Y);
        }
        const amber = 30 + p.amber * 25;
        ctx.strokeStyle = `hsla(${amber},85%,60%,0.85)`;
        ctx.lineWidth = Math.max(0.6, 2.4 * scale);
        ctx.stroke();
      }

      // trichomes — stalked glandular heads; detail scales with magnification
      for (const tr of geom.trichomes) {
        const m = Math.max(0, Math.min(1, mat + tr.matJitter));
        const hx = sx(tr.x);
        const hy = sy(tr.y);
        const hr = tr.head * scale;
        if (hx < -40 || hx > W + 40 || hy < -40 || hy > H + 40) continue;
        if (hr < 1.4) {
          // far view — frosty speckle
          ctx.fillStyle = headColor(m);
          ctx.globalAlpha = 0.55;
          ctx.fillRect(hx, hy, 1.3, 1.3);
          ctx.globalAlpha = 1;
          continue;
        }
        // stalk
        const baseY = hy + tr.stalk * scale;
        ctx.strokeStyle = "rgba(225,235,210,0.5)";
        ctx.lineWidth = Math.max(0.5, hr * 0.22);
        ctx.beginPath();
        ctx.moveTo(hx, baseY);
        ctx.lineTo(hx, hy);
        ctx.stroke();
        // bulbous head
        const hg = ctx.createRadialGradient(hx - hr * 0.3, hy - hr * 0.3, hr * 0.1, hx, hy, hr);
        hg.addColorStop(0, "rgba(255,255,255,0.95)");
        hg.addColorStop(0.6, headColor(m));
        hg.addColorStop(1, headColor(Math.min(1, m + 0.15)));
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(hx, hy, hr, 0, Math.PI * 2);
        ctx.fill();
        // glossy glint (twinkles slightly over time)
        const tw = motionOK ? 0.5 + 0.5 * Math.sin(time * 2 + tr.glint * 6.28) : 0.7;
        ctx.fillStyle = `rgba(255,255,255,${0.5 * tw})`;
        ctx.beginPath();
        ctx.arc(hx - hr * 0.32, hy - hr * 0.32, hr * 0.28, 0, Math.PI * 2);
        ctx.fill();
        // terpene droplet + label at high magnification
        if (hr > 14 && tr.terp >= 0 && terps.length > 0) {
          const info = terpeneInfo(terps[tr.terp % terps.length]);
          ctx.fillStyle = info.color;
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.arc(hx, hy + hr * 0.15, hr * 0.42, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          if (labels && hr > 26) {
            ctx.strokeStyle = "rgba(255,255,255,0.5)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(hx + hr, hy - hr);
            ctx.lineTo(hx + hr + 18, hy - hr - 14);
            ctx.stroke();
            ctx.font = "11px ui-monospace, monospace";
            ctx.fillStyle = info.color;
            ctx.textBaseline = "bottom";
            ctx.fillText(info.name, hx + hr + 21, hy - hr - 12);
          }
        }
      }
    }

    function draw(time: number) {
      // backdrop — dark microscope field with vignette
      ctx.setTransform(Math.min(2, window.devicePixelRatio || 1), 0, 0, Math.min(2, window.devicePixelRatio || 1), 0, 0);
      const bg = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.75);
      bg.addColorStop(0, "#0e1512");
      bg.addColorStop(1, "#05070a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const scale = base * cam.current.zoom;
      drawScene(cam.current.x, cam.current.y, scale, W / 2, H / 2, true, time);

      // magnifier lens
      if (pointer.current.inside) {
        const lx = pointer.current.x;
        const ly = pointer.current.y;
        const R = Math.min(W, H) * 0.18;
        // world point under the cursor (main camera)
        const wx = (lx - W / 2) / scale + cam.current.x;
        const wy = (ly - H / 2) / scale + cam.current.y;
        const lensMag = 2.6;
        ctx.save();
        ctx.beginPath();
        ctx.arc(lx, ly, R, 0, Math.PI * 2);
        ctx.clip();
        const lg = ctx.createRadialGradient(lx, ly, 1, lx, ly, R);
        lg.addColorStop(0, "#0e1512");
        lg.addColorStop(1, "#070b0e");
        ctx.fillStyle = lg;
        ctx.fillRect(lx - R, ly - R, R * 2, R * 2);
        drawScene(wx, wy, scale * lensMag, lx, ly, true, time);
        ctx.restore();
        // glass ring + sheen
        ctx.beginPath();
        ctx.arc(lx, ly, R, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(120,210,140,0.8)";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(lx, ly, R, Math.PI * 1.05, Math.PI * 1.5);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // ---- interaction -------------------------------------------------------
    function clampCam() {
      cam.current.zoom = Math.max(0.7, Math.min(16, cam.current.zoom));
      const pad = WORLD * 0.6;
      cam.current.x = Math.max(-pad, Math.min(WORLD + pad, cam.current.x));
      cam.current.y = Math.max(-pad, Math.min(WORLD + pad, cam.current.y));
    }
    function rel(e: PointerEvent | WheelEvent) {
      const rect = canvas!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function onDown(e: PointerEvent) {
      const p = rel(e);
      drag.current = { on: true, px: p.x, py: p.y };
      try {
        canvas!.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    function onMove(e: PointerEvent) {
      const p = rel(e);
      pointer.current.x = p.x;
      pointer.current.y = p.y;
      pointer.current.inside = true;
      if (drag.current.on) {
        const scale = base * cam.current.zoom;
        cam.current.x -= (p.x - drag.current.px) / scale;
        cam.current.y -= (p.y - drag.current.py) / scale;
        drag.current.px = p.x;
        drag.current.py = p.y;
        clampCam();
      }
    }
    function onUp() {
      drag.current.on = false;
    }
    function onLeave() {
      pointer.current.inside = false;
      drag.current.on = false;
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const p = rel(e);
      const scaleBefore = base * cam.current.zoom;
      const wx = (p.x - W / 2) / scaleBefore + cam.current.x;
      const wy = (p.y - H / 2) / scaleBefore + cam.current.y;
      cam.current.zoom *= e.deltaY < 0 ? 1.12 : 1 / 1.12;
      clampCam();
      const scaleAfter = base * cam.current.zoom;
      // keep the cursor's world point fixed under the cursor
      cam.current.x = wx - (p.x - W / 2) / scaleAfter;
      cam.current.y = wy - (p.y - H / 2) / scaleAfter;
      clampCam();
      setZoomLabel(Math.round(cam.current.zoom * 10) / 10);
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last >= 33) {
        last = t;
        draw(t / 1000);
      }
      raf = requestAnimationFrame(loop);
    };
    if (motionOK) raf = requestAnimationFrame(loop);
    else draw(0);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geomKey]);

  function resetView() {
    cam.current = { x: WORLD / 2, y: WORLD / 2, zoom: 1 };
    setZoomLabel(1);
  }

  return (
    <div ref={wrapRef} className={`canvas-dark relative h-full w-full overflow-hidden rounded-lg ${className}`}>
      <canvas ref={canvasRef} className="block touch-none cursor-crosshair" />
      <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/50 px-2 py-1 font-mono text-[10px] text-grow-200">
        {zoomLabel.toFixed(1)}× · drag to pan · scroll to zoom
      </div>
      <button
        onClick={resetView}
        className="absolute right-2 top-2 rounded bg-ink-800/80 px-2 py-1 text-[10px] text-gray-300 hover:bg-ink-700"
      >
        Reset view
      </button>
    </div>
  );
}
