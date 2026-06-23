"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CalendarProps {
  year: number;
  month: number;
  selectedDate: Date | null;
  onSelect: (date: Date) => void;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function Calendar({ year, month, selectedDate, onSelect }: CalendarProps) {
  const today = new Date();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const cells: (number | null)[] = [
    ...Array(startPadding).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="w-full">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((day) => (
          <div key={day} className="flex items-center justify-center h-8">
            <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">
              {day}
            </span>
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`pad-${idx}`} className="h-11" />;
          }

          const date = new Date(year, month, day);
          const isSelected =
            selectedDate &&
            date.getFullYear() === selectedDate.getFullYear() &&
            date.getMonth() === selectedDate.getMonth() &&
            date.getDate() === selectedDate.getDate();

          const isToday =
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate();

          const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());

          return (
            <button
              key={day}
              onClick={() => onSelect(date)}
              className={cn(
                "h-11 w-full flex items-center justify-center rounded-lg text-sm transition-colors",
                isSelected
                  ? "bg-accent text-white font-semibold"
                  : isToday
                  ? "border border-accent text-accent font-medium"
                  : isPast
                  ? "text-text-tertiary hover:bg-surface-elevated"
                  : "text-text-primary hover:bg-surface-elevated"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface DatePickerProps {
  value: string; // ISO date string YYYY-MM-DD
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  minDate?: string;
}

export function DatePicker({ value, onChange, label, placeholder = "Select date" }: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [viewYear, setViewYear] = React.useState(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d.getFullYear();
    }
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = React.useState(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d.getMonth();
    }
    return new Date().getMonth();
  });

  const selectedDate = value ? new Date(value + "T00:00:00") : null;

  const displayValue = selectedDate
    ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(selectedDate)
    : "";

  const handleSelect = (date: Date) => {
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    onChange(iso);
    setIsOpen(false);
  };

  const navigateMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString("en-US", { month: "long" });

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "w-full h-11 rounded-lg border border-border bg-surface px-3 text-sm text-left",
          "flex items-center justify-between",
          "hover:border-accent/50 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-background",
          value ? "text-text-primary" : "text-text-tertiary"
        )}
      >
        <span>{displayValue || placeholder}</span>
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
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => navigateMonth(-1)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
              </button>
              <span className="text-sm font-semibold text-text-primary">
                {monthName} {viewYear}
              </span>
              <button
                type="button"
                onClick={() => navigateMonth(1)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Calendar */}
            <Calendar
              year={viewYear}
              month={viewMonth}
              selectedDate={selectedDate}
              onSelect={handleSelect}
            />

            {/* Today shortcut */}
            <div className="mt-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  setViewYear(today.getFullYear());
                  setViewMonth(today.getMonth());
                  handleSelect(today);
                }}
                className="w-full text-center text-xs text-accent hover:text-accent/80 transition-colors py-1"
              >
                Today
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface DatePickerFieldProps extends DatePickerProps {
  label: string;
}

export function DatePickerField({ label, ...props }: DatePickerFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-text-secondary">{label}</label>
      <DatePicker {...props} />
    </div>
  );
}