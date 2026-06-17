"use client";

import type { ReactNode } from "react";

export interface TabDef {
  key: string;
  label: ReactNode;
  badge?: ReactNode;
}

export function Tabs({
  tabs,
  active,
  onChange,
  className = "",
}: {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={`flex flex-wrap gap-1 border-b border-ink-700 ${className}`}>
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            className={`relative -mb-px rounded-t-md border-b-2 px-4 py-2 text-sm transition-colors ${
              on
                ? "border-grow-400 text-grow-200"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            {t.label}
            {t.badge !== undefined && (
              <span className="ml-1.5 rounded-full bg-ink-700 px-1.5 py-0.5 text-[10px] text-gray-300">
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
