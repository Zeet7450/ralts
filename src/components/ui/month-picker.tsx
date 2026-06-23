"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonthPickerProps {
  value: string; // YYYY-MM
  onChange: (value: string) => void;
}

const MONTH_KEYS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
] as const;

export function MonthPicker({ value, onChange }: MonthPickerProps) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = React.useState(false);
  const [viewYear, setViewYear] = React.useState(() => {
    if (value) return parseInt(value.split("-")[0], 10);
    return new Date().getFullYear();
  });
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const selectedYear = value ? parseInt(value.split("-")[0], 10) : viewYear;
  const selectedMonth = value ? parseInt(value.split("-")[1], 10) - 1 : new Date().getMonth();

  // Locale-aware month name — uses active next-intl locale
  const getMonthName = (idx: number) => t(`months.${MONTH_KEYS[idx]}`);

  const displayValue = value
    ? `${getMonthName(selectedMonth)} ${selectedYear}`
    : "";

  const handleSelect = (month: number) => {
    const iso = `${viewYear}-${String(month + 1).padStart(2, "0")}`;
    onChange(iso);
    setIsOpen(false);
  };

  // Close on outside click
  React.useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          "w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-left",
          "flex items-center justify-between gap-2",
          "hover:border-accent/50 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-background",
          value ? "text-text-primary" : "text-text-tertiary"
        )}
      >
        <span className="truncate">{displayValue || t("finance.select_month")}</span>
        <svg
          className={cn("h-3.5 w-3.5 text-text-tertiary shrink-0 transition-transform duration-200", isOpen && "rotate-180")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Inline dropdown panel */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-surface border border-border rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Year navigation row */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <span className="text-xs font-semibold text-text-primary tabular-nums">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Month grid — 3 columns, 4 rows */}
          <div className="grid grid-cols-3 gap-0.5 p-1.5">
            {MONTH_KEYS.map((key, idx) => {
              const isSelected = viewYear === selectedYear && idx === selectedMonth;
              const monthName = getMonthName(idx);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelect(idx)}
                  className={cn(
                    "h-9 w-full flex items-center justify-center rounded-md text-[11px] font-medium transition-colors",
                    isSelected
                      ? "bg-accent text-white"
                      : "text-text-primary hover:bg-surface-elevated"
                  )}
                >
                  {monthName}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}