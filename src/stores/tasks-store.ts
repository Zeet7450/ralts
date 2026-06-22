import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { Task, TaskFormData, TaskGroup } from "@/types";
import { generateId, isOverdue, isToday, isUpcoming, startOfDay } from "@/lib/utils";

interface TasksState {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  fetchTasks: () => Promise<void>;
  addTask: (data: TaskFormData) => Promise<void>;
  updateTask: (id: string, data: Partial<Task>) => Promise<void>;
  toggleChecklistItem: (taskId: string, itemId: string) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  uncompleteTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  getGroupedTasks: () => TaskGroup;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,

  fetchTasks: async () => {
    set({ isLoading: true, error: null });
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("due_date", { ascending: true, nullsFirst: false });

    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({ tasks: data || [], isLoading: false });
    }
  },

  addTask: async (data) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("tasks").insert({
      id: generateId(),
      user_id: user.id,
      ...data,
      checklist: data.checklist?.map(item => ({
        id: generateId(),
        ...item,
      })) || [],
      reminder_times: data.reminder_times || [],
      is_completed: false,
    });

    await get().fetchTasks();
  },

  updateTask: async (id, data) => {
    const supabase = createClient();
    await supabase.from("tasks").update(data).eq("id", id);
    await get().fetchTasks();
  },

  toggleChecklistItem: async (taskId, itemId) => {
    const task = get().tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedChecklist = task.checklist.map(item =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );

    await get().updateTask(taskId, { checklist: updatedChecklist });
  },

  completeTask: async (id) => {
    await get().updateTask(id, {
      is_completed: true,
      completed_at: new Date().toISOString(),
    });
  },

  uncompleteTask: async (id) => {
    await get().updateTask(id, {
      is_completed: false,
      completed_at: null,
    });
  },

  deleteTask: async (id) => {
    const supabase = createClient();
    await supabase.from("tasks").delete().eq("id", id);
    await get().fetchTasks();
  },

  getGroupedTasks: () => {
    const activeTasks = get().tasks.filter(t => !t.is_completed);
    const completedTasks = get().tasks.filter(t => t.is_completed);

    return {
      overdue: activeTasks.filter(t => t.due_date && isOverdue(t.due_date)),
      today: activeTasks.filter(t => t.due_date && isToday(t.due_date)),
      upcoming: activeTasks.filter(t => !t.due_date || (isUpcoming(t.due_date) && !isToday(t.due_date))),
      completed: completedTasks,
    };
  },
}));
