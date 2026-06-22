export interface TaskChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  checklist: TaskChecklistItem[];
  due_date: string | null;
  reminder_times: string[];
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskFormData {
  title: string;
  description?: string;
  checklist?: Omit<TaskChecklistItem, "id">[];
  due_date?: string;
  reminder_times?: string[];
}

export interface TaskGroup {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  completed: Task[];
}
