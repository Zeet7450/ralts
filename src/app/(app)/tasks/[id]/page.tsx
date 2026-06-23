"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DateTimePickerField } from "@/components/ui/date-time-picker";
import { useTasksStore } from "@/stores/tasks-store";
import type { Task } from "@/types";

export default function TaskDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const { tasks, fetchTasks, updateTask, deleteTask } = useTasksStore();

  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const taskId = params.id as string;

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setDueDate(task.due_date ? task.due_date.slice(0, 16) : "");
    }
  }, [tasks, taskId]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsLoading(true);
    await updateTask(taskId, {
      title: title.trim(),
      description: description.trim() || undefined,
      due_date: dueDate || undefined,
    });
    setIsLoading(false);
    router.push("/tasks");
  };

  const handleDelete = async () => {
    setIsLoading(true);
    await deleteTask(taskId);
    setIsLoading(false);
    router.push("/tasks");
  };

  if (!tasks.find((t) => t.id === taskId) && tasks.length > 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-text-secondary">Task not found</p>
        <Button variant="outline" onClick={() => router.push("/tasks")}>
          Back to Tasks
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 pt-4 pb-2 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        </Button>
        <h1 className="text-lg font-semibold flex-1">{t("tasks.edit_task")}</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowDeleteConfirm(true)}
          className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      </div>

      {/* Form */}
      <div className="px-4 pt-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title" className="text-xs font-medium text-text-secondary">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="What needs to be done?"
            className="h-11 bg-surface border-border"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-xs font-medium text-text-secondary">Notes</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("common.optional")}
            rows={3}
            className="bg-surface border-border resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <DateTimePickerField
            label="Due date"
            value={dueDate}
            onChange={setDueDate}
            placeholder="Select date and time"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-10"
            onClick={() => router.back()}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 h-10 bg-accent text-white"
            disabled={isLoading || !title.trim()}
          >
            {isLoading ? "..." : t("common.save")}
          </Button>
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface w-full max-w-sm rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold">{t("common.confirm_delete")}</h2>
            <p className="text-sm text-text-secondary">
              Are you sure you want to delete this task? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-10"
                onClick={() => setShowDeleteConfirm(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                className="flex-1 h-10 bg-destructive text-white hover:bg-destructive/90"
                onClick={handleDelete}
                disabled={isLoading}
              >
                {t("common.delete")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}