"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: ReactNode;
  panel: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  /** Accessible name of the tab list, e.g. "Company sections". */
  label: string;
  defaultTabId?: string;
  onChange?: (tabId: string) => void;
  className?: string;
}

/** Tab list with roving tabindex; Left/Right/Home/End move and select. */
export function Tabs({ tabs, label, defaultTabId, onChange, className }: TabsProps) {
  const baseId = useId();
  const firstId = tabs[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState(defaultTabId ?? firstId);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const select = (tabId: string) => {
    setSelectedId(tabId);
    onChange?.(tabId);
    tabRefs.current.get(tabId)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") nextIndex = index === 0 ? last : index - 1;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = last;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = tabs[nextIndex];
    if (next) select(next.id);
  };

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} className="flex gap-1 border-b border-line">
        {tabs.map((tab, index) => {
          const selected = tab.id === selectedId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              ref={(node) => {
                if (node) tabRefs.current.set(tab.id, node);
                else tabRefs.current.delete(tab.id);
              }}
              onClick={() => select(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                selected
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-secondary hover:border-line-strong hover:text-ink",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== selectedId}
          tabIndex={0}
          className="py-4"
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
