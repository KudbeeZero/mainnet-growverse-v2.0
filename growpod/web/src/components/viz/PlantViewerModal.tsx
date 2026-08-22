"use client";

// Premium full-screen 3D plant viewer.
//
// Wraps the existing PlantGL seven-layer construction renderer in a cinematic
// studio-lit environment with a live control deck (layer visibility, density,
// auto-rotate, screenshot). Reachable from the chamber's "View in 3D" chip.
// Mobile: controls collapse into a bottom sheet so the canvas keeps the screen.

import { useCallback, useEffect, useMemo, useState } from "react";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Button } from "@/components/ui/Button";
import {
  PlantGL,
  ALL_LAYERS,
  DEFAULT_DENSITY,
  type PlantLayerVisibility,
  type PlantDensity,
} from "./PlantGL";
import type { BudColor, DevParams } from "@/lib/chamber/morphology";

const LAYER_LABELS: Array<{ key: keyof PlantLayerVisibility; label: string }> = [
  { key: "woody", label: "Stem" },
  { key: "fanLeaves", label: "Fan leaves" },
  { key: "budCore", label: "Bud core" },
  { key: "calyxes", label: "Calyxes" },
  { key: "sugarLeaves", label: "Sugar leaves" },
  { key: "pistils", label: "Pistils" },
  { key: "frost", label: "Trichomes" },
];

function StudioEnvironment() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <hemisphereLight args={["#cfe8ff", "#0a141c", 0.55]} />
      <directionalLight position={[4, 6, 5]} intensity={1.5} color="#fff6e0" castShadow={false} />
      <directionalLight position={[-3, 4, -2]} intensity={0.5} color="#bcd8ff" />
      <pointLight position={[0, 1.5, 3]} intensity={6} distance={8} color="#eafff6" />
    </>
  );
}

function Rig({ autoRotate }: { autoRotate: boolean }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.lookAt(0, 0.4, 0);
  }, [camera]);
  return (
    <OrbitControls
      enablePan={false}
      enableZoom
      minDistance={1.2}
      maxDistance={7}
      autoRotate={autoRotate}
      autoRotateSpeed={0.9}
      target={[0, 0.4, 0]}
    />
  );
}

export interface PlantViewerModalProps {
  open: boolean;
  onClose: () => void;
  strainName: string;
  strain?: string;
  indicaRatio: number;
  seed: number;
  day: number;
  stage: string;
  dev: DevParams;
  budColor: BudColor;
  reducedMotion?: boolean;
}

export function PlantViewerModal({
  open,
  onClose,
  strainName,
  strain,
  indicaRatio,
  seed,
  day,
  stage,
  dev,
  budColor,
  reducedMotion = false,
}: PlantViewerModalProps) {
  const [layers, setLayers] = useState<PlantLayerVisibility>(ALL_LAYERS);
  const [density, setDensity] = useState<PlantDensity>(DEFAULT_DENSITY);
  const [autoRotate, setAutoRotate] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);

  // Reset transient controls each time a new plant opens so the next plant
  // always starts in the full cinematic default.
  useEffect(() => {
    if (open) {
      setLayers(ALL_LAYERS);
      setDensity(DEFAULT_DENSITY);
      setAutoRotate(!reducedMotion);
      setPanelOpen(false);
    }
  }, [open, reducedMotion]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const toggleLayer = useCallback((key: keyof PlantLayerVisibility) => {
    setLayers((l) => ({ ...l, [key]: !l[key] }));
  }, []);

  const setDensityValue = useCallback((key: keyof PlantDensity, value: number) => {
    setDensity((d) => ({ ...d, [key]: value }));
  }, []);

  const onScreenshot = useCallback(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("[data-plant-viewer-canvas] canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${strainName.replace(/\s+/g, "-").toLowerCase()}-day${Math.round(day)}-3d.png`;
    a.click();
  }, [strainName, day]);

  const layerButton = (key: keyof PlantLayerVisibility, label: string) => {
    const on = layers[key];
    return (
      <button
        key={key}
        type="button"
        onClick={() => toggleLayer(key)}
        aria-pressed={on}
        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
          on
            ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100"
            : "border-ink-600 bg-ink-800 text-gray-500 hover:border-ink-500"
        }`}
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${on ? "bg-cyan-300" : "bg-ink-600"}`}
          aria-hidden
        />
        {label}
      </button>
    );
  };

  const densitySlider = (key: keyof PlantDensity, label: string) => (
    <label key={key} className="flex items-center gap-2">
      <span className="w-16 flex-none text-[10px] font-semibold tracking-wide text-gray-400">
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={2}
        step={0.05}
        value={density[key]}
        onChange={(e) => setDensityValue(key, Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer accent-cyan-400"
        aria-label={`${label} density`}
      />
      <span className="w-7 flex-none text-right font-mono text-[10px] text-cyan-200">
        {density[key].toFixed(2)}×
      </span>
    </label>
  );

  const panel = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {LAYER_LABELS.map((l) => layerButton(l.key, l.label))}
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {densitySlider("cola", "Calyx")}
        {densitySlider("pistil", "Pistil")}
        {densitySlider("frost", "Trichome")}
        {densitySlider("leaf", "Leaf")}
      </div>
    </div>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#040a10]">
      {/* Header */}
      <header className="flex flex-none items-center justify-between gap-3 px-3 py-2 sm:px-5 sm:py-3">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-extrabold tracking-wide text-gray-100 sm:text-base">
            {strainName} <span className="text-cyan-300">· 3D</span>
          </h1>
          <p className="truncate text-[10px] tracking-wider text-gray-500">
            Day {Math.round(day)} · {stage.replace(/_/g, " ")}
          </p>
        </div>
        <div className="flex flex-none items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAutoRotate((v) => !v)}
            aria-pressed={autoRotate}
            className="hidden sm:inline-flex"
          >
            {autoRotate ? "⏸ Rotate" : "▶ Rotate"}
          </Button>
          <Button variant="secondary" size="sm" onClick={onScreenshot} className="hidden sm:inline-flex">
            📸 Capture
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>
      </header>

      {/* Canvas */}
      <div className="relative min-h-0 flex-1" data-plant-viewer-canvas>
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
          camera={{ position: [0, 0.55, 4.2], fov: 42 }}
          frameloop={reducedMotion ? "demand" : "always"}
          onCreated={({ gl }) => {
            gl.setClearColor(new THREE.Color("#040a10"), 1);
          }}
        >
          <StudioEnvironment />
          <Rig autoRotate={autoRotate} />
          <PlantGL
            strain={strain}
            indicaRatio={indicaRatio}
            seed={seed}
            day={day}
            stage={stage}
            dev={dev}
            budColor={budColor}
            reducedMotion={reducedMotion}
            layers={layers}
            density={density}
          />
        </Canvas>

        {/* Mobile floating controls */}
        <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 sm:hidden">
          <Button variant="secondary" size="sm" onClick={() => setAutoRotate((v) => !v)} aria-pressed={autoRotate}>
            {autoRotate ? "⏸" : "▶"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setPanelOpen((v) => !v)}>
            {panelOpen ? "▴ Hide" : "▾ Layers"}
          </Button>
          <Button variant="secondary" size="sm" onClick={onScreenshot}>
            📸
          </Button>
        </div>

        {/* Desktop control deck — docked bottom-left */}
        <div className="absolute inset-x-3 bottom-3 hidden max-w-sm flex-col gap-2 sm:flex">
          <div className="rounded-xl border border-ink-700/80 bg-ink-900/85 p-3 backdrop-blur">
            {panel}
          </div>
        </div>

        {/* Mobile bottom sheet */}
        {panelOpen && (
          <div className="absolute inset-x-0 bottom-12 max-h-[55%] overflow-y-auto rounded-t-xl border-t border-ink-700 bg-ink-900/95 p-3 backdrop-blur sm:hidden">
            {panel}
          </div>
        )}
      </div>
    </div>
  );
}
