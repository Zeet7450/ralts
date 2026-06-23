"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonthPickerProps {
  value: string; // YYYY-MM
  onChange: (value: string) => void;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function MonthPicker({ value, onChange }: MonthPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [viewYear, setViewYear] = React.useState(() => {
    if (value) return parseInt(value.split("-")[0], 10);
    return new Date().getFullYear();
  });

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const selectedYear = value ? parseInt(value.split("-")[0], 10) : viewYear;
  const selectedMonth = value ? parseInt(value.split("-")[1], 10) - 1 : new Date().getMonth();

  const displayValue = value
    ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
        new Date(parseInt(value.split("-")[0], 10), parseInt(value.split("-")[1], 10) - 1, 1)
      )
    : "";

  const handleSelect = (month: number) => {
    const iso = `${viewYear}-${String(month + 1).padStart(2, "0")}`;
    onChange(iso);
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-left",
          "flex items-center justify-between",
          "hover:border-accent/50 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-background",
          value ? "text-text-primary" : "text-text-tertiary"
        )}
      >
        <span>{displayValue || "Select month"}</span>
        <svg className="h-4 w-4 text-text-tertiary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsOpen(false)} />

          {/* Sheet */}
          <div className="relative w-full max-w-sm bg-surface rounded-t-2xl p-5 pb-6 safe-area-pb animate-in slide-in-from-bottom duration-300">
            {/* Year navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setViewYear(y => y - 1)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
              </button>
              <span className="text-sm font-semibold text-text-primary">{viewYear}</span>
              <button
                type="button"
                onClick={() => setViewYear(y => y + 1)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Month grid — 3 columns, 4 rows */}
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((month, idx) => {
                const isSelected = viewYear === selectedYear && idx === selectedMonth;
                const short = month.slice(0, 3);

                return (
                  <button
                    key={month}
                    type="button"
                    onClick={() => handleSelect(idx)}
                    className={cn(
                      "h-11 rounded-lg text-sm font-medium transition-colors",
                      isSelected
                        ? "bg-accent text-white"
                        : "bg-surface-elevated text-text-primary hover:bg-accent/20 hover:text-accent"
                    )}
                  >
                    {short}
                  </button>
                );
              })}
            </div>

            {/* This month shortcut */}
            <div className="mt-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setViewYear(now.getFullYear());
                  handleSelect(now.getMonth());
                }}
                className="w-full text-center text-xs text-accent hover:text-accent/80 transition-colors py-1"
              >
                This month
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}