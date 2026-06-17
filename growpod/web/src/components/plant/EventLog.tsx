import { timeAgo, titleCase } from "@/lib/format";
import type { PlantEvent } from "@/lib/types";

const EVENT_ICON: Record<string, string> = {
  stage_change: "🌱",
  condition_onset: "⚠️",
  death: "💀",
  watered: "💧",
  fed: "🧪",
  pest_treated: "🐞",
  disease_treated: "🧫",
};

export function EventLog({ events }: { events: PlantEvent[] }) {
  if (!events.length) {
    return <p className="text-xs text-gray-500">No events yet.</p>;
  }
  return (
    <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1 text-xs">
      {events.map((e) => (
        <li key={e.id} className="flex items-start gap-2 text-gray-300">
          <span aria-hidden>{EVENT_ICON[e.event_type] ?? "•"}</span>
          <div className="flex-1">
            <span className="text-gray-200">{titleCase(e.event_type)}</span>
            {e.severity && (
              <span className="ml-1 text-gray-500">({e.severity})</span>
            )}
            {renderPayload(e.payload)}
          </div>
          <span className="whitespace-nowrap text-gray-500">{timeAgo(e.timestamp)}</span>
        </li>
      ))}
    </ul>
  );
}

function renderPayload(payload: Record<string, unknown> | null) {
  if (!payload) return null;
  const from = payload["from"];
  const to = payload["to"];
  if (from && to) {
    return (
      <span className="ml-1 text-gray-500">
        {String(from)} → {String(to)}
      </span>
    );
  }
  const condition = payload["condition"];
  if (condition) return <span className="ml-1 text-gray-500">{titleCase(String(condition))}</span>;
  return null;
}
