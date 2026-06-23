"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, RotateCcw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTasksStore } from "@/stores/tasks-store";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function CompletedTasksPage() {
  const t = useTranslations();
  const router = useRouter();
  const { tasks, isLoading, fetchTasks, uncompleteTask } = useTasksStore();

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const completedTasks = tasks.filter((task) => task.is_completed);

  const handleUncomplete = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    await uncompleteTask(taskId);
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 pt-4 pb-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <h1 className="text-lg font-semibold flex-1">{t("tasks.completed")}</h1>
        <span className="text-xs text-text-tertiary">{completedTasks.length}</span>
      </div>

      {/* Content */}
      <div className="px-4 space-y-2">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface rounded-lg h-16 animate-pulse" />
            ))}
          </div>
        ) : completedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-text-secondary">No completed tasks yet.</p>
          </div>
        ) : (
          <div className="bg-surface rounded-xl divide-y divide-border">
            {completedTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                {/* Restore button */}
                <button
                  onClick={(e) => handleUncomplete(e, task.id)}
                  className="w-5 h-5 rounded-full border-2 border-border flex items-center justify-center shrink-0 hover:border-accent transition-colors"
                  title="Restore task"
                >
                  <RotateCcw className="h-3 w-3 text-text-tertiary" strokeWidth={1.5} />
                </button>

                {/* Task content — clickable to edit */}
                <Link
                  href={`/tasks/${task.id}`}
                  className="flex-1 min-w-0 active:bg-surface-elevated rounded-md -mx-1 px-1"
                >
                  <p className="text-sm line-through text-text-tertiary">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {task.completed_at && (
                      <span className="text-[11px] text-text-tertiary flex items-center gap-1">
                        <Calendar className="h-3 w-3" strokeWidth={1.5} />
                        {formatDateTime(task.completed_at)}
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}