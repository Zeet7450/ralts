"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Plus, CheckSquare, Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTasksStore } from "@/stores/tasks-store";
import { formatDateTime } from "@/lib/utils";

export default function TasksPage() {
  const t = useTranslations();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    overdue: true,
    today: true,
    upcoming: true,
  });
  const { tasks, isLoading, fetchTasks, completeTask, getGroupedTasks } = useTasksStore();

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const grouped = getGroupedTasks();

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderTaskRow = (task: typeof tasks[0]) => (
    <div
      key={task.id}
      className="flex items-center gap-3 py-3 border-b border-border last:border-0"
    >
      {/* Checkbox — stops propagation so tapping the row navigates, checkbox toggles completion */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          completeTask(task.id);
        }}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-150 ${
          task.is_completed
            ? "bg-accent border-accent"
            : "border-border hover:border-accent"
        }`}
      >
        {task.is_completed && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Row — clickable to edit */}
      <Link
        href={`/tasks/${task.id}`}
        className="flex-1 min-w-0 active:bg-surface-elevated rounded-md -mx-1 px-1"
      >
        <p className={`text-sm ${task.is_completed ? "line-through text-text-tertiary" : "text-text-primary"}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          {task.checklist.length > 0 && (
            <span className="text-xs text-text-tertiary">
              {task.checklist.filter(c => c.done).length}/{task.checklist.length} items
            </span>
          )}
          {task.due_date && (
            <span className="text-xs text-text-tertiary flex items-center gap-1">
              <Calendar className="h-3 w-3" strokeWidth={1.5} />
              {formatDateTime(task.due_date)}
            </span>
          )}
        </div>
      </Link>
    </div>
  );

  const renderSection = (key: string, title: string, items: typeof grouped.overdue, isEmpty: boolean) => {
    if (isEmpty && items.length === 0) return null;

    return (
      <div key={key} className="bg-surface rounded-lg">
        <button
          onClick={() => toggleSection(key)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{title}</span>
            {items.length > 0 && (
              <span className="text-xs text-text-tertiary">{items.length}</span>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 text-text-tertiary transition-transform duration-200 ${
              openSections[key] ? "rotate-180" : ""
            }`}
            strokeWidth={1.5}
          />
        </button>
        {openSections[key] && (
          <div className="px-4 pb-4">
            {items.length === 0 ? (
              <p className="text-xs text-text-tertiary py-2">All clear</p>
            ) : (
              items.map(renderTaskRow)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold">{t("nav.tasks")}</h1>
          <Link href="/tasks/new">
            <Button size="sm" className="bg-accent text-white h-8 w-8 p-0">
              <Plus className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </Link>
        </div>
      </div>

      {/* Tasks */}
      <div className="px-4 space-y-2">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-surface rounded-lg h-16 animate-pulse" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckSquare className="h-10 w-10 text-text-tertiary mb-3" strokeWidth={1} />
            <p className="text-sm text-text-secondary">{t("tasks.no_tasks")}</p>
          </div>
        ) : (
          <>
            {renderSection("overdue", t("tasks.overdue"), grouped.overdue, false)}
            {renderSection("today", t("tasks.today"), grouped.today, false)}
            {renderSection("upcoming", t("tasks.upcoming"), grouped.upcoming, false)}
          </>
        )}
      </div>

      {/* Completed link */}
      {grouped.completed.length > 0 && (
        <div className="px-4 mt-4">
          <Link href="/tasks/completed">
            <Button variant="ghost" className="w-full text-text-secondary text-sm">
              {t("tasks.completed")} ({grouped.completed.length})
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}