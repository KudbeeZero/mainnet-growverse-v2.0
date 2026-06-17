// Radial gauge for a scientist readout (e.g. VPD). Shows the value on a 270°
// arc with the optimal band highlighted — instantly tells a grower whether
// they're in range without reading the number.

export function Gauge({
  label,
  value,
  unit,
  min = 0,
  max = 2.5,
  optimal,
  size = 96,
}: {
  label: string;
  value: number | null | undefined;
  unit?: string;
  min?: number;
  max?: number;
  /** [lo, hi] optimal band in the same units. */
  optimal?: [number, number];
  size?: number;
}) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const START = 135; // degrees
  const SWEEP = 270;
  const v = value ?? min;
  const frac = Math.max(0, Math.min(1, (v - min) / (max - min)));

  const polar = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const arcPath = (a0: number, a1: number) => {
    const s = polar(a0);
    const e = polar(a1);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const valDeg = START + frac * SWEEP;
  let bandPath: string | null = null;
  if (optimal) {
    const lo = Math.max(0, Math.min(1, (optimal[0] - min) / (max - min)));
    const hi = Math.max(0, Math.min(1, (optimal[1] - min) / (max - min)));
    bandPath = arcPath(START + lo * SWEEP, START + hi * SWEEP);
  }
  const inBand = optimal ? v >= optimal[0] && v <= optimal[1] : true;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size}>
        <path d={arcPath(START, START + SWEEP)} fill="none" stroke="#21262d" strokeWidth={stroke} strokeLinecap="round" />
        {bandPath && (
          <path d={bandPath} fill="none" stroke="#356010" strokeWidth={stroke} strokeLinecap="round" opacity={0.9} />
        )}
        <path
          d={arcPath(START, valDeg)}
          fill="none"
          stroke={inBand ? "#76c024" : "#f59e0b"}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <text x={cx} y={cy - 2} textAnchor="middle" className="instrument-value" fill="#e5e7eb" fontSize="16">
          {value === null || value === undefined ? "—" : value.toFixed(2)}
        </text>
        {unit && (
          <text x={cx} y={cy + 14} textAnchor="middle" fill="#6b7280" fontSize="9">
            {unit}
          </text>
        )}
      </svg>
      <div className="instrument-label mt-1">{label}</div>
    </div>
  );
}
